/**
 * Antigravity GIF Studio — Generative UI Preview Widget Generator
 * 
 * Produces a self-contained single-file HTML artifact embedding the SVG,
 * interactive playback controls, timeline scrubber, 0.25x-3x speed slider,
 * background mode switcher, and inlined gifenc for instant offline client-side re-encoding.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sanitizeSvg } = require('./renderer.js');

/**
 * Generates a self-contained Generative UI preview widget.
 * 
 * @param {Object} options
 * @param {string} [options.svg] - SVG markup to embed
 * @param {string} [options.inputPath] - File path to .svg file
 * @param {number} [options.duration] - Loop duration in seconds
 * @param {number} [options.fps=20] - Default playback / re-encoding FPS
 * @param {string} [options.title='Antigravity GIF Studio Preview'] - Display title
 * @param {string} [options.outputPath] - File path to save standalone HTML
 * @returns {Promise<Object>} Object containing html string and optional outputPath
 */
async function generatePreviewWidget(options = {}) {
  let {
    svg,
    inputPath,
    duration,
    fps = 20,
    title = 'Antigravity GIF Studio Preview',
    outputPath
  } = options;

  if (inputPath) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`SVG file not found at path: ${inputPath}`);
    }
    svg = fs.readFileSync(inputPath, 'utf8');
  }

  // Support file path passed directly to 'svg' parameter
  if (typeof svg === 'string' && fs.existsSync(svg) && fs.statSync(svg).isFile()) {
    svg = fs.readFileSync(svg, 'utf8');
  }

  if (typeof svg !== 'string' || !svg.trim()) {
    throw new Error('SVG content is required to generate preview widget.');
  }

  const trimmedSvg = svg.trim();

  // Detect loop duration if not provided
  if (!duration || duration <= 0) {
    const secMatches = [...trimmedSvg.matchAll(/([0-9.]+)\s*s\b/gi)].map(m => parseFloat(m[1]));
    const msMatches = [...trimmedSvg.matchAll(/([0-9.]+)\s*ms\b/gi)].map(m => parseFloat(m[1]) / 1000);
    const all = secMatches.concat(msMatches).filter(d => d > 0);
    duration = all.length > 0 ? Math.max(...all) : 2.0;
  }

  fps = Number(fps) || 20;

  // Read minified gifenc bundle to inline directly for 100% offline self-containment
  const gifencBundlePath = path.resolve(__dirname, '..', 'node_modules', 'gifenc', 'dist', 'gifenc.js');
  let gifencSource = '';
  if (fs.existsSync(gifencBundlePath)) {
    gifencSource = fs.readFileSync(gifencBundlePath, 'utf8');
  }

  let inlinedSvg = sanitizeSvg(trimmedSvg)
    .replace(/\s*xmlns="https?:\/\/www\.w3\.org\/2000\/svg"/gi, '')
    .replace(/\s*xmlns:xlink="https?:\/\/www\.w3\.org\/1999\/xlink"/gi, '');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg-dark: #0a0b10;
      --card-bg: #12141c;
      --card-border: #232736;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-cyan: #06b6d4;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-sub: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem;
    }
    .container {
      width: 100%;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--card-border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      fill: none;
      stroke: var(--accent-cyan);
      stroke-width: 2;
    }
    .brand-title {
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #fff 30%, var(--accent-cyan));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .stage-wrapper {
      position: relative;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
    .stage-toolbar {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 6px;
      z-index: 10;
    }
    .tool-btn {
      background: rgba(18, 20, 28, 0.85);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.75rem;
      cursor: pointer;
      backdrop-filter: blur(8px);
      transition: all 0.15s ease;
    }
    .tool-btn:hover, .tool-btn.active {
      color: #fff;
      border-color: var(--accent);
      background: rgba(99, 102, 241, 0.25);
    }
    .stage-viewport {
      min-height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 2rem;
    }
    .bg-checker {
      background-image: linear-gradient(45deg, #181a24 25%, transparent 25%),
                        linear-gradient(-45deg, #181a24 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #181a24 75%),
                        linear-gradient(-45deg, transparent 75%, #181a24 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      background-color: #10121a;
    }
    .bg-dark { background-color: #0b0c10; }
    .bg-light { background-color: #ffffff; }

    #svg-stage {
      max-width: 100%;
      max-height: 480px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #svg-stage svg {
      width: 100%;
      height: 100%;
      max-height: 460px;
      display: block;
    }
    .controls {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .scrubber-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .timeline-slider {
      flex: 1;
      -webkit-appearance: none;
      height: 6px;
      background: #2a2e3f;
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }
    .timeline-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent-cyan);
      box-shadow: 0 0 10px var(--accent-cyan);
      cursor: pointer;
    }
    .time-display {
      font-variant-numeric: tabular-nums;
      font-size: 0.85rem;
      color: var(--text-muted);
      min-width: 110px;
      text-align: right;
    }
    .control-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn {
      background: #1e2230;
      color: var(--text-main);
      border: 1px solid var(--card-border);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: #272c3e;
      border-color: #3b4259;
    }
    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
    .speed-pills {
      display: flex;
      background: #181b26;
      padding: 2px;
      border-radius: 8px;
      border: 1px solid var(--card-border);
    }
    .speed-pill {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 4px 8px;
      font-size: 0.75rem;
      border-radius: 6px;
      cursor: pointer;
    }
    .speed-pill.active {
      background: var(--accent);
      color: #fff;
    }
    .export-bar {
      border-top: 1px solid var(--card-border);
      padding-top: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .select-label {
      font-size: 0.8rem;
      color: var(--text-sub);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    select {
      background: #1a1d29;
      color: var(--text-main);
      border: 1px solid var(--card-border);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
    }
    .encode-progress-wrap {
      display: none;
      flex-direction: column;
      gap: 4px;
      width: 100%;
    }
    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: #1e2230;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent), var(--accent-cyan));
      transition: width 0.1s ease;
    }
    .progress-text {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="brand">
        <svg class="brand-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"/>
          <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
        </svg>
        <span class="brand-title">${escapeHtml(title)}</span>
      </div>
      <div class="badge" id="info-badge">Loop Duration: ${duration.toFixed(2)}s</div>
    </header>

    <div class="stage-wrapper">
      <div class="stage-toolbar">
        <button class="tool-btn active" id="btn-bg-checker" title="Checkerboard (Transparent)">Checker</button>
        <button class="tool-btn" id="btn-bg-dark" title="Dark Background">Dark</button>
        <button class="tool-btn" id="btn-bg-light" title="Light Background">Light</button>
      </div>

      <div class="stage-viewport bg-checker" id="stage-viewport">
        <div id="svg-stage">
          ${inlinedSvg}
        </div>
      </div>
    </div>

    <div class="controls">
      <div class="scrubber-row">
        <button class="btn btn-primary" id="btn-play-pause">
          <span id="play-icon">⏸</span>
        </button>
        <input type="range" class="timeline-slider" id="scrubber" min="0" max="${duration}" step="0.01" value="0">
        <div class="time-display" id="time-display">0.00s / ${duration.toFixed(2)}s</div>
      </div>

      <div class="control-row">
        <div class="btn-group">
          <span class="select-label">Speed:</span>
          <div class="speed-pills">
            <button class="speed-pill" data-speed="0.25">0.25x</button>
            <button class="speed-pill" data-speed="0.5">0.5x</button>
            <button class="speed-pill active" data-speed="1.0">1.0x</button>
            <button class="speed-pill" data-speed="1.5">1.5x</button>
            <button class="speed-pill" data-speed="2.0">2.0x</button>
            <button class="speed-pill" data-speed="3.0">3.0x</button>
          </div>
        </div>

        <div class="btn-group">
          <button class="btn" id="btn-copy-svg">📋 Copy SVG</button>
          <button class="btn" id="btn-download-svg">💾 Save SVG</button>
        </div>
      </div>

      <div class="export-bar">
        <div class="btn-group">
          <label class="select-label">
            FPS:
            <select id="fps-select">
              <option value="10">10 fps</option>
              <option value="15">15 fps</option>
              <option value="20" ${fps === 20 ? 'selected' : ''}>20 fps</option>
              <option value="24" ${fps === 24 ? 'selected' : ''}>24 fps</option>
              <option value="30" ${fps === 30 ? 'selected' : ''}>30 fps</option>
              <option value="60">60 fps</option>
            </select>
          </label>
        </div>

        <button class="btn btn-primary" id="btn-reencode-gif">
          🎬 Re-encode & Download GIF
        </button>
      </div>

      <div class="encode-progress-wrap" id="progress-wrap">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="progress-fill"></div>
        </div>
        <div class="progress-text">
          <span id="progress-label">Rendering frames...</span>
          <span id="progress-pct">0%</span>
        </div>
      </div>
    </div>
  </div>

  <!-- INLINED ZERO-DEPENDENCY GIFENC BUNDLE -->
  <script>
    var exports = {};
    var module = { exports };
    ${gifencSource}
    window.gifenc = exports.GIFEncoder ? exports : (module.exports || {});
  </script>

  <!-- WIDGET CLIENT-SIDE CONTROLLER -->
  <script>
    (function() {
      let duration = ${duration};
      let isPlaying = true;
      let playbackSpeed = 1.0;
      let currentBgMode = 'checker';
      let animFrameId = null;
      let startTime = performance.now();
      let pauseOffset = 0;

      const stage = document.getElementById('svg-stage');
      const scrubber = document.getElementById('scrubber');
      const timeDisplay = document.getElementById('time-display');
      const playBtn = document.getElementById('btn-play-pause');
      const playIcon = document.getElementById('play-icon');
      const viewport = document.getElementById('stage-viewport');
      const fpsSelect = document.getElementById('fps-select');
      const reencodeBtn = document.getElementById('btn-reencode-gif');
      const progressWrap = document.getElementById('progress-wrap');
      const progressFill = document.getElementById('progress-fill');
      const progressLabel = document.getElementById('progress-label');
      const progressPct = document.getElementById('progress-pct');

      // Background mode toggles
      document.getElementById('btn-bg-checker').onclick = () => setBg('checker');
      document.getElementById('btn-bg-dark').onclick = () => setBg('dark');
      document.getElementById('btn-bg-light').onclick = () => setBg('light');

      function setBg(mode) {
        currentBgMode = mode;
        viewport.className = 'stage-viewport bg-' + mode;
        document.querySelectorAll('.stage-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('btn-bg-' + mode).classList.add('active');
      }

      playBtn.onclick = togglePlay;
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
          e.preventDefault();
          togglePlay();
        }
      });

      function togglePlay() {
        isPlaying = !isPlaying;
        playIcon.textContent = isPlaying ? '⏸' : '▶';
        const svgEl = stage.querySelector('svg');
        if (!svgEl) return;

        const anims = svgEl.getAnimations ? svgEl.getAnimations({ subtree: true }) : [];
        if (isPlaying) {
          startTime = performance.now() - (pauseOffset / playbackSpeed) * 1000;
          anims.forEach(a => { a.playbackRate = playbackSpeed; a.play(); });
          if (svgEl.unpauseAnimations) svgEl.unpauseAnimations();
          loop();
        } else {
          pauseOffset = parseFloat(scrubber.value);
          anims.forEach(a => a.pause());
          if (svgEl.pauseAnimations) svgEl.pauseAnimations();
          cancelAnimationFrame(animFrameId);
        }
      }

      scrubber.oninput = () => {
        if (isPlaying) togglePlay();
        const t = parseFloat(scrubber.value);
        pauseOffset = t;
        applyScrubTime(t);
        updateTimeText(t);
      };

      function applyScrubTime(t) {
        const svgEl = stage.querySelector('svg');
        if (!svgEl) return;
        if (svgEl.setCurrentTime) {
          try { svgEl.setCurrentTime(t); } catch(e) {}
        }
        const anims = svgEl.getAnimations ? svgEl.getAnimations({ subtree: true }) : [];
        anims.forEach(anim => {
          anim.pause();
          const dur = anim.effect?.getComputedTiming()?.duration || 1000;
          anim.currentTime = (t * 1000) % dur;
        });
      }

      function updateTimeText(t) {
        timeDisplay.textContent = t.toFixed(2) + 's / ' + duration.toFixed(2) + 's';
      }

      function loop() {
        if (!isPlaying) return;
        const elapsed = ((performance.now() - startTime) / 1000) * playbackSpeed;
        const currentT = elapsed % duration;
        scrubber.value = currentT;
        updateTimeText(currentT);
        animFrameId = requestAnimationFrame(loop);
      }

      document.querySelectorAll('.speed-pill').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.speed-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          playbackSpeed = parseFloat(btn.dataset.speed);
          const svgEl = stage.querySelector('svg');
          if (svgEl && svgEl.getAnimations) {
            svgEl.getAnimations({ subtree: true }).forEach(a => a.playbackRate = playbackSpeed);
          }
          if (isPlaying) {
            startTime = performance.now() - (parseFloat(scrubber.value) / playbackSpeed) * 1000;
          }
        };
      });

      document.getElementById('btn-copy-svg').onclick = () => {
        const svgCode = stage.innerHTML;
        navigator.clipboard.writeText(svgCode).then(() => alert('SVG markup copied to clipboard!'));
      };

      document.getElementById('btn-download-svg').onclick = () => {
        const blob = new Blob([stage.innerHTML], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'antigravity-studio-export.svg';
        a.click();
        URL.revokeObjectURL(url);
      };

      reencodeBtn.onclick = async () => {
        const svgEl = stage.querySelector('svg');
        if (!svgEl) return;
        const fps = parseInt(fpsSelect.value, 10);
        const totalFrames = Math.max(1, Math.round(duration * fps));
        const frameDelayMs = Math.round(1000 / fps);

        const viewBox = svgEl.viewBox?.baseVal || { width: 400, height: 400 };
        const width = Math.round(viewBox.width || 400);
        const height = Math.round(viewBox.height || 400);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        progressWrap.style.display = 'flex';
        reencodeBtn.disabled = true;

        const { GIFEncoder, quantize, applyPalette } = window.gifenc;
        const gif = GIFEncoder();

        const allEls = svgEl.querySelectorAll('*');
        allEls.forEach((el, idx) => el.setAttribute('data-bake-id', idx));

        for (let i = 0; i < totalFrames; i++) {
          const tSec = i / fps;
          const tMs = tSec * 1000;
          progressLabel.textContent = 'Rendering frame ' + (i + 1) + ' / ' + totalFrames + '...';
          const pct = Math.round(((i + 1) / totalFrames) * 100);
          progressFill.style.width = pct + '%';
          progressPct.textContent = pct + '%';

          if (svgEl.setCurrentTime) {
            try { svgEl.setCurrentTime(tSec); } catch (e) {}
          }
          const anims = svgEl.getAnimations ? svgEl.getAnimations({ subtree: true }) : [];
          anims.forEach(a => { a.pause(); a.currentTime = tMs; });

          const clone = svgEl.cloneNode(true);
          clone.querySelectorAll('animate, animateTransform, set, animateMotion').forEach(el => el.remove());
          const cloneEls = clone.querySelectorAll('[data-bake-id]');
          cloneEls.forEach(cloneEl => {
            const id = cloneEl.getAttribute('data-bake-id');
            const origEl = svgEl.querySelector('[data-bake-id="' + id + '"]');
            if (origEl) {
              const comp = window.getComputedStyle(origEl);
              cloneEl.style.transform = comp.transform;
              cloneEl.style.transformOrigin = comp.transformOrigin;
              cloneEl.style.opacity = comp.opacity;
              cloneEl.style.animation = 'none';
            }
            cloneEl.removeAttribute('data-bake-id');
          });

          const xml = new XMLSerializer().serializeToString(clone);
          const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const img = new Image();

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
          URL.revokeObjectURL(url);

          ctx.clearRect(0, 0, width, height);
          if (currentBgMode === 'dark') {
            ctx.fillStyle = '#0b0c10';
            ctx.fillRect(0, 0, width, height);
          } else if (currentBgMode === 'light') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);

          const imgData = ctx.getImageData(0, 0, width, height);
          const palette = quantize(imgData.data, 256, { format: 'rgba4444', oneBitAlpha: currentBgMode === 'checker' });
          const index = applyPalette(imgData.data, palette, 'rgba4444');
          const transparentIndex = currentBgMode === 'checker' ? palette.findIndex(p => p[3] === 0) : -1;

          gif.writeFrame(index, width, height, {
            palette,
            delay: frameDelayMs,
            transparent: transparentIndex >= 0,
            transparentIndex: Math.max(0, transparentIndex),
            dispose: 2
          });

          await new Promise(r => setTimeout(r, 0));
        }

        gif.finish();
        const gifBlob = new Blob([gif.bytes()], { type: 'image/gif' });
        const gifUrl = URL.createObjectURL(gifBlob);

        const a = document.createElement('a');
        a.href = gifUrl;
        a.download = 'antigravity-studio-export.gif';
        a.click();

        progressLabel.textContent = 'Complete!';
        setTimeout(() => {
          progressWrap.style.display = 'none';
          reencodeBtn.disabled = false;
        }, 1500);
      };

      loop();
    })();
  </script>
</body>
</html>`;

  const result = {
    html
  };

  if (outputPath) {
    const resolvedPath = path.resolve(outputPath);
    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, html, 'utf8');
    result.outputPath = resolvedPath;
  }

  return result;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  generatePreviewWidget
};
