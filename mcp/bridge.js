/**
 * Antigravity GIF Studio — Local HTTP Bridge Server
 * 
 * Provides a lightweight localhost loopback bridge for the Generative UI preview widget
 * to bypass webview iframe sandbox restrictions and directly save rendered GIFs
 * to the user's Windows Pictures directory (or custom path) and open in Explorer.
 */

'use strict';

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { exec } = require('node:child_process');

const DEFAULT_PORT = 37190;

/**
 * Returns the default Windows Pictures directory path,
 * falling back to user home directory if not found.
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
 * Starts the local HTTP bridge on 127.0.0.1.
 * 
 * @param {number} [port=37190]
 * @returns {http.Server}
 */
function startLocalBridge(port = DEFAULT_PORT, shouldUnref = true) {
  const server = http.createServer((req, res) => {
    // Handle CORS & Chromium Private Network Access (PNA) preflights
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Target-Dir');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let url;
    try {
      url = new URL(req.url, `http://localhost:${port}`);
    } catch (e) {
      res.writeHead(400);
      res.end();
      return;
    }

    // Healthcheck / discovery endpoint
    if (url.pathname === '/ping' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        server: 'antigravity-gif-studio-bridge',
        defaultDir: getDefaultPicturesDir()
      }));
      return;
    }

    // Static preview server endpoint
    if (url.pathname === '/preview' && req.method === 'GET') {
      const artifactPath = path.join('C:\\Users\\HP\\.gemini\\antigravity\\brain\\65dae600-12dd-4b4b-b08a-0385895fe052', 'night_seascape_preview.html');
      if (fs.existsSync(artifactPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(artifactPath).pipe(res);
        return;
      }
    }

    // Save GIF directly to Windows Pictures
    if (url.pathname === '/save' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          let filename = req.headers['x-filename'] || 'antigravity-studio-export.gif';
          try {
            filename = decodeURIComponent(filename);
          } catch(e) {}

          // Sanitize filename
          filename = filename.replace(/[/\\?%*:|"<>]/g, '_');
          if (!filename.toLowerCase().endsWith('.gif')) {
            filename += '.gif';
          }

          const targetDir = getDefaultPicturesDir();
          const targetPath = path.join(targetDir, filename);

          fs.writeFileSync(targetPath, buffer);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            savedPath: targetPath,
            filename: filename,
            fileSizeBytes: buffer.length
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Reveal file in Windows Explorer
    if (url.pathname === '/open-folder' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          let targetPath = '';
          if (chunks.length > 0) {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            targetPath = body.path;
          }
          if (!targetPath || !fs.existsSync(targetPath)) {
            targetPath = getDefaultPicturesDir();
          }

          if (process.platform === 'win32') {
            exec(`explorer.exe /select,"${targetPath}"`);
          } else if (process.platform === 'darwin') {
            exec(`open -R "${targetPath}"`);
          } else {
            exec(`xdg-open "${path.dirname(targetPath)}"`);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, opened: targetPath }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.on('error', err => {
    // If port is already in use by a parallel MCP instance, fail silently without crash
    if (err.code !== 'EADDRINUSE') {
      console.error('Bridge error:', err.message);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    if (shouldUnref) {
      server.unref();
    }
  });

  return server;
}

module.exports = {
  startLocalBridge,
  getDefaultPicturesDir,
  DEFAULT_PORT
};

if (require.main === module) {
  const server = startLocalBridge(DEFAULT_PORT, false);
  console.log(`Bridge server running on http://127.0.0.1:${DEFAULT_PORT}`);
}
