import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps/app-with-deps';

const passthroughSchema = {
  '~standard': {
    version: 1,
    vendor: 'antigravity-gif-studio',
    validate: (value) => ({ value }),
  },
};

const state = {
  assetId: null,
  title: 'Antigravity GIF Studio',
  svg: '',
  gifBase64: null,
  gifPath: null,
  svgPath: null,
  savedPath: null,
  duration: 2.0,
  fps: 20,
  width: null,
  height: null,
  transparent: false,
  maxColors: 256,
  seamErrorPercentage: null,
  isSeamless: null,
  fileSizeBytes: null,
  playing: true,
  speed: 1.0,
  currentTime: 0,
  viewMode: 'svg', // 'svg' | 'gif'
  backgroundMode: 'checkerboard',
  history: [],
};

const el = {
  title: document.getElementById('studio-title'),
  badgeDims: document.getElementById('badge-dims'),
  badgeSeam: document.getElementById('badge-seam'),
  badgeSize: document.getElementById('badge-size'),
  viewport: document.getElementById('stage-viewport'),
  svgHost: document.getElementById('stage-svg-host'),
  gifPreview: document.getElementById('stage-gif-preview'),
  stageEmpty: document.getElementById('stage-empty'),
  scrubber: document.getElementById('scrubber'),
  timeReadout: document.getElementById('time-readout'),
  btnPlay: document.getElementById('btn-play'),
  btnStepBack: document.getElementById('btn-step-back'),
  btnStepFwd: document.getElementById('btn-step-fwd'),
  btnToggleView: document.getElementById('btn-toggle-view'),
  statusBanner: document.getElementById('status-banner'),
  statusText: document.getElementById('status-text'),
  statusPath: document.getElementById('status-path'),
  inputFps: document.getElementById('input-fps'),
  inputDuration: document.getElementById('input-duration'),
  inputColors: document.getElementById('input-colors'),
  inputWidth: document.getElementById('input-width'),
  inputHeight: document.getElementById('input-height'),
  inputFilename: document.getElementById('input-filename'),
  inputTransparent: document.getElementById('input-transparent'),
  btnRenderGif: document.getElementById('btn-render-gif'),
  btnSavePictures: document.getElementById('btn-save-pictures'),
  btnSaveAs: document.getElementById('btn-save-as'),
  btnOpenFolder: document.getElementById('btn-open-folder'),
  btnOpenFile: document.getElementById('btn-open-file'),
  btnAttachContext: document.getElementById('btn-attach-context'),
  btnSendAgent: document.getElementById('btn-send-agent'),
  optInputPath: document.getElementById('opt-input-path'),
  optColors: document.getElementById('opt-colors'),
  optLossy: document.getElementById('opt-lossy'),
  optDedup: document.getElementById('opt-dedup'),
  btnOptimizeGif: document.getElementById('btn-optimize-gif'),
  optStats: document.getElementById('opt-stats'),
  svgEditor: document.getElementById('svg-source-editor'),
  btnApplySvg: document.getElementById('btn-apply-svg'),
  historyList: document.getElementById('history-list'),
  btnRefreshHistory: document.getElementById('btn-refresh-history'),
};

function sanitizeSvgClient(svgText) {
  if (typeof svgText !== 'string') return '';
  return svgText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '')
    .replace(/<(iframe|object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
    .replace(/<(iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-zA-Z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-zA-Z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-zA-Z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, 'data:text/plain')
    .replace(/\b(xlink:)?href\s*=\s*(["'])\s*https?:\/\/[^"']*\2/gi, '$1href=$2#$2')
    .replace(/@import\s+[^;]+;/gi, '');
}

function setStatus(message, type = 'info', filePath = '') {
  if (!message) {
    el.statusBanner.hidden = true;
    return;
  }
  el.statusBanner.hidden = false;
  el.statusBanner.className = `status-banner ${type}`;
  el.statusText.textContent = message;
  el.statusPath.textContent = filePath || '';
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getSvgElement() {
  return el.svgHost.querySelector('svg');
}

function syncAnimationsToTime(tSec, isPlaying) {
  const svgEl = getSvgElement();
  if (!svgEl) return;

  if (typeof svgEl.setCurrentTime === 'function') {
    try {
      svgEl.setCurrentTime(tSec);
      if (isPlaying && typeof svgEl.unpauseAnimations === 'function') {
        svgEl.unpauseAnimations();
      } else if (!isPlaying && typeof svgEl.pauseAnimations === 'function') {
        svgEl.pauseAnimations();
      }
    } catch (e) {}
  }

  const anims = typeof el.svgHost.getAnimations === 'function'
    ? el.svgHost.getAnimations({ subtree: true })
    : [];

  const tMs = tSec * 1000;
  for (const anim of anims) {
    try {
      anim.playbackRate = state.speed;
      anim.currentTime = tMs;
      if (isPlaying) {
        if (anim.playState !== 'running') anim.play();
      } else {
        if (anim.playState !== 'paused') anim.pause();
      }
    } catch (e) {}
  }
}

let lastRafTs = 0;
function tick(ts) {
  if (!lastRafTs) lastRafTs = ts;
  const dtSec = Math.min(0.1, (ts - lastRafTs) / 1000);
  lastRafTs = ts;

  if (state.svg && state.playing && state.viewMode === 'svg') {
    const dur = Math.max(0.1, state.duration || 2.0);
    state.currentTime = (state.currentTime + dtSec * state.speed) % dur;
    el.scrubber.value = String(Math.round((state.currentTime / dur) * 1000));
    el.timeReadout.textContent = `${state.currentTime.toFixed(2)}s / ${dur.toFixed(2)}s`;
  }

  requestAnimationFrame(tick);
}

function updateTimelineDisplay() {
  const dur = Math.max(0.1, state.duration || 2.0);
  el.scrubber.value = String(Math.round((state.currentTime / dur) * 1000));
  el.timeReadout.textContent = `${state.currentTime.toFixed(2)}s / ${dur.toFixed(2)}s`;
  el.btnPlay.textContent = state.playing ? 'Pause' : 'Play';
}

function renderStage() {
  el.title.textContent = state.title || 'Antigravity GIF Studio';

  const hasSvg = Boolean(state.svg && state.svg.trim());
  const hasGif = Boolean(state.gifBase64);

  el.stageEmpty.style.display = !hasSvg && !hasGif ? 'flex' : 'none';
  el.btnToggleView.hidden = !(hasSvg && hasGif);

  if (state.viewMode === 'gif' && hasGif) {
    el.svgHost.style.display = 'none';
    el.gifPreview.style.display = 'block';
    el.gifPreview.src = `data:image/gif;base64,${state.gifBase64}`;
    el.btnToggleView.textContent = 'View Live SVG';
  } else if (hasSvg) {
    el.gifPreview.style.display = 'none';
    el.svgHost.style.display = 'flex';
    el.svgHost.innerHTML = sanitizeSvgClient(state.svg);
    el.btnToggleView.textContent = 'View Rendered GIF';
    syncAnimationsToTime(state.currentTime, state.playing);
  } else if (hasGif) {
    el.svgHost.style.display = 'none';
    el.gifPreview.style.display = 'block';
    el.gifPreview.src = `data:image/gif;base64,${state.gifBase64}`;
  } else {
    el.svgHost.innerHTML = '';
    el.svgHost.style.display = 'none';
    el.gifPreview.style.display = 'none';
  }

  // Badges
  if (state.width && state.height) {
    el.badgeDims.hidden = false;
    el.badgeDims.textContent = `${state.width}×${state.height}`;
  } else {
    el.badgeDims.hidden = true;
  }

  if (state.seamErrorPercentage !== null && state.seamErrorPercentage !== undefined) {
    el.badgeSeam.hidden = false;
    el.badgeSeam.className = `pill ${state.isSeamless ? 'success' : 'warning'}`;
    el.badgeSeam.textContent = state.isSeamless
      ? `Seamless (${state.seamErrorPercentage}% diff)`
      : `Seam Diff: ${state.seamErrorPercentage}%`;
  } else {
    el.badgeSeam.hidden = true;
  }

  if (state.fileSizeBytes) {
    el.badgeSize.hidden = false;
    el.badgeSize.textContent = formatBytes(state.fileSizeBytes);
  } else {
    el.badgeSize.hidden = true;
  }

  // Action button states
  el.btnRenderGif.disabled = !hasSvg;
  const canSave = Boolean(hasGif || state.gifPath || state.savedPath);
  el.btnSavePictures.disabled = !canSave;
  el.btnSaveAs.disabled = !canSave;
  el.btnOpenFolder.disabled = !(state.savedPath || state.gifPath);

  const openableFile = state.savedPath || state.gifPath || state.svgPath;
  el.btnOpenFile.hidden = !openableFile;

  // Sync form controls
  el.inputFps.value = String(state.fps || 20);
  el.inputDuration.value = String(state.duration || 2.0);
  el.inputColors.value = String(state.maxColors || 256);
  el.inputTransparent.checked = Boolean(state.transparent);
  if (state.width) el.inputWidth.value = String(state.width);
  if (state.height) el.inputHeight.value = String(state.height);
  if (hasSvg && el.svgEditor.value !== state.svg) {
    el.svgEditor.value = state.svg;
  }

  updateTimelineDisplay();
}

function setBackgroundMode(mode, persist = false) {
  state.backgroundMode = mode;
  el.viewport.className = `stage-viewport bg-${mode}`;
  document.querySelectorAll('[data-bg]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.bg === mode);
  });
  if (persist) {
    persistSettings({ backgroundMode: mode });
  }
}

function renderHistoryList(items) {
  state.history = Array.isArray(items) ? items : [];
  if (state.history.length === 0) {
    el.historyList.innerHTML = '<div class="history-sub">No recent animations yet.</div>';
    return;
  }
  el.historyList.innerHTML = '';
  for (const item of state.history) {
    const row = document.createElement('div');
    row.className = 'history-item';

    const meta = document.createElement('div');
    meta.className = 'history-meta';

    const name = document.createElement('div');
    name.className = 'history-name';
    name.textContent = item.title || 'Untitled Animation';

    const sub = document.createElement('div');
    sub.className = 'history-sub';
    const parts = [
      `${item.width || 400}×${item.height || 400}`,
      `${item.duration || 2}s @ ${item.fps || 20}fps`,
    ];
    if (item.fileSizeBytes) parts.push(formatBytes(item.fileSizeBytes));
    sub.textContent = parts.join(' • ');

    meta.appendChild(name);
    meta.appendChild(sub);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn chip';
    loadBtn.type = 'button';
    loadBtn.textContent = 'Load';

    row.onclick = () => loadAssetById(item.id);
    row.appendChild(meta);
    row.appendChild(loadBtn);
    el.historyList.appendChild(row);
  }
}

function applyPayload(data) {
  if (!data || typeof data !== 'object') return;
  if (data.assetId) state.assetId = data.assetId;
  if (data.id) state.assetId = data.id;
  if (data.title) state.title = data.title;
  if (typeof data.svg === 'string') state.svg = data.svg;
  if (data.gifBase64 !== undefined) state.gifBase64 = data.gifBase64;
  if (data.gifPath !== undefined) state.gifPath = data.gifPath;
  if (data.svgPath !== undefined) state.svgPath = data.svgPath;
  if (data.savedPath !== undefined) state.savedPath = data.savedPath;
  if (data.duration) state.duration = Number(data.duration);
  if (data.fps) state.fps = Number(data.fps);
  if (data.width) state.width = Number(data.width);
  if (data.height) state.height = Number(data.height);
  if (typeof data.transparent === 'boolean') state.transparent = data.transparent;
  if (data.maxColors) state.maxColors = Number(data.maxColors);
  if (data.seamErrorPercentage !== undefined) state.seamErrorPercentage = data.seamErrorPercentage;
  if (data.isSeamless !== undefined) state.isSeamless = data.isSeamless;
  if (data.fileSizeBytes !== undefined) state.fileSizeBytes = data.fileSizeBytes;
  if (data.settings?.backgroundMode) setBackgroundMode(data.settings.backgroundMode, false);
  if (data.history) renderHistoryList(data.history);

  if (data.title && !el.inputFilename.dataset.dirty) {
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'animation';
    el.inputFilename.value = `${slug}.gif`;
  }

  state.currentTime = 0;
  state.viewMode = state.svg ? 'svg' : state.gifBase64 ? 'gif' : 'svg';
  renderStage();
}

function parseToolResultJson(res) {
  if (res?.structuredContent && typeof res.structuredContent === 'object') {
    return res.structuredContent;
  }
  const textBlock = res?.content?.find((c) => c.type === 'text');
  if (textBlock?.text) {
    try {
      return JSON.parse(textBlock.text);
    } catch (e) {
      return { message: textBlock.text };
    }
  }
  return {};
}

const app = new App({ name: 'Antigravity GIF Studio', version: '2.0.0' }, {});

async function loadAssetById(assetId) {
  if (!assetId) return;
  try {
    setStatus('Loading animation asset...', 'info');
    const res = await app.callServerTool({
      name: 'app_get_asset',
      arguments: { assetId },
    });
    const payload = parseToolResultJson(res);
    if (res.isError) {
      setStatus(payload.message || 'Failed to load asset.', 'error');
      return;
    }
    applyPayload(payload);
    setStatus('', 'info');
  } catch (err) {
    setStatus(`Load failed: ${err.message}`, 'error');
  }
}

let settingsSaveTimer = null;
function persistSettings(partial) {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    app.callServerTool({
      name: 'app_save_settings',
      arguments: partial,
    }).catch(() => {});
  }, 250);
}

function updateCapabilitiesUI() {
  const caps = app.getHostCapabilities();
  el.btnAttachContext.hidden = !caps?.updateModelContext;
  el.btnSendAgent.hidden = !caps?.message;
}

// Register lifecycle handlers BEFORE connect()
app.ontoolinput = ({ arguments: args }) => {
  if (args?.title) {
    el.title.textContent = args.title;
  }
  setStatus('Preparing animation preview...', 'info');
};

app.ontoolresult = async (result) => {
  const sc = result?.structuredContent || parseToolResultJson(result);
  if (!sc) return;

  if (sc.needsAssetFetch && sc.assetId) {
    applyPayload(sc);
    await loadAssetById(sc.assetId);
    return;
  }

  applyPayload(sc);
  setStatus('', 'info');
};

app.ontoolcancelled = () => {
  setStatus('Tool execution cancelled.', 'info');
};

app.onhostcontextchanged = (ctx) => {
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  updateCapabilitiesUI();
};

// Wire UI events
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    ['export', 'optimize', 'source', 'history'].forEach((name) => {
      document.getElementById(`tab-${name}`).hidden = name !== target;
    });
    if (target === 'history') {
      refreshHistory();
    }
  });
});

document.querySelectorAll('[data-bg]').forEach((btn) => {
  btn.addEventListener('click', () => setBackgroundMode(btn.dataset.bg, true));
});

document.querySelectorAll('[data-speed]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.speed = Number(btn.dataset.speed) || 1;
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('active', b === btn));
    syncAnimationsToTime(state.currentTime, state.playing);
  });
});

el.btnPlay.addEventListener('click', () => {
  state.playing = !state.playing;
  syncAnimationsToTime(state.currentTime, state.playing);
  updateTimelineDisplay();
});

el.btnStepBack.addEventListener('click', () => {
  state.playing = false;
  const dur = Math.max(0.1, state.duration || 2.0);
  const step = 1 / (state.fps || 20);
  state.currentTime = (state.currentTime - step + dur) % dur;
  syncAnimationsToTime(state.currentTime, false);
  updateTimelineDisplay();
});

el.btnStepFwd.addEventListener('click', () => {
  state.playing = false;
  const dur = Math.max(0.1, state.duration || 2.0);
  const step = 1 / (state.fps || 20);
  state.currentTime = (state.currentTime + step) % dur;
  syncAnimationsToTime(state.currentTime, false);
  updateTimelineDisplay();
});

el.scrubber.addEventListener('input', () => {
  state.playing = false;
  const dur = Math.max(0.1, state.duration || 2.0);
  state.currentTime = (Number(el.scrubber.value) / 1000) * dur;
  syncAnimationsToTime(state.currentTime, false);
  updateTimelineDisplay();
});

el.btnToggleView.addEventListener('click', () => {
  state.viewMode = state.viewMode === 'svg' ? 'gif' : 'svg';
  renderStage();
});

el.inputFilename.addEventListener('input', () => {
  el.inputFilename.dataset.dirty = '1';
});

[el.inputFps, el.inputColors, el.inputTransparent].forEach((input) => {
  input.addEventListener('change', () => {
    state.fps = Number(el.inputFps.value) || 20;
    state.maxColors = Number(el.inputColors.value) || 256;
    state.transparent = Boolean(el.inputTransparent.checked);
    persistSettings({
      fps: state.fps,
      maxColors: state.maxColors,
      transparent: state.transparent,
    });
  });
});

el.btnApplySvg.addEventListener('click', async () => {
  const svgCode = el.svgEditor.value.trim();
  if (!svgCode) {
    setStatus('Please paste SVG markup first.', 'error');
    return;
  }
  state.svg = svgCode;
  state.gifBase64 = null;
  state.viewMode = 'svg';
  state.currentTime = 0;
  renderStage();
  try {
    const res = await app.callServerTool({
      name: 'app_register_svg',
      arguments: {
        svg: svgCode,
        title: state.title || 'Custom SVG',
        fps: Number(el.inputFps.value) || 20,
        duration: Number(el.inputDuration.value) || undefined,
      },
    });
    const data = parseToolResultJson(res);
    if (!res.isError) {
      applyPayload(data);
      setStatus('SVG applied and cached on server.', 'success');
    }
  } catch (err) {
    setStatus(`Applied locally (server cache failed: ${err.message})`, 'info');
  }
});

el.btnRenderGif.addEventListener('click', async () => {
  if (!state.svg) return;
  el.btnRenderGif.disabled = true;
  setStatus('Rendering frames in headless Chromium...', 'info');
  try {
    const args = {
      assetId: state.assetId,
      svg: state.svg,
      fps: Number(el.inputFps.value) || 20,
      duration: Number(el.inputDuration.value) || state.duration || 2.0,
      maxColors: Number(el.inputColors.value) || 256,
      transparent: Boolean(el.inputTransparent.checked),
      title: state.title,
    };
    const w = Number(el.inputWidth.value);
    const h = Number(el.inputHeight.value);
    if (w > 0) args.width = w;
    if (h > 0) args.height = h;

    const res = await app.callServerTool({
      name: 'app_render_preview',
      arguments: args,
    });
    const data = parseToolResultJson(res);
    if (res.isError) {
      setStatus(data.message || 'Render failed.', 'error');
      return;
    }
    applyPayload(data);
    if (state.gifBase64) {
      state.viewMode = 'gif';
      renderStage();
    }
    setStatus(
      `Rendered ${data.frameCount} frames (${formatBytes(data.fileSizeBytes)}) — ${data.isSeamless ? 'Seamless' : `Seam diff ${data.seamErrorPercentage}%`}`,
      'success',
      data.gifPath || ''
    );
  } catch (err) {
    setStatus(`Render failed: ${err.message}`, 'error');
  } finally {
    el.btnRenderGif.disabled = !state.svg;
  }
});

el.btnSavePictures.addEventListener('click', async () => {
  try {
    setStatus('Saving GIF to Pictures...', 'info');
    const res = await app.callServerTool({
      name: 'app_save_gif',
      arguments: {
        assetId: state.assetId,
        filename: el.inputFilename.value.trim() || 'antigravity-studio-export.gif',
      },
    });
    const data = parseToolResultJson(res);
    if (res.isError) {
      setStatus(data.message || 'Save failed.', 'error');
      return;
    }
    state.savedPath = data.savedPath;
    renderStage();
    setStatus('Saved to Pictures folder.', 'success', data.savedPath);
  } catch (err) {
    setStatus(`Save failed: ${err.message}`, 'error');
  }
});

el.btnSaveAs.addEventListener('click', async () => {
  try {
    setStatus('Waiting for Save As dialog...', 'info');
    const res = await app.callServerTool({
      name: 'app_save_gif_as',
      arguments: {
        assetId: state.assetId,
        filename: el.inputFilename.value.trim() || 'antigravity-studio-export.gif',
      },
    });
    const data = parseToolResultJson(res);
    if (res.isError) {
      setStatus(data.message || 'Save As failed.', 'error');
      return;
    }
    if (data.cancelled) {
      setStatus('Save As cancelled.', 'info');
      return;
    }
    state.savedPath = data.savedPath;
    renderStage();
    setStatus('Saved GIF successfully.', 'success', data.savedPath);
  } catch (err) {
    setStatus(`Save As failed: ${err.message}`, 'error');
  }
});

el.btnOpenFolder.addEventListener('click', async () => {
  const targetPath = state.savedPath || state.gifPath;
  if (!targetPath) return;
  try {
    await app.callServerTool({
      name: 'app_open_folder',
      arguments: { path: targetPath },
    });
  } catch (err) {
    setStatus(`Could not open folder: ${err.message}`, 'error');
  }
});

el.btnOpenFile.addEventListener('click', async () => {
  const targetPath = state.savedPath || state.gifPath || state.svgPath;
  if (!targetPath) return;
  const normalized = targetPath.replace(/\\/g, '/');
  const fileUri = normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
  try {
    const res = await app.request(
      {
        method: 'com.google.antigravity/toggle-aux-pane',
        params: { tabType: 'fileView', uri: fileUri },
      },
      passthroughSchema
    );
    if (res?.isError) {
      setStatus('Side pane file view is unavailable on this surface.', 'info');
    }
  } catch (err) {
    setStatus('Host does not support opening workspace file tabs.', 'info');
  }
});

el.btnOptimizeGif.addEventListener('click', async () => {
  const inputPath = el.optInputPath.value.trim() || state.savedPath || state.gifPath || '';
  if (!inputPath && !state.gifBase64) {
    setStatus('Render a GIF or enter an input GIF path first.', 'error');
    return;
  }
  el.btnOptimizeGif.disabled = true;
  setStatus('Optimizing GIF palette and deduplicating frames...', 'info');
  try {
    const res = await app.callServerTool({
      name: 'app_optimize_preview',
      arguments: {
        assetId: state.assetId,
        inputPath: inputPath || undefined,
        maxColors: Number(el.optColors.value) || 128,
        lossy: Number(el.optLossy.value) || 0,
        frameDeduplication: Boolean(el.optDedup.checked),
      },
    });
    const data = parseToolResultJson(res);
    if (res.isError) {
      setStatus(data.message || 'Optimization failed.', 'error');
      return;
    }
    applyPayload(data);
    state.viewMode = 'gif';
    renderStage();
    el.optStats.hidden = false;
    el.optStats.textContent = `${formatBytes(data.originalBytes)} → ${formatBytes(data.optimizedBytes)} (${data.savingsPercent}% saved)`;
    setStatus(`Optimization complete (${data.savingsPercent}% smaller).`, 'success');
  } catch (err) {
    setStatus(`Optimization failed: ${err.message}`, 'error');
  } finally {
    el.btnOptimizeGif.disabled = false;
  }
});

el.btnAttachContext.addEventListener('click', async () => {
  const summary = [
    `GIF Studio Settings (${state.title})`,
    `- FPS: ${el.inputFps.value}`,
    `- Duration: ${el.inputDuration.value}s`,
    `- Speed preview: ${state.speed}x`,
    `- Max Colors: ${el.inputColors.value}`,
    `- Transparent: ${el.inputTransparent.checked}`,
    state.width && state.height ? `- Dimensions: ${state.width}x${state.height}` : '',
    state.savedPath || state.gifPath ? `- Output file: ${state.savedPath || state.gifPath}` : '',
  ].filter(Boolean).join('\n');

  try {
    await app.updateModelContext({
      content: [{ type: 'text', text: summary }],
    });
    setStatus('Studio settings attached to your next chat prompt.', 'success');
  } catch (err) {
    setStatus(`Could not attach context: ${err.message}`, 'error');
  }
});

el.btnSendAgent.addEventListener('click', async () => {
  const prompt = `Please regenerate "${state.title}" with FPS=${el.inputFps.value}, duration=${el.inputDuration.value}s, maxColors=${el.inputColors.value}, transparent=${el.inputTransparent.checked}${el.inputWidth.value && el.inputHeight.value ? `, dimensions=${el.inputWidth.value}x${el.inputHeight.value}` : ''}.`;
  try {
    await app.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: prompt }],
    });
    setStatus('Sent regeneration request to chat.', 'success');
  } catch (err) {
    setStatus(`Could not send message: ${err.message}`, 'error');
  }
});

async function refreshHistory() {
  try {
    const res = await app.callServerTool({ name: 'app_list_history', arguments: {} });
    const data = parseToolResultJson(res);
    renderHistoryList(data.history || []);
  } catch (err) {}
}

el.btnRefreshHistory.addEventListener('click', refreshHistory);

document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    el.btnPlay.click();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    el.btnStepBack.click();
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    el.btnStepFwd.click();
  }
});

async function bootstrap() {
  await app.connect();
  const ctx = app.getHostContext();
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  updateCapabilitiesUI();
  requestAnimationFrame(tick);
}

bootstrap().catch((err) => {
  setStatus(`MCP App connection failed: ${err.message}`, 'error');
});
