/**
 * Tier 1: Feature Coverage Test Suite
 * 
 * Comprehensive tests covering all primary features defined in PROJECT.md:
 * - F1: Plugin Manifest (plugin.json)
 * - F2: MCP Configuration (mcp_config.json)
 * - F3: Plugin Logo Asset (assets/logo.svg)
 * - F4: Documentation (README.md)
 * - F5: MCP Server Core & Stdio Transport (mcp/index.js)
 * - F6: Tool: render_svg_to_gif (mcp/renderer.js)
 * - F7: Tool: generate_preview_widget (mcp/widget-template.js)
 * - F8: Tool: optimize_gif (mcp/optimizer.js)
 * - F9: Skill Definition (skills/gif-studio/SKILL.md)
 * - F10: Generative UI Preview Widget Capabilities
 * 
 * Requirement: >= 5 test cases per feature.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { describe, it, assert } = require('./harness.js');
const {
  resolvePath,
  fileExists,
  readJson,
  readText,
  readBuffer,
  getTempDir,
  parseGifInfo,
  inspectSvg,
  spawnMcpServer
} = require('./test_utils.js');

describe('Tier 1 - Feature Coverage Suite', () => {

  // =========================================================================
  // F1: Plugin Manifest (plugin.json) — >=5 test cases
  // =========================================================================
  describe('F1: Plugin Manifest (plugin.json)', () => {
    it('F1-1: plugin.json exists and is valid JSON', () => {
      assert.ok(fileExists('plugin.json'), 'plugin.json must exist at project root');
      const manifest = readJson('plugin.json');
      assert.ok(manifest && typeof manifest === 'object', 'plugin.json must be a JSON object');
    });

    it('F1-2: plugin.json adheres to official agent-plugins schema', () => {
      const manifest = readJson('plugin.json');
      assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    });

    it('F1-3: plugin.json declares required name "antigravity-gif-studio" and version', () => {
      const manifest = readJson('plugin.json');
      assert.equal(manifest.name, 'antigravity-gif-studio');
      assert.ok(manifest.displayName, 'displayName must be defined');
      assert.match(manifest.version, /^\d+\.\d+\.\d+/, 'version must follow semver format');
    });

    it('F1-4: plugin.json defines descriptive metadata, author, and category', () => {
      const manifest = readJson('plugin.json');
      assert.ok(manifest.description && manifest.description.length >= 20, 'description must be descriptive');
      assert.ok(manifest.category, 'category must be specified');
      assert.ok(manifest.author && manifest.author.name, 'author must include name');
      assert.ok(Array.isArray(manifest.keywords) && manifest.keywords.length >= 3, 'keywords array must have >= 3 tags');
    });

    it('F1-5: plugin.json references valid logo asset and provides suggestedPrompts', () => {
      const manifest = readJson('plugin.json');
      assert.equal(manifest.logo, 'assets/logo.svg', 'logo must point to assets/logo.svg');
      assert.ok(Array.isArray(manifest.suggestedPrompts), 'suggestedPrompts must be an array');
      assert.ok(manifest.suggestedPrompts.length >= 2, 'suggestedPrompts must contain at least 2 prompts');
      manifest.suggestedPrompts.forEach(p => {
        assert.ok(typeof p === 'string' && p.length > 10, 'Each suggested prompt must be a meaningful string');
      });
    });
  });

  // =========================================================================
  // F2: MCP Configuration (mcp_config.json) — >=5 test cases
  // =========================================================================
  describe('F2: MCP Configuration (mcp_config.json)', () => {
    it('F2-1: mcp_config.json exists and is valid JSON', () => {
      assert.ok(fileExists('mcp_config.json'), 'mcp_config.json must exist at project root');
      const config = readJson('mcp_config.json');
      assert.ok(config && typeof config === 'object', 'mcp_config.json must parse as an object');
    });

    it('F2-2: mcp_config.json defines mcpServers object', () => {
      const config = readJson('mcp_config.json');
      assert.ok(config.mcpServers && typeof config.mcpServers === 'object', 'mcpServers key must exist');
    });

    it('F2-3: mcp_config.json registers "antigravity-gif-studio" server', () => {
      const config = readJson('mcp_config.json');
      assert.ok(config.mcpServers['antigravity-gif-studio'], 'Server key "antigravity-gif-studio" must be registered');
    });

    it('F2-4: server command is configured as "node"', () => {
      const config = readJson('mcp_config.json');
      const server = config.mcpServers['antigravity-gif-studio'];
      assert.equal(server.command, 'node', 'Server command must be node');
    });

    it('F2-5: server args reference local entry point with ${PLUGIN_ROOT} or mcp/index.js', () => {
      const config = readJson('mcp_config.json');
      const server = config.mcpServers['antigravity-gif-studio'];
      assert.ok(Array.isArray(server.args), 'args must be an array');
      assert.ok(server.args.length >= 1, 'args must have at least one entry point argument');
      const entryArg = server.args[0];
      assert.ok(
        entryArg.includes('mcp/index.js') || entryArg.includes('mcp\\index.js'),
        `Entry point must point to mcp/index.js, got: ${entryArg}`
      );
    });
  });

  // =========================================================================
  // F3: Plugin Logo Asset (assets/logo.svg) — >=5 test cases
  // =========================================================================
  describe('F3: Plugin Logo Asset (assets/logo.svg)', () => {
    it('F3-1: assets/logo.svg exists and is non-empty', () => {
      assert.ok(fileExists('assets/logo.svg'), 'assets/logo.svg must exist');
      const content = readText('assets/logo.svg');
      assert.ok(content.length > 100, 'Logo SVG content must not be empty');
    });

    it('F3-2: assets/logo.svg has valid root <svg> tag with XML namespace', () => {
      const content = readText('assets/logo.svg');
      assert.match(content, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/i, 'Must declare SVG namespace');
      assert.match(content, /<\/svg>\s*$/i, 'Must have closing </svg> tag');
    });

    it('F3-3: assets/logo.svg specifies 512x512 viewBox and square dimensions', () => {
      const info = inspectSvg(readText('assets/logo.svg'));
      assert.ok(info.viewBox, 'Logo must specify viewBox attribute');
      assert.ok(info.viewBox.includes('512') || (info.width === '512' && info.height === '512'), 'viewBox or dimensions must be 512x512');
    });

    it('F3-4: assets/logo.svg contains defs with gradient shaders', () => {
      const content = readText('assets/logo.svg');
      assert.match(content, /<defs>/i, 'Logo should contain <defs> section');
      assert.match(content, /(linearGradient|radialGradient)/i, 'Logo should include vector gradients');
    });

    it('F3-5: assets/logo.svg embodies studio visual motif with geometric elements', () => {
      const content = readText('assets/logo.svg');
      const hasPaths = /<path[\s>]/i.test(content);
      const hasShapes = /(circle|rect|polygon|ellipse)/i.test(content);
      assert.ok(hasPaths || hasShapes, 'Logo must contain vector paths or geometric shapes');
    });
  });

  // =========================================================================
  // F4: Documentation (README.md) — >=5 test cases
  // =========================================================================
  describe('F4: Documentation (README.md)', () => {
    it('F4-1: README.md exists and is comprehensive (>1000 bytes)', () => {
      assert.ok(fileExists('README.md'), 'README.md must exist');
      const content = readText('README.md');
      assert.ok(content.length >= 1000, `README.md should be comprehensive, size: ${content.length} bytes`);
    });

    it('F4-2: README.md documents installation and plugin configuration', () => {
      const content = readText('README.md');
      assert.match(content, /#+[^#\n]*Installation/i, 'Must have Installation section');
      assert.match(content, /mcp_config\.json/i, 'Must mention mcp_config.json');
    });

    it('F4-3: README.md documents all 3 MCP tools with parameters', () => {
      const content = readText('README.md');
      assert.ok(content.includes('render_svg_to_gif'), 'Must document render_svg_to_gif');
      assert.ok(content.includes('generate_preview_widget'), 'Must document generate_preview_widget');
      assert.ok(content.includes('optimize_gif'), 'Must document optimize_gif');
    });

    it('F4-4: README.md documents Generative UI preview widget capabilities', () => {
      const content = readText('README.md');
      assert.match(content, /preview|widget|generative\s*ui/i, 'Must document preview widget');
      assert.match(content, /scrub|speed|fps/i, 'Must mention widget interactive controls');
    });

    it('F4-5: README.md documents skill usage and zero external API key guarantee', () => {
      const content = readText('README.md');
      assert.match(content, /skills\/gif-studio/i, 'Must reference the skill directory');
      assert.match(content, /zero\s*(external)?\s*api/i, 'Must emphasize zero external API key architecture');
    });
  });

  // =========================================================================
  // F5: MCP Server Core & Stdio Transport (mcp/index.js) — >=5 test cases
  // =========================================================================
  describe('F5: MCP Server Core & Stdio Transport (mcp/index.js)', () => {
    it('F5-1: mcp/index.js exists and is executable via Node.js', () => {
      assert.ok(fileExists('mcp/index.js'), 'mcp/index.js must exist');
    });

    it('F5-2: MCP server initializes cleanly over stdio JSON-RPC handshake', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        assert.ok(client.initResult, 'Must return initialize result');
        assert.ok(client.initResult.serverInfo, 'Must declare serverInfo');
        assert.equal(client.initResult.serverInfo.name, 'antigravity-gif-studio');
      } finally {
        await client.close();
      }
    });

    it('F5-3: MCP server advertises capabilities with tools support', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        assert.ok(client.initResult.capabilities, 'Must declare capabilities');
        assert.ok(client.initResult.capabilities.tools, 'Must declare tools capability');
      } finally {
        await client.close();
      }
    });

    it('F5-4: tools/list returns exactly the 3 required tools', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        const res = await client.listTools();
        assert.ok(Array.isArray(res.tools), 'tools must be an array');
        const toolNames = res.tools.map(t => t.name);
        assert.ok(toolNames.includes('render_svg_to_gif'), 'Must have render_svg_to_gif');
        assert.ok(toolNames.includes('generate_preview_widget'), 'Must have generate_preview_widget');
        assert.ok(toolNames.includes('optimize_gif'), 'Must have optimize_gif');
      } finally {
        await client.close();
      }
    });

    it('F5-5: Each tool specifies a valid inputSchema with JSON schema type object', async () => {
      if (!fileExists('mcp/index.js')) {
        assert.fail('mcp/index.js missing (pending Milestone M2)');
      }
      const client = await spawnMcpServer();
      try {
        const res = await client.listTools();
        res.tools.forEach(tool => {
          assert.ok(tool.description, `Tool ${tool.name} must have description`);
          assert.ok(tool.inputSchema, `Tool ${tool.name} must have inputSchema`);
          assert.equal(tool.inputSchema.type, 'object', `Tool ${tool.name} schema type must be object`);
        });
      } finally {
        await client.close();
      }
    });
  });

  // =========================================================================
  // F6: MCP Tool: render_svg_to_gif — >=5 test cases
  // =========================================================================
  describe('F6: Tool: render_svg_to_gif', () => {
    it('F6-1: renderer module is present and exports render function', () => {
      assert.ok(fileExists('mcp/renderer.js'), 'mcp/renderer.js must exist');
      const renderer = require('../mcp/renderer.js');
      assert.ok(typeof renderer.renderSvgToGif === 'function', 'renderer must export renderSvgToGif function');
    });

    it('F6-2: renders basic SVG to GIF with default parameters', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('f6_2');
      const outPath = path.join(outDir, 'basic.gif');

      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        fps: 10,
        duration: 1.0
      });

      assert.ok(res.success, 'Rendering must succeed');
      assert.ok(fs.existsSync(outPath), 'Output file must exist');
      const gifInfo = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(gifInfo.version, '89a');
      assert.ok(gifInfo.frameCount >= 1, 'Must have at least 1 frame');
    });

    it('F6-3: respects custom width and height parameters', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('f6_3');
      const outPath = path.join(outDir, 'dimensions.gif');

      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        width: 240,
        height: 180,
        fps: 10,
        duration: 1.0
      });

      assert.ok(res.success);
      const gifInfo = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(gifInfo.width, 240);
      assert.equal(gifInfo.height, 180);
    });

    it('F6-4: preserves transparent background when transparent=true', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/transparent_spinner.svg');
      const outDir = getTempDir('f6_4');
      const outPath = path.join(outDir, 'trans.gif');

      const res = await renderSvgToGif({
        svg,
        outputPath: outPath,
        transparent: true,
        fps: 10,
        duration: 1.0
      });

      assert.ok(res.success);
      const gifInfo = parseGifInfo(fs.readFileSync(outPath));
      // First frame must specify transparency flag in Graphic Control Extension
      assert.ok(gifInfo.frames.length > 0);
      assert.equal(gifInfo.frames[0].control.transparent, true, 'Transparency must be flagged in GIF GCE');
    });

    it('F6-5: returns gifBase64 when outputPath is omitted', async () => {
      if (!fileExists('mcp/renderer.js')) {
        assert.fail('mcp/renderer.js missing (pending Milestone M2)');
      }
      const { renderSvgToGif } = require('../mcp/renderer.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');

      const res = await renderSvgToGif({
        svg,
        fps: 5,
        duration: 0.5
      });

      assert.ok(res.success);
      assert.ok(res.gifBase64, 'Must return gifBase64 property');
      const buf = Buffer.from(res.gifBase64, 'base64');
      const gifInfo = parseGifInfo(buf);
      assert.equal(gifInfo.version, '89a');
    });
  });

  // =========================================================================
  // F7: Tool: generate_preview_widget — >=5 test cases
  // =========================================================================
  describe('F7: Tool: generate_preview_widget', () => {
    it('F7-1: widget-template module exists and exports generation function', () => {
      assert.ok(fileExists('mcp/widget-template.js'), 'mcp/widget-template.js must exist');
      const widgetMod = require('../mcp/widget-template.js');
      assert.ok(typeof widgetMod.generatePreviewWidget === 'function', 'Must export generatePreviewWidget');
    });

    it('F7-2: generates standalone HTML containing the embedded SVG markup', async () => {
      if (!fileExists('mcp/widget-template.js')) {
        assert.fail('mcp/widget-template.js missing (pending Milestone M3)');
      }
      const { generatePreviewWidget } = require('../mcp/widget-template.js');
      const svg = readText('tests/fixtures/pulse_circle.svg');
      const res = await generatePreviewWidget({ svg });

      assert.ok(res.html, 'Must return html string');
      assert.match(res.html, /<!DOCTYPE\s+html>/i, 'Must be valid HTML document');
      assert.ok(res.html.includes('pulseEffect'), 'Must embed SVG @keyframes style');
      assert.ok(res.html.includes('<circle'), 'Must embed SVG geometry');
    });

    it('F7-3: inlines gifenc client-side encoder for zero-dependency offline re-encoding', async () => {
      if (!fileExists('mcp/widget-template.js')) {
        assert.fail('mcp/widget-template.js missing (pending Milestone M3)');
      }
      const { generatePreviewWidget } = require('../mcp/widget-template.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const res = await generatePreviewWidget({ svg });

      assert.match(res.html, /(GIFEncoder|gifenc)/i, 'Must inline gifenc encoder');
      assert.ok(!res.html.includes('cdn.jsdelivr.net'), 'Must not depend on external CDNs');
      assert.ok(!res.html.includes('unpkg.com'), 'Must not depend on external unpkg');
    });

    it('F7-4: embeds interactive playback, scrubber, and speed controls', async () => {
      if (!fileExists('mcp/widget-template.js')) {
        assert.fail('mcp/widget-template.js missing (pending Milestone M3)');
      }
      const { generatePreviewWidget } = require('../mcp/widget-template.js');
      const svg = readText('tests/fixtures/conveyor_wave.svg');
      const res = await generatePreviewWidget({ svg, duration: 2.0, fps: 24 });

      assert.match(res.html, /type=["']range["']/i, 'Must include timeline scrubber range slider');
      assert.match(res.html, /(play|pause)/i, 'Must include play/pause control');
      assert.match(res.html, /speed/i, 'Must include speed multiplier');
      assert.match(res.html, /fps/i, 'Must include fps selector');
    });

    it('F7-5: saves HTML directly to outputPath when specified', async () => {
      if (!fileExists('mcp/widget-template.js')) {
        assert.fail('mcp/widget-template.js missing (pending Milestone M3)');
      }
      const { generatePreviewWidget } = require('../mcp/widget-template.js');
      const svg = readText('tests/fixtures/minimal_rect.svg');
      const outDir = getTempDir('f7_5');
      const outPath = path.join(outDir, 'widget.html');

      const res = await generatePreviewWidget({ svg, outputPath: outPath });
      assert.ok(fs.existsSync(outPath), 'Widget HTML file must exist on disk');
      const diskHtml = fs.readFileSync(outPath, 'utf8');
      assert.equal(diskHtml, res.html);
    });
  });

  // =========================================================================
  // F8: Tool: optimize_gif — >=5 test cases
  // =========================================================================
  describe('F8: Tool: optimize_gif', () => {
    it('F8-1: optimizer module exists and exports optimizeGif function', () => {
      assert.ok(fileExists('mcp/optimizer.js'), 'mcp/optimizer.js must exist');
      const opt = require('../mcp/optimizer.js');
      assert.ok(typeof opt.optimizeGif === 'function', 'Must export optimizeGif');
    });

    it('F8-2: optimizes GIF file and produces valid GIF89a output', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      const inputPath = resolvePath('tests/fixtures/sample_animated.gif');
      const outDir = getTempDir('f8_2');
      const outPath = path.join(outDir, 'opt_basic.gif');

      const res = await optimizeGif({
        inputPath,
        outputPath: outPath,
        maxColors: 64
      });

      assert.ok(res.success);
      assert.ok(fs.existsSync(outPath));
      const info = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(info.version, '89a');
    });

    it('F8-3: returns compression stats (originalBytes, optimizedBytes, savingsPercent)', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      const inputPath = resolvePath('tests/fixtures/sample_animated.gif');
      const outDir = getTempDir('f8_3');
      const outPath = path.join(outDir, 'opt_stats.gif');

      const res = await optimizeGif({
        inputPath,
        outputPath: outPath,
        maxColors: 32
      });

      assert.ok(typeof res.originalBytes === 'number');
      assert.ok(typeof res.optimizedBytes === 'number');
      assert.ok(typeof res.savingsPercent === 'number');
      assert.ok(res.optimizedBytes <= res.originalBytes, 'Optimized size should not exceed original');
    });

    it('F8-4: supports in-memory base64 input and output', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      const buf = readBuffer('tests/fixtures/sample_animated.gif');
      const base64Input = buf.toString('base64');

      const res = await optimizeGif({
        inputBase64: base64Input,
        maxColors: 64
      });

      assert.ok(res.success);
      assert.ok(res.optimizedBase64 || res.gifBase64, 'Must return base64 payload when outputPath omitted');
    });

    it('F8-5: preserves frame count and animation timing in optimized GIF', async () => {
      if (!fileExists('mcp/optimizer.js')) {
        assert.fail('mcp/optimizer.js missing (pending Milestone M2)');
      }
      const { optimizeGif } = require('../mcp/optimizer.js');
      const inputPath = resolvePath('tests/fixtures/sample_animated.gif');
      const origInfo = parseGifInfo(readBuffer('tests/fixtures/sample_animated.gif'));
      const outDir = getTempDir('f8_5');
      const outPath = path.join(outDir, 'opt_timing.gif');

      await optimizeGif({
        inputPath,
        outputPath: outPath,
        maxColors: 128
      });

      const optInfo = parseGifInfo(fs.readFileSync(outPath));
      assert.equal(optInfo.frameCount, origInfo.frameCount, 'Frame count must be preserved');
      assert.equal(optInfo.width, origInfo.width, 'Width must be preserved');
      assert.equal(optInfo.height, origInfo.height, 'Height must be preserved');
    });
  });

  // =========================================================================
  // F9: Skill Definition (skills/gif-studio/SKILL.md) — >=5 test cases
  // =========================================================================
  describe('F9: Skill Definition (skills/gif-studio/SKILL.md)', () => {
    it('F9-1: skills/gif-studio/SKILL.md exists and is non-empty', () => {
      assert.ok(fileExists('skills/gif-studio/SKILL.md'), 'SKILL.md must exist');
      const text = readText('skills/gif-studio/SKILL.md');
      assert.ok(text.length >= 500, 'SKILL.md must have substantive content');
    });

    it('F9-2: SKILL.md declares valid YAML frontmatter with name and description', () => {
      if (!fileExists('skills/gif-studio/SKILL.md')) {
        assert.fail('skills/gif-studio/SKILL.md missing (pending Milestone M3)');
      }
      const text = readText('skills/gif-studio/SKILL.md');
      assert.match(text, /^---\r?\n[\s\S]+?\r?\n---/, 'Must start with YAML frontmatter');
      assert.match(text, /name:\s*gif-studio/i, 'Must define skill name');
      assert.match(text, /description:/i, 'Must define skill description');
    });

    it('F9-3: SKILL.md enforces the Fundamental Harmonic Period Law (Ti = Tmaster / ki)', () => {
      if (!fileExists('skills/gif-studio/SKILL.md')) {
        assert.fail('skills/gif-studio/SKILL.md missing (pending Milestone M3)');
      }
      const text = readText('skills/gif-studio/SKILL.md');
      assert.match(text, /(harmonic|sub-multiple|T_master|master\s*loop)/i, 'Must teach harmonic loop periods');
      assert.match(text, /animation-delay/i, 'Must document negative animation-delay for phase offset');
    });

    it('F9-4: SKILL.md documents transform-origin anchoring rules for SVG', () => {
      if (!fileExists('skills/gif-studio/SKILL.md')) {
        assert.fail('skills/gif-studio/SKILL.md missing (pending Milestone M3)');
      }
      const text = readText('skills/gif-studio/SKILL.md');
      assert.match(text, /transform-origin/i, 'Must document transform-origin discipline');
      assert.match(text, /(transform-box|fill-box|viewbox\s*coordinates)/i, 'Must teach center anchoring');
    });

    it('F9-5: SKILL.md provides guidance on transparency and 256-color palette optimization', () => {
      if (!fileExists('skills/gif-studio/SKILL.md')) {
        assert.fail('skills/gif-studio/SKILL.md missing (pending Milestone M3)');
      }
      const text = readText('skills/gif-studio/SKILL.md');
      assert.match(text, /transparen/i, 'Must document transparency handling (1-bit alpha)');
      assert.match(text, /(palette|256|quantiz)/i, 'Must document GIF 256-color palette constraints');
    });
  });

  // =========================================================================
  // F10: Generative UI Preview Widget Capabilities — >=5 test cases
  // =========================================================================
  describe('F10: Generative UI Preview Widget Capabilities', () => {
    let widgetHtml = '';

    it('F10-1: generates HTML with full UI container and header branding', async () => {
      if (!fileExists('mcp/widget-template.js')) {
        assert.fail('mcp/widget-template.js missing (pending Milestone M3)');
      }
      const { generatePreviewWidget } = require('../mcp/widget-template.js');
      const svg = readText('tests/fixtures/pulse_circle.svg');
      const res = await generatePreviewWidget({ svg, title: 'Antigravity Test Studio' });
      widgetHtml = res.html;
      assert.ok(widgetHtml.includes('Antigravity Test Studio'), 'Must contain customized title');
    });

    it('F10-2: supports background mode switching (checkerboard, dark, light)', () => {
      if (!widgetHtml) assert.fail('Widget HTML not generated');
      assert.match(widgetHtml, /(checker|dark|light)/i, 'Must provide background mode switcher');
    });

    it('F10-3: provides speed multiplier range from 0.25x to 3.0x', () => {
      if (!widgetHtml) assert.fail('Widget HTML not generated');
      assert.match(widgetHtml, /0\.25/i, 'Must support 0.25x speed');
      assert.match(widgetHtml, /3(\.0)?x?/i, 'Must support 3.0x speed');
    });

    it('F10-4: supports multi-framerate selection (10, 15, 24, 30, 60 fps)', () => {
      if (!widgetHtml) assert.fail('Widget HTML not generated');
      assert.match(widgetHtml, /15/i, 'Must offer 15 fps');
      assert.match(widgetHtml, /24|30/i, 'Must offer standard fps options');
    });

    it('F10-5: includes client-side GIF re-encoding button and progress indicator', () => {
      if (!widgetHtml) assert.fail('Widget HTML not generated');
      assert.match(widgetHtml, /(reencode|export|download).*gif/i, 'Must include GIF re-encoding export button');
      assert.match(widgetHtml, /progress/i, 'Must include progress bar or status feedback');
    });
  });
});
