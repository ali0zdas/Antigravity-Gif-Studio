/**
 * Antigravity GIF Studio — Core SVG-to-GIF Rendering Engine (High-Fidelity)
 * 
 * Uses Chromium compositor element screenshotting via Puppeteer CDP,
 * stepping Web Animations API and SMIL native timelines accurately,
 * decoding PNG frames with pngjs into raw RGBA buffers,
 * quantizing/encoding frames into an animated GIF via gifenc,
 * enforcing zero network requests, hybrid color fidelity (rgb565 / rgba4444),
 * and performing automated seam discontinuity validation.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { PNG } = require('pngjs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const { findChrome } = require('./chrome-finder.js');

// Cached browser instance with launch lock and idle management
let sharedBrowser = null;
let launchPromise = null;
let idleTimer = null;
let activeRenders = 0;

function scheduleIdleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  if (activeRenders > 0) return;
  idleTimer = setTimeout(async () => {
    if (sharedBrowser && activeRenders === 0) {
      try { await sharedBrowser.close(); } catch (e) {}
      sharedBrowser = null;
    }
  }, 60000); // 60s idle timeout when no renders are active
  if (idleTimer.unref) idleTimer.unref();
}

async function getBrowser() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (sharedBrowser && sharedBrowser.connected) {
    scheduleIdleClose();
    return sharedBrowser;
  }
  if (launchPromise) {
    return launchPromise;
  }

  launchPromise = (async () => {
    try {
      const executablePath = findChrome();
      const launchArgs = [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-sync'
      ];

      // Only add --no-sandbox if running under root on Linux/Docker
      if (process.platform === 'linux' && process.getuid && process.getuid() === 0) {
        launchArgs.push('--no-sandbox', '--disable-setuid-sandbox');
      }

      const browser = await puppeteer.launch({
        executablePath,
        headless: 'new',
        args: launchArgs
      });
      sharedBrowser = browser;
      return browser;
    } finally {
      launchPromise = null;
    }
  })();

  const browser = await launchPromise;
  scheduleIdleClose();
  return browser;
}

// Clean up browser on process termination
process.on('exit', () => {
  if (sharedBrowser) {
    try { sharedBrowser.process()?.kill(); } catch (e) {}
  }
});

/**
 * Extracts width and height from SVG string attributes or viewBox.
 */
function parseSvgDimensions(svgText) {
  let width = 400;
  let height = 400;
  let hasDims = false;

  const viewBoxMatch = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      width = Math.round(parts[2]);
      height = Math.round(parts[3]);
      hasDims = true;
    }
  }

  const widthMatch = svgText.match(/<svg[^>]*\bwidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = svgText.match(/<svg[^>]*\bheight\s*=\s*["']([^"']+)["']/i);

  if (widthMatch && !widthMatch[1].includes('%')) {
    const val = parseFloat(widthMatch[1]);
    if (val > 0) {
      width = Math.round(val);
      hasDims = true;
    }
  }
  if (heightMatch && !heightMatch[1].includes('%')) {
    const val = parseFloat(heightMatch[1]);
    if (val > 0) {
      height = Math.round(val);
      hasDims = true;
    }
  }

  return { width, height, hasDims };
}

/**
 * Fast heuristic detection of SVG duration from text.
 * Prioritizes explicit animation/SMIL duration attributes before generic time tokens.
 */
function detectSvgDuration(svgText) {
  const targeted = [
    ...[...svgText.matchAll(/\bdur\s*=\s*["']\s*([0-9.]+)\s*(ms|s)\s*["']/gi)],
    ...[...svgText.matchAll(/animation(?:-duration)?\s*:[^;{}]*?\b([0-9.]+)\s*(ms|s)\b/gi)]
  ].map(m => (m[2].toLowerCase() === 'ms' ? parseFloat(m[1]) / 1000 : parseFloat(m[1])))
   .filter(d => d > 0);

  if (targeted.length > 0) {
    return Math.max(...targeted);
  }

  const matches = [...svgText.matchAll(/([0-9.]+)\s*s\b/gi)].map(m => parseFloat(m[1]));
  const msMatches = [...svgText.matchAll(/([0-9.]+)\s*ms\b/gi)].map(m => parseFloat(m[1]) / 1000);
  const all = matches.concat(msMatches).filter(d => d > 0);
  if (all.length > 0) {
    return Math.max(...all);
  }
  return 2.0;
}

/**
 * Sanitizes SVG code to neutralize potential XSS scripts, foreignObjects,
 * embedded active tags, inline event handlers, and external network fetches.
 */
function sanitizeSvg(svgText) {
  let clean = svgText;
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '');
  clean = clean.replace(/<(iframe|object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  clean = clean.replace(/<(iframe|object|embed)\b[^>]*\/?>/gi, '');
  clean = clean.replace(/\son[a-zA-Z]+\s*=\s*"[^"]*"/gi, '');
  clean = clean.replace(/\son[a-zA-Z]+\s*=\s*'[^']*'/gi, '');
  clean = clean.replace(/\son[a-zA-Z]+\s*=\s*[^\s>]+/gi, '');
  clean = clean.replace(/javascript\s*:/gi, '');
  clean = clean.replace(/data\s*:\s*text\/html/gi, 'data:text/plain');
  clean = clean.replace(/\b(xlink:)?href\s*=\s*(["'])\s*https?:\/\/[^"']*\2/gi, '$1href=$2#$2');
  clean = clean.replace(/@import\s+[^;]+;/gi, '');
  return clean;
}

/**
 * Core function to render an SVG animation to an animated looping GIF.
 * 
 * @param {Object} options
 * @param {string} [options.svg] - Raw SVG markup or path to .svg file on disk
 * @param {string} [options.inputPath] - File path to .svg file on disk
 * @param {string} [options.outputPath] - File path where resulting GIF is saved
 * @param {number} [options.fps=20] - Target frames per second (1-60)
 * @param {number} [options.duration] - Loop duration in seconds (> 0)
 * @param {number} [options.width] - Output width in pixels
 * @param {number} [options.height] - Output height in pixels
 * @param {boolean} [options.transparent=false] - Whether background is transparent
 * @param {number} [options.maxColors=256] - Palette quantization size (2-256)
 * @returns {Promise<Object>} Render result metadata
 */
async function renderSvgToGif(options = {}) {
  let {
    svg,
    inputPath,
    outputPath,
    fps = 15,
    duration,
    width,
    height,
    transparent = false,
    maxColors = 256
  } = options;

  // 1. Resolve and validate SVG source (markup or file path)
  if (inputPath) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input SVG file not found at path: ${inputPath}`);
    }
    svg = fs.readFileSync(inputPath, 'utf8');
  }

  if (typeof svg === 'string' && fs.existsSync(svg) && fs.statSync(svg).isFile()) {
    svg = fs.readFileSync(svg, 'utf8');
  }

  if (typeof svg !== 'string' || !svg.trim()) {
    throw new Error('SVG input code is required and cannot be empty.');
  }

  const trimmed = svg.trim();
  if (!/<svg[\s>]/i.test(trimmed)) {
    throw new Error('Input must be a valid SVG document containing an <svg> root element.');
  }

  // 2. Validate FPS and Colors
  fps = Number(fps);
  if (isNaN(fps) || fps <= 0) {
    fps = 15;
  }
  fps = Math.max(1, Math.min(60, Math.round(fps)));

  maxColors = Number(maxColors);
  if (isNaN(maxColors) || maxColors < 2) maxColors = 2;
  if (maxColors > 256) maxColors = 256;
  maxColors = Math.round(maxColors);

  // 3. Resolve dimensions
  const dims = parseSvgDimensions(trimmed);
  width = width ? Math.round(Number(width)) : dims.width;
  height = height ? Math.round(Number(height)) : dims.height;

  width = Math.max(1, Math.min(4000, width || 400));
  height = Math.max(1, Math.min(3000, height || 400));

  // Sanitize SVG
  const sanitized = sanitizeSvg(trimmed);

  // 4. Connect to Chromium with network interception (strict zero-network policy)
  activeRenders++;
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setRequestInterception(true);
    page.on('request', req => req.abort());

    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const bgStyle = transparent ? 'background: transparent;' : 'background: #000000;';

    await page.setContent(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    ${bgStyle}
  }
  #stage {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  #stage > svg {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
  }
</style>
</head>
<body>
  <div id="stage">${sanitized}</div>
</body>
</html>`);

    const stageEl = await page.$('#stage');
    if (!stageEl) {
      throw new Error('Failed to locate rendering stage element inside Chromium.');
    }

    // 5. Accurate in-browser duration determination via Web Animations API
    if (duration !== undefined && duration !== null) {
      duration = Number(duration);
      if (isNaN(duration) || duration <= 0) {
        throw new Error(`Animation duration must be a positive number. Got: ${duration}`);
      }
    } else {
      const computedDuration = await page.evaluate(() => {
        const anims = document.getAnimations({ subtree: true });
        if (!anims || anims.length === 0) return 0;
        let maxTime = 0;
        anims.forEach(a => {
          const t = a.effect ? a.effect.getComputedTiming() : null;
          if (t && t.duration) {
            let durSec = Number(t.duration) / 1000;
            const dir = t.direction || 'normal';
            // If alternate direction is used, full cycle is 2x duration
            if (dir === 'alternate' || dir === 'alternate-reverse') {
              durSec = durSec * 2;
            }
            if (durSec > maxTime) maxTime = durSec;
          }
        });
        return maxTime;
      });

      duration = computedDuration > 0 ? computedDuration : detectSvgDuration(trimmed);
    }

    const totalFrames = Math.max(1, Math.round(duration * fps));
    const maxFrames = Math.max(1, Number(process.env.GIF_STUDIO_MAX_FRAMES) || 600);
    if (totalFrames > maxFrames) {
      throw new Error(`Requested animation exceeds maximum frame limit (${totalFrames} > ${maxFrames}). Reduce duration or FPS.`);
    }
    const delayMs = Math.round(1000 / fps);

    const gif = GIFEncoder();
    const quantFormat = transparent ? 'rgba4444' : 'rgb565';
    let firstFramePngData = null;
    const capturedPngs = [];

    for (let i = 0; i < totalFrames; i++) {
      const tSec = i / fps;
      const tMs = tSec * 1000;

      // Advance DOM animations synchronously
      await page.evaluate((sec, ms) => {
        const el = document.querySelector('#stage > svg') || document.querySelector('#stage svg');
        if (el && el.setCurrentTime) {
          try { el.setCurrentTime(sec); } catch (e) {}
        }
        const anims = document.getAnimations({ subtree: true });
        anims.forEach(a => {
          a.pause();
          a.currentTime = ms;
        });
      }, tSec, tMs);

      const shot = await stageEl.screenshot({
        omitBackground: transparent,
        type: 'png'
      });

      const png = PNG.sync.read(Buffer.from(shot));
      if (i === 0) {
        firstFramePngData = Buffer.from(png.data);
      }
      capturedPngs.push(png);
    }

    // Build unified global palette across multi-frame temporal samples to eliminate jitter/flicker
    const sampleStep = Math.max(1, Math.floor(capturedPngs.length / 10));
    const sampleFrames = [];
    for (let i = 0; i < capturedPngs.length; i += sampleStep) {
      sampleFrames.push(capturedPngs[i]);
    }
    const samplePixelLimit = 250000;
    const pixelsPerFrame = Math.max(100, Math.floor(samplePixelLimit / sampleFrames.length));
    const combinedSamples = new Uint8Array(sampleFrames.length * pixelsPerFrame * 4);
    let sampleOffset = 0;

    for (const frame of sampleFrames) {
      const totalPixels = width * height;
      const stride = Math.max(1, Math.floor(totalPixels / pixelsPerFrame));
      for (let p = 0; p < totalPixels && sampleOffset + 4 <= combinedSamples.length; p += stride) {
        const srcIdx = p * 4;
        combinedSamples[sampleOffset++] = frame.data[srcIdx];
        combinedSamples[sampleOffset++] = frame.data[srcIdx + 1];
        combinedSamples[sampleOffset++] = frame.data[srcIdx + 2];
        combinedSamples[sampleOffset++] = frame.data[srcIdx + 3];
      }
    }

    const globalPalette = quantize(combinedSamples.subarray(0, sampleOffset), maxColors, {
      format: quantFormat,
      oneBitAlpha: transparent
    });
    const transparentIndex = transparent ? globalPalette.findIndex(p => p[3] === 0) : -1;

    for (let i = 0; i < capturedPngs.length; i++) {
      const index = applyPalette(capturedPngs[i].data, globalPalette, quantFormat);
      gif.writeFrame(index, width, height, {
        palette: i === 0 ? globalPalette : null,
        delay: delayMs,
        transparent: transparent && transparentIndex >= 0,
        transparentIndex: Math.max(0, transparentIndex),
        dispose: transparent ? 2 : 1
      });
    }

    gif.finish();
    const gifBuffer = Buffer.from(gif.bytes());

    // 6. Automated Seam Discontinuity Check (Frame at t=0 vs Frame at t=duration)
    await page.evaluate((sec, ms) => {
      const el = document.querySelector('#stage > svg') || document.querySelector('#stage svg');
      if (el && el.setCurrentTime) {
        try { el.setCurrentTime(sec); } catch (e) {}
      }
      const anims = document.getAnimations({ subtree: true });
      anims.forEach(a => {
        a.pause();
        a.currentTime = ms;
      });
    }, duration, duration * 1000);

    const seamShot = await stageEl.screenshot({
      omitBackground: transparent,
      type: 'png'
    });
    const seamPng = PNG.sync.read(Buffer.from(seamShot));

    let seamDiffCount = 0;
    const totalPixels = width * height;
    if (firstFramePngData) {
      for (let p = 0; p < firstFramePngData.length; p += 4) {
        const dr = Math.abs(firstFramePngData[p] - seamPng.data[p]);
        const dg = Math.abs(firstFramePngData[p + 1] - seamPng.data[p + 1]);
        const db = Math.abs(firstFramePngData[p + 2] - seamPng.data[p + 2]);
        const da = Math.abs(firstFramePngData[p + 3] - seamPng.data[p + 3]);
        if (dr + dg + db + da > 24) {
          seamDiffCount++;
        }
      }
    }

    const seamErrorPercentage = Number(((seamDiffCount / totalPixels) * 100).toFixed(2));
    const isSeamless = seamErrorPercentage <= 2.5;

    const result = {
      success: true,
      frameCount: totalFrames,
      durationSeconds: Number(duration.toFixed(3)),
      fps,
      width,
      height,
      fileSizeBytes: gifBuffer.length,
      seamErrorPercentage,
      isSeamless,
      quantizationFormat: quantFormat
    };

    if (outputPath) {
      const resolvedOutput = path.resolve(outputPath);
      const parentDir = path.dirname(resolvedOutput);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(resolvedOutput, gifBuffer);
      result.outputPath = resolvedOutput;
    } else {
      result.gifBase64 = gifBuffer.toString('base64');
    }

    return result;
  } finally {
    activeRenders = Math.max(0, activeRenders - 1);
    scheduleIdleClose();
    try { await page.close(); } catch (e) {}
  }
}

module.exports = {
  renderSvgToGif,
  parseSvgDimensions,
  detectSvgDuration,
  sanitizeSvg,
  getBrowser
};
