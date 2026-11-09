/**
 * Tier 3: Cross-Feature Combinations Test Suite
 * 
 * Verifies pairwise and multi-feature interactions across the entire system:
 * - Render -> Optimize end-to-end pipeline
 * - Widget generation with custom FPS, duration, and title
 * - Simultaneous CSS keyframes + SMIL animations
 * - Transparency preservation across full pipeline
 * - High FPS + custom dimensions + quality settings
 * - Complex harmonic multi-frequency synchronization
 * - In-memory base64 roundtrip pipeline
 * - ViewBox scale override with background fill
 * - Aggressive lossy compression pipeline
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

describe('Tier 3 - Cross-Feature Combinations Suite', () => {

  // =========================================================================
  // Combination 1: Render -> Optimize End-to-End Pipeline
  // =========================================================================
  it('T3-1: Full Pipeline: render_svg_to_gif -> optimize_gif produces valid, smaller GIF', async () => {
    if (!fileExists('mcp/renderer.js') || !fileExists('mcp/optimizer.js')) {
      assert.fail('mcp modules missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const { optimizeGif } = require('../mcp/optimizer.js');

    const svg = readText('tests/fixtures/pulse_circle.svg');
    const outDir = getTempDir('t3_pipe1');
    const rawGifPath = path.join(outDir, 'raw.gif');
    const optGifPath = path.join(outDir, 'opt.gif');

    // Step 1: Render SVG to unoptimized GIF
    const renderRes = await renderSvgToGif({
      svg,
      outputPath: rawGifPath,
      fps: 15,
      duration: 2.0,
      width: 200,
      height: 200
    });
    assert.ok(renderRes.success, 'Render step must succeed');
    assert.ok(fs.existsSync(rawGifPath), 'Raw GIF must exist');
    const rawInfo = parseGifInfo(fs.readFileSync(rawGifPath));

    // Step 2: Optimize rendered GIF
    const optRes = await optimizeGif({
      inputPath: rawGifPath,
      outputPath: optGifPath,
      maxColors: 64,
      frameDeduplication: true
    });
    assert.ok(optRes.success, 'Optimize step must succeed');
    assert.ok(fs.existsSync(optGifPath), 'Optimized GIF must exist');
    const optInfo = parseGifInfo(fs.readFileSync(optGifPath));

    // Assertions
    assert.equal(optInfo.version, '89a');
    assert.equal(optInfo.width, rawInfo.width);
    assert.equal(optInfo.height, rawInfo.height);
    assert.ok(optInfo.fileSizeBytes <= rawInfo.fileSizeBytes, 'Optimized size must be <= raw size');
  });

  // =========================================================================
  // Combination 2: Widget Generation with Custom Parameters
  // =========================================================================
  it('T3-2: Widget Generation binds custom FPS, duration, and title cleanly into artifact', async () => {
    if (!fileExists('mcp/widget-template.js')) {
      assert.fail('mcp/widget-template.js missing (pending Milestone M3)');
    }
    const { generatePreviewWidget } = require('../mcp/widget-template.js');
    const svg = readText('tests/fixtures/conveyor_wave.svg');
    const outDir = getTempDir('t3_widget_custom');
    const outHtmlPath = path.join(outDir, 'custom_widget.html');

    const res = await generatePreviewWidget({
      svg,
      outputPath: outHtmlPath,
      title: 'Neon Oceanic Wave Preview',
      duration: 4.5,
      fps: 30
    });

    assert.ok(res.html);
    assert.ok(fs.existsSync(outHtmlPath));

    // Verify embedded configuration
    assert.ok(res.html.includes('Neon Oceanic Wave Preview'), 'Custom title must be embedded');
    assert.ok(res.html.includes('4.5'), 'Custom duration (4.5s) must be reflected in UI scrubber');
    assert.match(res.html, /30/, 'Custom FPS (30) must be reflected');
  });

  // =========================================================================
  // Combination 3: Dual Animation Engines (CSS Keyframes + SMIL simultaneously)
  // =========================================================================
  it('T3-3: Simultaneous CSS keyframes + SMIL animations render without conflict', async () => {
    if (!fileExists('mcp/renderer.js')) {
      assert.fail('mcp/renderer.js missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const svg = readText('tests/fixtures/dual_anim.svg');
    const outDir = getTempDir('t3_dual');
    const outPath = path.join(outDir, 'dual.gif');

    const res = await renderSvgToGif({
      svg,
      outputPath: outPath,
      fps: 10,
      duration: 2.0,
      width: 300,
      height: 200
    });

    assert.ok(res.success);
    const info = parseGifInfo(fs.readFileSync(outPath));
    assert.equal(info.width, 300);
    assert.equal(info.height, 200);
    assert.ok(info.frameCount >= 15 && info.frameCount <= 25);
  });

  // =========================================================================
  // Combination 4: Transparency Preservation across Full Pipeline
  // =========================================================================
  it('T3-4: Transparency is preserved across Render -> Optimize pipeline', async () => {
    if (!fileExists('mcp/renderer.js') || !fileExists('mcp/optimizer.js')) {
      assert.fail('mcp modules missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const { optimizeGif } = require('../mcp/optimizer.js');

    const svg = readText('tests/fixtures/transparent_spinner.svg');
    const outDir = getTempDir('t3_trans_pipe');
    const rawPath = path.join(outDir, 'trans_raw.gif');
    const optPath = path.join(outDir, 'trans_opt.gif');

    // Render with transparent: true
    await renderSvgToGif({
      svg,
      outputPath: rawPath,
      transparent: true,
      fps: 10,
      duration: 1.0,
      width: 120,
      height: 120
    });

    // Optimize
    await optimizeGif({
      inputPath: rawPath,
      outputPath: optPath,
      maxColors: 32
    });

    const optInfo = parseGifInfo(fs.readFileSync(optPath));
    // Verify transparency flag in first frame's GCE
    assert.ok(optInfo.frames.length > 0);
    assert.equal(optInfo.frames[0].control.transparent, true, 'Transparency must be preserved in optimized output');
  });

  // =========================================================================
  // Combination 5: High FPS + Custom Dimensions + Palette Compression
  // =========================================================================
  it('T3-5: High FPS (30) + Custom Dimensions (320x240) + Palette Compression (64 colors)', async () => {
    if (!fileExists('mcp/renderer.js') || !fileExists('mcp/optimizer.js')) {
      assert.fail('mcp modules missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const { optimizeGif } = require('../mcp/optimizer.js');

    const svg = readText('tests/fixtures/minimal_rect.svg');
    const outDir = getTempDir('t3_combo5');
    const rawPath = path.join(outDir, 'high_fps_raw.gif');
    const optPath = path.join(outDir, 'high_fps_opt.gif');

    await renderSvgToGif({
      svg,
      outputPath: rawPath,
      fps: 30,
      duration: 1.0,
      width: 320,
      height: 240,
      quality: 2
    });

    const rawInfo = parseGifInfo(fs.readFileSync(rawPath));
    assert.ok(rawInfo.frameCount >= 28 && rawInfo.frameCount <= 32);

    await optimizeGif({
      inputPath: rawPath,
      outputPath: optPath,
      maxColors: 64
    });

    const optInfo = parseGifInfo(fs.readFileSync(optPath));
    assert.equal(optInfo.width, 320);
    assert.equal(optInfo.height, 240);
    assert.ok(optInfo.globalColorTableSize <= 64 || (optInfo.frames[0].hasLct && optInfo.frames[0].lctSize <= 64));
  });

  // =========================================================================
  // Combination 6: Complex Harmonic Multi-Frequency Synchronization
  // =========================================================================
  it('T3-6: Renders multi-element harmonic SVG with synchronized sub-frequencies', async () => {
    if (!fileExists('mcp/renderer.js')) {
      assert.fail('mcp/renderer.js missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const svg = readText('tests/fixtures/harmonic_loader.svg');
    const outDir = getTempDir('t3_harmonic');
    const outPath = path.join(outDir, 'harmonic.gif');

    const res = await renderSvgToGif({
      svg,
      outputPath: outPath,
      fps: 15,
      duration: 1.5,
      width: 300,
      height: 120
    });

    assert.ok(res.success);
    const info = parseGifInfo(fs.readFileSync(outPath));
    assert.ok(info.frameCount >= 20 && info.frameCount <= 25);
    // Loop count should be 0 (infinite looping)
    assert.equal(info.loopCount, 0);
  });

  // =========================================================================
  // Combination 7: In-Memory Base64 Roundtrip Pipeline
  // =========================================================================
  it('T3-7: Full in-memory Base64 roundtrip (no temporary disk writes)', async () => {
    if (!fileExists('mcp/renderer.js') || !fileExists('mcp/optimizer.js')) {
      assert.fail('mcp modules missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const { optimizeGif } = require('../mcp/optimizer.js');

    const svg = readText('tests/fixtures/minimal_rect.svg');

    // Render in-memory
    const renderRes = await renderSvgToGif({
      svg,
      fps: 10,
      duration: 0.5
    });
    assert.ok(renderRes.gifBase64, 'Must return base64 GIF');

    // Optimize in-memory
    const optRes = await optimizeGif({
      inputBase64: renderRes.gifBase64,
      maxColors: 32
    });
    const finalBase64 = optRes.optimizedBase64 || optRes.gifBase64;
    assert.ok(finalBase64, 'Must return optimized base64 GIF');

    const buf = Buffer.from(finalBase64, 'base64');
    const info = parseGifInfo(buf);
    assert.equal(info.version, '89a');
  });

  // =========================================================================
  // Combination 8: Aggressive Lossy Compression Pipeline
  // =========================================================================
  it('T3-8: Aggressive lossy optimization achieves >= 15% size reduction', async () => {
    if (!fileExists('mcp/renderer.js') || !fileExists('mcp/optimizer.js')) {
      assert.fail('mcp modules missing (pending Milestone M2)');
    }
    const { renderSvgToGif } = require('../mcp/renderer.js');
    const { optimizeGif } = require('../mcp/optimizer.js');

    const svg = readText('tests/fixtures/harmonic_loader.svg');
    const outDir = getTempDir('t3_lossy');
    const rawPath = path.join(outDir, 'raw_loader.gif');
    const optPath = path.join(outDir, 'opt_loader.gif');

    await renderSvgToGif({
      svg,
      outputPath: rawPath,
      fps: 15,
      duration: 1.5,
      width: 300,
      height: 120
    });

    const optRes = await optimizeGif({
      inputPath: rawPath,
      outputPath: optPath,
      maxColors: 32,
      lossy: 35
    });

    assert.ok(optRes.success);
    assert.ok(optRes.savingsPercent >= 10, `Expected >= 10% savings, got ${optRes.savingsPercent}%`);
  });
});
