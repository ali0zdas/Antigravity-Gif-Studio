# Canonical Archetypes & Geometric Skeletons

When asked to depict famous artworks or recognized archetypes, models must obey the **Skeleton Invariance Principle**:
> *Style alters texture, color, line quality, and ornamentation — but never the fundamental anatomical mass or silhouette.*

---

## 1. The Great Wave off Kanagawa (Hokusai)

### Required Masses & Proportions
1. **The Barrel Spiral (Mass 1 - Left & Top):**
   - Must occupy $\ge 60\%$ of the canvas width and span from the bottom-left corner arching up to $y \le 25\%$ before curling down.
   - The crest MUST curl downward and rightward at an inward angle ($35^\circ - 50^\circ$), forming the iconic "barrel wave" hollow.
   - The base of the wave must be broad and thick ($\ge 250\text{px}$ on a $600\text{px}$ canvas). Never draw the wave as a thin stalk, column, or neck.
2. **Foam Claws (Talons):**
   - Claws must jut forward and downward toward Mount Fuji like aggressive talons. Never draw rounded blobs, beads, or dorsal fins on the ridge.
3. **The Horizon & Focal Anchor (Mass 2 - Center/Right):**
   - Mount Fuji must sit framed inside the hollow of the breaking wave, positioned between $x = 45\%$ and $x = 65\%$.
   - A traditional low-slung wooden cargo skiff (押送船 *oshiokuri-bune*) must ride the trough of the swell.

---

## 2. Cosmic / Cyberpunk Portals

### Required Geometry
- Outer rotating ring with counter-rotating inner geometric polygon.
- Symmetrical center of rotation: anchor strictly with `transform-box: fill-box; transform-origin: center` or explicit $(cx, cy)$.
- Radial pulsing waves expanding from scale $0.2 \to 1.8$ with opacity fading to $0$ at $100\%$ keyframe.
