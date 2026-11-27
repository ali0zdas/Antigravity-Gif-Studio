/**
 * Antigravity GIF Studio — Test Utilities & Helpers
 * 
 * Provides pure-JavaScript GIF parsing/validation, SVG inspection,
 * stdio JSON-RPC MCP server interaction harness, and test fixture helpers.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TMP_DIR = path.join(__dirname, 'tmp');

function resolvePath(...segments) {
  return path.join(PROJECT_ROOT, ...segments);
}

function fileExists(relPath) {
  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(PROJECT_ROOT, relPath);
  return fs.existsSync(fullPath);
}

function readText(relPath) {
  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(PROJECT_ROOT, relPath);
  return fs.readFileSync(fullPath, 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function readBuffer(relPath) {
  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(PROJECT_ROOT, relPath);
  return fs.readFileSync(fullPath);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function getTempDir(subDir = 'default') {
  const dir = path.join(TMP_DIR, subDir);
  return ensureDir(dir);
}

function cleanTempDir() {
  if (fs.existsSync(TMP_DIR)) {
    try {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    } catch (e) {
      // Ignore if locked
    }
  }
}

/**
 * Pure JavaScript GIF89a / GIF87a Binary Parser & Validator
 * Inspects headers, dimensions, global palette, extensions, and frame descriptors.
 * 
 * @param {Buffer|Uint8Array} buf 
 * @returns {Object} Parsed GIF metadata
 */
function parseGifInfo(buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf);
  }

  if (buf.length < 13) {
    throw new Error(`Invalid GIF buffer: size is only ${buf.length} bytes (minimum 13 bytes required)`);
  }

  const sig = buf.toString('ascii', 0, 3);
  const ver = buf.toString('ascii', 3, 6);
  if (sig !== 'GIF' || (ver !== '87a' && ver !== '89a')) {
    throw new Error(`Invalid GIF signature: got "${sig}${ver}", expected "GIF87a" or "GIF89a"`);
  }

  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  const packed = buf[10];
  const gctFlag = (packed & 0x80) !== 0;
  const colorRes = ((packed & 0x70) >> 4) + 1;
  const gctSize = 2 ** ((packed & 0x07) + 1);
  const bgColorIndex = buf[11];
  const pixelAspect = buf[12];

  let offset = 13;
  let globalColorTable = null;
  if (gctFlag) {
    const gctByteLength = gctSize * 3;
    if (offset + gctByteLength > buf.length) {
      throw new Error('GIF GCT truncated');
    }
    globalColorTable = buf.subarray(offset, offset + gctByteLength);
    offset += gctByteLength;
  }

  const frames = [];
  let loopCount = null; // null means no Netscape block found
  let currentGraphicControl = null;

  while (offset < buf.length) {
    const blockType = buf[offset];

    if (blockType === 0x3B) {
      // GIF Trailer
      break;
    }

    if (blockType === 0x21) {
      // Extension Block
      const extType = buf[offset + 1];
      offset += 2;

      if (extType === 0xF9) {
        // Graphic Control Extension
        const blockSize = buf[offset];
        const gcePacked = buf[offset + 1];
        const disposal = (gcePacked >> 2) & 0x07;
        const transparentFlag = (gcePacked & 0x01) !== 0;
        const delayCs = buf.readUInt16LE(offset + 2); // 100ths of second
        const transparentIndex = buf[offset + 4];
        offset += blockSize + 1; // skip data + block terminator (0x00)
        if (buf[offset] === 0x00) offset++;

        currentGraphicControl = {
          disposal,
          transparent: transparentFlag,
          transparentIndex: transparentFlag ? transparentIndex : null,
          delayCs,
          delayMs: delayCs * 10
        };
      } else if (extType === 0xFF) {
        // Application Extension (e.g. NETSCAPE2.0)
        const blockSize = buf[offset];
        const appName = buf.toString('ascii', offset + 1, offset + 1 + blockSize);
        offset += blockSize + 1;

        if (appName.startsWith('NETSCAPE2.0') || appName.startsWith('ANIMEXTS1.0')) {
          const subBlockSize = buf[offset];
          if (subBlockSize === 3 && buf[offset + 1] === 1) {
            loopCount = buf.readUInt16LE(offset + 2);
          }
          offset += subBlockSize + 1;
        }

        // Skip any remaining sub-blocks until 0x00
        while (offset < buf.length && buf[offset] !== 0x00) {
          offset += buf[offset] + 1;
        }
        if (offset < buf.length && buf[offset] === 0x00) offset++;
      } else {
        // Other extension (Comment, Plain Text, etc.)
        while (offset < buf.length && buf[offset] !== 0x00) {
          offset += buf[offset] + 1;
        }
        if (offset < buf.length && buf[offset] === 0x00) offset++;
      }
    } else if (blockType === 0x2C) {
      // Image Descriptor (Frame)
      const frameLeft = buf.readUInt16LE(offset + 1);
      const frameTop = buf.readUInt16LE(offset + 3);
      const frameWidth = buf.readUInt16LE(offset + 5);
      const frameHeight = buf.readUInt16LE(offset + 7);
      const framePacked = buf[offset + 9];
      const hasLct = (framePacked & 0x80) !== 0;
      const lctSize = hasLct ? 2 ** ((framePacked & 0x07) + 1) : 0;
      offset += 10;

      let localColorTable = null;
      if (hasLct) {
        const lctByteLength = lctSize * 3;
        localColorTable = buf.subarray(offset, offset + lctByteLength);
        offset += lctByteLength;
      }

      // LZW Minimum Code Size
      const lzwMinCodeSize = buf[offset];
      offset++;

      // Image Data Sub-blocks
      const dataChunks = [];
      while (offset < buf.length && buf[offset] !== 0x00) {
        const subLen = buf[offset];
        offset++;
        dataChunks.push(buf.subarray(offset, offset + subLen));
        offset += subLen;
      }
      if (offset < buf.length && buf[offset] === 0x00) offset++;

      const rawImageData = Buffer.concat(dataChunks);

      frames.push({
        index: frames.length,
        left: frameLeft,
        top: frameTop,
        width: frameWidth,
        height: frameHeight,
        hasLct,
        lctSize,
        control: currentGraphicControl || { disposal: 0, transparent: false, delayMs: 100 },
        dataSize: rawImageData.length,
        dataHash: crypto.createHash('md5').update(rawImageData).digest('hex')
      });

      currentGraphicControl = null;
    } else {
      // Unknown byte, advance
      offset++;
    }
  }

  // Detect animation motion across frames:
  // Are there 2 or more frames, and do their raster byte hashes or coordinates differ?
  let hasAnimationMotion = false;
  if (frames.length > 1) {
    const firstHash = frames[0].dataHash;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i].dataHash !== firstHash || frames[i].left !== frames[0].left || frames[i].top !== frames[0].top) {
        hasAnimationMotion = true;
        break;
      }
    }
  }

  return {
    version: ver,
    width,
    height,
    hasGlobalColorTable: gctFlag,
    globalColorTableSize: gctSize,
    loopCount,
    frameCount: frames.length,
    frames,
    hasAnimationMotion,
    fileSizeBytes: buf.length
  };
}

/**
 * Validates XML / SVG structure and extracts animation metadata
 * @param {string} svgText 
 * @returns {Object} SVG metadata
 */
function inspectSvg(svgText) {
  if (typeof svgText !== 'string' || !svgText.trim()) {
    throw new Error('SVG text must be a non-empty string');
  }

  const hasSvgTag = /<svg[^>]*>[\s\S]*<\/svg>/i.test(svgText);
  const viewBoxMatch = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const widthMatch = svgText.match(/width\s*=\s*["']([^"']+)["']/i);
  const heightMatch = svgText.match(/height\s*=\s*["']([^"']+)["']/i);

  // Keyframes inspection
  const keyframeMatches = [...svgText.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  const durationMatches = [...svgText.matchAll(/([0-9.]+)s/g)].map(m => parseFloat(m[1]));
  
  // SMIL inspection
  const smilAnimateCount = (svgText.match(/<animate[\s>]/gi) || []).length;
  const smilTransformCount = (svgText.match(/<animateTransform[\s>]/gi) || []).length;

  return {
    isValid: hasSvgTag,
    hasSvgTag,
    viewBox: viewBoxMatch ? viewBoxMatch[1] : null,
    width: widthMatch ? widthMatch[1] : null,
    height: heightMatch ? heightMatch[1] : null,
    keyframes: keyframeMatches,
    durations: durationMatches,
    hasKeyframes: keyframeMatches.length > 0,
    hasSmil: (smilAnimateCount + smilTransformCount) > 0,
    smilAnimateCount,
    smilTransformCount
  };
}

/**
 * Helper to spawn and interact with the local MCP Server via stdio JSON-RPC
 * @param {Object} options
 * @returns {Promise<Object>} MCP Client Interface
 */
async function spawnMcpServer(options = {}) {
  const serverPath = options.serverPath || resolvePath('mcp', 'index.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error(`MCP server entry point not found at: ${serverPath}`);
  }

  const extraArgs = Array.isArray(options.args) ? options.args : [];
  const child = spawn(process.execPath, [serverPath, ...extraArgs], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env || {}), NODE_ENV: 'test' }
  });

  let messageId = 1;
  const pendingRequests = new Map();
  let buffer = '';

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep last incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id && pendingRequests.has(msg.id)) {
          const { resolve, reject } = pendingRequests.get(msg.id);
          pendingRequests.delete(msg.id);
          if (msg.error) {
            reject(new Error(`MCP Error ${msg.error.code}: ${msg.error.message}`));
          } else {
            resolve(msg.result);
          }
        }
      } catch (e) {
        // Not a JSON message or debug trace
      }
    }
  });

  let stderrOutput = '';
  child.stderr.on('data', (chunk) => {
    stderrOutput += chunk.toString('utf8');
  });

  function sendRpc(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      
      const timer = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error(`MCP RPC timeout for method "${method}" (id: ${id}). Stderr: ${stderrOutput}`));
        }
      }, options.timeout || 15000);

      pendingRequests.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });

      child.stdin.write(payload);
    });
  }

  // Perform MCP handshake
  const initResult = await sendRpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'antigravity-test-client', version: '1.0.0' }
  });

  // Send notifications/initialized
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {}
  }) + '\n');

  return {
    child,
    initResult,
    sendRpc,
    listTools: () => sendRpc('tools/list', {}),
    callTool: (name, args) => sendRpc('tools/call', { name, arguments: args }),
    listResources: () => sendRpc('resources/list', {}),
    readResource: (uri) => sendRpc('resources/read', { uri }),
    close: () => {
      return new Promise((resolve) => {
        child.kill();
        resolve();
      });
    }
  };
}

/**
 * Creates a synthetic minimal GIF using gifenc for test assertions
 */
function createSyntheticGif(options = {}) {
  const { GIFEncoder, quantize, applyPalette } = require('gifenc');
  const width = options.width || 100;
  const height = options.height || 100;
  const frameCount = options.frameCount || 2;
  const delay = options.delay || 100;
  const transparent = options.transparent !== false;

  const gif = GIFEncoder();

  for (let f = 0; f < frameCount; f++) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      if (transparent && i < (rgba.length / 2)) {
        rgba[i] = 0;
        rgba[i + 1] = 0;
        rgba[i + 2] = 0;
        rgba[i + 3] = 0; // transparent
      } else {
        rgba[i] = (f * 50) % 255;
        rgba[i + 1] = 120;
        rgba[i + 2] = 200;
        rgba[i + 3] = 255; // opaque
      }
    }

    const palette = quantize(rgba, 256, { format: 'rgba4444', oneBitAlpha: true });
    const index = applyPalette(rgba, palette, 'rgba4444');
    const transparentIndex = palette.findIndex(p => p[3] === 0);

    gif.writeFrame(index, width, height, {
      palette,
      delay,
      transparent: transparent && transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: 2
    });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

module.exports = {
  PROJECT_ROOT,
  FIXTURES_DIR,
  TMP_DIR,
  resolvePath,
  fileExists,
  readText,
  readJson,
  readBuffer,
  getTempDir,
  cleanTempDir,
  parseGifInfo,
  inspectSvg,
  spawnMcpServer,
  createSyntheticGif
};
