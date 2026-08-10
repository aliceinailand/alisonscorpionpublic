# Earth cloud-cover simulation (ASX desktop Three.js)

**Date:** 2026-08-10  
**Module:** `website/desktop-os/js/three-bg.js`  
**Public transparency:** algorithm + priors live in shared source; each load logs seed/mean.

## Why

A bare day-map Earth looks artificially cloudless. Real Earth is cloudy most of the time. Guest desktop should randomize weather so **each page load can differ**, while remaining **statistically grounded** in climate literature—not pure white noise.

## Climate facts used (synthesis)

| Scope | Typical cloud fraction | Notes |
|-------|------------------------|--------|
| **Global mean** | ~**67–68%** | ~56–73% depending on optical-depth threshold |
| **Oceans** | ~**72%** | Higher, low seasonal swing |
| **Land** | ~**55%** | Stronger seasonal variation |
| **Clearer continents** | Africa (esp. Sahara), Middle East, Australia interior | Continentality / aridity |
| **Cloudier continents / belts** | Europe, N America storm tracks, S America (Amazon), Asia monsoon, ITCZ, Southern Ocean | Westerlies, monsoons, convective belts |

Sources consulted for priors (not live API pulls):

- Wikipedia *Cloud cover* (global / land / ocean averages; continental qualitative map)
- NASA ISCCP / GISS cloud role summaries (ocean vs land; tropics vs subtropics)
- Climatic Atlas of Clouds Over Land and Ocean (UW) — type of long-term observational product
- Three.js practice: separate slightly larger cloud sphere + transparent map (franky-adl/threejs-earth, vasturiano three-globe clouds example, three.js `earth_clouds_1024.png`)

**No live weather API** on the public guest shell: deterministic client-side sim keeps the page offline-capable, private, and free of third-party weather keys.

## Algorithm (JavaScript)

1. **Seed** per page load: `random ⊕ time ⊕ performance.now`.
2. **Target global mean** drawn uniformly in **[0.58, 0.74]** (realistic band around ~0.67; allows “clearer” days, never near-zero).
3. **Equirectangular map** (256×128 tiny → 1024×512 desktop): for each pixel  
   - `lat/lng` from UV  
   - **`cloudPrior(lat,lng)`** from ordered region boxes (Sahara 0.18 … Southern Ocean 0.82; default ocean 0.71, land 0.54)  
   - Multi-octave **value-noise FBM** with seed-based day offset  
   - Optional blend with NASA **earth_clouds_1024.png** structure if CDN loads  
   - Soft threshold shaped by prior → alpha  
4. **Rescale** all alphas so measured mean ≈ target mean (forces realism even if noise ran dry).  
5. **Two shells:** main clouds @ `R×1.018`, thin cirrus @ `R×1.028` with XOR seed.  
6. **Drift:** clouds rotate slightly faster than ground for weather illusion.

## Transparency / audit hooks

| Hook | Purpose |
|------|---------|
| `canvas.dataset.asxCloudSeed` | Hex-ish seed for this weather day |
| `canvas.dataset.asxCloudCover` | Realized mean alpha |
| `canvas.dataset.asxCloudTarget` | Target mean used for rescale |
| `canvas.dataset.asxCloudMode` | `nasa-structure+climate-prior` or procedural-only |
| `console.info("[ASX] Earth cloud cover …")` | Operator / curious user |
| `handle.getCloudCover()` | Programmatic |
| This research note | Public source-sharing narrative |

## What this is not

- Not live satellite weather (no GFS/GOES tile stream).  
- Not photoreal volumetric clouds (too heavy for guest wallpaper).  
- Not Google Earth cloud product.  

## Claude / Grok note

Claude-class parts can refine noise, shaders, or regional boxes. Grok synchronizes priors + shell + public research folder so the **working display** and **audit trail** stay aligned for a public, source-shared site.

## Verification

- Hard-refresh public apex; Earth should show white translucent cloud bands.  
- Reload several times → different patterns; console mean stays ~58–74%.  
- Sahara / Australia should trend clearer than Southern Ocean / ITCZ in the same seed’s map.
