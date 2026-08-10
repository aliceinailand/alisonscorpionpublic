# Sun distance vs appearance — architecture website scale

**Date:** 2026-08-10  
**Module:** `website/desktop-os/js/three-bg.js`, CSS `#sun-glare`  
**Question:** How far should the sun be, and how big should it look, on an ASX guest desktop?

## Real physics (ground truth)

| Fact | Value |
|------|--------|
| Earth–Sun distance | **1 AU** ≈ 149.6×10⁶ km ≈ **8.3 light-minutes** |
| Sun linear diameter | ≈ 1.39×10⁶ km (~109 Earth diameters) |
| **Angular diameter from Earth** | **~0.53°** (31–32′) |
| Angular diameter of Moon | **~0.5°** (coincidence of size/distance) |
| From LEO / satellite | Still **~0.53°** — altitude ≪ 1 AU, so the disc barely changes |
| Fit Jupiter in between? | Jupiter’s orbital radius is ~5 AU (outside Earth); linear scale is enormous, but that does **not** shrink the sun’s *angular* size from Earth |

**Key insight:** photos from space still show a **bright disc / fireball**, not a hard point, because:

1. Angular size is still half a degree of sky, and  
2. **Luminance + scattering + camera bloom** expand perceived size far past the photosphere limb.

A “tiny white pixel with no disc” is *less* realistic than a resolved ball with corona, even though 1 AU is huge.

## Why pure 1:1 AU fails on a website

With `EARTH_R = 8` scene units, true 1 AU would be on the order of **~10⁵ scene units**. Either:

- the sun is outside a sane far plane / precision budget, or  
- the photosphere becomes a sub-pixel speck and the scene *feels* sunless.

Classic solar-system demos either **compress distances** or **size by angular diameter**. ASX is a **satellite wallpaper**, not an orrery — we choose **angular-size architecture**.

## ASX architecture scale (chosen)

| Element | Scene choice | Rationale |
|---------|--------------|-----------|
| Earth radius | `EARTH_R = 8` | Local hero |
| Moon distance | `~2.85 × EARTH_R` | Relative lunar feel (already good) |
| Camera (far sat) | `RADIUS_FAR ≈ 36` | High-orbit protector view |
| **Sun distance** | `SUN_DIST ≈ 520` (~65 R⊕) | Past the Moon; low parallax while orbiting; directional light still “parallel enough” |
| **Sun angular diameter** | art **~2.3–2.8°** photosphere | Real 0.53° is ~1% of a 48° FOV → hard to *read* as a ball; mild exaggeration + multi-layer corona + CSS bloom sells fireball without pulling the sun in as a lantern |
| Photosphere radius | `SUN_R = SUN_DIST × tan(θ/2)` | Angular-size lock |
| Layers | chromosphere, corona, halo, scatter (additive) | Space-photo fireball |
| Screen glare | `#sun-glare` always soft when on-screen; `.hot` when looking at it | Perceived size of the real sun |

**Not claiming:** linear AU accuracy.  
**Claiming:** “there is a sun out there, you can see the disc, it lights the Earth, it does not orbit next to the Moon.”

## From Earth vs from space (what we match)

| Viewpoint | What people expect | ASX treatment |
|-----------|-------------------|---------------|
| Ground (memory) | Big bright disc, glare, hard to stare at | Bloom / glare layer |
| Orbit / deep-space stills | Harder limb, still a **ball**, corona rays | Multi-shell additive mesh at fixed far direction |
| True scale orrery | Speck + huge empty space | **Out of scope** for guest wallpaper |

## Operator knobs (in code)

- `SUN_DIST` — push farther for less parallax; recompute `SUN_R` from angle  
- `SUN_ANGULAR_DEG` — raise if disc still feels tiny; lower toward 0.8–1.2° for stricter realism  
- CSS gradient stops — how huge the *felt* fireball is  

## Claude / Grok

Claude: corona shaders, lens-flare parts.  
Grok: lock angular architecture so Earth / Moon / Sun stay one coherent desktop (zoom realism preserved).

## Verification

1. Hard-refresh desktop → sun is a visible warm disc with halo, not a pinprick.  
2. Orbit drag → sun barely shifts (distant); Moon still nearby.  
3. Double-click Earth zoom still works; sun stays in deep background.  
4. Looking toward sun → stronger `#sun-glare.hot` bloom.
