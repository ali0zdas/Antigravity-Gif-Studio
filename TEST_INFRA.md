# Antigravity GIF Studio — Test Infrastructure & Architecture

**Document Version**: 1.0.0  
**Author**: Test Writer 1 (E2E Test Suite Architect)  
**Target System**: Antigravity GIF Studio  
**Integrity Mode**: Development / Test-Driven Verification  

---

## 1. Test Architecture & Methodology

Antigravity GIF Studio uses a **zero-external-dependency, 4-tier opaque-box test architecture** executed by a custom Node.js test harness (`tests/harness.js`) and runner CLI (`tests/run_tests.js`).

### Core Design Principles:
1. **Zero External Test Frameworks**: Implemented in native Node.js (v22+) utilizing `node:assert/strict` and pure JavaScript binary parsing. Zero reliance on Jest, Mocha, or Vitest eliminates npm configuration overhead and Windows execution friction.
2. **Binary-Level GIF Verification**: `tests/test_utils.js` implements a pure-JS GIF parser reading GIF87a/GIF89a logical screen descriptors, global/local color tables, Graphic Control Extensions (delay, transparency flag, index), Application Extensions (Netscape 2.0 loop count), and Image Descriptors.
3. **Motion Advancement Detection**: Unlike naive file-check tests, the harness compares image data blocks and raster hashes across frames to guarantee that CSS `@keyframes` and SMIL animations actually advanced in time (preventing the static-frame defect discovered in legacy tools).
4. **End-to-End Stdio MCP Client**: Built-in JSON-RPC 2.0 client spawns `node mcp/index.js`, executes the initialization handshake, queries `tools/list`, and dispatches `tools/call` over stdin/stdout pipes.
5. **Progressive Testability & Fail-Fast Reporting**: Test cases assert against strict interface contracts. Completed milestones pass cleanly (e.g. M1: F1–F4), while pending milestones report clear, actionable assertion messages specifying the missing file or interface.

---

## 2. Test Suite Directory Layout

```
tests/
├── run_tests.js               # Standalone test runner CLI (entry point)
├── harness.js                 # Zero-dependency test engine (describe, it, hooks, timeouts)
├── test_utils.js              # GIF binary parser, SVG inspector, MCP client helper, temp manager
├── tier1_features.test.js     # Tier 1: Feature Coverage (F1–F10, >=5 tests/feature)
├── tier2_boundaries.test.js   # Tier 2: Boundary & Corner Cases (7 areas, >=5 tests/area)
├── tier3_combinations.test.js # Tier 3: Cross-Feature Combinations & Pipelines
├── tier4_realworld.test.js    # Tier 4: Real-World Workloads & Kanagawa Motion Verification
├── fixtures/                  # Authoritative test fixtures
│   ├── kanagawa_tablo.svg     # Reference Great Wave artwork (600x400, 6 @keyframes)
│   ├── minimal_rect.svg       # Minimal static vector rectangle
│   ├── pulse_circle.svg       # CSS @keyframes pulsing scale/opacity
│   ├── smil_rect.svg          # SMIL <animate> and <animateTransform>
│   ├── dual_anim.svg          # Simultaneous CSS and SMIL animations
│   ├── harmonic_loader.svg    # 3 phase-staggered harmonic bouncing dots
│   ├── conveyor_wave.svg      # Modulo translateX infinite wave conveyor
│   ├── transparent_spinner.svg# 100% transparent alpha rotating spinner
│   ├── invalid_malformed.svg  # Broken XML for error recovery testing
│   ├── no_dimensions.svg      # SVG missing dimensions and viewBox
│   ├── wide_banner.svg        # 1200x200 extreme aspect ratio
│   ├── tall_banner.svg        # 200x800 extreme aspect ratio
│   ├── xss_payload.svg        # Embedded script tags for sanitization verification
│   ├── sample_animated.gif    # Synthetic 3-frame animated GIF
│   ├── sample_transparent.gif # Synthetic 2-frame transparent animated GIF
│   └── sample_static.gif      # Synthetic 1-frame static GIF
└── tmp/                       # Ephemeral scratchpad for test renders (auto-cleaned)
```

---

## 3. Test Runner CLI (`tests/run_tests.js`)

The standalone test runner provides granular control over test execution, filtering, and reporting.

### Command Reference:

```bash
# Run all test tiers (Tiers 1 through 4)
node tests/run_tests.js

# Run individual tiers
node tests/run_tests.js --tier 1       # Tier 1: Feature Coverage
node tests/run_tests.js --tier 2       # Tier 2: Boundary & Corner Cases
node tests/run_tests.js --tier 3       # Tier 3: Cross-Feature Combinations
node tests/run_tests.js --tier 4       # Tier 4: Real-World Scenarios

# Shorthand tier syntax
node tests/run_tests.js tier1
node tests/run_tests.js 2

# Filter tests by string or feature ID
node tests/run_tests.js --filter F1    # Run only F1 tests
node tests/run_tests.js -f kanagawa    # Run only kanagawa scenarios

# Fail-fast (abort on first failure)
node tests/run_tests.js --bail

# CLI Help
node tests/run_tests.js --help
```

### Exit Codes:
- `0`: All executed tests passed cleanly.
- `1`: One or more tests failed or encountered errors.

---

## 4. 4-Tier Test Breakdown & Feature Mapping

### Tier 1: Feature Coverage (`tests/tier1_features.test.js`)
*Requirement: $\ge 5$ test cases per feature across all 10 features in `PROJECT.md`.*

| Feature ID | Feature Name | Target Component | Test Cases | Scope & Verification |
|---|---|---|---|---|
| **F1** | Plugin Manifest | `plugin.json` | 5 | Valid JSON, `agent-plugins.org` v1.0.0 schema, semver, category, author, suggestedPrompts $\ge 2$, logo path |
| **F2** | MCP Configuration | `mcp_config.json` | 5 | Valid JSON, `mcpServers` object, `antigravity-gif-studio` registration, `node` command, `${PLUGIN_ROOT}/mcp/index.js` arg |
| **F3** | Plugin Logo Asset | `assets/logo.svg` | 5 | Valid SVG XML, 512x512 viewBox/dimensions, `<defs>` gradients, neon shaders, geometric aperture artwork |
| **F4** | Plugin Documentation | `README.md` | 5 | File size $>1000$ B, Installation section, MCP tools specification, Generative UI widget documentation, zero-API key guarantee |
| **F5** | MCP Server Core & Stdio Transport | `mcp/index.js` | 5 | Stdio JSON-RPC 2.0 handshake (`initialize`, `notifications/initialized`), tools capability advertisement, `tools/list` returns 3 tools with JSON schemas |
| **F6** | Tool: `render_svg_to_gif` | `mcp/renderer.js` | 5 | Basic render, custom width/height, transparent background preservation (`dispose: 2`, 1-bit alpha), base64 output when outputPath omitted |
| **F7** | Tool: `generate_preview_widget` | `mcp/widget-template.js` | 5 | Valid HTML5 artifact, embedded SVG markup, inlined `gifenc` (zero external CDN dependencies), scrubber/speed/fps controls, disk saving |
| **F8** | Tool: `optimize_gif` | `mcp/optimizer.js` | 5 | Valid GIF89a output, byte size reduction, compression stats (`originalBytes`, `optimizedBytes`, `savingsPercent`), base64 input/output, frame count preservation |
| **F9** | Motion Design Skill | `skills/gif-studio/SKILL.md` | 5 | YAML frontmatter, Fundamental Harmonic Period Law ($T_i = T_{\text{master}} / k_i$), transform-origin anchoring, transparency instructions, 256-color palette |
| **F10** | Generative UI Preview Widget | Inline / Widget Generator | 5 | Complete container & branding, background switcher (checkerboard/dark/light), speed slider (0.25x–3x), FPS dropdown, instant client-side re-encoding button & progress feedback |

*Total Tier 1 Test Cases: 50 tests.*

---

### Tier 2: Boundary & Corner Cases (`tests/tier2_boundaries.test.js`)
*Requirement: $\ge 5$ test cases per boundary area across 7 areas.*

| Boundary Area | Target Vulnerability / Boundary | Test Cases | Scope & Verification |
|---|---|---|---|
| **Area 1: Dimensions & ViewBox** | Extreme aspect ratios & missing dimensions | 5 | Minimal 1x1 px, large resolution (4000x3000), ultra-wide (1200x50), ultra-tall (50x1200), missing width/height/viewBox fallbacks |
| **Area 2: SVG Syntax & Adversarial Inputs** | Parser crashes, malformed markup, XSS | 5 | Malformed unclosed XML tags, non-SVG root element (`<div>`), empty/whitespace string rejection, `<script>` / `onload` XSS neutralization, Unicode & special entity handling |
| **Area 3: Temporal & Framerate Boundaries** | Zero, negative, and extreme time values | 5 | Minimum framerate boundary (`fps = 1`), maximum framerate (`fps = 60`), invalid FPS clamping/error, zero/negative duration rejection, micro-duration (`0.1s`) |
| **Area 4: Palette & Quantization Boundaries** | Extreme palette counts & empty visual buffers | 5 | Minimum palette (`maxColors = 2`, monochrome), full palette (`maxColors = 256`), out-of-range palette clamping, 100% transparent empty SVG, quality parameter boundaries (1 vs 30) |
| **Area 5: JSON-RPC & Parameter Boundaries** | Invalid RPC frames & missing parameters | 5 | Empty arguments object `{}` validation error, missing `svg` parameter rejection, missing `inputGif` rejection, unknown tool rejection, recovery from malformed JSON-RPC on stdin |
| **Area 6: Optimization Edge Cases** | Atypical GIF structures & corrupt buffers | 5 | Static 1-frame GIF, 100% identical frame deduplication, already-reduced palette (16 colors), lossless (`lossy = 0`) vs aggressive lossy (`lossy = 80`), corrupt/truncated GIF rejection |
| **Area 7: File System & Output Boundaries** | Path traversal, missing directories, spaces | 5 | Non-existent input path error, automatic creation of nested output directories, paths with spaces and special symbols, absolute vs relative paths, omitted outputPath in-memory base64 |

*Total Tier 2 Test Cases: 35 tests.*

---

### Tier 3: Cross-Feature Combinations (`tests/tier3_combinations.test.js`)

| Scenario ID | Interaction Pipeline | Key Assertions |
|---|---|---|
| **T3-1** | `render_svg_to_gif` $\to$ `optimize_gif` | Full render-to-optimize pipeline creates valid GIF89a, preserves dimensions, and reduces file size. |
| **T3-2** | Widget Generator with Custom Parameters | Custom duration (4.5s), custom FPS (30), and custom title cleanly bound into interactive HTML artifact. |
| **T3-3** | Dual Animation Engines (CSS + SMIL) | SVG with simultaneous CSS `@keyframes` and SMIL `<animate>` renders without timeline conflicts. |
| **T3-4** | Transparency Preservation Pipeline | Transparent SVG passed through render and optimize preserves Graphic Control Extension alpha flag and index. |
| **T3-5** | High FPS + Custom Dimensions + Palette Reduction | 30 FPS render at 320x240 compressed to 64 colors maintains frame count $\approx 30$ and dimensions. |
| **T3-6** | Harmonic Multi-Frequency Synchronization | 3 elements oscillating at $3.0\text{s}$, $1.5\text{s}$, and $0.75\text{s}$ complete integer cycles with loop count 0. |
| **T3-7** | In-Memory Base64 Pipeline | Render to `gifBase64` and optimize via `inputBase64` executes without temporary file creation. |
| **T3-8** | Aggressive Lossy Compression Pipeline | Harmonic loader GIF compressed with `lossy: 35` achieves $\ge 10\%$ size savings while preserving motion. |

*Total Tier 3 Test Cases: 8 tests.*

---

### Tier 4: Real-World Application Scenarios (`tests/tier4_realworld.test.js`)

| Scenario ID | Workload | Key Verification |
|---|---|---|
| **T4-1** | `kanagawa_tablo.svg` Looping Render & Motion Check | 600x400 Great Wave SVG rendered to GIF89a (~53 frames @ 15fps, 3.5s duration). **Verifies non-zero frame motion across time steps** (fixing the legacy defect where frames were static). |
| **T4-2** | Multi-Element Harmonic Loader Workload | 3 bouncing dots with harmonic delay offsets render into smooth oscillating GIF. |
| **T4-3** | Modulo Conveyor Wave Workload | Infinite rolling wave animation renders with seamless loop boundary. |
| **T4-4** | Pulsating Glowing Cyberpunk Badge Workload | Scale and opacity keyframe oscillations render cleanly with centered transform origin. |
| **T4-5** | Generative UI Widget on Kanagawa Great Wave | Generates self-contained HTML embedding complete Kanagawa SVG, inlined `gifenc`, timeline scrubber, speed presets, and zero external CDN scripts. |
| **T4-6** | Real-World Optimization Benchmark | Kanagawa Great Wave render optimized with palette quantization achieves measurable byte reduction while maintaining full frame fidelity. |

*Total Tier 4 Test Cases: 6 tests.*

---

## 5. Test Fixtures Catalog

| Fixture File | Format | Visual / Animation Characteristics | Primary Test Purpose |
|---|---|---|---|
| `kanagawa_tablo.svg` | SVG (6.1 KB) | 600x400 ornate wood frame, gold inlay, Great Wave with 6 CSS `@keyframes` | Real-world motion verification (T4-1, T4-5, T4-6) |
| `minimal_rect.svg` | SVG (165 B) | 100x100 static rounded indigo rectangle | Baseline rendering, dimension overrides, speed benchmarks |
| `pulse_circle.svg` | SVG (644 B) | 200x200 cyan circle with 2s CSS pulse keyframes (scale 0.8–1.2) | CSS Web Animations time-stepping (F6, T3-1, T4-4) |
| `smil_rect.svg` | SVG (404 B) | 200x200 purple rect with SMIL opacity and rotation `<animateTransform>` | SMIL DOM time-stepping (F6, T2-3) |
| `dual_anim.svg` | SVG (711 B) | 300x200 combining CSS pulsing circle and SMIL fading rect | Simultaneous multi-engine evaluation (T3-3) |
| `harmonic_loader.svg` | SVG (820 B) | 300x120 3 dots with delays `0s`, `-0.5s`, `-1.0s` obeying harmonic law | Phase-staggered loop closure (T3-6, T4-2) |
| `conveyor_wave.svg` | SVG (631 B) | 400x150 ocean wave rolling modulo translateX conveyor | Marquee translation & clip-path rendering (T3-2, T4-3) |
| `transparent_spinner.svg` | SVG (798 B) | 120x120 amber spinner with no background rectangle | 1-bit alpha transparency verification (F6-4, T3-4) |
| `invalid_malformed.svg` | SVG (198 B) | Broken XML with unclosed `<rect>` and missing tags | Parser resilience and error recovery (T2-2.1) |
| `no_dimensions.svg` | SVG (99 B) | SVG missing width, height, and viewBox | Fallback dimension detection (T2-1.5) |
| `wide_banner.svg` | SVG (476 B) | 1200x200 sweeping laser beam | Ultra-wide aspect ratio handling (T2-1.3) |
| `tall_banner.svg` | SVG (489 B) | 200x800 rising/dropping elevator block | Ultra-tall aspect ratio handling (T2-1.4) |
| `xss_payload.svg` | SVG (217 B) | SVG containing `<script>window.__xss=true</script>` & `onload` | Adversarial injection safety (T2-2.4) |
| `sample_animated.gif` | GIF (504 B) | Synthetic 80x80 3-frame animated GIF | Optimizer verification (F8, T2-6.3) |
| `sample_transparent.gif` | GIF (453 B) | Synthetic 80x80 2-frame transparent animated GIF | Transparent optimization verification (T2-6) |
| `sample_static.gif` | GIF (143 B) | Synthetic 50x50 1-frame static GIF | 1-frame boundary optimization (T2-6.1) |

---

## 6. Verification & Quality Assurance Results

- **Syntactic Validity**: Verified via `node --check` across all test suites, harness, and runner files.
- **Milestone M1 Coverage**: Verified 100% pass rate (20/20 tests passing) across `plugin.json` (F1), `mcp_config.json` (F2), `assets/logo.svg` (F3), and `README.md` (F4).
- **Execution Speed**: 20 M1 tests execute in **< 10 milliseconds**.
- **Pending Milestones**: Tests for M2 (`mcp/renderer.js`, `mcp/optimizer.js`, `mcp/index.js`) and M3 (`skills/gif-studio/SKILL.md`, `mcp/widget-template.js`) report clean, descriptive assertion failures indicating exact required components.
