/**
 * Antigravity GIF Studio — Safe OS File & Dialog Actions
 *
 * Provides shell-free (execFile) file saving, native Save-As dialogs,
 * and file manager reveal helpers shared by MCP app-only tools and
 * the optional legacy HTTP bridge.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

/**
 * Returns the default Pictures directory, falling back to the user's home directory.
 * @returns {string}
 */
function getDefaultPicturesDir() {
  const home = os.homedir();
  const pictures = path.join(home, 'Pictures');
  if (fs.existsSync(pictures)) {
    return pictures;
  }
  return home;
}

/**
 * Sanitizes a user-provided filename to a safe single-segment .gif basename.
 * @param {string} rawName
 * @returns {string}
 */
function sanitizeGifFilename(rawName) {
  let name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'antigravity-studio-export.gif';
  try {
    name = decodeURIComponent(name);
  } catch (e) {}
  name = path.basename(name).replace(/[/\\?%*:|"<>]/g, '_').trim();
  if (!name || name === '.' || name === '..') {
    name = 'antigravity-studio-export.gif';
  }
  if (!name.toLowerCase().endsWith('.gif')) {
    name += '.gif';
  }
  return name;
}

/**
 * Saves a GIF buffer into targetDir (defaults to Pictures) using a sanitized filename.
 * @param {Buffer} buffer
 * @param {Object} [options]
 * @param {string} [options.filename]
 * @param {string} [options.targetDir]
 * @returns {{success: boolean, savedPath: string, filename: string, fileSizeBytes: number}}
 */
function saveGifBuffer(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('GIF buffer is empty.');
  }
  const safeName = sanitizeGifFilename(options.filename);
  const resolvedDir = options.targetDir ? path.resolve(options.targetDir) : getDefaultPicturesDir();
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }
  const targetPath = path.join(resolvedDir, safeName);
  fs.writeFileSync(targetPath, buffer);
  return {
    success: true,
    savedPath: targetPath,
    filename: safeName,
    fileSizeBytes: buffer.length
  };
}

/**
 * Opens a native OS Save-As dialog without shell interpolation and writes buffer if confirmed.
 * @param {Buffer} buffer
 * @param {string} [defaultFilename]
 * @param {string} [initialDir]
 * @returns {Promise<{success: boolean, cancelled?: boolean, savedPath?: string, filename?: string, fileSizeBytes?: number}>}
 */
function saveGifWithDialog(buffer, defaultFilename, initialDir) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return Promise.reject(new Error('GIF buffer is empty.'));
  }

  const safeName = sanitizeGifFilename(defaultFilename);
  const startDir = initialDir && fs.existsSync(initialDir) ? path.resolve(initialDir) : getDefaultPicturesDir();
  const childEnv = {
    ...process.env,
    AGS_INITIAL_DIR: startDir,
    AGS_DEFAULT_FILE: safeName
  };

  return new Promise((resolve, reject) => {
    const finishSave = (selectedRaw) => {
      const selectedPath = (selectedRaw || '').trim();
      if (!selectedPath) {
        resolve({ success: false, cancelled: true });
        return;
      }
      const resolved = path.resolve(selectedPath);
      const parent = path.dirname(resolved);
      if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
      }
      fs.writeFileSync(resolved, buffer);
      resolve({
        success: true,
        savedPath: resolved,
        filename: path.basename(resolved),
        fileSizeBytes: buffer.length
      });
    };

    if (process.platform === 'win32') {
      const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms;',
        '$dlg = New-Object System.Windows.Forms.SaveFileDialog;',
        '$dlg.InitialDirectory = $env:AGS_INITIAL_DIR;',
        '$dlg.FileName = $env:AGS_DEFAULT_FILE;',
        "$dlg.Filter = 'GIF Image (*.gif)|*.gif|All Files (*.*)|*.*';",
        "$dlg.Title = 'Save GIF (Antigravity GIF Studio)';",
        'if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.FileName }'
      ].join(' ');

      execFile(
        'powershell.exe',
        ['-NoProfile', '-STA', '-Command', psScript],
        { windowsHide: true, env: childEnv },
        (err, stdout) => {
          if (err) {
            reject(err);
            return;
          }
          try { finishSave(stdout); } catch (writeErr) { reject(writeErr); }
        }
      );
    } else if (process.platform === 'darwin') {
      const osaScript = 'POSIX path of (choose file name with prompt "Save GIF (Antigravity GIF Studio)" default name (system attribute "AGS_DEFAULT_FILE"))';
      execFile('osascript', ['-e', osaScript], { env: childEnv }, (err, stdout) => {
        if (err) {
          // User cancelled dialog returns non-zero in osascript (-128)
          if (err.code === 1 || String(err.message).includes('-128')) {
            resolve({ success: false, cancelled: true });
            return;
          }
          reject(err);
          return;
        }
        try { finishSave(stdout); } catch (writeErr) { reject(writeErr); }
      });
    } else {
      const defaultPath = path.join(startDir, safeName);
      execFile(
        'zenity',
        ['--file-selection', '--save', '--confirm-overwrite', '--title=Save GIF (Antigravity GIF Studio)', `--filename=${defaultPath}`],
        { env: childEnv },
        (err, stdout) => {
          if (err) {
            if (err.code === 1) {
              resolve({ success: false, cancelled: true });
              return;
            }
            reject(err);
            return;
          }
          try { finishSave(stdout); } catch (writeErr) { reject(writeErr); }
        }
      );
    }
  });
}

/**
 * Reveals a file or directory in the native OS file manager without shell interpolation.
 * @param {string} [targetPath]
 * @returns {{success: boolean, opened: string}}
 */
function revealInFileManager(targetPath) {
  let resolved = targetPath ? path.resolve(targetPath) : '';
  if (!resolved || !fs.existsSync(resolved)) {
    resolved = getDefaultPicturesDir();
  }

  if (process.platform === 'win32') {
    const isDir = fs.statSync(resolved).isDirectory();
    const args = isDir ? [resolved] : [`/select,${resolved}`];
    execFile('explorer.exe', args, { windowsHide: false }, () => {});
  } else if (process.platform === 'darwin') {
    execFile('open', ['-R', resolved], () => {});
  } else {
    const dir = fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
    execFile('xdg-open', [dir], () => {});
  }

  return { success: true, opened: resolved };
}

module.exports = {
  getDefaultPicturesDir,
  sanitizeGifFilename,
  saveGifBuffer,
  saveGifWithDialog,
  revealInFileManager
};
