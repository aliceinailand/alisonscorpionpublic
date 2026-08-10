# ASX desktop — resource delivery policy

**Date locked:** 2026-08-10  
**Principle:** Major public CDNs deliver heavy vendor assets. **Our site only initiates the request** (and ships the shell). Their edges do the work.

## Order of preference

1. **Major free CDNs** (first)  
   - **cdnjs** (Cloudflare) — Three.js, etc.  
   - **jsDelivr** — npm/GitHub packages, Three textures  
   - Others only if widely used and CORS-safe (e.g. threejs.org as texture fallback)

2. **Our origin** (`alisonscorpion.com` / GH Pages) — **fallback only** for vendor files, or required first-party

3. Never hot-path large vendor blobs only from our origin when a major CDN already hosts them

## What stays on our website (must)

| Resource | Why first-party |
|----------|-----------------|
| `index.html`, `css/*`, `js/*` (shell) | App code, ES modules, policy, window manager |
| `/safety/hosts/*` | Policy data we control; load **only** when Browser opens |
| Brand / favicon / OG images | Identity, SEO, start icon |
| `/assets/cdn/*` mirrors | **Cold fallback** if CDN fails — not the hot path |

## What goes to major CDNs (hot path)

| Resource | Primary | Fallback |
|----------|---------|----------|
| three.min.js r128 | cdnjs | `/assets/cdn/three-r128/` |
| Earth/moon textures + clouds | jsDelivr | `/assets/cdn/three-r128/planets/` |
| d3 | jsDelivr | `/assets/cdn/d3/` |

## Why this is faster / cheaper for us

- GH Pages / CF only serve small shell + rare fallbacks  
- Visitor bandwidth for multi‑MB textures hits **their** CDN  
- Browser/OS already warms cdnjs/jsDelivr for many users  
- We still keep mirrors so the desktop does not hard-fail if a CDN blips  

## What we cannot do

- Set Cloudflare Cache Rules on `jsdelivr.com` / `cdnjs.cloudflare.com` (not our zone)  
- They already long-cache; we do not need to re-host to “make them cache”

## Operator rule

When adding a library or texture: **search cdnjs / jsDelivr first**, pin version + SRI when available, add local mirror under `/assets/cdn/` only as backup. Document the pin in this folder or `assets/cdn/README.md`.
