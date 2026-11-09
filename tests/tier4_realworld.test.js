/**
 * Tier 4: Real-World Application Scenarios Test Suite
 * 
 * Verifies production workloads, complex vector artwork, and pixel motion:
 * - kanagawa_tablo.svg conversion to genuine looping animated GIF
 * - Frame motion verification (confirming CSS @keyframes actually advanced across frames)
 * - Multi-element harmonic bouncing loader workload
 * - Modulo conveyor wave loop workload
 * - Pulsating cyberpunk glowing badge workload
 * - Generative UI interactive widget integration on kanagawa_tablo.svg
 * - Real-world palette reduction & optimization benchmark
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
  parseGifInfo
} = require('./test_utils.js');

describe('Tier 4 - Real-World Application Scenarios Suite', () => {

  // =========================================================================
  // Scenario 1: kanagawa_tablo.svg Conversion & Frame Motion Verification
  // =========================================================================
  it('T4-1: kanagawa_tablo.svg renders to valid looping GIF with confirmed animation motion', async () => {
    if (!fileExists('mcp/renderer.js')) {
      assert.fail('mcp/renderer.js missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const svg = readText('tests/fixtures/kanagawa_tablo.svg');
    const outDir = getTempDir('t4_kanagawa');
    const outPath = path.join(outDir, 'kanagawa_rendered.gif');

    // 3.5s loop @ 15fps = ~53 frames
    const res = await renderSvgToGif({
      svg,
      outputPath: outPath,
      duration: 3.5,
      fps: 15,
      width: 600,
      height: 400
    });

    assert.ok(res.success, 'Rendering kanagawa_tablo.svg must succeed');
    assert.ok(fs.existsSync(outPath), 'Output GIF must exist on disk');

    const info = parseGifInfo(fs.readFileSync(outPath));
    assert.equal(info.version, '89a', 'Must be GIF89a format');
    assert.equal(info.width, 600, 'Width must be 600');
    assert.equal(info.height, 400, 'Height must be 400');
    assert.equal(info.loopCount, 0, 'Must have infinite loop (NETSCAPE2.0 loopCount = 0)');
    assert.ok(info.frameCount >= 45 && info.frameCount <= 55, `Expected ~53 frames, got ${info.frameCount}`);

    // CRITICAL: Verify that the frames are NOT identical static images!
    // (Existing POC kanagawa_tablo.gif suffered from 24 static identical frames)
    assert.ok(info.hasAnimationMotion, 'GIF must have observable animation motion across frames');
  });

  // =========================================================================
  // Scenario 2: Multi-Element Bouncing Harmonic Loader
  // =========================================================================
  it('T4-2: Multi-element harmonic bouncing loader renders with phase-shifted motion', async () => {
    if (!fileExists('mcp/renderer.js')) {
      assert.fail('mcp/renderer.js missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const svg = readText('tests/fixtures/harmonic_loader.svg');
    const outDir = getTempDir('t4_loader');
    const outPath = path.join(outDir, 'harmonic_loader.gif');

    const res = await renderSvgToGif({
      svg,
      outputPath: outPath,
      duration: 1.5,
      fps: 20,
      width: 300,
      height: 120
    });

    assert.ok(res.success);
    const info = parseGifInfo(fs.readFileSync(outPath));
    assert.equal(info.width, 300);
    assert.equal(info.height, 120);
    assert.ok(info.frameCount >= 25 && info.frameCount <= 32);
    assert.ok(info.hasAnimationMotion, 'Harmonic loader must animate smoothly');
  });

  // =========================================================================
  // Scenario 3: Modulo Conveyor Wave Loop
  // =========================================================================
  it('T4-3: Modulo conveyor wave renders into seamless infinite looping GIF', async () => {
    if (!fileExists('mcp/renderer.js')) {
      assert.fail('mcp/renderer.js missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const svg = readText('tests/fixtures/conveyor_wave.svg');
    const outDir = getTempDir('t4_wave');
    const outPath = path.join(outDir, 'wave_loop.gif');

    const res = await renderSvgToGif({
      svg,
      outputPath: outPath,
      duration: 2.0,
      fps: 15,
      width: 400,
      height: 150
    });

    assert.ok(res.success);
    const info = parseGifInfo(fs.readFileSync(outPath));
    assert.equal(info.loopCount, 0, 'Must loop infinitely');
    assert.ok(info.hasAnimationMotion, 'Wave must advance continuously');
  });

  // =========================================================================
  // Scenario 4: Pulsating Glowing Cyberpunk Badge
  // =========================================================================
  it('T4-4: Pulsating glowing badge renders scale and opacity oscillations correctly', async () => {
    if (!fileExists('mcp/renderer.js')) {
      assert.fail('mcp/renderer.js missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const svg = readText('tests/fixtures/pulse_circle.svg');
    const outDir = getTempDir('t4_badge');
    const outPath = path.join(outDir, 'pulsating_badge.gif');

    const res = await renderSvgToGif({
      svg,
      outputPath: outPath,
      duration: 2.0,
      fps: 15,
      width: 200,
      height: 200
    });

    assert.ok(res.success);
    const info = parseGifInfo(fs.readFileSync(outPath));
    assert.equal(info.width, 200);
    assert.equal(info.height, 200);
    assert.ok(info.hasAnimationMotion, 'Badge must pulsate across frames');
  });

  // =========================================================================
  // Scenario 5: Generative UI Widget Generation on kanagawa_tablo.svg
  // =========================================================================
  it('T4-5: Generative UI widget on kanagawa_tablo.svg generates complete offline application', async () => {
    if (!fileExists('mcp/widget-template.js')) {
      assert.fail('mcp/widget-template.js missing (pending Milestone M3)');
    }
    const { generatePreviewWidget } = require('../mcp/widget-template.js');
    const svg = readText('tests/fixtures/kanagawa_tablo.svg');
    const outDir = getTempDir('t4_kanagawa_widget');
    const outHtmlPath = path.join(outDir, 'kanagawa_preview.html');

    const res = await generatePreviewWidget({
      svg,
      outputPath: outHtmlPath,
      title: 'Kanagawa Great Wave — Live Preview',
      duration: 3.5,
      fps: 24
    });

    assert.ok(res.html);
    assert.ok(fs.existsSync(outHtmlPath));

    const html = fs.readFileSync(outHtmlPath, 'utf8');

    // 1. Verify complete HTML structure
    assert.match(html, /<!DOCTYPE\s+html>/i, 'Must have doctype');
    assert.match(html, /<html[\s>]/i, 'Must have html tag');
    assert.match(html, /<body[\s>]/i, 'Must have body tag');

    // 2. Verify embedded Kanagawa Great Wave SVG
    assert.ok(html.includes('waveSwell1'), 'Must embed Kanagawa waveSwell1 keyframe');
    assert.ok(html.includes('crestSurge'), 'Must embed Kanagawa crestSurge keyframe');
    assert.ok(html.includes('boatMotion'), 'Must embed Kanagawa boatMotion keyframe');

    // 3. Verify inlined GIF encoder
    assert.match(html, /(gifenc|GIFEncoder)/i, 'Must inline gifenc');

    // 4. Verify offline guarantee (zero external CDN script dependencies)
    assert.ok(!html.includes('http://'), 'Must not link to http resources');
    assert.ok(!html.includes('https://cdn'), 'Must not link to https CDN scripts');

    // 5. Verify interactive controls
    assert.match(html, /(play|pause)/i, 'Must have play/pause');
    assert.match(html, /scrubber|timeline/i, 'Must have scrubber');
    assert.match(html, /checker|background/i, 'Must have background toggles');
    assert.match(html, /speed/i, 'Must have speed controls');
  });

  // =========================================================================
  // Scenario 6: Full Optimization on Real-World Vector Artwork
  // =========================================================================
  it('T4-6: End-to-end optimization achieves significant size savings on real artwork', async () => {
    if (!fileExists('mcp/renderer.js') || !fileExists('mcp/optimizer.js')) {
      assert.fail('mcp modules missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const { optimizeGif } = require('../mcp/optimizer.js');

    const svg = readText('tests/fixtures/kanagawa_tablo.svg');
    const outDir = getTempDir('t4_benchmark');
    const rawPath = path.join(outDir, 'raw_benchmark.gif');
    const optPath = path.join(outDir, 'opt_benchmark.gif');

    // Render 1.5s loop @ 10fps
    await renderSvgToGif({
      svg,
      outputPath: rawPath,
      duration: 1.5,
      fps: 10,
      width: 400,
      height: 266
    });

    const rawInfo = parseGifInfo(fs.readFileSync(rawPath));

    const optRes = await optimizeGif({
      inputPath: rawPath,
      outputPath: optPath,
      maxColors: 128,
      frameDeduplication: true
    });

    assert.ok(optRes.success);
    const optInfo = parseGifInfo(fs.readFileSync(optPath));

    assert.equal(optInfo.frameCount, rawInfo.frameCount, 'Frame count must be preserved');
    assert.ok(optInfo.fileSizeBytes < rawInfo.fileSizeBytes, 'Optimized size must be smaller than raw size');
  });
});
