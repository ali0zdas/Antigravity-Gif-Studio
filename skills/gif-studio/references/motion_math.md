# Mathematical Foundations of Seamless Motion

## 1. The Fundamental Harmonic Period Law
Before writing SVG markup or CSS `@keyframes`, declare a single **Master Loop Duration** ($T_{\text{master}}$). Common values:
- `2.0s`: Spinners, pulsing badges, rapid micro-interactions.
- `3.0s`: Character breathing, organic idle loops.
- `4.0s`: Ocean waves, complex mechanical gears, planetary orbits.

### Sub-Multiple Period Formula
Every moving child element $i$ must complete an exact integer number of cycles $k_i \in \{1, 2, 3, \dots\}$ within $T_{\text{master}}$:

$$T_i = \frac{T_{\text{master}}}{k_i}$$

| $T_{\text{master}}$ | $k=1$ (1 cycle) | $k=2$ (2 cycles) | $k=3$ (3 cycles) | $k=4$ (4 cycles) |
|---|---|---|---|---|
| **2.0s** | 2.0s | 1.0s | 0.667s | 0.5s |
| **3.0s** | 3.0s | 1.5s | 1.0s | 0.75s |
| **4.0s** | 4.0s | 2.0s | 1.333s | 1.0s |

## 2. Why `animation-direction: alternate` Is Strictly Forbidden
Using `animation-direction: alternate` makes the browser execute:
- Forward trip ($0\% \to 100\%$): takes $T$ seconds.
- Reverse trip ($100\% \to 0\%$): takes another $T$ seconds.
Total periodic cycle is $2T$ seconds! If a master GIF is sampled from $t=0$ to $t=T$, the element is frozen at its extreme $100\%$ displacement and instantly snaps to $0\%$ when the GIF repeats, producing a jarring seam jump.

### The Pure Ping-Pong Alternative (Mandatory)
Always encode both strokes explicitly within a single forward cycle:
```css
@keyframes pingPongSmooth {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-24px); }
  100% { transform: translateY(0px); }
}

.element {
  animation: pingPongSmooth 4s cubic-bezier(0.42, 0, 0.58, 1) infinite;
}
```

## 3. Negative Delay Phase Offsets
When staggering $N$ identical elements (particles, rings, bars):
$$\Delta t_j = -\left( j \cdot \frac{T_i}{N} \right), \quad j \in \{0, 1, \dots, N-1\}$$
Using negative delay pre-advances the clock so elements are already in smooth motion at $t=0$.
