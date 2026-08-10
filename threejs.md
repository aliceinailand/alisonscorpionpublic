# Three.js — ASX Desktop OS

**Parent doc:** [`../docs/THREEJS_WEBSITE.md`](../docs/THREEJS_WEBSITE.md)  
**Module:** `js/three-bg.js`  
**CDN:** three.js **r128** `three.min.js` (cdnjs) → global `THREE`

## What it does

Renders a full-viewport **ASX satellite view** of Earth under the desktop chrome:

- Realistic Earth (textured) + atmosphere
- **Moon** on orbit
- **Sun** in the distance + lens **glare** when in view (~few seconds)
- **Vortex rings** + **icosahedron grid** around Earth (ASX protector frame — kept)
- Camera = satellite; auto orbital drift
- **Drag empty desktop** to look around; release → auto rotation resumes
- Starfield; resize-safe; context-lost → ambient fallback

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
Smallest width: `agents/research/threejs/small_width_ambient_fallback_20260810.md`

| Control | Desktop | Mobile | Tiny (≤420px) |
|---------|---------|--------|----------------|
| Path | Three.js | Three light | **Ambient D3/SVG** (default) |
| `setPixelRatio` cap | ≤ 2 | ≤ 1.25 | ambient N/A · Three force ≤1 |
| Stars | ~1400 | ~400 | ambient ~40–120 SVG |
| Resize | window | visualViewport | viewBox slice |
| Fallback | — | contextlost → ambient | ambient first |

| Query | Force |
|-------|--------|
| `?bg=ambient` | Always SVG/D3 |
| `?bg=three` | Force Three |

Shell CSS: icon **grid** under 768px, full-bleed windows, safe-area, **100svh**.  
Modules: `three-bg.js`, `ambient-d3-bg.js`, router in `main.js`.

## LeoAI / Brave hybrid OS illusion (2026-08-10)

Source: `Documents/AI_DATA/LeoAI/linux-os-three-js-render.txt`  
Review: `agents/research/threejs/leoai_linux_os_threejs_review_20260810.md`

| Leo recommendation | ASX choice |
|--------------------|------------|
| Not a real OS — browser illusion | Guest desktop session |
| Three for 3D “room” | Universe bg only |
| HTML for text/inputs/windows | DOM WM + apps (not CSS3D windows) |
| Virtual FS + command parser | `fs.js` + terminal |
| Pointer events + touch-action | WM pointers; canvas `touch-action: none` |
| Persist VFS in IndexedDB | Optional future (guest notes partial) |

**Do not** migrate windows into pure Three meshes (raycast drag / focus hell on mobile).

## Preview

```bash
cd website && python3 -m http.server 8765 --bind 127.0.0.1
# http://127.0.0.1:8765/desktop-os/
```
