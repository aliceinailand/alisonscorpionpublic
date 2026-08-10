# ASX first-party CDN mirror

**Why:** Cloudflare Cache Rules only apply to **our** zone (`alisonscorpion.com`).  
We **cannot** force-cache `cdn.jsdelivr.net` or other third-party hosts.

**What we do instead (free):**

1. Mirror pinned vendor files here under `/assets/cdn/`  
2. Load same-origin first (hits CF edge after Cache Rules / `_headers`)  
3. Fall back to jsDelivr / cdnjs if local 404  

| Path | Source | License notes |
|------|--------|----------------|
| `three-r128/three.min.js` | three.js r128 (cdnjs) | MIT |
| `three-r128/planets/*` | three.js r128 example textures | MIT (three.js) |
| `d3/d3.min.js` | d3@7.9.0 | ISC |

Covered by CF rule **ASX cache: assets + /assets/cdn** (**1 year**) and `_headers` `max-age=31536000, immutable`.

Refresh: re-download from upstream pins if upgrading Three/D3 versions; keep SRI in `main.js` in sync.
