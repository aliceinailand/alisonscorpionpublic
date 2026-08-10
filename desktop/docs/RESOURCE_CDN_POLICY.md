# ASX desktop — resource delivery policy (hard rule)

**Date locked:** 2026-08-10  
**Rule:** **Never serve vendor weight from our origin if a major public CDN already has it.**

## Goal

- **Our site** = thin shell (HTML/CSS/app JS) + brand + policy.  
- **Their sites** (cdnjs, jsDelivr, unpkg, threejs.org) = multi‑MB libraries and textures.  
- Guests hit **well-funded, already-warm CDNs**. We do **not** add download volume or storage for files that are already public elsewhere.  
- Even on GitHub Pages, the site is large enough — **offload every byte we can**.

## Order of preference

1. **cdnjs** (Cloudflare-backed free CDN)  
2. **jsDelivr**  
3. **unpkg** / **threejs.org** / other well-known public hosts  
4. **Never** our `/assets/cdn/` for hot path — **do not store vendor mirrors on our servers**

Our origin is **not** a third CDN for Three/D3/textures. Multi-hop is **CDN → CDN → CDN**, not CDN → us.

## What we still host (required first-party)

| Asset | Reason |
|-------|--------|
| Shell `index.html`, `css/*`, `js/*` (apps, WM) | Product code; ES modules |
| Brand, favicon, OG images | Identity / SEO |
| `/safety/hosts/*` | **Our** policy lists; load only when Browser opens |

## What we never host again

| Asset | Source |
|-------|--------|
| three.min.js | cdnjs → jsDelivr → unpkg |
| Earth/moon/cloud textures | jsDelivr → threejs.org → raw.githubusercontent |
| d3 | jsDelivr → cdnjs → unpkg |

## Operator checklist (new library)

1. Search **cdnjs** and **jsDelivr** for a pinned version.  
2. Prefer SRI when the primary is cdnjs.  
3. Add 1–2 public CDN fallbacks.  
4. **Do not** commit the minified library into this repo.  
5. Document the pin in the importing module header.

## Why not mirror “just in case”?

- Inflates our deploy and GH bandwidth for no hot-path gain.  
- Major CDNs already long-cache and absorb hits.  
- Failures are rare; multi-CDN chains cover that without storing copies here.

## Related

- `js/main.js` — Three load chain  
- `js/three-bg.js` — texture URLs  
- `js/ambient-d3-bg.js` — D3 load chain  
