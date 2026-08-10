# Earth-view stars & constellations (ASX Three.js background)

**Date:** 2026-08-10  
**Module:** `website/desktop-os/js/three-bg.js` (`buildCelestialStarfield`)  
**Goal:** Dense **background** stars that mirror the celestial sphere as seen from Earth / LEO, with **universe purple** void — without pulling attention off Earth + Moon.

## Physics / geometry

| Fact | Implication for ASX |
|------|---------------------|
| Stars are effectively at infinity vs LEO altitude | Same sky patterns from surface and satellite view (parallax negligible for naked-eye stars). |
| Positions use **right ascension (RA)** + **declination (Dec)** on the celestial sphere | Project RA/Dec → cartesian on a large sphere (~900 units) around the scene origin. |
| Cube-random stars clump at corners | **Uniform sphere sampling** for far dust. |
| Real Sun angular size ~0.53° | Unchanged (art-directed photosphere); stars stay dim points. |

## Layers (priority: Earth/Moon first)

1. **Far dust** (~9k desktop / fewer mobile) — dim purple-white points, additive, low opacity  
2. **Mid field** — slightly brighter lavender/warm mix  
3. **Milky Way band** — tilted density belt (approx. galactic plane ~60°), soft purple glow  
4. **Catalog brights** — ~50 naked-eye anchors with approx J2000 RA/Dec + spectral color tint  
5. **Faint constellation lines** — Orion, Scorpius (ASX brand), Big Dipper, Cassiopeia, Summer Triangle, Southern Cross at ~7% purple opacity  

## Constellations implemented (stick figures)

- **Orion** — belt + shoulders/knees (Betelgeuse, Rigel, Alnitak/Alnilam/Mintaka, …)  
- **Scorpius** — Antares heart + stinger (Shaula, Sargas) — brand resonance  
- **Ursa Major / Big Dipper** — Dubhe → Alkaid  
- **Cassiopeia** — classic W  
- **Summer Triangle** — Vega, Deneb, Altair  
- **Southern Cross** — Acrux, Mimosa, Gacrux  

Coordinates are **approximate** (education/art accuracy, not a planetarium). Good enough for pattern recognition from orbit camera.

## Art direction: universe purple

- Void clear color: `#0a0618` (was near-black `#010208`)  
- Fog / ambient fill: violet-tinted so night side and sky read as brand purple  
- Stars lean cool violet + soft gold-white; never pure flat white field  
- Constellation guides stay **barely there** — recognisable if you look, not diagram-loud  

## Performance

| Path | Far stars | Notes |
|------|-----------|--------|
| Desktop | ~9000 + mid + band | Additive points; no textures |
| Mobile | ~4500 | Lower DPR already |
| Tiny / reduce-motion | Fewer; no band / no lines | |

## Hand / glass gate (not removed)

Glass gate **purple satin glove** is still in `js/glass-gate.js`. It runs **once per browser tab session** (`sessionStorage` key `asx-glass-gate-ok`). After skip/pass, later loads jump straight to desktop — that is intentional, not a deletion.

Retest glove:

```js
sessionStorage.removeItem('asx-glass-gate-ok');
location.reload();
```

## Sources (general)

- Celestial sphere RA/Dec mapping (standard astronomy)  
- Bright-star identity / approximate positions (common catalog knowledge: Sirius, Vega, Antares, …)  
- Constellation stick-figure topology (Orion belt, Dipper, Cassiopeia W, Scorpius curve)  
- Prior ASX notes: sun angular scale, cloud cover, CDN policy  

## Follow-ups (optional)

- Full Hipparcos / Yale BSC load for denser real field  
- Season-aware RA offset so “tonight’s sky” rotates with calendar  
- Photoreal glove refinement (still SVG gate, not Zero WebGL)  
