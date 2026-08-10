# Three.js vs Google Earth — research note (ASX desktop)

**Date:** 2026-08-10  
**Question:** Can Three.js match Google Earth click-to-zoom?

## Short answer

| Goal | Feasible in ASX guest Three.js? |
|------|----------------------------------|
| Click / double-click a point on the globe and **dolly the camera** toward it | **Yes** — raycast + radius/look lerp |
| Drag orbit + scroll zoom | **Yes** |
| Lat/lng readout for hit point | **Yes** (sphere math) |
| Full **Google Earth** (street-level tiles, buildings, search, GE API) | **No** without a different stack |

## What “Google Earth like” means online

| Stack | What it is | GitHub / web |
|-------|------------|--------------|
| **Raycast globe** | Click mesh → camera zoom | discourse.threejs “click and zoom like google earth”; patlov/earthThreeJS |
| **three-globe / globe.gl** | Data viz globe + `onGlobeClick({lat,lng})` | vasturiano/three-globe, globe.gl |
| **geo-three** | Slippy **map tiles** on 3D terrain | tentone/geo-three |
| **Google Maps + Three** | Official **js-three** overlay on Maps, not GE itself | googlemaps/js-three |
| **Cesium / Google Photorealistic 3D Tiles** | True planetary tile engines | Separate product from guest ASX shell |

## ASX choice

Keep **lightweight satellite illusion** in the desktop background:

1. Double-click Earth → approach surface (raycast).  
2. Scroll → zoom.  
3. Double-click empty desktop → return to satellite altitude.  
4. Drag → look; release → auto orbit when zoomed out.  

**Not** embedding Google Earth licensing/tiles into the start menu wallpaper.

Full maps product belongs in **Containers** / a dedicated app later if needed (Cesium or Maps).

## Claude / Grok split (operator note)

Claude: exceptional **parts** (meshes, shaders, UI fragments).  
Grok: **synchronize** into a working display under ASX fail-closed / multi-agent process.
