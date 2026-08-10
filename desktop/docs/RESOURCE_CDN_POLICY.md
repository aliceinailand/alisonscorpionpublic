# ASX desktop — resource delivery policy (hard rule)

**Date locked:** 2026-08-10  
**Rule:** **Never serve vendor weight from our origin if a major public CDN already has it.**

## Goal

- **Our site** = thin shell only (HTML/CSS/app JS) + brand + policy.  
- **Heavy vendor files** = already-public CDNs with real funding and global edges.  
- Guests almost never pull multi‑MB libraries from GitHub Pages / our CF origin.  
- **Our website is the last resort** (and for vendor assets: **not in the chain at all**).

## Priority stack (think of it this way)

| Rank | Who | Role |
|------|-----|------|
| **#1** | **Cloudflare** | Free global edge via **cdnjs.cloudflare.com**, and often the edge behind **jsDelivr** (and anything else already on Cloudflare). Best-funded, already warm for millions of sites. |
| **#2** | **jsDelivr** (and similar multi-CDN) | npm/GitHub packages, Three textures; long immutable cache. |
| **#3** | **Other public hosts** | unpkg, threejs.org, raw.githubusercontent — rare hops if #1/#2 fail. |
| **#4** | **alisonscorpion.com** | **Extremely rare** for anything vendor. Shell + brand + `/safety` only. We do **not** store Three/D3/textures here. |

So: the browser hits **their** pipes first. We only “make the call” (a URL). We do **not** contribute downloads of public libraries.

## Load chains in code (vendor = public only)

| Asset | Order |
|-------|--------|
| **three.min.js** | 1 cdnjs (CF) → 2 jsDelivr → 3 unpkg |
| **D3** | 1 cdnjs (CF) → 2 jsDelivr → 3 unpkg |
| **Earth/moon/cloud textures** | 1 jsDelivr → 2 threejs.org → 3 raw.githubusercontent |

No `/assets/cdn/` vendor blobs. No origin fallback for those files.

## What we still host (must be first-party)

| Asset | Why |
|-------|-----|
| Shell `index.html`, `css/*`, `js/*` | Product code |
| Brand / favicon / OG | Identity |
| `/safety/hosts/*` | Our policy; **Browser-only** fetch |

## Operator checklist

1. Prefer **cdnjs** first when the library exists there (Cloudflare #1).  
2. Then **jsDelivr**.  
3. Then unpkg / project CDN.  
4. **Do not** commit minified vendor files into this repo.  
5. Pin versions; SRI on primary cdnjs URL when available.

## Related

- `js/main.js` — Three chain  
- `js/three-bg.js` — texture chain  
- `js/ambient-d3-bg.js` — D3 chain  
