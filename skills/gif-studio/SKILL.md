---
name: gif-studio
description: Generates mathematically seamless looping animated SVGs, motion graphics, and animated GIFs using harmonic period laws, anchor discipline, 1-bit transparency handling, and interactive Generative UI preview widgets with zero external API key requirements.
---

# Antigravity GIF Studio — Motion Design & Animation Skill

This skill guides Large Language Models (LLMs) and autonomous coding agents in authoring mathematically perfect, seamless looping vector animations (SVG) and exporting high-performance animated GIFs. It establishes the governing physical and mathematical loop laws, coordinate anchor disciplines, color quantization budgeting, and Generative UI preview widget protocols.

---

## 1. Core Mental Models & Anti-Flaw Guidelines

When LLMs write animated SVGs, five catastrophic flaws routinely occur if not strictly constrained:

1. **Harmonic Period Mismatch**: Assigning arbitrary animation durations to independent elements (e.g., element A runs at 3.5s, element B at 2.8s, element C at 2.0s). The least common multiple (LCM) of these periods is 182 seconds! When rendered as a 3-second or 4-second GIF, elements snap abruptly back to initial states, destroying the illusion of motion.
2. **Loop Boundary Discontinuity (Velocity Snap)**: When 0% and 100% states match in position but have non-zero velocities in opposite directions (e.g., using `linear` easing on an oscillating spring), the element suffers an unnatural instantaneous velocity reversal ($v \to -v$).
3. **Broken Coordinate Anchors (Erratic SVG Wobble)**: In SVG, CSS `transform: rotate(...)` defaults to the origin `(0, 0)` of the entire viewBox coordinate space rather than the element's centroid, causing elements to swing wildly across the canvas.
4. **Hardcoded Opaque Backgrounds**: Unsolicited `<rect width="100%" height="100%" fill="#ffffff"/>` layers prevent transparent stickers and destroy alpha channel flexibility.
5. **Palette Color Bloat in GIFs**: Heavy radial gradients with thousands of micro-shades cause severe banding, noise, and ballooning file sizes under GIF's 256-color palette limit.

---

## 2. The Fundamental Harmonic Period Law

Before writing a single line of SVG markup or CSS `@keyframes`, you **MUST** declare a single **Master Loop Duration** ($T_{\text{master}}$). Standard master durations are:
- **2.0s** (Fast snappy loops, spinners, pulsating icons)
- **3.0s** (Rhythmic motion, breathing cycles, character idles)
- **4.0s** (Complex scenes, planetary orbits, ocean waves)
- **6.0s** (Rich multi-tiered ambient landscapes)

### The Law of Sub-Multiples
Every animated sub-element in the entire SVG must complete an exact integer number of cycles within $T_{\text{master}}$. Its individual period $T_i$ must be an exact integer divisor:

$$T_i = \frac{T_{\text{master}}}{k_i}, \quad k_i \in \{1, 2, 3, 4, \dots\}$$

Where:
- $T_{\text{master}}$ is the master loop duration.
- $k_i$ is the number of complete cycles executed per master loop.
- $T_i$ is the sub-motion period assigned to the element's `animation-duration`.

#### Permitted Sub-Periods for Common Master Loops

| Master Duration $T_{\text{master}}$ | $k=1$ (1 cycle) | $k=2$ (2 cycles) | $k=3$ (3 cycles) | $k=4$ (4 cycles) | $k=6$ (6 cycles) |
|---|---|---|---|---|---|
| **2.0s** | 2.000s | 1.000s | 0.667s | 0.500s | 0.333s |
| **3.0s** | 3.000s | 1.500s | 1.000s | 0.750s | 0.500s |
| **4.0s** | 4.000s | 2.000s | 1.333s | 1.000s | 0.667s |
| **6.0s** | 6.000s | 3.000s | 2.000s | 1.500s | 1.000s |

*Any element whose duration is not an exact integer sub-multiple will jump at the master loop boundary.*

---

## 3. Negative Animation Delay Injection Rule

When staggering elements (such as particles, waves, or equalizer bars) across time:
- **NEVER use positive `animation-delay`** (e.g., `animation-delay: 0.5s`). In GIF rasterization and loop resets, positive delays freeze the element at $t=0$ in its initial un-animated state, producing dead static frames before motion begins.
- **ALWAYS use negative `animation-delay`** (e.g., `animation-delay: -0.5s`). Negative delay pre-advances the animation into its cycle immediately at $t=0$, ensuring that all elements are already in active, continuous harmonic motion from the very first frame.

### Phase-Staggered Array Formula
For an array of $N$ elements running a sub-motion of period $T_i$, calculate each element $j$'s negative animation-delay as:

$$\Delta t_j = -\left( j \cdot \frac{T_i}{N} \right), \quad j \in \{0, 1, 2, \dots, N-1\}$$

```css
/* Example: 4 ripple rings with period Ti = 2s */
.ring-0 { animation: ripple 2s linear infinite; animation-delay: 0.0s; }
.ring-1 { animation: ripple 2s linear infinite; animation-delay: -0.5s; }
.ring-2 { animation: ripple 2s linear infinite; animation-delay: -1.0s; }
.ring-3 { animation: ripple 2s linear infinite; animation-delay: -1.5s; }
```

---

## 4. The Four Seamless Motion Primitives

All vector motion can be decomposed into four mathematically closed primitives:

### Primitive A: Symmetrical Ping-Pong Cosine Keyframing
Used for oscillating, floating, breathing, and bobbing motions.
- **Equation**: $y(t) = A \cos\left(\frac{2\pi t}{T}\right)$
- **Keyframe Pattern**:
  - $0\%$: Initial position ($0$)
  - $50\%$: Extreme displacement ($\Delta$)
  - $100\%$: Initial position ($0$)
- **Timing Function**: **MUST** use `ease-in-out` (or cubic-bezier approximation `cubic-bezier(0.42, 0, 0.58, 1)`). At $0\%$ and $100\%$, instantaneous velocity $v = 0$, guaranteeing zero jerk across the boundary.

```css
@keyframes pingPongFloat {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-30px); }
  100% { transform: translateY(0px); }
}

.floating-gem {
  animation: pingPongFloat 3s ease-in-out infinite;
}
```

### Primitive B: Modulo Conveyor Translation
Used for infinite scrolling clouds, continuous conveyor belts, undulating wave trains, and road textures.
- **Equation**: $x(t) = (x_0 - v \cdot t) \pmod{W_{\text{tile}}}$
- **Keyframe Pattern**:
  - Duplicate geometry: The group must contain two identical repeating segments placed back-to-back with stride $W_{\text{tile}}$.
  - Translate the container by exactly $-W_{\text{tile}}$ from $0\%$ to $100\%$.
- **Timing Function**: **MUST** use `linear`. Any non-linear curve causes a visible speed wobble.

```xml
<g class="conveyor-track">
  <!-- Tile 1 at x=0 -->
  <use href="#wave-segment" x="0" />
  <!-- Tile 2 at x=W (exact seamless duplicate) -->
  <use href="#wave-segment" x="400" />
</g>
```
```css
@keyframes conveyorTranslate {
  0%   { transform: translateX(0px); }
  100% { transform: translateX(-400px); }
}

.conveyor-track {
  animation: conveyorTranslate 4s linear infinite;
}
```

### Primitive C: Full Cyclic Rotation
Used for spinning wheels, planetary gears, radar sweeps, and cyclic loading rings.
- **Equation**: $\theta(t) = \theta_0 + \omega t$
- **Keyframe Pattern**:
  - $0\%$: `rotate(0deg)`
  - $100\%$: `rotate(360deg)` (or `-360deg` for counter-clockwise).
- **Timing Function**: **MUST** use `linear` for constant angular velocity, preserving angular momentum across the loop seam.

```css
@keyframes cyclicSpin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.gear-cog {
  transform-box: fill-box;
  transform-origin: center;
  animation: cyclicSpin 2s linear infinite;
}
```

### Primitive D: Continuous Orbital & Radial Waves
Used for expanding ripples, sonar pulses, and particles orbiting a gravitational center.
- **Keyframe Pattern**: Scale expanding while opacity fades to zero before the boundary:
  - $0\%$: Scale minimal ($0.1$), Opacity high ($0.9$)
  - $80\%$: Opacity tapering ($0.3$)
  - $100\%$: Scale maximum ($2.0$), Opacity zero ($0.0$)
- By setting opacity to 0 at 100%, when the element recycles to 0%, the jump is completely invisible!

```css
@keyframes radialPulse {
  0% {
    transform: scale(0.2);
    opacity: 0.9;
  }
  75% {
    opacity: 0.5;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}
```

---

## 5. Anchor & Pivot Discipline (Transform-Origin in SVG)

In SVG rendering engines, the default CSS `transform-origin` is `(0, 0)`—the top-left corner of the SVG viewport! Applying `rotate()` or `scale()` without an explicit anchor causes elements to swing wildly around the origin of the canvas.

To anchor transforms correctly, choose one of these two disciplines:

### Approach A: Absolute ViewBox Coordinates (Recommended for Fixed Artworks)
Determine the exact centroid $(cx, cy)$ of the SVG group or path within the `viewBox` coordinates, and supply explicit pixel units:
```css
.portal-ring {
  transform-origin: 256px 256px;
  animation: cyclicSpin 3s linear infinite;
}
```

### Approach B: CSS Transform-Box (Modern & Responsive)
Instruct the browser to calculate the transform origin relative to the element's own bounding box rather than the viewBox:
```css
.animated-icon {
  transform-box: fill-box;
  transform-origin: center;
  animation: pingPongFloat 2s ease-in-out infinite;
}
```

### Hierarchical Grouping Alternative
Nest the element inside a translated group `<g transform="translate(cx, cy)">` and animate an inner group `<g class="spinner" transform="translate(0, 0)">` with origin `0 0`.

---

## 6. CSS `@keyframes` vs SMIL Decision Matrix

| Capability / Trait | CSS `@keyframes` inside `<style>` | SMIL (`<animate>`, `<animateTransform>`) |
|---|---|---|
| **Antigravity Studio Status** | **Primary & Recommended Standard** | Secondary / Fallback |
| **Web Animations API** | Full control via `element.getAnimations()` | DOM-level only (`svg.setCurrentTime()`) |
| **Virtual Clock Frame Stepping** | Instant deterministic freezing via `animation-delay` | Requires browser SMIL engine time-stepping |
| **Hardware Acceleration** | GPU-accelerated composition | CPU-bound path interpolation |
| **Styling Separation** | Clean separation in `<style>` tag | Interleaved inside element tags |
| **Toolchain Compatibility** | Supported by Chromium headless renderer | Supported by Chromium, partial in Node SVG parsers |

**Rule**: Always author animations using CSS `@keyframes` inside an embedded `<style>` element enclosed within `<defs>` or directly under `<svg>`. Reserve SMIL exclusively for path morphing (`d` attribute morphing) when CSS path interpolation is unsupported.

---

## 7. Transparency & 256-Color Palette Optimization

GIF is an 8-bit indexed image format with strict limitations. Follow these rules to ensure crisp, lightweight exports:

### 1-Bit Alpha Transparency & Anti-Aliasing Halos
- GIF 89a does not support 8-bit alpha channels; a pixel is either **100% opaque** or **100% transparent**.
- Semi-transparent anti-aliased edge pixels will be thresholded to either fully solid or fully transparent by color quantizers.
- If anti-aliased pixels blend against dark or light borders, they create an ugly "halo" artifact when displayed over contrasting backgrounds.
- **Matte Color Selection**:
  - If exporting for dark mode interfaces, design outer edges against a dark matte color (`#0f1117`).
  - If exporting for light mode, design against a crisp light matte (`#ffffff`).
  - For clean transparent stickers, use crisp vector paths and bold outlines rather than soft diffuse blur filters (`feGaussianBlur`).

### 256-Color Palette Quantization Budget
- A standard GIF supports a maximum of 256 colors per frame (including the transparent index).
- Continuous multi-stop photographic gradients or multiple overlapping transparent blurs trigger severe dithering noise and banding.
- **Best Practices**:
  1. Use flat cel-shaded palettes with 16 to 64 distinct colors.
  2. Limit linear gradients to 2 stops.
  3. Avoid noisy dithering textures; flat fills compress down to tiny GIF file sizes (often under 50KB!).

---

## 8. Responsive Scaling & Root Container Rules

1. **Always specify `viewBox`**:
   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
   ```
2. **Never hardcode fixed pixel dimensions on the root container**:
   Do NOT set `width="400px" height="400px"` without allowing fluid percentage scaling. Using `width="100%" height="100%"` with an explicit `viewBox` ensures the graphic dynamically scales inside chat messages, preview widgets, and high-DPI displays.
3. **Safety Bounding Margin**:
   Leave a 5%–10% margin between animated geometries and the `viewBox` edges so rotating corners or expanding scale transforms do not get clipped.

---

## 9. Generative UI Preview Widget Integration Protocol

When the user asks to preview, tweak, or interact with an animated SVG or GIF in Antigravity chat, provide an interactive Generative UI preview widget.

### Protocol for LLMs in Chat
You can generate the preview widget in two ways:
1. **Via MCP Tool**: Call `generate_preview_widget` with the SVG markup:
   ```json
   {
     "svg": "<svg ...>...</svg>",
     "duration": 3.0,
     "fps": 24,
     "title": "Neon Portal Preview"
   }
   ```
2. **Direct Generative UI Artifact**: Emit the self-contained single-file HTML preview artifact directly into the chat response using Antigravity artifact tags.

### Feature Specification of the Interactive Preview Widget
The Generative UI widget is a single, zero-dependency HTML file that runs 100% client-side with zero external CDN dependencies:
- **Live Playback Controls**: Play / Pause toggle with Spacebar keyboard shortcut.
- **Interactive Timeline Scrubber**: Frame-accurate slider scrubbing from $0.00\text{s}$ to $T_{\text{master}}\text{s}$.
- **Speed Multiplier**: $0.25\times$ to $3.0\times$ speed adjustment with instant preset pills ($0.25\times, 0.5\times, 1.0\times, 1.5\times, 2.0\times, 3.0\times$).
- **Background Mode Switching**:
  - `Checkerboard`: High-contrast checkerboard grid for inspecting transparency and 1-bit alpha edges.
  - `Dark`: Deep obsidian canvas (`#0b0c10`) for testing dark-mode luminescence.
  - `Light`: Crisp white canvas (`#ffffff`) for testing light-mode contrast.
- **FPS Selector**: Quick dropdown switching between $10, 12, 15, 24, 30, 60$ FPS.
- **Client-Side GIF Re-Encoding Engine**: Inlines `gifenc` directly in the document, capturing every frame via Virtual Clock CSS injection and encoding an animated GIF directly in the browser—with real-time percentage progress bar and direct download.
- **Zero API Keys & Offline Operation**: Fully functional offline with zero cloud requests.

---

## 10. Complete Motion Design Example: The Quantum Orbital Portal

Here is a reference implementation embodying all principles: harmonic sub-periods, center anchoring with `transform-box: fill-box`, negative animation delays, and flat-shaded palette discipline.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <style>
      /* Master Loop: T_master = 4.0s */
      :root {
        --t-master: 4s;
      }

      /* Primitive C: Full Cyclic Rotation (k=1, period = 4s) */
      @keyframes outerSpin {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Primitive C: Counter Rotation (k=2, period = 2s) */
      @keyframes innerSpin {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(-360deg); }
      }

      /* Primitive A: Symmetrical Cosine Ping-Pong (k=2, period = 2s) */
      @keyframes coreFloat {
        0%   { transform: translateY(0px) scale(1); }
        50%  { transform: translateY(-12px) scale(1.08); }
        100% { transform: translateY(0px) scale(1); }
      }

      /* Primitive D: Phase-Staggered Radial Wave (k=1, period = 4s) */
      @keyframes pulseRing {
        0%   { transform: scale(0.3); opacity: 0.9; }
        70%  { opacity: 0.4; }
        100% { transform: scale(1.6); opacity: 0; }
      }

      /* Anchor Discipline: Centered via fill-box and explicit coordinates */
      .center-anchor {
        transform-box: fill-box;
        transform-origin: center;
      }

      .outer-orbit {
        transform-origin: 200px 200px;
        animation: outerSpin 4s linear infinite;
      }

      .inner-orbit {
        transform-origin: 200px 200px;
        animation: innerSpin 2s linear infinite;
      }

      .floating-core {
        transform-origin: 200px 200px;
        animation: coreFloat 2s ease-in-out infinite;
      }

      /* Negative Animation Delays for deterministic startup */
      .pulse-1 {
        transform-origin: 200px 200px;
        animation: pulseRing 4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
        animation-delay: 0s;
      }

      .pulse-2 {
        transform-origin: 200px 200px;
        animation: pulseRing 4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
        animation-delay: -2s; /* 50% phase offset */
      }
    </style>

    <linearGradient id="portalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#d946ef" />
    </linearGradient>
  </defs>

  <!-- Ambient Pulsing Energy Waves -->
  <circle class="pulse-1" cx="200" cy="200" r="90" fill="none" stroke="#06b6d4" stroke-width="2" />
  <circle class="pulse-2" cx="200" cy="200" r="90" fill="none" stroke="#6366f1" stroke-width="2" />

  <!-- Outer Orbit Ring (Period = 4.0s) -->
  <g class="outer-orbit">
    <circle cx="200" cy="200" r="120" fill="none" stroke="#334155" stroke-width="3" stroke-dasharray="16 12" />
    <circle cx="200" cy="80" r="10" fill="#06b6d4" />
    <circle cx="200" cy="320" r="10" fill="#d946ef" />
  </g>

  <!-- Inner Orbit Ring (Period = 2.0s) -->
  <g class="inner-orbit">
    <polygon points="200,120 270,240 130,240" fill="none" stroke="url(#portalGrad)" stroke-width="4" stroke-linejoin="round" />
  </g>

  <!-- Floating Levitating Quantum Core (Period = 2.0s, Cosine Ping-Pong) -->
  <g class="floating-core">
    <circle cx="200" cy="200" r="28" fill="#ffffff" />
    <circle cx="200" cy="200" r="20" fill="#6366f1" />
    <polygon points="200,186 210,200 200,214 190,200" fill="#ffffff" />
  </g>
</svg>
```

---

## 11. Autonomous Agent Execution Checklist

Before presenting or exporting any animated SVG or GIF, check every item:
- [ ] Is $T_{\text{master}}$ clearly identified?
- [ ] Are all sub-durations exact integer divisors: $T_i = T_{\text{master}} / k_i$?
- [ ] Are phase offsets applied via **negative** `animation-delay`?
- [ ] Are ping-pong oscillations keyed `0% -> 50% -> 100%` with `ease-in-out`?
- [ ] Are continuous rotations keyed `0deg -> 360deg` with `linear`?
- [ ] Are conveyer translations keyed over exact tile width $W_{\text{tile}}$ with `linear`?
- [ ] Is every `transform-origin` explicitly anchored with pixel viewBox coordinates or `transform-box: fill-box; transform-origin: center`?
- [ ] Does the root `<svg>` use `viewBox` and responsive scaling instead of hardcoded rigid container dimensions?
- [ ] Is unwanted opaque background rectangles omitted to preserve alpha transparency?
- [ ] Is color palette disciplined for clean 256-color GIF quantization?
