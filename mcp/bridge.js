/**
 * Antigravity GIF Studio — Optional Legacy Local HTTP Bridge Server
 *
 * Disabled by default in MCP App mode. Only started when `--legacy-bridge`
 * is passed for standalone `<agent-embed>` HTML previews.
 */

'use strict';

const http = require('node:http');
const {
  getDefaultPicturesDir,
  saveGifBuffer,
  saveGifWithDialog,
  revealInFileManager
} = require('./os-actions.js');

const DEFAULT_PORT = 37190;
const MAX_BODY_BYTES = 50 * 1024 * 1024; // 50 MiB limit

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        aborted = true;
        reject(new Error(`Payload exceeds ${MAX_BODY_BYTES} byte limit.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      if (!aborted) reject(err);
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

/**
 * Starts the local HTTP bridge on 127.0.0.1.
 *
 * @param {number} [port=37190]
 * @param {boolean} [shouldUnref=true]
 * @returns {http.Server}
 */
function startLocalBridge(port = DEFAULT_PORT, shouldUnref = true) {
  const server = http.createServer(async (req, res) => {
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

    if (url.pathname === '/ping' && req.method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        server: 'antigravity-gif-studio-bridge',
        defaultDir: getDefaultPicturesDir()
      });
      return;
    }

    if (url.pathname === '/save' && req.method === 'POST') {
      try {
        const buffer = await readRequestBody(req);
        const result = saveGifBuffer(buffer, {
          filename: req.headers['x-filename']
        });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    if (url.pathname === '/save-as' && req.method === 'POST') {
      try {
        const buffer = await readRequestBody(req);
        const result = await saveGifWithDialog(buffer, req.headers['x-filename']);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    if (url.pathname === '/open-folder' && req.method === 'POST') {
      try {
        const buffer = await readRequestBody(req);
        let targetPath = '';
        if (buffer.length > 0) {
          const body = JSON.parse(buffer.toString('utf8'));
          targetPath = body.path || '';
        }
        sendJson(res, 200, revealInFileManager(targetPath));
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  server.on('error', (err) => {
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
  startLocalBridge(DEFAULT_PORT, false);
  console.log(`Bridge server running on http://127.0.0.1:${DEFAULT_PORT}`);
}
