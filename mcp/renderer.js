/**
 * Antigravity GIF Studio — Core SVG-to-GIF Rendering Engine (Remediated)
 * 
 * Uses Chromium compositor element screenshotting via Puppeteer CDP,
 * stepping Web Animations API and SMIL native timelines accurately,
 * decoding PNG frames with pngjs into raw RGBA buffers,
 * and quantizing/encoding frames into an animated GIF via gifenc.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { PNG } = require('pngjs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const { findChrome } = require('./chrome-finder.js');

// Cached browser instance with concurrency launch lock and idle timeout management
let sharedBrowser = null;
let launchPromise = null;
let idleTimer = null;

function scheduleIdleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (sharedBrowser) {
      try { await sharedBrowser.close(); } catch (e) {}
      sharedBrowser = null;
    }
  }, 8000);
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
      const browser = await puppeteer.launch({
        executablePath,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-default-browser-check'
        ]
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
 * Detects animation duration in seconds from CSS @keyframes or SMIL.
 */
function detectSvgDuration(svgText) {
  const matches = [...svgText.matchAll(/([0-9.]+)\s*s\b/gi)].map(m => parseFloat(m[1]));
  const msMatches = [...svgText.matchAll(/([0-9.]+)\s*ms\b/gi)].map(m => parseFloat(m[1]) / 1000);
  const all = matches.concat(msMatches).filter(d => d > 0);
  if (all.length > 0) {
    return Math.max(...all);
  }
  return 2.0;
}

/**
 * Sanitizes SVG code to neutralize potential XSS scripts while preserving graphic markup.
 */
function sanitizeSvg(svgText) {
  let clean = svgText;
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/\son[a-zA-Z]+\s*=\s*"[^"]*"/gi, '');
  clean = clean.replace(/\son[a-zA-Z]+\s*=\s*'[^']*'/gi, '');
  clean = clean.replace(/\son[a-zA-Z]+\s*=\s*[^\s>]+/gi, '');
  clean = clean.replace(/javascript\s*:/gi, '');
  return clean;
}

/**
 * Core function to render an SVG animation to an animated looping GIF.
 * 
 * @param {Object} options
 * @param {string} [options.svg] - Raw SVG markup or path to .svg file on disk
 * @param {string} [options.inputPath] - File path to .svg file on disk
 * @param {string} [options.outputPath] - File path where resulting GIF is saved
 * @param {number} [options.fps=15] - Target frames per second (1-60)
 * @param {number} [options.duration] - Loop duration in seconds (> 0)
 * @param {number} [options.width] - Output width in pixels
 * @param {number} [options.height] - Output height in pixels
 * @param {boolean} [options.transparent=true] - Whether background is transparent
 * @param {number} [options.maxColors=256] - Palette quantization size (2-256)
 * @param {number} [options.quality=10] - Quantization quality
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
    transparent = true,
    maxColors = 256,
    quality = 10
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

  // 2. Validate duration and FPS
  if (duration !== undefined && duration !== null) {
    if (typeof duration !== 'number' || duration <= 0 || isNaN(duration)) {
      throw new Error(`Animation duration must be a positive number. Got: ${duration}`);
    }
  } else {
    duration = detectSvgDuration(trimmed);
  }

  fps = Number(fps);
  if (isNaN(fps) || fps <= 0) {
    fps = 15;
  }
  fps = Math.max(1, Math.min(60, Math.round(fps)));

  // Clamp maxColors
  maxColors = Number(maxColors);
  if (isNaN(maxColors) || maxColors < 2) maxColors = 2;
  if (maxColors > 256) maxColors = 256;
  maxColors = Math.round(maxColors);

  // 3. Resolve dimensions
  const dims = parseSvgDimensions(trimmed);
  width = width ? Math.round(Number(width)) : dims.width;
  height = height ? Math.round(Number(height)) : dims.height;

  // Clamp dimensions within safe system limits
  width = Math.max(1, Math.min(4000, width || 400));
  height = Math.max(1, Math.min(3000, height || 400));

  // Sanitize SVG
  const sanitized = sanitizeSvg(trimmed);

  // 4. Connect to Chromium and set up rendering stage
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const bgStyle = transparent ? 'background: transparent;' : 'background: #ffffff;';
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

    const totalFrames = Math.max(1, Math.round(duration * fps));
    const delayMs = Math.round(1000 / fps);

    const gif = GIFEncoder();

    for (let i = 0; i < totalFrames; i++) {
      const tSec = i / fps;
      const tMs = tSec * 1000;

      // Advance both SMIL and Web Animations timelines natively in Chromium
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

      // Screenshot stage element directly from Chromium compositor
      const shot = await stageEl.screenshot({
        omitBackground: transparent,
        type: 'png'
      });

      // Decode PNG directly to raw RGBA buffer
      const png = PNG.sync.read(Buffer.from(shot));

      // Quantize colors using gifenc NeuQuant/Octree
      const palette = quantize(png.data, maxColors, {
        format: 'rgba4444',
        oneBitAlpha: transparent
      });

      const index = applyPalette(png.data, palette, 'rgba4444');
      const transparentIndex = transparent ? palette.findIndex(p => p[3] === 0) : -1;

      gif.writeFrame(index, width, height, {
        palette,
        delay: delayMs,
        transparent: transparent && transparentIndex >= 0,
        transparentIndex: Math.max(0, transparentIndex),
        dispose: 2
      });
    }

    gif.finish();
    const gifBuffer = Buffer.from(gif.bytes());

    const result = {
      success: true,
      frameCount: totalFrames,
      fileSizeBytes: gifBuffer.length,
      width,
      height
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
    await page.close();
  }
}

module.exports = {
  renderSvgToGif,
  parseSvgDimensions,
  detectSvgDuration,
  sanitizeSvg,
  getBrowser
};
