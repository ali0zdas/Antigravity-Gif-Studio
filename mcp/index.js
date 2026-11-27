#!/usr/bin/env node

/**
 * Antigravity GIF Studio — Local Model Context Protocol (MCP) Server & MCP App Host
 *
 * Exposes tools and UI resources for:
 * - open_gif_studio: Primary MCP App (inline, aux_pane side panel, global sidebar)
 * - render_svg_to_gif: Headless browser SVG animation rendering & GIF encoding
 * - generate_preview_widget: Inline MCP App preview + optional standalone HTML fallback
 * - optimize_gif: Palette quantization, frame deduplication & compression
 * - app_* tools (visibility: ["app"]): Asset retrieval, server-side export/save, settings, history
 *
 * Communicates via JSON-RPC 2.0 over stdio transport.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode
} = require('@modelcontextprotocol/sdk/types.js');

const {
  renderSvgToGif,
  parseSvgDimensions,
  detectSvgDuration,
  sanitizeSvg
} = require('./renderer.js');
const { generatePreviewWidget } = require('./widget-template.js');
const { optimizeGif } = require('./optimizer.js');
const { createStore } = require('./store.js');
const {
  saveGifBuffer,
  saveGifWithDialog,
  revealInFileManager
} = require('./os-actions.js');
const { startLocalBridge } = require('./bridge.js');

const APP_URI = 'ui://gif-studio/app.html';
const APP_MIME_TYPE = 'text/html;profile=mcp-app';
const DEFAULT_APP_HTML_PATH = path.join(__dirname, 'dist', 'app.html');
const MAX_STRUCTURED_SVG_BYTES = 700 * 1024; // Stay well below Antigravity's 1 MiB CallToolResult cap

const store = createStore();

// Only start the optional legacy HTTP bridge when explicitly requested
if (process.argv.includes('--legacy-bridge')) {
  try {
    startLocalBridge();
  } catch (e) {}
}

/**
 * Custom StdioServerTransport subclass resilient against malformed JSON lines on stdin.
 */
class ResilientStdioServerTransport extends StdioServerTransport {
  constructor(stdin = process.stdin, stdout = process.stdout) {
    super(stdin, stdout);
  }

  processReadBuffer() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message);
      } catch (err) {
        try {
          this._stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: `Parse error: ${err.message}` },
            id: null
          }) + '\n');
        } catch (writeErr) {}
      }
    }
  }
}

function loadAppHtml() {
  const overridePath = process.env.GIF_STUDIO_APP_HTML;
  const targetPath = overridePath && fs.existsSync(overridePath)
    ? overridePath
    : DEFAULT_APP_HTML_PATH;

  if (!fs.existsSync(targetPath)) {
    throw new McpError(
      ErrorCode.InternalError,
      `MCP App UI bundle not found at "${targetPath}". Run "npm run build:ui" first.`
    );
  }
  return fs.readFileSync(targetPath, 'utf8');
}

function resolveSvgInput(args = {}) {
  let svg = args.svg;
  let svgPath = args.inputPath ? path.resolve(args.inputPath) : null;

  if (args.inputPath) {
    if (!fs.existsSync(svgPath)) {
      throw new Error(`Input SVG file not found at path: ${args.inputPath}`);
    }
    svg = fs.readFileSync(svgPath, 'utf8');
  } else if (typeof svg === 'string' && fs.existsSync(svg) && fs.statSync(svg).isFile()) {
    svgPath = path.resolve(svg);
    svg = fs.readFileSync(svgPath, 'utf8');
  }

  return { svg: typeof svg === 'string' ? svg : '', svgPath };
}

function resolveGifBufferFromArgs(args = {}) {
  if (args.assetId) {
    const asset = store.getAsset(args.assetId);
    if (asset?.gifBase64) {
      return {
        buffer: Buffer.from(asset.gifBase64, 'base64'),
        defaultName: asset.title
      };
    }
    if (asset?.gifPath && fs.existsSync(asset.gifPath)) {
      return {
        buffer: fs.readFileSync(asset.gifPath),
        defaultName: asset.title
      };
    }
  }
  if (args.gifPath && fs.existsSync(args.gifPath)) {
    return {
      buffer: fs.readFileSync(args.gifPath),
      defaultName: path.basename(args.gifPath)
    };
  }
  if (args.gifBase64) {
    return {
      buffer: Buffer.from(String(args.gifBase64).replace(/^data:image\/gif;base64,/, ''), 'base64'),
      defaultName: args.filename
    };
  }
  throw new Error('No rendered GIF data or valid gifPath available. Render a GIF first.');
}

function buildStudioStructuredContent(record, includeExtras = {}) {
  const svgBytes = record?.svg ? Buffer.byteLength(record.svg, 'utf8') : 0;
  const needsAssetFetch = svgBytes > MAX_STRUCTURED_SVG_BYTES || Boolean(record?.gifBase64);

  return {
    assetId: record?.id || null,
    title: record?.title || 'Antigravity GIF Studio',
    svg: needsAssetFetch ? undefined : (record?.svg || ''),
    needsAssetFetch,
    gifPath: record?.gifPath || null,
    svgPath: record?.svgPath || null,
    duration: record?.duration || 2.0,
    fps: record?.fps || 20,
    width: record?.width || 400,
    height: record?.height || 400,
    transparent: Boolean(record?.transparent),
    maxColors: record?.maxColors || 256,
    seamErrorPercentage: record?.seamErrorPercentage ?? null,
    isSeamless: record?.isSeamless ?? null,
    fileSizeBytes: record?.fileSizeBytes ?? null,
    settings: store.getSettings(),
    ...includeExtras
  };
}

const server = new Server(
  {
    name: 'antigravity-gif-studio',
    version: '2.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Register UI Resource Handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: APP_URI,
        name: 'Antigravity GIF Studio App',
        description: 'Interactive SVG animation player, timeline scrubber, GIF renderer, and palette optimizer.',
        mimeType: APP_MIME_TYPE,
        _meta: {
          ui: { prefersBorder: false }
        }
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri !== APP_URI) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown resource URI: ${request.params.uri}`);
  }
  const html = loadAppHtml();
  return {
    contents: [
      {
        uri: APP_URI,
        mimeType: APP_MIME_TYPE,
        text: html,
        _meta: {
          ui: { prefersBorder: false }
        }
      }
    ]
  };
});

// Register Tool Listing Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'open_gif_studio',
        description: 'Opens or updates the interactive Antigravity GIF Studio MCP App (inline, side pane, or full-page sidebar). All parameters are optional; calling with {} opens the latest animation and history.',
        _meta: {
          ui: { resourceUri: APP_URI },
          'com.google.antigravity/ui': {
            entrypoints: [
              { type: 'aux_pane', title: 'GIF Studio' },
              { type: 'global', title: 'GIF Studio' }
            ]
          }
        },
        inputSchema: {
          type: 'object',
          properties: {
            svg: { type: 'string', description: 'Optional raw SVG markup to preview.' },
            inputPath: { type: 'string', description: 'Optional path to an SVG file on disk.' },
            gifPath: { type: 'string', description: 'Optional path to a rendered GIF file on disk.' },
            title: { type: 'string', default: 'Antigravity GIF Studio', description: 'Display title in the studio header.' },
            duration: { type: 'number', description: 'Master loop duration in seconds.' },
            fps: { type: 'integer', default: 20, description: 'Default playback / export FPS (1-60).' },
            width: { type: 'integer', description: 'Canvas width in pixels.' },
            height: { type: 'integer', description: 'Canvas height in pixels.' },
            transparent: { type: 'boolean', default: false, description: 'Whether transparency is enabled.' },
            maxColors: { type: 'integer', default: 256, description: 'Target palette colors (2-256).' },
            seamErrorPercentage: { type: 'number', description: 'Optional seam discontinuity % from render_svg_to_gif.' },
            isSeamless: { type: 'boolean', description: 'Optional seamless check status from render_svg_to_gif.' },
            fileSizeBytes: { type: 'integer', description: 'Optional rendered GIF file size in bytes.' }
          }
        }
      },
      {
        name: 'render_svg_to_gif',
        description: 'Renders SVG animation code or an SVG file to an animated looping GIF with configurable FPS, duration, dimensions, transparency, and quantization.',
        inputSchema: {
          type: 'object',
          properties: {
            svg: {
              type: 'string',
              description: 'Raw SVG source code to render, including inline CSS @keyframes, styles, and SMIL elements.'
            },
            inputPath: {
              type: 'string',
              description: 'Optional file path to an SVG file on disk.'
            },
            outputPath: {
              type: 'string',
              description: 'Optional file path where the generated GIF will be saved. If omitted, returns base64 string.'
            },
            width: {
              type: 'integer',
              description: 'Output width in pixels (defaults to SVG viewBox or 400).'
            },
            height: {
              type: 'integer',
              description: 'Output height in pixels (defaults to SVG viewBox or 400).'
            },
            fps: {
              type: 'integer',
              default: 15,
              description: 'Target frames captured per second (1-60).'
            },
            duration: {
              type: 'number',
              description: 'Total loop duration in seconds (auto-detected if omitted).'
            },
            transparent: {
              type: 'boolean',
              default: false,
              description: 'Preserve transparent background using 1-bit alpha (rgba4444). False uses richer rgb565 on solid #000000 backdrop.'
            },
            maxColors: {
              type: 'integer',
              default: 256,
              description: 'Maximum palette color count for quantization (2-256).'
            }
          },
          anyOf: [
            { required: ['svg'] },
            { required: ['inputPath'] }
          ]
        }
      },
      {
        name: 'generate_preview_widget',
        description: 'Opens an inline interactive MCP App preview widget for the SVG animation (and optionally writes a standalone HTML file if outputPath is specified).',
        _meta: {
          ui: { resourceUri: APP_URI }
        },
        inputSchema: {
          type: 'object',
          properties: {
            svg: {
              type: 'string',
              description: 'SVG markup to embed in the interactive preview widget.'
            },
            inputPath: {
              type: 'string',
              description: 'Optional file path to an SVG file on disk.'
            },
            title: {
              type: 'string',
              default: 'Antigravity GIF Studio Preview',
              description: 'Header title displayed on the preview card.'
            },
            duration: {
              type: 'number',
              description: 'Nominal loop duration in seconds.'
            },
            fps: {
              type: 'integer',
              default: 20,
              description: 'Default playback / re-encoding FPS.'
            },
            outputPath: {
              type: 'string',
              description: 'Optional path to also write a standalone legacy HTML file.'
            }
          },
          anyOf: [
            { required: ['svg'] },
            { required: ['inputPath'] }
          ]
        }
      },
      {
        name: 'optimize_gif',
        description: 'Performs palette reduction, consecutive frame deduplication, and compression on an input GIF.',
        inputSchema: {
          type: 'object',
          properties: {
            inputGif: {
              type: 'string',
              description: 'File path or base64 string of the input GIF.'
            },
            inputPath: {
              type: 'string',
              description: 'Optional file path to input GIF file on disk.'
            },
            inputBase64: {
              type: 'string',
              description: 'Base64-encoded GIF data (alternative to inputPath).'
            },
            outputPath: {
              type: 'string',
              description: 'Optional file path for optimized output GIF.'
            },
            maxColors: {
              type: 'integer',
              default: 128,
              description: 'Target reduced color palette count (2-256).'
            },
            lossy: {
              type: 'integer',
              default: 20,
              description: 'Lossy compression factor (0-100).'
            },
            frameDeduplication: {
              type: 'boolean',
              default: true,
              description: 'Merge identical or near-identical consecutive frames.'
            }
          },
          anyOf: [
            { required: ['inputGif'] },
            { required: ['inputPath'] },
            { required: ['inputBase64'] }
          ]
        }
      },
      // App-only tools (hidden from model, callable only by the MCP App UI)
      {
        name: 'app_get_asset',
        description: 'App-only: Fetches full SVG/GIF asset payload by assetId.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: {
          type: 'object',
          properties: {
            assetId: { type: 'string' }
          },
          required: ['assetId']
        }
      },
      {
        name: 'app_register_svg',
        description: 'App-only: Registers user-edited SVG markup in the studio cache.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: {
          type: 'object',
          properties: {
            svg: { type: 'string' },
            title: { type: 'string' },
            fps: { type: 'integer' },
            duration: { type: 'number' }
          },
          required: ['svg']
        }
      },
      {
        name: 'app_render_preview',
        description: 'App-only: Renders current SVG to GIF on the server and caches result for preview/export.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: {
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            svg: { type: 'string' },
            title: { type: 'string' },
            fps: { type: 'integer' },
            duration: { type: 'number' },
            width: { type: 'integer' },
            height: { type: 'integer' },
            transparent: { type: 'boolean' },
            maxColors: { type: 'integer' }
          }
        }
      },
      {
        name: 'app_optimize_preview',
        description: 'App-only: Optimizes the current or specified GIF and caches the result.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: {
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            inputPath: { type: 'string' },
            maxColors: { type: 'integer' },
            lossy: { type: 'integer' },
            frameDeduplication: { type: 'boolean' }
          }
        }
      },
      {
        name: 'app_save_gif',
        description: 'App-only: Saves the active GIF to the Pictures directory (or configured outputDir).',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: {
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            filename: { type: 'string' },
            targetDir: { type: 'string' }
          }
        }
      },
      {
        name: 'app_save_gif_as',
        description: 'App-only: Opens a native OS Save-As dialog for the active GIF.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: {
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            filename: { type: 'string' }
          }
        }
      },
      {
        name: 'app_open_folder',
        description: 'App-only: Reveals a saved GIF in the OS file manager.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        }
      },
      {
        name: 'app_get_settings',
        description: 'App-only: Reads persisted studio preferences.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'app_save_settings',
        description: 'App-only: Persists studio preferences to data_dir.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: {
          type: 'object',
          properties: {
            fps: { type: 'integer' },
            maxColors: { type: 'integer' },
            transparent: { type: 'boolean' },
            backgroundMode: { type: 'string' },
            outputDir: { type: 'string' }
          }
        }
      },
      {
        name: 'app_list_history',
        description: 'App-only: Lists recent animations from studio history.',
        _meta: { ui: { visibility: ['app'] } },
        inputSchema: { type: 'object', properties: {} }
      }
    ]
  };
});

// Register Tool Execution Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'open_gif_studio': {
        const hasSvgInput = Boolean(args?.svg || args?.inputPath);
        let record = null;

        if (hasSvgInput) {
          const { svg, svgPath } = resolveSvgInput(args);
          const sanitized = sanitizeSvg(svg.trim());
          const dims = parseSvgDimensions(sanitized);
          const duration = args.duration > 0 ? Number(args.duration) : detectSvgDuration(sanitized);
          const settings = store.getSettings();

          let gifBase64 = null;
          let fileSizeBytes = args.fileSizeBytes ?? null;
          const resolvedGifPath = args.gifPath ? path.resolve(args.gifPath) : null;
          if (resolvedGifPath && fs.existsSync(resolvedGifPath)) {
            const buf = fs.readFileSync(resolvedGifPath);
            gifBase64 = buf.toString('base64');
            fileSizeBytes = fileSizeBytes ?? buf.length;
          }

          record = store.putAsset({
            title: args.title || 'Antigravity GIF Studio',
            svg: sanitized,
            svgPath,
            gifPath: resolvedGifPath,
            gifBase64,
            duration,
            fps: args.fps || settings.fps || 20,
            width: args.width || dims.width,
            height: args.height || dims.height,
            transparent: args.transparent ?? settings.transparent ?? false,
            maxColors: args.maxColors || settings.maxColors || 256,
            seamErrorPercentage: args.seamErrorPercentage ?? null,
            isSeamless: args.isSeamless ?? null,
            fileSizeBytes
          });
        } else if (args?.gifPath && fs.existsSync(args.gifPath)) {
          const resolvedGifPath = path.resolve(args.gifPath);
          const buf = fs.readFileSync(resolvedGifPath);
          record = store.putAsset({
            title: args.title || path.basename(resolvedGifPath),
            svg: '',
            gifPath: resolvedGifPath,
            gifBase64: buf.toString('base64'),
            fileSizeBytes: buf.length,
            duration: args.duration || 2.0,
            fps: args.fps || 20
          });
        } else {
          record = store.getLatestAsset();
        }

        const structuredContent = buildStudioStructuredContent(record, {
          history: store.listHistory(),
          empty: !record
        });

        const summary = record
          ? {
              success: true,
              assetId: record.id,
              title: record.title,
              width: record.width,
              height: record.height,
              durationSeconds: record.duration,
              fps: record.fps,
              gifPath: record.gifPath
            }
          : {
              success: true,
              empty: true,
              historyCount: structuredContent.history.length
            };

        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
          structuredContent
        };
      }

      case 'render_svg_to_gif': {
        if (!args || typeof args !== 'object' || Object.keys(args).length === 0) {
          return {
            content: [{ type: 'text', text: 'Error: Arguments object is required. Provide svg or inputPath.' }],
            isError: true
          };
        }
        if (!args.svg && !args.inputPath) {
          return {
            content: [{ type: 'text', text: 'Error: Missing required parameter "svg" or "inputPath".' }],
            isError: true
          };
        }

        const result = await renderSvgToGif(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'generate_preview_widget': {
        if (!args || typeof args !== 'object' || Object.keys(args).length === 0) {
          return {
            content: [{ type: 'text', text: 'Error: Arguments object is required. Provide svg or inputPath.' }],
            isError: true
          };
        }
        if (!args.svg && !args.inputPath) {
          return {
            content: [{ type: 'text', text: 'Error: Missing required parameter "svg" or "inputPath".' }],
            isError: true
          };
        }

        const { svg, svgPath } = resolveSvgInput(args);
        const sanitized = sanitizeSvg(svg.trim());
        const dims = parseSvgDimensions(sanitized);

        // Only write legacy standalone HTML if outputPath is explicitly requested
        let legacyMeta = {};
        if (args.outputPath) {
          const legacyRes = await generatePreviewWidget(args);
          legacyMeta = {
            outputPath: legacyRes.outputPath,
            fileSizeBytes: legacyRes.fileSizeBytes
          };
        }

        const duration = args.duration > 0 ? Number(args.duration) : detectSvgDuration(sanitized);
        const fps = Number(args.fps) || 20;
        const record = store.putAsset({
          title: args.title || 'Antigravity GIF Studio Preview',
          svg: sanitized,
          svgPath,
          duration,
          fps,
          width: dims.width,
          height: dims.height
        });

        const summary = {
          success: true,
          assetId: record.id,
          title: record.title,
          durationSeconds: Number(duration.toFixed(3)),
          fps,
          ...legacyMeta
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
          structuredContent: buildStudioStructuredContent(record, { history: store.listHistory() })
        };
      }

      case 'optimize_gif': {
        if (!args || typeof args !== 'object' || Object.keys(args).length === 0) {
          return {
            content: [{ type: 'text', text: 'Error: Arguments object is required. Provide inputGif, inputPath, or inputBase64.' }],
            isError: true
          };
        }
        if (!args.inputGif && !args.inputPath && !args.inputBase64) {
          return {
            content: [{ type: 'text', text: 'Error: Missing required parameter "inputGif", "inputPath", or "inputBase64".' }],
            isError: true
          };
        }

        const result = await optimizeGif(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'app_get_asset': {
        const asset = store.getAsset(args.assetId);
        if (!asset) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ message: `Asset "${args.assetId}" not found.` }) }],
            isError: true
          };
        }
        const payload = {
          ...asset,
          assetId: asset.id,
          settings: store.getSettings()
        };
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, assetId: asset.id }) }],
          structuredContent: payload
        };
      }

      case 'app_register_svg': {
        const sanitized = sanitizeSvg(String(args.svg || '').trim());
        if (!/<svg[\s>]/i.test(sanitized)) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ message: 'Invalid SVG markup.' }) }],
            isError: true
          };
        }
        const dims = parseSvgDimensions(sanitized);
        const duration = args.duration > 0 ? Number(args.duration) : detectSvgDuration(sanitized);
        const record = store.putAsset({
          title: args.title || 'Custom SVG',
          svg: sanitized,
          duration,
          fps: Number(args.fps) || 20,
          width: dims.width,
          height: dims.height
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, assetId: record.id }) }],
          structuredContent: {
            ...record,
            assetId: record.id,
            history: store.listHistory()
          }
        };
      }

      case 'app_render_preview': {
        const existing = args.assetId ? store.getAsset(args.assetId) : null;
        const svgSource = args.svg || existing?.svg;
        if (!svgSource) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ message: 'No SVG available to render.' }) }],
            isError: true
          };
        }
        const rendered = await renderSvgToGif({
          svg: svgSource,
          fps: args.fps,
          duration: args.duration,
          width: args.width,
          height: args.height,
          transparent: Boolean(args.transparent),
          maxColors: args.maxColors || 256
        });

        const updated = store.putAsset({
          id: existing?.id,
          title: args.title || existing?.title || 'Antigravity GIF Studio',
          svg: sanitizeSvg(svgSource.trim()),
          svgPath: existing?.svgPath || null,
          gifPath: existing?.gifPath || null,
          gifBase64: rendered.gifBase64,
          duration: rendered.durationSeconds,
          fps: rendered.fps,
          width: rendered.width,
          height: rendered.height,
          transparent: Boolean(args.transparent),
          maxColors: args.maxColors || 256,
          seamErrorPercentage: rendered.seamErrorPercentage,
          isSeamless: rendered.isSeamless,
          fileSizeBytes: rendered.fileSizeBytes
        });

        const payload = {
          ...updated,
          assetId: updated.id,
          frameCount: rendered.frameCount,
          history: store.listHistory()
        };

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, assetId: updated.id, fileSizeBytes: rendered.fileSizeBytes }) }],
          structuredContent: payload
        };
      }

      case 'app_optimize_preview': {
        const existing = args.assetId ? store.getAsset(args.assetId) : null;
        const optArgs = {
          maxColors: args.maxColors || 128,
          lossy: args.lossy ?? 20,
          frameDeduplication: args.frameDeduplication !== false
        };
        if (args.inputPath) {
          optArgs.inputPath = args.inputPath;
        } else if (existing?.gifBase64) {
          optArgs.inputBase64 = existing.gifBase64;
        } else if (existing?.gifPath) {
          optArgs.inputPath = existing.gifPath;
        } else {
          return {
            content: [{ type: 'text', text: JSON.stringify({ message: 'No GIF available to optimize.' }) }],
            isError: true
          };
        }

        const optRes = await optimizeGif(optArgs);
        const updated = store.putAsset({
          id: existing?.id,
          title: existing?.title || (args.inputPath ? path.basename(args.inputPath) : 'Optimized GIF'),
          svg: existing?.svg || '',
          svgPath: existing?.svgPath || null,
          gifPath: args.inputPath ? path.resolve(args.inputPath) : existing?.gifPath || null,
          gifBase64: optRes.gifBase64,
          duration: existing?.duration || 2.0,
          fps: existing?.fps || 20,
          width: existing?.width || 400,
          height: existing?.height || 400,
          transparent: existing?.transparent ?? false,
          maxColors: optArgs.maxColors,
          fileSizeBytes: optRes.optimizedBytes
        });

        const payload = {
          ...updated,
          assetId: updated.id,
          originalBytes: optRes.originalBytes,
          optimizedBytes: optRes.optimizedBytes,
          savingsPercent: optRes.savingsPercent,
          keptOriginal: optRes.keptOriginal,
          history: store.listHistory()
        };

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, savingsPercent: optRes.savingsPercent }) }],
          structuredContent: payload
        };
      }

      case 'app_save_gif': {
        const { buffer, defaultName } = resolveGifBufferFromArgs(args);
        const settings = store.getSettings();
        const saved = saveGifBuffer(buffer, {
          filename: args.filename || defaultName,
          targetDir: args.targetDir || settings.outputDir || undefined
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(saved) }],
          structuredContent: saved
        };
      }

      case 'app_save_gif_as': {
        const { buffer, defaultName } = resolveGifBufferFromArgs(args);
        const settings = store.getSettings();
        const saved = await saveGifWithDialog(
          buffer,
          args.filename || defaultName,
          settings.outputDir || undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(saved) }],
          structuredContent: saved
        };
      }

      case 'app_open_folder': {
        const res = revealInFileManager(args.path);
        return {
          content: [{ type: 'text', text: JSON.stringify(res) }],
          structuredContent: res
        };
      }

      case 'app_get_settings': {
        const settings = store.getSettings();
        return {
          content: [{ type: 'text', text: JSON.stringify(settings) }],
          structuredContent: { settings }
        };
      }

      case 'app_save_settings': {
        const settings = store.saveSettings(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(settings) }],
          structuredContent: { settings }
        };
      }

      case 'app_list_history': {
        const history = store.listHistory();
        return {
          content: [{ type: 'text', text: JSON.stringify({ history }) }],
          structuredContent: { history }
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found or unknown tool: "${name}"`);
    }
  } catch (err) {
    if (err instanceof McpError) {
      throw err;
    }
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${err.message}`
        }
      ],
      isError: true
    };
  }
});

// Launch Server
async function main() {
  const transport = new ResilientStdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal MCP Server Startup Error:', err);
  process.exit(1);
});
