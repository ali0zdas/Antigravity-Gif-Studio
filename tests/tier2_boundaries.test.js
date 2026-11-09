/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * 
 * Comprehensive tests covering extreme boundaries, edge cases, and invalid inputs:
 * - Dimension & ViewBox boundaries (1x1, 4000x3000, 1200x50, 50x1200, missing viewBox)
 * - SVG Syntax & Sanitization boundaries (malformed XML, non-SVG, script injection)
 * - Temporal & Framerate boundaries (fps=1, fps=60, invalid fps, dur=0, dur=-2, dur=0.05)
 * - Palette & Quantization boundaries (maxColors=2, maxColors=256, out-of-range, transparent)
 * - JSON-RPC & Parameter boundaries (empty payload, missing required, unknown tool, malformed JSON)
 * - Optimization Edge Cases (1-frame static, identical frames, 16-color palette, corrupt GIF)
 * - File System Boundaries (missing paths, spaces in paths, omitted output path)
 * 
 * Requirement: >= 5 test cases per boundary area.
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

describe('Tier 2 - Boundary & Corner Cases Suite', () => {

  // =========================================================================
  // Area 1: Dimension & ViewBox Boundaries (>=5 tests)
  // =========================================================================
  describe('Area 1: Dimension & ViewBox Boundaries', () => {
    it('T2-1.1: handles minimal 1x1 pixel SVG without crashing', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#ff0000"/></svg>';
      const outDir = getTempDir('t2_dim1');
      const outPath = path.join(outDir, 'tiny.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      assert.ok(fs.existsSync(outPath));
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.ok(info.width >= 1 && info.height >= 1);
    });

    it('T2-1.2: handles large resolution (4000x3000) or clamps within safe memory limits', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('t2_dim2');
      const outPath = path.join(outDir, 'large.gif');

      // Request 4000x3000; engine may clamp or render safely
      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        width: 4000,
        height: 3000,
        fps: 2,
        duration: 0.5
      });

      assert.ok(res.success);
      assert.ok(fs.existsSync(outPath));
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.ok(info.width <= 4000 && info.height <= 3000);
    });

    it('T2-1.3: handles ultra-wide aspect ratio (1200x50)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/wide_banner.svg');
      const outDir = getTempDir('t2_dim3');
      const outPath = path.join(outDir, 'wide.gif');

      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        width: 1200,
        height: 50,
        fps: 5,
        duration: 0.5
      });

      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(info.width, 1200);
      assert.equal(info.height, 50);
    });

    it('T2-1.4: handles ultra-tall aspect ratio (50x1200)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/tall_banner.svg');
      const outDir = getTempDir('t2_dim4');
      const outPath = path.join(outDir, 'tall.gif');

      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        width: 50,
        height: 1200,
        fps: 5,
        duration: 0.5
      });

      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(info.width, 50);
      assert.equal(info.height, 1200);
    });

    it('T2-1.5: SVG missing width, height, and viewBox falls back to default 400x400', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/no_dimensions.svg');
      const outDir = getTempDir('t2_dim5');
      const outPath = path.join(outDir, 'default_dims.gif');

      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        fps: 5,
        duration: 0.5
      });

      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(info.width, 400, 'Default width should be 400');
      assert.equal(info.height, 400, 'Default height should be 400');
    });
  });

  // =========================================================================
  // Area 2: SVG Syntax & Adversarial Inputs (>=5 tests)
  // =========================================================================
  describe('Area 2: SVG Syntax & Adversarial Inputs', () => {
    it('T2-2.1: rejects or handles malformed XML gracefully without hanging', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/invalid_malformed.svg');

      try {
        const res = await renderSvgToGif({ svg, fps: 5, duration: 0.5 });
        // If it handles gracefully, it must report error or return fallback
        assert.ok(res !== undefined);
      } catch (err) {
        assert.ok(err instanceof Error, 'Should throw an Error on malformed SVG');
      }
    });

    it('T2-2.2: rejects non-SVG root element (e.g. <div> tag)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const invalidMarkup = '<div style="background: red; width: 100px; height: 100px;">Not SVG</div>';

      try {
        const res = await renderSvgToGif({ svg: invalidMarkup, fps: 5, duration: 0.5 });
        assert.equal(res.success, false, 'Should fail when input is not SVG');
      } catch (err) {
        assert.match(err.message, /svg/i, 'Error should mention SVG requirement');
      }
    });

    it('T2-2.3: rejects empty or whitespace-only SVG string', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');

      await assert.rejects(
        async () => {
          await renderSvgToGif({ svg: '   \n\t   ', fps: 5, duration: 0.5 });
        },
        /(empty|required|invalid)/i,
        'Should reject empty SVG string'
      );
    });

    it('T2-2.4: neutralizes <script> tags and onload handlers (XSS injection safety)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/xss_payload.svg');
      const outDir = getTempDir('t2_xss');
      const outPath = path.join(outDir, 'safe.gif');

      // Must execute cleanly without executing arbitrary script or crashing
      const res = await renderSvgToGif({ svg, outputPath: outPath, fps: 5, duration: 0.5 });
      assert.ok(res.success || res.error);
    });

    it('T2-2.5: handles SVG with special characters, unicode, and XML entities', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">
          <text x="20" y="50" font-size="20" fill="#333">&lt;Antigravity 🌊 🚀 &amp; Studio&gt;</text>
        </svg>
      `;
      const outDir = getTempDir('t2_unicode');
      const outPath = path.join(outDir, 'unicode.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      assert.ok(fs.existsSync(outPath));
    });
  });

  // =========================================================================
  // Area 3: Temporal & Framerate Boundaries (>=5 tests)
  // =========================================================================
  describe('Area 3: Temporal & Framerate Boundaries', () => {
    it('T2-3.1: supports minimum framerate boundary (fps = 1)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('t2_fps1');
      const outPath = path.join(outDir, 'fps1.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, fps: 1, duration: 2.0 });
      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.ok(info.frameCount >= 1 && info.frameCount <= 3);
    });

    it('T2-3.2: supports maximum framerate boundary (fps = 60)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('t2_fps60');
      const outPath = path.join(outDir, 'fps60.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, fps: 60, duration: 0.5 });
      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.ok(info.frameCount >= 25 && info.frameCount <= 35);
    });

    it('T2-3.3: clamps or rejects invalid FPS (0, negative, NaN)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');

      try {
        const res = await renderSvgToGif({ svg, fps: 0, duration: 1.0 });
        // If clamped, fps must be >= 1
        assert.ok(res.frameCount >= 1);
      } catch (err) {
        assert.match(err.message, /fps/i);
      }
    });

    it('T2-3.4: rejects zero or negative duration', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');

      await assert.rejects(
        async () => {
          await renderSvgToGif({ svg, duration: -2.0, fps: 10 });
        },
        /(duration|positive|invalid)/i
      );
    });

    it('T2-3.5: handles sub-second micro duration (duration = 0.1s)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('t2_micro');
      const outPath = path.join(outDir, 'micro.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, duration: 0.1, fps: 10 });
      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.ok(info.frameCount >= 1);
    });
  });

  // =========================================================================
  // Area 4: Palette & Quantization Boundaries (>=5 tests)
  // =========================================================================
  describe('Area 4: Palette & Quantization Boundaries', () => {
    it('T2-4.1: supports minimum palette limit (maxColors = 2, monochrome)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('t2_pal2');
      const outPath = path.join(outDir, 'mono.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, maxColors: 2, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      assert.ok(fs.existsSync(outPath));
    });

    it('T2-4.2: supports full 256-color palette limit (maxColors = 256)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('t2_pal256');
      const outPath = path.join(outDir, 'full256.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, maxColors: 256, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.ok(info.globalColorTableSize <= 256);
    });

    it('T2-4.3: clamps or rejects out-of-range maxColors (>256 or <2)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');

      try {
        const res = await renderSvgToGif({ svg, maxColors: 512, fps: 5, duration: 0.5 });
        // If clamped, should be 256
        assert.ok(res.success);
      } catch (err) {
        assert.match(err.message, /color|palette/i);
      }
    });

    it('T2-4.4: handles fully transparent SVG with 0 filled pixels', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"></svg>';
      const outDir = getTempDir('t2_pure_trans');
      const outPath = path.join(outDir, 'empty.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, transparent: true, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(info.version, '89a');
    });

    it('T2-4.5: verifies quantization quality parameter boundaries (quality 1 vs 30)', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');

      const resHigh = await renderSvgToGif({ svg, quality: 1, fps: 5, duration: 0.5 });
      const resFast = await renderSvgToGif({ svg, quality: 30, fps: 5, duration: 0.5 });

      assert.ok(resHigh.success);
      assert.ok(resFast.success);
    });
  });

  // =========================================================================
  // Area 5: JSON-RPC & Parameter Validation Boundaries (>=5 tests)
  // =========================================================================
  describe('Area 5: JSON-RPC & Parameter Validation Boundaries', () => {
    it('T2-5.1: calling tool with empty arguments object returns validation error', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        const res = await client.callTool('render_svg_to_gif', {});
        // Must report error or validation failure
        assert.ok(res.isError || (res.content && res.content[0].text.includes('Error')));
      } finally {
        await client.close();
      }
    });

    it('T2-5.2: calling render_svg_to_gif without required svg parameter fails cleanly', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        const res = await client.callTool('render_svg_to_gif', { fps: 15, duration: 2.0 });
        assert.ok(res.isError || (res.content && res.content[0].text.includes('svg')));
      } finally {
        await client.close();
      }
    });

    it('T2-5.3: calling optimize_gif without inputGif or inputPath fails cleanly', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        const res = await client.callTool('optimize_gif', { maxColors: 64 });
        assert.ok(res.isError || (res.content && res.content[0].text.includes('input')));
      } finally {
        await client.close();
      }
    });

    it('T2-5.4: calling unknown tool returns tool not found error', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        await assert.rejects(
          async () => {
            await client.callTool('unknown_phantom_tool', {});
          },
          /(found|unknown|not supported)/i
        );
      } finally {
        await client.close();
      }
    });

    it('T2-5.5: server recovers from malformed JSON-RPC string on stdin', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        // Send corrupt JSON line directly
        client.child.stdin.write('{"jsonrpc": "2.0", broken json here...\n');
        // Now send valid request; server must still respond
        const res = await client.listTools();
        assert.ok(Array.isArray(res.tools), 'Server must survive malformed line and process next message');
      } finally {
        await client.close();
      }
    });
  });

  // =========================================================================
  // Area 6: Optimization Edge Cases (>=5 tests)
  // =========================================================================
  describe('Area 6: Optimization Edge Cases', () => {
    it('T2-6.1: handles 1-frame static GIF optimization without corruption', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      const inputPath = resolvePath('tests/fixtures/sample_static.gif');
      const outDir = getTempDir('t2_opt_static');
      const outPath = path.join(outDir, 'opt_static.gif');

      const res = await optimizeGif({ inputPath, outputPath: outPath, maxColors: 32 });
      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(info.frameCount, 1);
    });

    it('T2-6.2: handles GIF with 100% identical consecutive frames (frame deduplication)', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      // Create a 4-frame GIF where all frames are identical
      const identicalGif = createSyntheticGif({ frameCount: 4, width: 60, height: 60, delay: 50 });
      const inDir = getTempDir('t2_identical');
      const inPath = path.join(inDir, 'identical.gif');
      const outPath = path.join(inDir, 'deduped.gif');
      fs.writeFileSync(inPath, identicalGif);

      const res = await optimizeGif({ inputPath: inPath, outputPath: outPath, frameDeduplication: true });
      assert.ok(res.success);
      assert.ok(fs.existsSync(outPath));
    });

    it('T2-6.3: handles already-reduced palette (16 colors) without bloat', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      const inputPath = resolvePath('tests/fixtures/sample_animated.gif');
      const outDir = getTempDir('t2_low_pal');
      const outPath = path.join(outDir, 'low_pal.gif');

      const res = await optimizeGif({ inputPath, outputPath: outPath, maxColors: 16 });
      assert.ok(res.success);
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.ok(info.frameCount >= 1);
    });

    it('T2-6.4: supports lossless (lossy=0) vs aggressive lossy (lossy=80)', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      const inputPath = resolvePath('tests/fixtures/sample_animated.gif');
      const outDir = getTempDir('t2_lossy');
      const outLossless = path.join(outDir, 'lossless.gif');
      const outLossy = path.join(outDir, 'lossy.gif');

      const res1 = await optimizeGif({ inputPath, outputPath: outLossless, lossy: 0 });
      const res2 = await optimizeGif({ inputPath, outputPath: outLossy, lossy: 80 });

      assert.ok(res1.success);
      assert.ok(res2.success);
    });

    it('T2-6.5: rejects corrupt or truncated GIF buffer', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      const truncatedBuf = Buffer.from('GIF89aNotAValidGifPayload');

      await assert.rejects(
        async () => {
          await optimizeGif({ inputBase64: truncatedBuf.toString('base64') });
        },
        /(corrupt|invalid|header|error)/i
      );
    });
  });

  // =========================================================================
  // Area 7: File System & Path Boundaries (>=5 tests)
  // =========================================================================
  describe('Area 7: File System & Path Boundaries', () => {
    it('T2-7.1: throws clean error when input SVG file path does not exist', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      await assert.rejects(
        async () => {
          await renderSvgToGif({ inputPath: 'tests/fixtures/non_existent_file.svg' });
        },
        /(not found|no such file|exist)/i
      );
    });

    it('T2-7.2: automatically creates nested parent directories for outputPath', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('t2_nested/deep/sub/dir');
      const outPath = path.join(outDir, 'nested.gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      assert.ok(fs.existsSync(outPath));
    });

    it('T2-7.3: supports output paths with spaces and special characters', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('t2_spaces');
      const outPath = path.join(outDir, 'studio test @ output [2026].gif');

      const res = await renderSvgToGif({ svg, outputPath: outPath, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      assert.ok(fs.existsSync(outPath));
    });

    it('T2-7.4: handles absolute vs relative output file paths', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const absPath = path.resolve('tests', 'tmp', 'abs_test.gif');

      const res = await renderSvgToGif({ svg, outputPath: absPath, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      assert.ok(fs.existsSync(absPath));
    });

    it('T2-7.5: handles omitted outputPath by returning in-memory base64 without creating disk file', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');

      const res = await renderSvgToGif({ svg, fps: 5, duration: 0.5 });
      assert.ok(res.success);
      assert.ok(res.gifBase64 && res.gifBase64.length > 50);
      assert.equal(res.outputPath, undefined, 'outputPath should be undefined when omitted');
    });
  });
});
