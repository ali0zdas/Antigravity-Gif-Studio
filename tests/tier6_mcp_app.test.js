/**
 * Tier 6: MCP Apps & Bug-Fix Regression Suite
 *
 * Verifies:
 * - Self-contained MCP App HTML bundle (< 10 MiB, zero external scripts)
 * - MCP resources/list and resources/read (`ui://gif-studio/app.html`, `text/html;profile=mcp-app`)
 * - Antigravity entrypoints (`aux_pane`, `global`) & `visibility: ["app"]` tools
 * - 1 MiB CallToolResult protection + `app_get_asset` fallback
 * - Persistent `--data_dir` store across restarts & safe path-traversal-proof file saving
 * - Bug-fix regressions (optimizer Uint8Array overflow, sanitizeSvg hardening, frame limit, transparent schema alignment)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const omggif = require('omggif');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const { describe, it, assert } = require('./harness.js');
const {
  fileExists,
  readText,
  getTempDir,
  spawnMcpServer,
  parseGifInfo
} = require('./test_utils.js');

describe('Tier 6 - MCP Apps & Bug-Fix Regression Suite', () => {
  describe('MCP App Resource & Entrypoints', () => {
    it('T6-1: built mcp/dist/app.html exists, is self-contained, and < 10 MiB', () => {
      assert.ok(fileExists('mcp/dist/app.html'), 'mcp/dist/app.html must be built');
      const html = readText('mcp/dist/app.html');
      const bytes = Buffer.byteLength(html, 'utf8');
      assert.ok(bytes > 10000 && bytes < 10 * 1024 * 1024, `Bundle size ${bytes} must be under 10 MiB`);
      assert.ok(!/<script[^>]+src=/i.test(html), 'Must not include external <script src>');
      assert.ok(!/<link[^>]+rel=["']stylesheet["']/i.test(html), 'Must not include external stylesheet links');
      assert.ok(html.includes('ui/initialize'), 'Must bundle @modelcontextprotocol/ext-apps SDK');
    });

    it('T6-2: server declares resources capability and serves ui://gif-studio/app.html', async () => {
      const dataDir = getTempDir('t6_res');
      const client = await spawnMcpServer({ args: [`--data_dir=${dataDir}`] });
      try {
        assert.ok(client.initResult.capabilities.resources, 'Server must declare resources capability');
        const listRes = await client.listResources();
        assert.ok(Array.isArray(listRes.resources));
        const appRes = listRes.resources.find((r) => r.uri === 'ui://gif-studio/app.html');
        assert.ok(appRes, 'ui://gif-studio/app.html must be listed');
        assert.equal(appRes.mimeType, 'text/html;profile=mcp-app');

        const readRes = await client.readResource('ui://gif-studio/app.html');
        assert.ok(Array.isArray(readRes.contents) && readRes.contents.length === 1);
        assert.equal(readRes.contents[0].mimeType, 'text/html;profile=mcp-app');
        assert.ok(readRes.contents[0].text.includes('Antigravity GIF Studio'));
      } finally {
        await client.close();
      }
    });

    it('T6-3: tools/list configures open_gif_studio entrypoints and app-only visibility', async () => {
      const dataDir = getTempDir('t6_tools');
      const client = await spawnMcpServer({ args: [`--data_dir=${dataDir}`] });
      try {
        const { tools } = await client.listTools();

        const studio = tools.find((t) => t.name === 'open_gif_studio');
        assert.ok(studio, 'open_gif_studio must be registered');
        assert.equal(studio._meta?.ui?.resourceUri, 'ui://gif-studio/app.html');
        const entrypoints = studio._meta?.['com.google.antigravity/ui']?.entrypoints || [];
        assert.ok(entrypoints.some((e) => e.type === 'aux_pane'), 'Must define aux_pane entrypoint');
        assert.ok(entrypoints.some((e) => e.type === 'global'), 'Must define global entrypoint');

        const preview = tools.find((t) => t.name === 'generate_preview_widget');
        assert.equal(preview._meta?.ui?.resourceUri, 'ui://gif-studio/app.html');

        const renderTool = tools.find((t) => t.name === 'render_svg_to_gif');
        assert.equal(renderTool.inputSchema.properties.transparent.default, false, 'transparent default must align with renderer');

        const appTools = tools.filter((t) => t.name.startsWith('app_'));
        assert.ok(appTools.length >= 8, 'Must expose app-only helper tools');
        for (const t of appTools) {
          assert.deepEqual(t._meta?.ui?.visibility, ['app'], `${t.name} must restrict visibility to ["app"]`);
        }
      } finally {
        await client.close();
      }
    });
  });

  describe('MCP App Runtime, 1 MiB Cap & Persistence', () => {
    it('T6-4: open_gif_studio works with empty {} input for entrypoint launches', async () => {
      const dataDir = getTempDir('t6_empty');
      const client = await spawnMcpServer({ args: [`--data_dir=${dataDir}`] });
      try {
        const res = await client.callTool('open_gif_studio', {});
        assert.ok(!res.isError, 'Empty {} launch must succeed');
        assert.ok(res.structuredContent, 'Must return structuredContent');
        assert.equal(res.structuredContent.empty, true);
      } finally {
        await client.close();
      }
    });

    it('T6-5: large SVGs (> 750 KB) omit inline svg in CallToolResult and fetch via app_get_asset', async () => {
      const dataDir = getTempDir('t6_large');
      const client = await spawnMcpServer({ args: [`--data_dir=${dataDir}`] });
      try {
        const pad = '<!-- ' + 'x'.repeat(800 * 1024) + ' -->';
        const bigSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${pad}<circle cx="50" cy="50" r="20" fill="#6366f1"/></svg>`;
        const res = await client.callTool('open_gif_studio', { svg: bigSvg, title: 'Large SVG' });

        const serializedBytes = Buffer.byteLength(JSON.stringify(res), 'utf8');
        assert.ok(serializedBytes < 1024 * 1024, `CallToolResult (${serializedBytes}) must remain < 1 MiB`);
        assert.equal(res.structuredContent.needsAssetFetch, true);
        assert.equal(res.structuredContent.svg, undefined);

        const assetRes = await client.callTool('app_get_asset', { assetId: res.structuredContent.assetId });
        assert.ok(!assetRes.isError);
        assert.ok(assetRes.structuredContent.svg.includes('<circle'));
      } finally {
        await client.close();
      }
    });

    it('T6-6: settings saved via app_save_settings persist across server restarts', async () => {
      const dataDir = getTempDir('t6_persist');
      let client = await spawnMcpServer({ args: [`--data_dir=${dataDir}`] });
      try {
        await client.callTool('app_save_settings', {
          fps: 30,
          maxColors: 64,
          transparent: true,
          backgroundMode: 'light'
        });
      } finally {
        await client.close();
      }

      client = await spawnMcpServer({ args: [`--data_dir=${dataDir}`] });
      try {
        const res = await client.callTool('app_get_settings', {});
        const s = res.structuredContent.settings;
        assert.equal(s.fps, 30);
        assert.equal(s.maxColors, 64);
        assert.equal(s.transparent, true);
        assert.equal(s.backgroundMode, 'light');
      } finally {
        await client.close();
      }
    });

    it('T6-7: app_save_gif sanitizes path traversal filenames safely', async () => {
      const dataDir = getTempDir('t6_save');
      const saveTarget = getTempDir('t6_save_out');
      const client = await spawnMcpServer({ args: [`--data_dir=${dataDir}`] });
      try {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#10b981"/></svg>';
        const renderRes = await client.callTool('app_render_preview', {
          svg,
          fps: 5,
          duration: 0.4,
          width: 64,
          height: 64
        });
        assert.ok(!renderRes.isError);

        const saveRes = await client.callTool('app_save_gif', {
          assetId: renderRes.structuredContent.assetId,
          filename: '../../outside/evil_name',
          targetDir: saveTarget
        });
        assert.ok(!saveRes.isError);
        const savedPath = saveRes.structuredContent.savedPath;
        assert.equal(path.dirname(savedPath), path.resolve(saveTarget), 'Must not escape targetDir');
        assert.ok(savedPath.endsWith('.gif'));
        assert.ok(fs.existsSync(savedPath));
        const info = parseGifInfo(fs.readFileSync(savedPath));
        assert.equal(info.version, '89a');
      } finally {
        await client.close();
      }
    });
  });

  describe('Core Engine Bug-Fix Regressions', () => {
    it('T6-8: optimizer lossy=100 clamps RGB channels at 255 without Uint8 overflow', async () => {
      const { optimizeGif } = require('../mcp/optimizer.js');
      const width = 32;
      const height = 32;
      const gif = GIFEncoder();
      const rgba = new Uint8Array(width * height * 4);
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = 255;
        rgba[i + 1] = 255;
        rgba[i + 2] = 255;
        rgba[i + 3] = 255;
      }
      const palette = quantize(rgba, 16, { format: 'rgb565' });
      const idx = applyPalette(rgba, palette, 'rgb565');
      gif.writeFrame(idx, width, height, { palette, delay: 100, dispose: 1 });
      gif.finish();

      const outDir = getTempDir('t6_overflow');
      const inPath = path.join(outDir, 'white.gif');
      const outPath = path.join(outDir, 'white_opt.gif');
      fs.writeFileSync(inPath, Buffer.from(gif.bytes()));

      const res = await optimizeGif({ inputPath: inPath, outputPath: outPath, lossy: 100, maxColors: 16 });
      assert.ok(res.success);

      const reader = new omggif.GifReader(fs.readFileSync(outPath));
      const decoded = new Uint8Array(width * height * 4);
      reader.decodeAndBlitFrameRGBA(0, decoded);
      assert.ok(decoded[0] >= 240 && decoded[1] >= 240 && decoded[2] >= 240, `Expected bright white pixel, got (${decoded[0]},${decoded[1]},${decoded[2]})`);
    });

    it('T6-9: sanitizeSvg strips iframe, object, embed, external href, and data:text/html', () => {
      const { sanitizeSvg } = require('../mcp/renderer.js');
      const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><iframe src="https://evil.test"></iframe><object data="x"></object><embed src="x"/><a href="https://evil.test" xlink:href="data:text/html,<script>1</script>"><rect width="10" height="10"/></a></svg>`;
      const clean = sanitizeSvg(dirty);
      assert.ok(!/<iframe/i.test(clean));
      assert.ok(!/<object/i.test(clean));
      assert.ok(!/<embed/i.test(clean));
      assert.ok(!/https:\/\/evil\.test/i.test(clean));
      assert.ok(!/data:text\/html/i.test(clean));
      assert.ok(clean.includes('<rect'));
    });

    it('T6-10: renderer enforces MAX_FRAMES guard against OOM frame counts', async () => {
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const prevLimit = process.env.GIF_STUDIO_MAX_FRAMES;
      process.env.GIF_STUDIO_MAX_FRAMES = '10';
      try {
        let threw = false;
        try {
          await renderSvgToGif({
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="#fff"/></svg>',
            fps: 10,
            duration: 2.0
          });
        } catch (err) {
          threw = true;
          assert.match(err.message, /maximum frame limit/i);
        }
        assert.ok(threw, 'Must reject frame counts exceeding GIF_STUDIO_MAX_FRAMES');
      } finally {
        if (prevLimit === undefined) delete process.env.GIF_STUDIO_MAX_FRAMES;
        else process.env.GIF_STUDIO_MAX_FRAMES = prevLimit;
      }
    });
  });
});
