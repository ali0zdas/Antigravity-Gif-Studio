---
name: gif-studio
description: Generates mathematically seamless looping animated SVGs and high-performance GIFs using harmonic period laws, anchor discipline, skeleton invariance, and interactive Generative UI preview widgets with zero external API keys.
---

# Antigravity GIF Studio — Motion Design & Animation Skill

This skill guides coding agents in authoring mathematically seamless vector animations (SVG) and exporting production-ready looping GIFs using the local `antigravity-gif-studio` MCP tools.

---

## 1. Golden Rules of Seamless Motion

### Rule 1: Declare a Single Master Loop Duration ($T_{\text{master}}$)
Always choose a master duration ($2.0\text{s}$, $3.0\text{s}$, or $4.0\text{s}$). Every animated sub-element must have a period $T_i = T_{\text{master}} / k_i$, where $k_i \in \{1, 2, 3, \dots\}$.

### Rule 2: STRICT BAN ON `animation-direction: alternate`
**NEVER use `animation-direction: alternate` or `alternate-reverse`.**
`alternate` doubles the real loop period to $2T$. When sampled across $T$, the element is frozen at its extreme and snaps violently upon loop repeat.
*Always use explicit ping-pong keyframing:*
```css
@keyframes pingPong {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-20px); }
  100% { transform: translateY(0px); }
}
.bobbing { animation: pingPong 3s ease-in-out infinite; }
```

### Rule 3: Skeleton Invariance (Style vs. Anatomy)
When applying an art style (e.g., Art Nouveau, Cyberpunk, Bauhaus, Ukiyo-e) to a subject:
- **The anatomical skeleton and mass proportions NEVER change.**
- Only surface texture, line strokes, palette, and ornaments adapt to the style.
- *For iconic motifs (e.g. The Great Wave), refer to `references/canonicals.md`.*

### Rule 4: Negative Delay Injection
When staggering elements, **always use negative delay** (`animation-delay: -0.5s`, never positive). Negative delay pre-advances the timeline so all elements are in active motion from frame 0.

### Rule 5: Anchor Discipline (Transform Origin)
SVG `transform: rotate(...)` defaults to `(0, 0)` of the canvas. Always declare:
```css
transform-box: fill-box;
transform-origin: center;
```
Or provide explicit pixel coordinates `transform-origin: 200px 150px;`.

### Rule 6: Color Fidelity & Palette Discipline
- GIF supports 256 colors per frame. Flat cel-shading compresses to tiny files (<100KB).
- For transparent stickers, avoid soft blur filters (`feGaussianBlur`); use clean vector silhouettes.

---

## 2. Standard Workflow for Coding Agents

When the user asks to generate, animate, or preview a GIF / SVG:

1. **Author the SVG:** Write the complete SVG markup obeying the Golden Rules above.
2. **Render the GIF via MCP:**
   Call `render_svg_to_gif` with the SVG markup and an `outputPath` (e.g., `output.gif` in the workspace). Set `"transparent": true` for stickers/icons, or `"transparent": false` for full scenes using richer `rgb565` color quantization.
   ```json
   {
     "svg": "<svg ...>...</svg>",
     "outputPath": "my_animation.gif",
     "fps": 20,
     "duration": 4.0,
     "transparent": false
   }
   ```
3. **Open or Update the Interactive GIF Studio MCP App:**
   Call `open_gif_studio` (opens/updates the live side pane `aux_pane` or `generate_preview_widget` for an inline card) with the SVG and rendered GIF details:
   ```json
   {
     "svg": "<svg ...>...</svg>",
     "gifPath": "my_animation.gif",
     "title": "Animation Title",
     "fps": 20,
     "duration": 4.0,
     "transparent": false
   }
   ```
   The MCP App renders natively in Antigravity (no temporary HTML files or `<agent-embed>` tags needed). Calling `open_gif_studio` again with updated SVG markup refreshes the open side pane in place.
4. **Legacy Fallback (Non-MCP-App Hosts):**
   If running on a host without MCP App UI support, pass `"outputPath": "<artifactDir>/preview.html"` to `generate_preview_widget` to write a standalone HTML file.

---

## 3. Reference Guides

For deep formulas and motif guidelines, consult:
- `references/motion_math.md`: Harmonic frequencies, conveyor equations, rotational momentum.
- `references/canonicals.md`: Wave geometry, character idle cycles, portal physics.
