#!/usr/bin/env node

/**
 * Antigravity GIF Studio — Local Model Context Protocol (MCP) Server
 * 
 * Exposes tools for:
 * - render_svg_to_gif: Headless browser SVG animation rendering & GIF encoding
 * - generate_preview_widget: Generative UI standalone HTML artifact creation
 * - optimize_gif: Palette quantization, frame deduplication & compression
 * 
 * Communicates via standard JSON-RPC 2.0 over stdio transport.
 */

'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode
} = require('@modelcontextprotocol/sdk/types.js');

const { renderSvgToGif } = require('./renderer.js');
const { generatePreviewWidget } = require('./widget-template.js');
const { optimizeGif } = require('./optimizer.js');

/**
 * Custom StdioServerTransport subclass that is resilient against
 * malformed JSON lines on stdin, emitting standard JSON-RPC Parse errors (-32700)
 * rather than terminating the connection prematurely.
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
        // Recover cleanly from malformed JSON-RPC input by replying with a parse error
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

// Instantiate MCP Server
const server = new Server(
  {
    name: 'antigravity-gif-studio',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register Tool Listing Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
              default: true,
              description: 'Whether to preserve transparent background in the output GIF.'
            },
            maxColors: {
              type: 'integer',
              default: 256,
              description: 'Maximum palette color count for quantization (2-256).'
            }
          },
          required: ['svg']
        }
      },
      {
        name: 'generate_preview_widget',
        description: 'Generates a self-contained Generative UI HTML artifact embedding the SVG, live playback controls, timeline scrubber, 0.25x-3x speed slider, and offline client-side GIF re-encoding.',
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
              description: 'Optional path to write the standalone HTML file.'
            }
          },
          required: ['svg']
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
          required: ['inputGif']
        }
      }
    ]
  };
});

// Register Tool Execution Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'render_svg_to_gif': {
        if (!args || (typeof args !== 'object') || Object.keys(args).length === 0) {
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
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'generate_preview_widget': {
        if (!args || (typeof args !== 'object') || Object.keys(args).length === 0) {
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

        const result = await generatePreviewWidget(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'optimize_gif': {
        if (!args || (typeof args !== 'object') || Object.keys(args).length === 0) {
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
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
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
