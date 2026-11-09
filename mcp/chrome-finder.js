/**
 * Antigravity GIF Studio — Chrome / Edge Binary Locator
 * 
 * Auto-detects Google Chrome and Microsoft Edge executables across
 * Windows, macOS, and Linux with zero manual configuration required.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Resolves the path to a Chromium-based browser executable.
 * Prioritizes environment variables, then Google Chrome, then Microsoft Edge.
 * 
 * @returns {string} Absolute path to the browser executable
 * @throws {Error} If no compatible browser binary is located
 */
function findChrome() {
  // 1. Honor explicit environment variable overrides
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates = [];
  const env = process.env;

  if (process.platform === 'win32') {
    const programFiles = env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = env.LOCALAPPDATA || '';

    // Standard Windows Chrome installation paths
    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : null
    );

    // Standard Windows Microsoft Edge installation paths
    candidates.push(
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      localAppData ? path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    // Linux and BSD standard paths
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/microsoft-edge',
      '/snap/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'No compatible Chromium-based browser (Google Chrome or Microsoft Edge) was found on the host system. ' +
    'Please set the CHROME_PATH or PUPPETEER_EXECUTABLE_PATH environment variable.'
  );
}

module.exports = {
  findChrome
};
