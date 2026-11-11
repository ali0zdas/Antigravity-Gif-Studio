/**
 * Antigravity GIF Studio — Generative UI Preview Widget Generator
 * 
 * Produces a self-contained single-file HTML artifact embedding the SVG,
 * interactive playback controls, timeline scrubber, 0.25x-3x speed slider,
 * background mode switcher, and inlined gifenc for instant offline client-side re-encoding.
 * Optimized for token economy and clean iframe rendering in Antigravity.
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
 * @returns {Promise<Object>} Object containing metadata and optional html string
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
      --card-bg: var(--card, #12141c);
      --card-border: var(--border, #232736);
      --accent: var(--primary, #6366f1);
      --accent-hover: #4f46e5;
      --accent-cyan: #06b6d4;
      --text-main: var(--foreground, #f1f5f9);
      --text-muted: var(--muted-foreground, #94a3b8);
      --text-sub: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: transparent;
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.75rem;
    }
    .container {
      width: 100%;
      max-width: 820px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--card-border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .brand-icon {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: var(--accent-cyan);
      stroke-width: 2;
    }
    .brand-title {
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text-main);
    }
    .badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .stage-wrapper {
      position: relative;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .stage-toolbar {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      z-index: 10;
    }
    .tool-btn {
      background: rgba(18, 20, 28, 0.85);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      border-radius: 5px;
      padding: 4px 8px;
      font-size: 0.7rem;
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
      min-height: 260px;
      max-height: 380px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 1rem;
    }
    .bg-checker {
      background-image: linear-gradient(45deg, #181a24 25%, transparent 25%),
                        linear-gradient(-45deg, #181a24 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #181a24 75%),
                        linear-gradient(-45deg, transparent 75%, #181a24 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      background-color: #10121a;
    }
    .bg-dark { background-color: #0b0c10; }
    .bg-light { background-color: #ffffff; }

    #svg-stage {
      max-width: 100%;
      max-height: 360px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #svg-stage svg {
      width: 100%;
      height: 100%;
      max-height: 340px;
      display: block;
    }
    .controls {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .scrubber-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .timeline-slider {
      flex: 1;
      -webkit-appearance: none;
      height: 5px;
      background: #2a2e3f;
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }
    .timeline-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent-cyan);
      box-shadow: 0 0 8px var(--accent-cyan);
      cursor: pointer;
    }
    .time-display {
      font-variant-numeric: tabular-nums;
      font-size: 0.75rem;
      color: var(--text-muted);
      min-width: 95px;
      text-align: right;
    }
    .control-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .btn {
      background: #1e2230;
      color: var(--text-main);
      border: 1px solid var(--card-border);
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
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
      border-radius: 6px;
      border: 1px solid var(--card-border);
    }
    .speed-pill {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 3px 6px;
      font-size: 0.7rem;
      border-radius: 4px;
      cursor: pointer;
    }
    .speed-pill.active {
      background: var(--accent);
      color: #fff;
    }
    .export-bar {
      border-top: 1px solid var(--card-border);
      padding-top: 0.6rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .select-label {
      font-size: 0.75rem;
      color: var(--text-sub);
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    select {
      background: #1a1d29;
      color: var(--text-main);
      border: 1px solid var(--card-border);
      padding: 3px 6px;
      border-radius: 5px;
      font-size: 0.75rem;
    }
    .encode-progress-wrap {
      display: none;
      flex-direction: column;
      gap: 3px;
      width: 100%;
    }
    .progress-bar-bg {
      width: 100%;
      height: 5px;
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
      font-size: 0.7rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }

    /* Interactive Export & Save Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(8, 10, 16, 0.82);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal-box {
      background: #141722;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      padding: 1.25rem;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      animation: modalFadeIn 0.2s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 0.5rem;
    }
    .modal-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .modal-close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.3rem;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .modal-close-btn:hover {
      color: #fff;
      background: rgba(255,255,255,0.08);
    }
    .modal-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .modal-label {
      font-size: 0.75rem;
      color: var(--text-sub);
      font-weight: 500;
    }
    .modal-input {
      background: #1a1d29;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 0.85rem;
      width: 100%;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .modal-input:focus {
      border-color: var(--accent);
    }
    .param-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed var(--card-border);
      padding: 0.45rem;
      border-radius: 6px;
    }
    .param-pill {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .modal-preview-box {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #090b12;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 0.85rem;
      gap: 0.75rem;
    }
    .saved-success-banner {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.35);
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      width: 100%;
    }
    .saved-icon {
      font-size: 1.5rem;
      line-height: 1;
    }
    .saved-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      overflow: hidden;
      width: 100%;
    }
    .saved-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #4ade80;
    }
    .saved-path {
      font-size: 0.7rem;
      color: #cbd5e1;
      font-family: monospace;
      word-break: break-all;
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .drag-hint-banner {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      width: 100%;
    }
    .drag-icon-wrap {
      font-size: 1.6rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulseDrag 1.8s ease-in-out infinite;
    }
    @keyframes pulseDrag {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    .drag-hint-text {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .drag-hint-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #818cf8;
    }
    .drag-hint-desc {
      font-size: 0.72rem;
      color: var(--text-muted);
      line-height: 1.35;
    }
    .modal-preview-img-wrap {
      position: relative;
      cursor: grab;
      border: 2px dashed rgba(99, 102, 241, 0.45);
      border-radius: 8px;
      padding: 6px;
      background: #06080e;
      transition: all 0.2s ease;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
    }
    .modal-preview-img-wrap:hover {
      border-color: var(--accent);
      background: rgba(99, 102, 241, 0.05);
      box-shadow: 0 0 14px rgba(99, 102, 241, 0.3);
    }
    .modal-preview-img-wrap:active {
      cursor: grabbing;
    }
    .drag-badge {
      position: absolute;
      bottom: 10px;
      right: 10px;
      background: rgba(18, 20, 28, 0.9);
      backdrop-filter: blur(4px);
      border: 1px solid var(--card-border);
      color: #f1f5f9;
      font-size: 0.68rem;
      padding: 3px 8px;
      border-radius: 5px;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .modal-preview-img {
      max-width: 100%;
      max-height: 160px;
      border-radius: 4px;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: element;
    }
    .modal-foot {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      border-top: 1px solid var(--card-border);
      padding-top: 0.75rem;
      flex-wrap: wrap;
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
        <button class="btn btn-primary" id="btn-play-pause" aria-label="Play or Pause Animation">
          <span id="play-icon">⏸</span>
        </button>
        <input type="range" class="timeline-slider" id="scrubber" min="0" max="${duration}" step="0.01" value="0" aria-label="Timeline Scrubber">
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
              <option value="12">12 fps</option>
              <option value="15">15 fps</option>
              <option value="20" ${fps === 20 ? 'selected' : ''}>20 fps</option>
              <option value="24" ${fps === 24 ? 'selected' : ''}>24 fps</option>
              <option value="30" ${fps === 30 ? 'selected' : ''}>30 fps</option>
            </select>
          </label>

          <label class="select-label">
            Size:
            <select id="scale-select">
              <option value="1.0" selected>100% (Original)</option>
              <option value="0.75">75% (Medium)</option>
              <option value="0.5">50% (Compact)</option>
              <option value="1.5">150% (Large)</option>
              <option value="2.0">200% (2x HD)</option>
            </select>
          </label>

          <label class="select-label">
            Color:
            <select id="color-select">
              <option value="auto" selected>Stable (rgb565)</option>
              <option value="alpha">1-bit Alpha</option>
            </select>
          </label>
        </div>

        <button class="btn btn-primary" id="btn-reencode-gif">
          🎬 Re-encode GIF
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

  <!-- SAVE / EXPORT MODAL DIALOG -->
  <div class="modal-overlay" id="save-modal-overlay">
    <div class="modal-box">
      <div class="modal-head">
        <div class="modal-title">
          <span>🎬 GIF Kodla ve Dışa Aktar</span>
        </div>
        <button class="modal-close-btn" id="modal-btn-close" title="Kapat">&times;</button>
      </div>

      <div class="modal-field" id="modal-filename-group">
        <label class="modal-label" for="modal-input-filename">Dosya Adı (.gif) &mdash; <span style="color: #818cf8;">Hedef: Windows Resimler Klasörü</span>:</label>
        <input type="text" class="modal-input" id="modal-input-filename" value="antigravity-animation.gif" placeholder="Dosya adı...">
      </div>

      <div class="modal-field">
        <span class="modal-label">Seçilen Parametreler:</span>
        <div class="param-summary" id="modal-param-summary">
          <span class="param-pill" id="badge-param-speed">Hız: 1.0x</span>
          <span class="param-pill" id="badge-param-fps">FPS: 20</span>
          <span class="param-pill" id="badge-param-size">Boyut: 100%</span>
          <span class="param-pill" id="badge-param-color">Renk: Stable (rgb565)</span>
        </div>
      </div>

      <div class="encode-progress-wrap" id="modal-progress-wrap" style="display: none;">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="modal-progress-fill"></div>
        </div>
        <div class="progress-text">
          <span id="modal-progress-label">İşleniyor...</span>
          <span id="modal-progress-pct">0%</span>
        </div>
      </div>

      <div class="modal-preview-box" id="modal-preview-box">
        <div class="saved-success-banner" id="modal-saved-banner" style="display: none;">
          <div class="saved-icon">🎉</div>
          <div class="saved-text">
            <span class="saved-title">GIF Windows Resimler Dizinine Kaydedildi!</span>
            <span class="saved-path" id="modal-saved-path">C:\Users\...\Pictures\animation.gif</span>
          </div>
        </div>

        <div class="drag-hint-banner" id="drag-hint-banner">
          <div class="drag-icon-wrap">✋</div>
          <div class="drag-hint-text">
            <span class="drag-hint-title">Alternatif: Sürükle & Bırak ile İstediğin Yere Kaydet</span>
            <span class="drag-hint-desc">Aşağıdaki GIF'i tutup doğrudan masaüstünüze veya istediğiniz bir klasöre de bırakabilirsiniz.</span>
          </div>
        </div>

        <div class="modal-preview-img-wrap" id="modal-img-wrap" title="Tutup masaüstünüze veya klasöre sürükleyin">
          <img class="modal-preview-img" id="modal-preview-img" src="" alt="Rendered GIF Preview" draggable="true">
          <span class="drag-badge">🖱️ Sürükle & Bırak</span>
        </div>

        <span class="modal-label" id="modal-preview-meta" style="color: #4ade80;">✅ GIF Başarıyla Oluşturuldu</span>
      </div>

      <div class="modal-foot">
        <button class="btn" id="modal-btn-open-explorer" style="display: none; background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.35); color: #4ade80;">
          📂 Klasörde Göster
        </button>
        <button class="btn" id="modal-btn-cancel">Kapat</button>
        <button class="btn btn-primary" id="modal-btn-start">
          🚀 Kodla & Resimlerime Kaydet
        </button>
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
      const scaleSelect = document.getElementById('scale-select');
      const colorSelect = document.getElementById('color-select');
      const reencodeBtn = document.getElementById('btn-reencode-gif');
      const progressWrap = document.getElementById('progress-wrap');
      const progressFill = document.getElementById('progress-fill');
      const progressLabel = document.getElementById('progress-label');
      const progressPct = document.getElementById('progress-pct');

      // Populate resolution labels dynamically based on SVG viewBox
      const initialSvg = stage.querySelector('svg');
      if (initialSvg && scaleSelect && scaleSelect.options.length >= 5) {
        const vb = initialSvg.viewBox?.baseVal || { width: 400, height: 400 };
        const bw = Math.round(vb.width || 400);
        const bh = Math.round(vb.height || 400);
        scaleSelect.options[0].textContent = '100% (' + bw + '×' + bh + ')';
        scaleSelect.options[1].textContent = '75% (' + Math.round(bw * 0.75) + '×' + Math.round(bh * 0.75) + ')';
        scaleSelect.options[2].textContent = '50% (' + Math.round(bw * 0.5) + '×' + Math.round(bh * 0.5) + ')';
        scaleSelect.options[3].textContent = '150% (' + Math.round(bw * 1.5) + '×' + Math.round(bh * 1.5) + ')';
        scaleSelect.options[4].textContent = '200% (' + Math.round(bw * 2.0) + '×' + Math.round(bh * 2.0) + ')';
      }

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
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
          e.preventDefault();
          if (isPlaying) togglePlay();
          const step = 1 / Math.max(10, parseInt(fpsSelect.value || 20));
          const current = parseFloat(scrubber.value);
          const next = e.code === 'ArrowLeft' ? Math.max(0, current - step) : Math.min(duration, current + step);
          scrubber.value = next;
          pauseOffset = next;
          applyScrubTime(next);
          updateTimeText(next);
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

      const copyBtn = document.getElementById('btn-copy-svg');
      copyBtn.onclick = () => {
        const svgCode = stage.innerHTML;
        navigator.clipboard.writeText(svgCode).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => { copyBtn.textContent = originalText; }, 1800);
        }).catch(() => {});
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

      // Modal DOM Elements
      const saveModalOverlay = document.getElementById('save-modal-overlay');
      const modalBtnClose = document.getElementById('modal-btn-close');
      const modalBtnCancel = document.getElementById('modal-btn-cancel');
      const modalBtnStart = document.getElementById('modal-btn-start');
      const modalInputFilename = document.getElementById('modal-input-filename');
      const modalProgressWrap = document.getElementById('modal-progress-wrap');
      const modalProgressFill = document.getElementById('modal-progress-fill');
      const modalProgressLabel = document.getElementById('modal-progress-label');
      const modalProgressPct = document.getElementById('modal-progress-pct');
      const modalPreviewBox = document.getElementById('modal-preview-box');
      const modalPreviewImg = document.getElementById('modal-preview-img');
      const modalPreviewMeta = document.getElementById('modal-preview-meta');
      const modalSavedBanner = document.getElementById('modal-saved-banner');
      const modalSavedPath = document.getElementById('modal-saved-path');
      const modalBtnOpenExplorer = document.getElementById('modal-btn-open-explorer');

      const badgeParamSpeed = document.getElementById('badge-param-speed');
      const badgeParamFps = document.getElementById('badge-param-fps');
      const badgeParamSize = document.getElementById('badge-param-size');
      const badgeParamColor = document.getElementById('badge-param-color');

      function closeModal() {
        saveModalOverlay.classList.remove('active');
      }

      modalBtnClose.onclick = closeModal;
      modalBtnCancel.onclick = closeModal;
      saveModalOverlay.onclick = (e) => {
        if (e.target === saveModalOverlay) closeModal();
      };

      // Open Modal on Re-encode button click
      reencodeBtn.onclick = () => {
        const svgEl = stage.querySelector('svg');
        if (!svgEl) return;

        // Update parameter badges
        badgeParamSpeed.textContent = 'Hız: ' + playbackSpeed + 'x';
        badgeParamFps.textContent = 'FPS: ' + fpsSelect.value;
        badgeParamSize.textContent = 'Boyut: ' + (scaleSelect ? scaleSelect.options[scaleSelect.selectedIndex].text : '100%');
        badgeParamColor.textContent = 'Renk: ' + (colorSelect ? colorSelect.options[colorSelect.selectedIndex].text : 'Stable');

        // Suggest clean filename based on title or default
        const cleanTitle = '${escapeHtml(title)}'.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'antigravity_animation';
        modalInputFilename.value = cleanTitle + '_' + playbackSpeed + 'x_' + fpsSelect.value + 'fps.gif';

        // Reset modal state
        modalProgressWrap.style.display = 'none';
        modalProgressFill.style.width = '0%';
        modalProgressPct.textContent = '0%';
        modalPreviewBox.style.display = 'none';
        if (modalSavedBanner) modalSavedBanner.style.display = 'none';
        if (modalBtnOpenExplorer) modalBtnOpenExplorer.style.display = 'none';
        modalBtnStart.style.display = 'inline-block';
        modalBtnStart.disabled = false;
        modalBtnCancel.style.display = 'inline-block';
        modalBtnCancel.textContent = 'İptal';
        modalBtnCancel.disabled = false;
        modalInputFilename.disabled = false;

        saveModalOverlay.classList.add('active');
        setTimeout(() => modalInputFilename.focus(), 50);
      };

      modalInputFilename.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          modalBtnStart.click();
        }
      };

      modalBtnStart.onclick = async () => {
        const svgEl = stage.querySelector('svg');
        if (!svgEl) return;

        let targetFilename = (modalInputFilename.value || 'antigravity-studio-export.gif').trim();
        if (!targetFilename.toLowerCase().endsWith('.gif')) {
          targetFilename += '.gif';
        }

        modalBtnStart.disabled = true;
        modalBtnCancel.disabled = true;
        modalInputFilename.disabled = true;
        modalProgressWrap.style.display = 'flex';
        modalPreviewBox.style.display = 'none';

        // Read user parameters: Speed, FPS, Scale, Color Mode
        const fps = parseInt(fpsSelect.value, 10) || 20;
        const speed = playbackSpeed || 1.0;
        const scale = parseFloat(scaleSelect ? scaleSelect.value : 1.0) || 1.0;
        const colorMode = colorSelect ? colorSelect.value : 'auto';

        const effectiveDuration = duration / speed;
        const totalFrames = Math.max(1, Math.round(effectiveDuration * fps));
        const frameDelayMs = Math.round(1000 / fps);

        const viewBox = svgEl.viewBox?.baseVal || { width: 400, height: 400 };
        const baseWidth = Math.round(viewBox.width || 400);
        const baseHeight = Math.round(viewBox.height || 400);
        const width = Math.max(16, Math.round(baseWidth * scale));
        const height = Math.max(16, Math.round(baseHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const { GIFEncoder, quantize, applyPalette } = window.gifenc || {};
        if (!GIFEncoder) {
          alert('GIFEncoder motoru yüklenemedi.');
          modalProgressWrap.style.display = 'none';
          modalBtnStart.disabled = false;
          modalBtnCancel.disabled = false;
          return;
        }

        const gif = GIFEncoder();

        const allEls = svgEl.querySelectorAll('*');
        allEls.forEach((el, idx) => el.setAttribute('data-bake-id', idx));

        async function renderFrameToCanvas(tSec, tMs) {
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
              cloneEl.style.fill = comp.fill;
              cloneEl.style.stroke = comp.stroke;
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
          return ctx.getImageData(0, 0, width, height);
        }

        // Multi-frame sampling for Unified Global Palette (Zero Jitter)
        modalProgressLabel.textContent = 'Renk paleti optimize ediliyor...';
        modalProgressFill.style.width = '10%';
        modalProgressPct.textContent = '10%';

        const sampleIntervalCount = Math.min(10, totalFrames);
        const sampleStep = Math.max(1, Math.floor(totalFrames / sampleIntervalCount));
        const samplePixelsPerFrame = Math.max(100, Math.floor(100000 / sampleIntervalCount));
        const totalFramePixels = width * height;
        const stride = Math.max(1, Math.floor(totalFramePixels / samplePixelsPerFrame));
        const sampleBuffer = new Uint8Array(sampleIntervalCount * samplePixelsPerFrame * 4);
        let sampleOffset = 0;
        let detectedTransparency = false;

        for (let s = 0; s < sampleIntervalCount; s++) {
          const sampleFrameIdx = s * sampleStep;
          const sSec = (sampleFrameIdx / fps) * speed;
          const sMs = sSec * 1000;
          const sampleData = await renderFrameToCanvas(sSec, sMs);
          const d = sampleData.data;

          for (let p = 0; p < totalFramePixels && sampleOffset + 4 <= sampleBuffer.length; p += stride) {
            const idx = p * 4;
            const a = d[idx + 3];
            if (a < 250) detectedTransparency = true;
            sampleBuffer[sampleOffset++] = d[idx];
            sampleBuffer[sampleOffset++] = d[idx + 1];
            sampleBuffer[sampleOffset++] = d[idx + 2];
            sampleBuffer[sampleOffset++] = d[idx + 3];
          }
        }

        const isTransparent = colorMode === 'alpha' ? true : (colorMode === 'rgb565' ? false : (currentBgMode === 'checker' && detectedTransparency));
        const format = isTransparent ? 'rgba4444' : 'rgb565';
        const globalPalette = quantize(sampleBuffer.subarray(0, sampleOffset), 256, {
          format: format,
          oneBitAlpha: isTransparent
        });
        const transparentIndex = isTransparent ? globalPalette.findIndex(p => p[3] === 0) : -1;

        // Render and encode all frames
        for (let i = 0; i < totalFrames; i++) {
          const tSec = (i / fps) * speed;
          const tMs = tSec * 1000;
          modalProgressLabel.textContent = 'Kareler kodlanıyor: ' + (i + 1) + ' / ' + totalFrames + '...';
          const pct = Math.round(10 + ((i + 1) / totalFrames) * 85);
          modalProgressFill.style.width = pct + '%';
          modalProgressPct.textContent = pct + '%';

          const imgData = await renderFrameToCanvas(tSec, tMs);
          const index = applyPalette(imgData.data, globalPalette, format);

          gif.writeFrame(index, width, height, {
            palette: i === 0 ? globalPalette : null,
            delay: frameDelayMs,
            transparent: isTransparent && transparentIndex >= 0,
            transparentIndex: Math.max(0, transparentIndex),
            dispose: 2
          });

          await new Promise(r => setTimeout(r, 0));
        }

        gif.finish();
        const gifBytes = gif.bytes();
        const gifBlob = new Blob([gifBytes], { type: 'image/gif' });
        const gifUrl = URL.createObjectURL(gifBlob);
        const sizeMb = (gifBytes.length / (1024 * 1024)).toFixed(2);

        // Attempt automatic save to Windows Pictures directory via local bridge
        let savedPath = null;
        const bridgeEndpoint = 'http:' + '//127.0.0.1:37190';
        try {
          modalProgressLabel.textContent = 'Resimler dizinine kaydediliyor...';
          const resp = await fetch(bridgeEndpoint + '/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'image/gif',
              'X-Filename': encodeURIComponent(targetFilename)
            },
            body: gifBytes
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.savedPath) {
              savedPath = data.savedPath;
            }
          }
        } catch (fetchErr) {
          console.log('Bridge save offline:', fetchErr.message);
        }

        // Update preview & enable drag-and-drop
        modalPreviewImg.src = gifUrl;
        modalPreviewMeta.textContent = '✅ GIF Hazır (' + sizeMb + ' MB, ' + totalFrames + ' kare)';
        modalPreviewBox.style.display = 'flex';

        if (savedPath && modalSavedBanner && modalSavedPath) {
          modalSavedBanner.style.display = 'flex';
          modalSavedPath.textContent = savedPath;
          if (modalBtnOpenExplorer) {
            modalBtnOpenExplorer.style.display = 'inline-flex';
            modalBtnOpenExplorer.onclick = () => {
              fetch(bridgeEndpoint + '/open-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: savedPath })
              }).catch(() => {});
            };
          }
        } else {
          if (modalSavedBanner) modalSavedBanner.style.display = 'none';
          if (modalBtnOpenExplorer) modalBtnOpenExplorer.style.display = 'none';
        }

        // Setup HTML5 DownloadURL dragout for direct Windows desktop/folder drop
        modalPreviewImg.setAttribute('draggable', 'true');
        modalPreviewImg.ondragstart = (e) => {
          e.dataTransfer.setData('DownloadURL', 'image/gif:' + targetFilename + ':' + gifUrl);
          e.dataTransfer.setData('text/plain', targetFilename);
          e.dataTransfer.effectAllowed = 'copyMove';
        };

        const imgWrap = document.getElementById('modal-img-wrap');
        if (imgWrap) {
          imgWrap.setAttribute('draggable', 'true');
          imgWrap.ondragstart = (e) => {
            e.dataTransfer.setData('DownloadURL', 'image/gif:' + targetFilename + ':' + gifUrl);
            e.dataTransfer.setData('text/plain', targetFilename);
            e.dataTransfer.effectAllowed = 'copyMove';
          };
        }

        modalProgressWrap.style.display = 'none';
        modalBtnStart.style.display = 'none';
        modalBtnCancel.textContent = 'Kapat';
        modalBtnCancel.disabled = false;
      };

      loop();
    })();
  </script>
</body>
</html>`;

  const result = {
    success: true,
    title,
    durationSeconds: Number(duration.toFixed(3)),
    fps,
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
    result.fileSizeBytes = Buffer.byteLength(html, 'utf8');
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
