# Three.js — ASX Desktop OS

**Parent doc:** [`../docs/THREEJS_WEBSITE.md`](../docs/THREEJS_WEBSITE.md)  
**Module:** `js/three-bg.js`  
**CDN:** three.js **r128** `three.min.js` (cdnjs) → global `THREE`

## What it does

Renders a full-viewport **universe purple** WebGL background under the desktop chrome:

- Void clear + fog (`#0a0809`)
- Icosahedron core + wireframe shell
- Three torus rings
- Starfield (points)
- Purple + gold point lights
- Continuous rotation animation; resize-safe

## Integration

1. `index.html` — `<canvas id="three-bg">` + script tag for three.min.js  
2. `main.js` — after boot splash: `initThreeBg("three-bg")`  
3. CSS — `#three-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; }`

## Design sources

Claude HTML extracts (not shipped as entry):

- `brainstorm/claude_html_extracts/extract_00.html` — gate / core / rings  
- `brainstorm/claude_html_extracts/extract_03.html` — entrance / boot  

## Not this module

- **Construct recipe** 3D scenes → `src/lib/construct/recipes/threejsrecipe.js` (Containers product)  
- Window manager / apps → DOM, not Three.js  

## Security / ops

- Soft dependency: if `THREE` missing, `initThreeBg` returns `null` (desktop still usable without WebGL).  
- Prefer pin SRI when locking production CDN version.  

## Mobile / responsiveness (2026-08-10)

Research: `agents/research/threejs/mobile_responsiveness_20260810.md`

| Control | Desktop | Mobile |
|---------|---------|--------|
| `setPixelRatio` cap | ≤ 2 | ≤ 1.25 |
| `antialias` | on | off |
| Stars | ~1400 | ~500 |
| Rings / segments | 3 / 100 | 2 / 48 |
| Resize | window | + visualViewport + orientationchange (debounced) |
| Buffer size | `setSize(w,h,false)` + CSS 100% | same |
| Pause | `visibilitychange` | same |

Shell CSS: icon **grid** under 768px, full-bleed windows, safe-area insets, 44px touch targets.  
WM: pointer events; default **maximized** on mobile; single-tap open icons.

## Preview

```bash
cd website && python3 -m http.server 8765 --bind 127.0.0.1
# http://127.0.0.1:8765/desktop-os/
```
