# Project: Antigravity GIF Studio

## Overview
Antigravity GIF Studio is an official Antigravity Plugin bundling a Skill, an MCP Server, and Generative UI templates to generate animated GIFs and SVGs with zero external API key requirements.

## Architecture
- **Language / Runtime**: Node.js (v22+) with pure JavaScript dependencies (`@modelcontextprotocol/sdk`, `puppeteer-core`, `gifenc`).
- **Headless Browser Layer**: Automated discovery of local Chromium (Google Chrome / Microsoft Edge) via DevTools Protocol (CDP) for frame-accurate CSS `@keyframes` and SMIL animation time-stepping.
- **Rendering & Encoding Pipeline**:
  - Frame time-stepping via Web Animations API (`anim.currentTime = tMs`) and SMIL (`svg.setCurrentTime(t)`).
  - Style-baking onto SVG clones for clean canvas rasterization.
  - Palette quantization & GIF encoding via `gifenc` (NeuQuant / Octree, 1-bit alpha transparency with `dispose: 2`).
  - Optimization via palette deduplication, MSE frame merging, and `ffmpeg` palettegen acceleration where available.
- **Generative UI Architecture**: Self-contained, single-file HTML preview widgets with zero external script/CDN dependencies, inlining `gifenc` for instant client-side GIF re-encoding, live playback, timeline scrubbing, speed control (0.25x–3x), background toggling (transparent checkerboard / dark / light), and FPS selection.
- **Skill Engine**: `skills/gif-studio/SKILL.md` enforcing the Fundamental Harmonic Period Law ($T_i = T_{\text{master}} / k_i$), transform-origin anchoring, and inline preview generation protocols.

## Code Layout
```
.
├── plugin.json                     # Plugin manifest (agent-plugins.org schema)
├── mcp_config.json                 # MCP server registration (${PLUGIN_ROOT}/mcp/index.js)
├── package.json                    # Node.js project manifest & dependencies
├── README.md                       # Comprehensive plugin documentation
├── assets/
│   └── logo.svg                    # Vector logo (512x512)
├── mcp/
│   ├── index.js                    # MCP server entry point (stdio JSON-RPC)
│   ├── chrome-finder.js            # Cross-platform Chrome/Edge binary locator
│   ├── renderer.js                 # SVG frame-stepping & GIF encoding engine
│   ├── optimizer.js                # Palette optimization & compression engine
│   └── widget-template.js          # Standalone Generative UI widget generator
├── skills/
│   └── gif-studio/
│       ├── SKILL.md                # Skill instructions for looping SVG & preview widget
│       └── references/
│           ├── canonicals.md       # Canonical animation motifs & SVG recipes
│           └── motion_math.md      # Mathematical loop harmonic formulas
├── tests/
│   ├── run_tests.js                # E2E test runner
│   ├── tier1_features.test.js      # Tier 1: Feature coverage
│   ├── tier2_boundaries.test.js    # Tier 2: Boundary & corner cases
│   ├── tier3_combinations.test.js  # Tier 3: Cross-feature combinations
│   ├── tier4_realworld.test.js     # Tier 4: Real-world workloads & kanagawa verification
│   └── fixtures/                   # Test SVG/GIF fixtures
└── .agents/teamwork/               # Coordination metadata (no source code)
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Plugin Manifest | Valid `plugin.json` declaring name `antigravity-gif-studio`, description, suggested prompts, logo path, version, and schema | M1 | ORIGINAL_REQUEST §R1 |
| F2 | MCP Configuration | `mcp_config.json` registering local MCP server using `${PLUGIN_ROOT}` stdio transport | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Plugin Logo Asset | Vector logo `assets/logo.svg` (512x512) with creative studio motif | M1 | ORIGINAL_REQUEST §R4 |
| F4 | Documentation | Complete `README.md` covering installation, tools, skill, and examples | M1 | ORIGINAL_REQUEST §R4 |
| F5 | MCP Server Core & Stdio Transport | Local MCP server using `@modelcontextprotocol/sdk` communicating via stdio JSON-RPC | M2 | ORIGINAL_REQUEST §R2 |
| F6 | Tool: `render_svg_to_gif` | Renders SVG code to looping GIF with configurable FPS, duration, dimensions, transparency, and quantization | M2 | ORIGINAL_REQUEST §R2 |
| F7 | Tool: `generate_preview_widget` | Generates self-contained Generative UI HTML artifact embedding SVG & playback controls | M2 | ORIGINAL_REQUEST §R2 |
| F8 | Tool: `optimize_gif` | Performs palette reduction, MSE deduplication, and compression on input GIF | M2 | ORIGINAL_REQUEST §R2 |
| F9 | Skill Definition | `skills/gif-studio/SKILL.md` with looping rules, harmonic period laws, transparency, and preview widget instructions | M3 | ORIGINAL_REQUEST §R3 |
| F10 | Generative UI Preview Widget | Self-contained HTML with live player, scrubber, 0.25x-3x speed, background toggle, FPS selector, client-side re-encoding | M3 | ORIGINAL_REQUEST §R3 |
| F11 | E2E Test Suite & Test Runner | 4-tier opaque-box test suite covering all features, boundaries, combinations, and real-world assets | M_TEST | Dual Track |
| F12 | Proof-of-concept Asset Verification | Verification of `kanagawa_tablo.svg` conversion to genuine looping animated GIF | M4 | ORIGINAL_REQUEST §Verification |
| F13 | Adversarial Coverage Hardening | White-box stress testing, corner cases, and adversarial coverage verification (Tier 5) | M4 | Project Pattern Phase 2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M_TEST | E2E Testing Track | Test harness `tests/run_tests.js`, Tiers 1–4 test suites, `TEST_INFRA.md`, publish `TEST_READY.md` | none | DONE |
| M1 | Manifest, Config & Assets | `plugin.json`, `mcp_config.json`, `assets/logo.svg`, `README.md`, `LICENSE` | none | DONE |
| M2 | MCP Server & Rendering Engine | `package.json`, `mcp/index.js`, `mcp/chrome-finder.js`, `mcp/renderer.js`, `mcp/optimizer.js` | none | DONE |
| M3 | Skill & Generative UI Widget | `skills/gif-studio/SKILL.md`, `mcp/widget-template.js` | M1, M2 | DONE |
| M4 | Final E2E Test Pass & Adversarial Hardening | Pass 100% of E2E test suite (Tiers 1-5, 132 tests) + POC asset verification | M_TEST, M1, M2, M3 | DONE |

## Interface Contracts

### MCP Tool: `render_svg_to_gif`
- **Input**:
  - `svg` (string, required): SVG markup or path to .svg file.
  - `fps` (number, optional, default: 15): Target frames per second (1–60).
  - `duration` (number, optional, default: 2.0): Animation loop duration in seconds.
  - `width` (number, optional): Width in pixels (defaults to SVG viewBox width or 400).
  - `height` (number, optional): Height in pixels (defaults to SVG viewBox height or 400).
  - `transparent` (boolean, optional, default: true): Whether background is transparent.
  - `quality` (number, optional, default: 10): Quantization quality (1–30, lower is better).
  - `outputPath` (string, optional): Absolute or relative path to save the .gif file.
- **Output**:
  - `success` (boolean): `true` if rendered successfully.
  - `gifBase64` (string): Base64-encoded GIF data (if outputPath omitted or requested).
  - `outputPath` (string): File path where GIF was saved.
  - `frameCount` (number): Total frames rendered.
  - `fileSizeBytes` (number): Size of resulting GIF.
  - `width` (number): Output width.
  - `height` (number): Output height.

### MCP Tool: `generate_preview_widget`
- **Input**:
  - `svg` (string, required): SVG markup.
  - `duration` (number, optional, default: 2.0): Loop duration in seconds.
  - `fps` (number, optional, default: 20): Default playback/re-encoding FPS.
  - `title` (string, optional, default: "Antigravity GIF Studio Preview"): Widget title.
  - `outputPath` (string, optional): File path to save the standalone HTML widget.
- **Output**:
  - `html` (string): Complete self-contained HTML document.
  - `outputPath` (string): File path where HTML widget was saved.

### MCP Tool: `optimize_gif`
- **Input**:
  - `inputGif` (string, required): File path or base64 string of the input GIF.
  - `outputPath` (string, optional): File path for optimized output GIF.
  - `maxColors` (number, optional, default: 128): Palette size reduction (16–256).
  - `lossy` (number, optional, default: 20): Compression factor (0–100).
- **Output**:
  - `success` (boolean): `true` if optimization succeeded.
  - `outputPath` (string): Output file path.
  - `originalBytes` (number): Original file size.
  - `optimizedBytes` (number): Optimized file size.
  - `savingsPercent` (number): Percentage reduction.
