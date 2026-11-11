/**
 * Antigravity GIF Studio — GIF Optimization & Compression Engine (Remediated)
 * 
 * Provides pure-JavaScript GIF optimization including palette reduction,
 * frame deduplication with delay merging, and lossy color clustering,
 * with persistent canvas accumulation to preserve disposal method 1 (sub-frame) GIFs.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const omggif = require('omggif');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

/**
 * Optimizes an animated or static GIF through palette reduction,
 * consecutive frame deduplication, and color quantization.
 * 
 * @param {Object} options
 * @param {string} [options.inputGif] - File path or base64 data
 * @param {string} [options.inputPath] - File path to input GIF
 * @param {string} [options.inputBase64] - Base64 encoded input GIF
 * @param {string} [options.outputPath] - File path for optimized output GIF
 * @param {number} [options.maxColors=128] - Reduced palette size (2-256)
 * @param {number} [options.lossy=0] - Lossy quantization level (0-100)
 * @param {boolean} [options.frameDeduplication=true] - Whether to merge identical consecutive frames
 * @returns {Promise<Object>} Optimization results and metrics
 */
async function optimizeGif(options = {}) {
  const {
    inputGif,
    inputPath,
    inputBase64,
    outputPath,
    maxColors = 128,
    lossy = 20,
    frameDeduplication = true
  } = options;

  // 1. Resolve and validate input buffer
  let inputBuffer = null;

  if (inputPath) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input GIF file not found: ${inputPath}`);
    }
    inputBuffer = fs.readFileSync(inputPath);
  } else if (inputBase64) {
    inputBuffer = Buffer.from(inputBase64, 'base64');
  } else if (inputGif) {
    if (typeof inputGif === 'string') {
      if (fs.existsSync(inputGif)) {
        inputBuffer = fs.readFileSync(inputGif);
      } else {
        // Treat as base64 string
        inputBuffer = Buffer.from(inputGif.replace(/^data:image\/gif;base64,/, ''), 'base64');
      }
    } else if (Buffer.isBuffer(inputGif)) {
      inputBuffer = inputGif;
    }
  }

  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error('Input GIF is required. Please specify inputPath, inputBase64, or inputGif.');
  }

  if (inputBuffer.length < 13) {
    throw new Error(`Corrupt or truncated GIF header: buffer is only ${inputBuffer.length} bytes.`);
  }

  const sig = inputBuffer.toString('ascii', 0, 3);
  const ver = inputBuffer.toString('ascii', 3, 6);
  if (sig !== 'GIF' || (ver !== '87a' && ver !== '89a')) {
    throw new Error(`Invalid GIF header: expected GIF87a or GIF89a signature, got "${sig}${ver}".`);
  }

  let reader;
  try {
    reader = new omggif.GifReader(inputBuffer);
  } catch (err) {
    throw new Error(`Corrupt or invalid GIF payload: ${err.message}`);
  }

  const width = reader.width;
  const height = reader.height;
  const numFrames = reader.numFrames();

  if (width <= 0 || height <= 0 || numFrames <= 0) {
    throw new Error(`Invalid GIF geometry or zero frames: ${width}x${height}, ${numFrames} frames.`);
  }

  // Clamp maxColors
  let colorsLimit = Number(maxColors) || 128;
  colorsLimit = Math.max(2, Math.min(256, Math.round(colorsLimit)));

  // 2. Decode raw frames with persistent canvas accumulation buffer
  const rawFrames = [];
  const canvas = new Uint8Array(width * height * 4);
  let previousCanvas = null;

  for (let i = 0; i < numFrames; i++) {
    const frameInfo = reader.frameInfo(i);

    // Save previous canvas before blitting if disposal method 3 (restore to previous)
    if (frameInfo.disposal === 3) {
      previousCanvas = new Uint8Array(canvas);
    }

    reader.decodeAndBlitFrameRGBA(i, canvas);

    // Snapshot current accumulated canvas state for this frame
    const frameRgba = new Uint8Array(canvas);
    rawFrames.push({
      rgba: frameRgba,
      delayMs: Math.max(10, (frameInfo.delay || 10) * 10),
      disposal: 2, // Re-encoding writes full frames, so disposal 2 (restore to bg) is clean
      transparent: frameInfo.transparent_index !== null
    });

    // Handle disposal for subsequent frames
    if (frameInfo.disposal === 2) {
      // Clear subrect to transparent/background
      const fx = Math.max(0, frameInfo.x || 0);
      const fy = Math.max(0, frameInfo.y || 0);
      const fw = Math.min(width - fx, frameInfo.width || width);
      const fh = Math.min(height - fy, frameInfo.height || height);
      for (let row = fy; row < fy + fh; row++) {
        const start = (row * width + fx) * 4;
        const end = start + fw * 4;
        canvas.fill(0, start, end);
      }
    } else if (frameInfo.disposal === 3 && previousCanvas) {
      // Restore canvas from previous snapshot
      canvas.set(previousCanvas);
    }
    // disposal 0 or 1: do nothing, leave canvas in place for next frame
  }

  // 3. Consecutive Frame Deduplication (merge 100% identical consecutive frames)
  let processedFrames = rawFrames;
  if (frameDeduplication && rawFrames.length > 1) {
    const deduped = [];
    for (let i = 0; i < rawFrames.length; i++) {
      if (deduped.length > 0) {
        const prev = deduped[deduped.length - 1];
        let identical = true;
        for (let p = 0; p < prev.rgba.length; p++) {
          if (prev.rgba[p] !== rawFrames[i].rgba[p]) {
            identical = false;
            break;
          }
        }
        if (identical) {
          prev.delayMs += rawFrames[i].delayMs;
          continue;
        }
      }
      deduped.push(rawFrames[i]);
    }
    processedFrames = deduped;
  }

  // 4. Lossy channel clustering if lossy > 0
  const lossyVal = Number(lossy) || 0;
  if (lossyVal > 0) {
    const step = Math.max(2, Math.round((lossyVal / 100) * 24));
    for (const frame of processedFrames) {
      const data = frame.rgba;
      for (let p = 0; p < data.length; p += 4) {
        if (data[p + 3] > 0) {
          data[p] = Math.round(data[p] / step) * step;
          data[p + 1] = Math.round(data[p + 1] / step) * step;
          data[p + 2] = Math.round(data[p + 2] / step) * step;
        }
      }
    }
  }

  // 5. Re-encode optimized GIF using stable unified global palette
  const gif = GIFEncoder();

  // Sample across frames to derive master unified palette
  const sampleIntervalCount = Math.min(10, processedFrames.length);
  const sampleStep = Math.max(1, Math.floor(processedFrames.length / sampleIntervalCount));
  const samplePixelsPerFrame = Math.max(100, Math.floor(100000 / sampleIntervalCount));
  const totalFramePixels = width * height;
  const stride = Math.max(1, Math.floor(totalFramePixels / samplePixelsPerFrame));
  const sampleBuffer = new Uint8Array(sampleIntervalCount * samplePixelsPerFrame * 4);
  let sampleOffset = 0;
  let hasAnyTransparency = false;

  for (let s = 0; s < sampleIntervalCount; s++) {
    const frame = processedFrames[s * sampleStep];
    if (frame.transparent) hasAnyTransparency = true;
    for (let p = 0; p < totalFramePixels && sampleOffset + 4 <= sampleBuffer.length; p += stride) {
      const idx = p * 4;
      if (frame.rgba[idx + 3] < 250) hasAnyTransparency = true;
      sampleBuffer[sampleOffset++] = frame.rgba[idx];
      sampleBuffer[sampleOffset++] = frame.rgba[idx + 1];
      sampleBuffer[sampleOffset++] = frame.rgba[idx + 2];
      sampleBuffer[sampleOffset++] = frame.rgba[idx + 3];
    }
  }

  const optFormat = hasAnyTransparency ? 'rgba4444' : 'rgb565';
  const globalPalette = quantize(sampleBuffer.subarray(0, sampleOffset), colorsLimit, {
    format: optFormat,
    oneBitAlpha: hasAnyTransparency
  });
  const transparentIndex = hasAnyTransparency ? globalPalette.findIndex(p => p[3] === 0) : -1;

  for (let i = 0; i < processedFrames.length; i++) {
    const frame = processedFrames[i];
    const index = applyPalette(frame.rgba, globalPalette, optFormat);

    gif.writeFrame(index, width, height, {
      palette: i === 0 ? globalPalette : null,
      delay: frame.delayMs,
      transparent: hasAnyTransparency && transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: frame.disposal
    });
  }

  gif.finish();
  let optimizedBuffer = Buffer.from(gif.bytes());

  // Guarantee optimized size does not exceed original size
  if (optimizedBuffer.length > inputBuffer.length) {
    optimizedBuffer = inputBuffer;
  }

  const originalBytes = inputBuffer.length;
  const optimizedBytes = optimizedBuffer.length;
  const savingsPercent = Math.max(0, Math.round(((originalBytes - optimizedBytes) / originalBytes) * 100));

  const result = {
    success: true,
    originalBytes,
    optimizedBytes,
    savingsPercent
  };

  if (outputPath) {
    const resolvedPath = path.resolve(outputPath);
    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, optimizedBuffer);
    result.outputPath = resolvedPath;
  } else {
    const base64 = optimizedBuffer.toString('base64');
    result.optimizedBase64 = base64;
    result.gifBase64 = base64;
  }

  return result;
}

module.exports = {
  optimizeGif
};
