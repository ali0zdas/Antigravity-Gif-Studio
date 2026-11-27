/**
 * Antigravity GIF Studio — Persistent Server Store & Asset Cache
 *
 * Manages persistent settings (`settings.json`), recent animation history
 * (`history.json`), and bounded asset storage under `--data_dir` (${PLUGIN_DATA})
 * so MCP App views stay stateless in the iframe and under the 1 MiB CallToolResult limit.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_HISTORY = 20;
const MAX_ASSETS = 25;

const DEFAULT_SETTINGS = {
  fps: 20,
  maxColors: 256,
  transparent: false,
  backgroundMode: 'checkerboard',
  outputDir: ''
};

/**
 * Resolves `--data_dir=<path>` or `--data_dir <path>` from CLI argv, falling back
 * to a user-scoped folder under ~/.gemini.
 * @param {string[]} [argv=process.argv]
 * @returns {string}
 */
function resolveDataDir(argv = process.argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--data_dir=')) {
      const val = arg.slice('--data_dir='.length).trim();
      if (val && val !== '${PLUGIN_DATA}') {
        return path.resolve(val);
      }
    } else if (arg === '--data_dir' && argv[i + 1]) {
      const val = argv[i + 1].trim();
      if (val && val !== '${PLUGIN_DATA}') {
        return path.resolve(val);
      }
    }
  }
  return path.join(os.homedir(), '.gemini', 'antigravity-gif-studio-data');
}

function createStore(customDataDir) {
  const dataDir = customDataDir ? path.resolve(customDataDir) : resolveDataDir();
  const assetsDir = path.join(dataDir, 'assets');
  const settingsPath = path.join(dataDir, 'settings.json');
  const historyPath = path.join(dataDir, 'history.json');

  const memoryAssets = new Map();
  let latestAssetId = null;

  function ensureDirs() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
  }

  function safeReadJson(filePath, fallback) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {}
    return fallback;
  }

  function safeWriteJson(filePath, data) {
    ensureDirs();
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  function getSettings() {
    const stored = safeReadJson(settingsPath, {});
    return {
      ...DEFAULT_SETTINGS,
      ...(stored && typeof stored === 'object' ? stored : {})
    };
  }

  function saveSettings(updates = {}) {
    const current = getSettings();
    const next = { ...current };

    if (updates.fps !== undefined) {
      const fps = Number(updates.fps);
      if (!Number.isNaN(fps)) {
        next.fps = Math.max(1, Math.min(60, Math.round(fps)));
      }
    }
    if (updates.maxColors !== undefined) {
      const maxColors = Number(updates.maxColors);
      if (!Number.isNaN(maxColors)) {
        next.maxColors = Math.max(2, Math.min(256, Math.round(maxColors)));
      }
    }
    if (typeof updates.transparent === 'boolean') {
      next.transparent = updates.transparent;
    }
    if (typeof updates.backgroundMode === 'string' && ['checkerboard', 'dark', 'light', 'host'].includes(updates.backgroundMode)) {
      next.backgroundMode = updates.backgroundMode;
    }
    if (typeof updates.outputDir === 'string') {
      next.outputDir = updates.outputDir.trim();
    }

    safeWriteJson(settingsPath, next);
    return next;
  }

  function listHistory() {
    const items = safeReadJson(historyPath, []);
    return Array.isArray(items) ? items : [];
  }

  function putAsset(assetData = {}) {
    ensureDirs();
    const id = assetData.id || crypto.randomBytes(8).toString('hex');
    const record = {
      id,
      title: assetData.title || 'Antigravity GIF Studio Preview',
      svg: assetData.svg || '',
      gifBase64: assetData.gifBase64 || null,
      gifPath: assetData.gifPath || null,
      svgPath: assetData.svgPath || null,
      duration: Number(assetData.duration) || 2.0,
      fps: Number(assetData.fps) || 20,
      width: Number(assetData.width) || 400,
      height: Number(assetData.height) || 400,
      transparent: Boolean(assetData.transparent),
      maxColors: Number(assetData.maxColors) || 256,
      seamErrorPercentage: assetData.seamErrorPercentage ?? null,
      isSeamless: assetData.isSeamless ?? null,
      fileSizeBytes: assetData.fileSizeBytes ?? null,
      updatedAt: new Date().toISOString()
    };

    // Enforce bounded LRU in memory
    if (memoryAssets.has(id)) {
      memoryAssets.delete(id);
    }
    memoryAssets.set(id, record);
    latestAssetId = id;

    while (memoryAssets.size > MAX_ASSETS) {
      const oldestKey = memoryAssets.keys().next().value;
      memoryAssets.delete(oldestKey);
    }

    // Persist SVG text to assets folder so history items can be reopened across restarts
    if (record.svg) {
      try {
        fs.writeFileSync(path.join(assetsDir, `${id}.svg`), record.svg, 'utf8');
      } catch (e) {}
    }

    // Update history index (lightweight metadata only)
    const history = listHistory().filter((item) => item.id !== id);
    history.unshift({
      id,
      title: record.title,
      duration: record.duration,
      fps: record.fps,
      width: record.width,
      height: record.height,
      transparent: record.transparent,
      gifPath: record.gifPath,
      svgPath: record.svgPath,
      seamErrorPercentage: record.seamErrorPercentage,
      isSeamless: record.isSeamless,
      fileSizeBytes: record.fileSizeBytes,
      updatedAt: record.updatedAt
    });
    if (history.length > MAX_HISTORY) {
      const removed = history.splice(MAX_HISTORY);
      for (const old of removed) {
        try {
          const oldSvgPath = path.join(assetsDir, `${old.id}.svg`);
          if (fs.existsSync(oldSvgPath)) fs.unlinkSync(oldSvgPath);
        } catch (e) {}
      }
    }
    safeWriteJson(historyPath, history);

    return record;
  }

  function getAsset(id) {
    if (!id) return null;
    const safeId = path.basename(String(id)).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) return null;

    if (memoryAssets.has(safeId)) {
      return memoryAssets.get(safeId);
    }

    // Reconstruct from disk history + saved SVG if available
    const historyItem = listHistory().find((item) => item.id === safeId);
    const svgFile = path.join(assetsDir, `${safeId}.svg`);
    if (historyItem || fs.existsSync(svgFile)) {
      const svg = fs.existsSync(svgFile) ? fs.readFileSync(svgFile, 'utf8') : '';
      const record = {
        ...(historyItem || { id: safeId, title: 'Restored Animation' }),
        svg,
        gifBase64: null
      };
      memoryAssets.set(safeId, record);
      return record;
    }

    return null;
  }

  function getLatestAsset() {
    if (latestAssetId && memoryAssets.has(latestAssetId)) {
      return memoryAssets.get(latestAssetId);
    }
    const history = listHistory();
    if (history.length > 0) {
      return getAsset(history[0].id);
    }
    return null;
  }

  return {
    dataDir,
    getSettings,
    saveSettings,
    listHistory,
    putAsset,
    getAsset,
    getLatestAsset
  };
}

module.exports = {
  createStore,
  resolveDataDir,
  DEFAULT_SETTINGS
};
