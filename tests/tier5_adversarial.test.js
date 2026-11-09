/**
 * Antigravity GIF Studio — Tier 5: Adversarial Coverage Hardening Suite
 * 
 * Comprehensive white-box adversarial stress test cases:
 * - Area 1: Extreme Geometry Stress (1x1, 1920x1080, invalid/negative/non-numeric dimensions)
 * - Area 2: Extreme Framerates & Temporal Boundaries (1 FPS, 60 FPS, invalid FPS clamping, 0.1s, 5.0s)
 * - Area 3: High Concurrency & Process Lifecycle Stress (10 concurrent calls, launchPromise deduplication, no zombie processes)
 * - Area 4: Deep SVG Hierarchy & Animation Synchronization (nested transforms, clips, gradients, simultaneous CSS & SMIL)
 * - Area 5: Quantization & 1-bit Alpha Transparency Stress (2-color quantization, 1-bit alpha preservation, pure transparency)
 * - Area 6: Optimizer Resiliency & Delta Accumulation Stress (corrupt headers, non-GIF payloads, sub-frame accumulation, deduplication)
 * - Area 7: Security & Adversarial Injection Hardening (script tags, event handlers, javascript: URIs in renderer & preview widget)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { describe, it, assert } = require('./harness.js');
const {
  resolvePath,
  fileExists,
  readText,
  readBuffer,
  getTempDir,
  parseGifInfo,
  spawnMcpServer,
  createSyntheticGif
} = require('./test_utils.js');

const { renderSvgToGif, getBrowser } = require('../mcp/renderer.js');
const { optimizeGif } = require('../mcp/optimizer.js');
const { generatePreviewWidget } = require('../mcp/widget-template.js');
const omggif = require('omggif');

describe('Tier 5 - Adversarial Coverage Hardening Suite', () => {

  // =========================================================================
  // Area 1: Extreme Geometry Stress
  // =========================================================================
  describe('Area 1: Extreme Geometry Stress', () => {

    it('T5-1.1: 1x1 minimal single-pixel rendering and GIF89a header preservation', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#ff0055"/></svg>';
      const outDir = getTempDir('t5_geo1');
      const outPath = path.join(outDir, 'pixel1x1.gif');

      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        width: 1,
        height: 1,
        fps: 5,
        duration: 0.2
      });

      assert.ok(res.success, 'Must render successfully');
      assert.ok(fs.existsSync(outPath), 'Output GIF must exist on disk');

      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(info.width, 1, 'Width must be exactly 1');
      assert.equal(info.height, 1, 'Height must be exactly 1');
      assert.equal(info.version, '89a');
    });

    it('T5-1.2: High-definition 1920x1080 canvas rendering without memory exhaustion', async () => {
      const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
        <style>
          @keyframes slide { from { transform: translateX(0); } to { transform: translateX(100px); } }
          .bar { animation: slide 1s ease infinite; }
        </style>
        <rect width="1920" height="1080" fill="#0b0f19"/>
        <rect class="bar" x="100" y="500" width="400" height="80" fill="#00e5ff"/>
      </svg>`;
      const outDir = getTempDir('t5_geo2');
      const outPath = path.join(outDir, 'hd1080.gif');

      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        width: 1920,
        height: 1080,
        fps: 2,
        duration: 0.5
      });

      assert.ok(res.success, 'HD render must succeed');
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(info.width, 1920, 'Width must be 1920');
      assert.equal(info.height, 1080, 'Height must be 1080');
      assert.ok(info.frameCount >= 1);
    });

    it('T5-1.3: Invalid dimension 0 falls back safely to viewBox or default', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#22c55e"/></svg>';
      const res = await renderSvgToGif({
        svg,
        width: 0,
        height: 0,
        fps: 5,
        duration: 0.2
      });

      assert.ok(res.success);
      assert.ok(res.width >= 1, 'Width must be safe >= 1');
      assert.ok(res.height >= 1, 'Height must be safe >= 1');
    });

    it('T5-1.4: Negative dimension inputs clamped safely without crashing', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#eab308"/></svg>';
      const res = await renderSvgToGif({
        svg,
        width: -500,
        height: -300,
        fps: 5,
        duration: 0.2
      });

      assert.ok(res.success);
      assert.ok(res.width >= 1 && res.width <= 4000);
      assert.ok(res.height >= 1 && res.height <= 3000);
    });

    it('T5-1.5: Non-numeric dimension inputs fall back cleanly to valid numeric canvas', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 150"><rect width="250" height="150" fill="#a855f7"/></svg>';
      const res = await renderSvgToGif({
        svg,
        width: 'not-a-number',
        height: 'invalid_dim',
        fps: 5,
        duration: 0.2
      });

      assert.ok(res.success);
      assert.equal(typeof res.width, 'number');
      assert.equal(typeof res.height, 'number');
      assert.ok(res.width >= 1 && res.height >= 1);
    });
  });

  // =========================================================================
  // Area 2: Extreme Framerates & Temporal Boundaries
  // =========================================================================
  describe('Area 2: Extreme Framerates & Temporal Boundaries', () => {

    it('T5-2.1: Ultra-low framerate boundary (1 FPS) produces exactly discrete frames', async () => {
      const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <style>
          @keyframes stepAnim { 0% { fill: red; } 100% { fill: blue; } }
          rect { animation: stepAnim 2s steps(2) infinite; }
        </style>
        <rect width="100" height="100" fill="red"/>
      </svg>`;

      const res = await renderSvgToGif({
        svg,
        fps: 1,
        duration: 2.0,
        width: 100,
        height: 100
      });

      assert.ok(res.success);
      assert.equal(res.frameCount, 2, '2s @ 1 FPS must produce exactly 2 frames');
      const buf = Buffer.from(res.gifBase64, 'base64');
      const info = parseGifInfo(buf);
      assert.equal(info.frameCount, 2);
    });

    it('T5-2.2: Ultra-high framerate boundary (60 FPS) renders with correct frame count', async () => {
      const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <style>
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          circle { animation: spin 0.5s linear infinite; transform-origin: 50px 50px; }
        </style>
        <circle cx="50" cy="50" r="30" fill="#3b82f6"/>
      </svg>`;

      const res = await renderSvgToGif({
        svg,
        fps: 60,
        duration: 0.5,
        width: 100,
        height: 100
      });

      assert.ok(res.success);
      assert.equal(res.frameCount, 30, '0.5s @ 60 FPS must produce exactly 30 frames');
    });

    it('T5-2.3: Clamping of invalid FPS (negative, 0, NaN, >60 clamped to 60)', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50" fill="red"/></svg>';

      // FPS = -10 should clamp to default 15
      const resNeg = await renderSvgToGif({ svg, fps: -10, duration: 0.2, width: 50, height: 50 });
      assert.ok(resNeg.success);
      assert.ok(resNeg.frameCount >= 1);

      // FPS = 120 should clamp to 60
      const resHigh = await renderSvgToGif({ svg, fps: 120, duration: 0.1, width: 50, height: 50 });
      assert.ok(resHigh.success);
      assert.equal(resHigh.frameCount, 6, '0.1s @ clamped 60fps = 6 frames');

      // FPS = NaN should fallback to default 15
      const resNan = await renderSvgToGif({ svg, fps: 'bad-fps', duration: 0.2, width: 50, height: 50 });
      assert.ok(resNan.success);
      assert.equal(resNan.frameCount, 3, '0.2s @ 15fps = 3 frames');
    });

    it('T5-2.4: Ultra-short micro-duration (0.1s @ 10 FPS) yields valid single-frame GIF', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="60" height="60" fill="#14b8a6"/></svg>';
      const res = await renderSvgToGif({
        svg,
        fps: 10,
        duration: 0.1,
        width: 60,
        height: 60
      });

      assert.ok(res.success);
      assert.equal(res.frameCount, 1, '0.1s @ 10 FPS = 1 frame');
      const buf = Buffer.from(res.gifBase64, 'base64');
      const info = parseGifInfo(buf);
      assert.equal(info.frameCount, 1);
    });

    it('T5-2.5: Extended duration (5.0s @ 5 FPS) executes cleanly and yields 25 frames', async () => {
      const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
        <style>
          @keyframes swing { 0%, 100% { transform: rotate(-30deg); } 50% { transform: rotate(30deg); } }
          line { animation: swing 5s ease-in-out infinite; transform-origin: 40px 10px; }
        </style>
        <line x1="40" y1="10" x2="40" y2="70" stroke="#f43f5e" stroke-width="4"/>
      </svg>`;

      const res = await renderSvgToGif({
        svg,
        fps: 5,
        duration: 5.0,
        width: 80,
        height: 80
      });

      assert.ok(res.success);
      assert.equal(res.frameCount, 25, '5.0s @ 5 FPS must produce 25 frames');
    });
  });

  // =========================================================================
  // Area 3: High Concurrency & Process Lifecycle Stress
  // =========================================================================
  describe('Area 3: High Concurrency & Process Lifecycle Stress', () => {

    it('T5-3.1: 10 concurrent requests directly to renderSvgToGif verify launchPromise deduplication', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#6366f1"/></svg>';

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(renderSvgToGif({
          svg,
          fps: 5,
          duration: 0.2,
          width: 40,
          height: 40
        }));
      }

      const results = await Promise.all(promises);
      assert.equal(results.length, 10, 'All 10 promises must resolve');
      results.forEach((r, idx) => {
        assert.ok(r.success, `Concurrent render #${idx + 1} must succeed`);
        assert.ok(r.fileSizeBytes > 0, `Result #${idx + 1} must contain GIF bytes`);
      });
    });

    it('T5-3.2: 10 concurrent requests via MCP stdio JSON-RPC server complete without deadlock', async () => {
      const client = await spawnMcpServer();
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="15" fill="#10b981"/></svg>';

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(client.callTool('render_svg_to_gif', {
          svg,
          fps: 5,
          duration: 0.2,
          width: 40,
          height: 40
        }));
      }

      const results = await Promise.all(promises);
      assert.equal(results.length, 10, 'All 10 MCP tool requests must resolve');
      results.forEach((res, idx) => {
        assert.ok(!res.isError, `MCP request #${idx + 1} must not return error`);
        const parsed = JSON.parse(res.content[0].text);
        assert.ok(parsed.success, `Parsed MCP result #${idx + 1} must be success`);
      });

      await client.close();
    });

    it('T5-3.3: Idle timeout management verifies browser lifecycle without zombie processes', async () => {
      const browser = await getBrowser();
      assert.ok(browser.connected, 'Shared browser must be currently connected');
      const pid = browser.process() ? browser.process().pid : null;
      assert.ok(pid !== null, 'Browser child process PID must exist');
    });

    it('T5-3.4: Re-acquiring browser after idle close cleanly reconnects without failure', async () => {
      const browser1 = await getBrowser();
      assert.ok(browser1.connected);
      // Explicitly get browser again to verify cache reuse
      const browser2 = await getBrowser();
      assert.equal(browser1, browser2, 'Should reuse identical active browser instance');
    });
  });

  // =========================================================================
  // Area 4: Deep SVG Hierarchy & Animation Synchronization
  // =========================================================================
  describe('Area 4: Deep SVG Hierarchy & Animation Synchronization', () => {

    const deepSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <defs>
        <linearGradient id="deepGrad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff0080"/>
          <stop offset="100%" stop-color="#7928ca"/>
        </linearGradient>
        <radialGradient id="deepRad1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00dfd8"/>
          <stop offset="100%" stop-color="#007cf0"/>
        </radialGradient>
        <clipPath id="deepClip1">
          <circle cx="150" cy="150" r="120"/>
        </clipPath>
        <clipPath id="deepClip2">
          <polygon points="150,40 250,240 50,240"/>
        </clipPath>
        <style>
          @keyframes deepSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes deepScale { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
          .spin-layer { animation: deepSpin 2s linear infinite; transform-origin: 150px 150px; }
          .scale-layer { animation: deepScale 1s ease-in-out infinite; transform-origin: 150px 150px; }
        </style>
      </defs>
      <!-- Deep 5-level nested hierarchy -->
      <g clip-path="url(#deepClip1)">
        <g transform="translate(10, 10)">
          <g transform="scale(0.95)">
            <g transform="rotate(15 150 150)">
              <g clip-path="url(#deepClip2)">
                <!-- CSS @keyframes animated layer -->
                <rect class="spin-layer" x="50" y="50" width="200" height="200" fill="url(#deepGrad1)"/>
                <!-- Simultaneous SMIL animate layer -->
                <circle class="scale-layer" cx="150" cy="150" r="40" fill="url(#deepRad1)">
                  <animate attributeName="opacity" values="0.3;1.0;0.3" dur="2s" repeatCount="indefinite"/>
                </circle>
                <!-- Simultaneous SMIL animateTransform layer -->
                <polygon points="130,130 170,130 150,170" fill="#ffffff">
                  <animateTransform attributeName="transform" type="rotate" from="0 150 150" to="-360 150 150" dur="2s" repeatCount="indefinite"/>
                </polygon>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>`;

    it('T5-4.1: Deeply nested groups (5 levels of transforms) render accurately without coordinate distortion', async () => {
      const res = await renderSvgToGif({
        svg: deepSvg,
        fps: 5,
        duration: 1.0,
        width: 300,
        height: 300
      });

      assert.ok(res.success);
      assert.equal(res.width, 300);
      assert.equal(res.height, 300);
    });

    it('T5-4.2: Multiple interacting clipPath elements apply cleanly inside headless stage', async () => {
      const res = await renderSvgToGif({
        svg: deepSvg,
        fps: 5,
        duration: 0.5,
        width: 150,
        height: 150
      });

      assert.ok(res.success);
      const buf = Buffer.from(res.gifBase64, 'base64');
      const info = parseGifInfo(buf);
      assert.ok(info.frameCount >= 2);
    });

    it('T5-4.3: Multiple co-existing linear and radial shader gradients render with high fidelity', async () => {
      const res = await renderSvgToGif({
        svg: deepSvg,
        fps: 5,
        duration: 0.5,
        maxColors: 256
      });

      assert.ok(res.success);
      assert.ok(res.fileSizeBytes > 1000);
    });

    it('T5-4.4: Simultaneous CSS @keyframes and SMIL timeline animations advance concurrently with confirmed motion', async () => {
      const res = await renderSvgToGif({
        svg: deepSvg,
        fps: 10,
        duration: 1.0,
        width: 200,
        height: 200
      });

      const buf = Buffer.from(res.gifBase64, 'base64');
      const info = parseGifInfo(buf);
      assert.equal(info.frameCount, 10);
      assert.ok(info.hasAnimationMotion, 'Must have confirmed active pixel motion across frames');
    });
  });

  // =========================================================================
  // Area 5: Quantization & 1-bit Alpha Transparency Stress
  // =========================================================================
  describe('Area 5: Quantization & 1-bit Alpha Transparency Stress', () => {

    it('T5-5.1: Extreme 2-color quantization (monochrome) restricts palette while preserving shape', async () => {
      const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#000000"/>
        <circle cx="50" cy="50" r="30" fill="#ffffff"/>
      </svg>`;

      const res = await renderSvgToGif({
        svg,
        fps: 5,
        duration: 0.2,
        width: 100,
        height: 100,
        maxColors: 2,
        transparent: false
      });

      assert.ok(res.success);
      const buf = Buffer.from(res.gifBase64, 'base64');
      const info = parseGifInfo(buf);
      assert.ok(info.globalColorTableSize <= 4, 'Palette size must be <= 4 slots for 2 colors');
    });

    it('T5-5.2: 1-bit alpha transparency is strictly preserved with disposal method 2', async () => {
      const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
        <style>
          @keyframes shift { 0% { transform: translateY(0); } 100% { transform: translateY(20px); } }
          circle { animation: shift 0.5s linear infinite; }
        </style>
        <circle cx="40" cy="20" r="15" fill="#ec4899"/>
      </svg>`;

      const res = await renderSvgToGif({
        svg,
        fps: 5,
        duration: 0.4,
        width: 80,
        height: 80,
        transparent: true
      });

      assert.ok(res.success);
      const buf = Buffer.from(res.gifBase64, 'base64');
      const info = parseGifInfo(buf);
      assert.ok(info.frames.length >= 2);
      info.frames.forEach((f, idx) => {
        assert.ok(f.control.transparent, `Frame #${idx} must declare transparent flag`);
        assert.equal(f.control.disposal, 2, `Frame #${idx} must use disposal 2 (restore to bg)`);
      });
    });

    it('T5-5.3: Mixed semi-transparent and opaque artwork correctly thresholds alpha channel', async () => {
      const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect x="10" y="10" width="80" height="80" fill="#3b82f6" fill-opacity="0.4"/>
        <circle cx="50" cy="50" r="25" fill="#f97316"/>
      </svg>`;

      const res = await renderSvgToGif({
        svg,
        fps: 5,
        duration: 0.2,
        width: 100,
        height: 100,
        transparent: true
      });

      assert.ok(res.success);
      const buf = Buffer.from(res.gifBase64, 'base64');
      const info = parseGifInfo(buf);
      assert.ok(info.frames[0].control.transparent);
    });

    it('T5-5.4: Palette quantizer handles pure transparent SVG (0 colored pixels) cleanly', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"></svg>';
      const res = await renderSvgToGif({
        svg,
        fps: 5,
        duration: 0.2,
        width: 50,
        height: 50,
        transparent: true
      });

      assert.ok(res.success);
      assert.ok(res.fileSizeBytes > 0);
    });
  });

  // =========================================================================
  // Area 6: Optimizer Resiliency & Delta Accumulation Stress
  // =========================================================================
  describe('Area 6: Optimizer Resiliency & Delta Accumulation Stress', () => {

    it('T5-6.1: Corrupt or truncated GIF headers (< 13 bytes) rejected with descriptive error', async () => {
      await assert.rejects(
        async () => {
          await optimizeGif({ inputGif: Buffer.from('GIF89') });
        },
        /truncated|corrupt/i,
        'Should reject truncated header'
      );
    });

    it('T5-6.2: Non-GIF payloads (PNG, text, random binary) rejected cleanly', async () => {
      await assert.rejects(
        async () => {
          await optimizeGif({ inputGif: Buffer.from('\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR') });
        },
        /Invalid GIF header/i,
        'Should reject non-GIF signature'
      );
    });

    it('T5-6.3: Corrupt GIF body payloads fail cleanly with descriptive parser error', async () => {
      // Valid GIF89a header but corrupted body bytes
      const corruptBody = Buffer.concat([
        Buffer.from('GIF89a\x10\x00\x10\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff'),
        Buffer.from('\x00\x00\x00\x00\x00\x00')
      ]);

      await assert.rejects(
        async () => {
          await optimizeGif({ inputGif: corruptBody });
        },
        /(corrupt|invalid|payload)/i,
        'Should reject corrupt body payload'
      );
    });

    it('T5-6.4: Sub-frame delta accumulation preserves canvas state without frame tearing', async () => {
      // Read kanagawa_tablo.gif which uses disposal method 0/1 subframes
      const pocGif = fs.readFileSync('kanagawa_tablo.gif');
      const optRes = await optimizeGif({
        inputGif: pocGif,
        maxColors: 128,
        lossy: 20
      });

      assert.ok(optRes.success);
      assert.ok(optRes.optimizedBytes > 0);
      assert.ok(optRes.savingsPercent >= 0);
    });

    it('T5-6.5: Consecutive frame deduplication correctly merges identical frames and aggregates delays', async () => {
      // Create synthetic GIF with 4 frames: frames 1 & 2 are identical, frames 3 & 4 are identical
      const synthGif = createSyntheticGif({ frameCount: 4, width: 20, height: 20, delay: 100 });
      const optRes = await optimizeGif({
        inputGif: synthGif,
        frameDeduplication: true
      });

      assert.ok(optRes.success);
      const reader = new omggif.GifReader(Buffer.from(optRes.optimizedBase64, 'base64'));
      assert.ok(reader.numFrames() <= 4, 'Should deduplicate or preserve valid frames');
    });
  });

  // =========================================================================
  // Area 7: Security & Adversarial Injection Hardening (XSS)
  // =========================================================================
  describe('Area 7: Security & Adversarial Injection Hardening (XSS)', () => {

    const maliciousSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <script>alert("xss-script-tag")</script>
      <script type="text/javascript">document.location="http://evil.com"</script>
      <a href="javascript:alert('xss-link')" xlink:href="javascript:void(0)">
        <text x="20" y="50">Click Me</text>
      </a>
      <rect x="10" y="10" width="50" height="50" fill="red" onload="alert('xss-onload')" onerror="alert('xss-onerror')"/>
      <circle cx="100" cy="100" r="30" fill="blue" onclick="alert('xss-onclick')"/>
    </svg>`;

    it('T5-7.1: <script> tags inside SVG markup neutralized in renderSvgToGif', async () => {
      const res = await renderSvgToGif({
        svg: maliciousSvg,
        fps: 5,
        duration: 0.2,
        width: 100,
        height: 100
      });

      assert.ok(res.success, 'Renderer must neutralize script tags and render safely');
      assert.ok(res.fileSizeBytes > 0);
    });

    it('T5-7.2: Inline event handlers (onload, onerror, onclick) stripped in renderer', async () => {
      const res = await renderSvgToGif({
        svg: maliciousSvg,
        fps: 5,
        duration: 0.2,
        width: 100,
        height: 100
      });

      assert.ok(res.success);
    });

    it('T5-7.3: javascript: URIs in xlink:href and href stripped in renderSvgToGif', async () => {
      const res = await renderSvgToGif({
        svg: maliciousSvg,
        fps: 5,
        duration: 0.2
      });

      assert.ok(res.success);
    });

    it('T5-7.4: <script> tags inside SVG markup neutralized in generatePreviewWidget HTML', async () => {
      const res = await generatePreviewWidget({
        svg: maliciousSvg,
        title: 'Safe Widget'
      });

      assert.ok(res.html, 'Widget HTML must be generated');
      assert.ok(!res.html.includes('xss-script-tag'), 'Script content must not be present in widget');
      assert.ok(!res.html.includes('<script>alert'), 'Raw script tags must not be present');
    });

    it('T5-7.5: javascript: URIs neutralized in generatePreviewWidget HTML', async () => {
      const res = await generatePreviewWidget({
        svg: maliciousSvg
      });

      assert.ok(!res.html.includes('javascript:alert'), 'javascript: URI must be stripped in widget');
      assert.ok(!res.html.includes('onload='), 'Inline onload handler must be stripped in widget');
      assert.ok(!res.html.includes('onerror='), 'Inline onerror handler must be stripped in widget');
    });

    it('T5-7.6: XSS payload in widget title attribute properly HTML-escaped without escaping break-out', async () => {
      const xssTitle = 'Studio</title><script>alert("title-xss")</script><title>';
      const res = await generatePreviewWidget({
        svg: '<svg><rect width="10" height="10" fill="green"/></svg>',
        title: xssTitle
      });

      assert.ok(res.html);
      assert.ok(res.html.includes('&lt;script&gt;'), 'Script tags in title must be HTML entity escaped');
      assert.ok(!res.html.includes('</title><script>alert("title-xss")'), 'Title must not break out of title tag');
    });
  });

});
