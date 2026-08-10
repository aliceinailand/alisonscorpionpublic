# ASX first-party CDN mirror

**Why:** Cloudflare Cache Rules only apply to **our** zone (`alisonscorpion.com`).  
We **cannot** force-cache `cdn.jsdelivr.net` or other third-party hosts.

**What we do instead (free):**

1. **Primary:** public CDNs — **cdnjs** (Three.js) / **jsDelivr** (textures, D3)  
2. **Fallback only:** mirrors here under `/assets/cdn/` if the CDN fails  
3. Mirrors stay on-repo so Alison’s desktop still boots offline-ish / CDN-down  

Order is intentional: free multi-CDN first; our origin is the safety net, not the hot path.

| Path | Source | License notes |
|------|--------|----------------|
| `three-r128/three.min.js` | three.js r128 (cdnjs) | MIT |
| `three-r128/planets/*` | three.js r128 example textures | MIT (three.js) |
| `d3/d3.min.js` | d3@7.9.0 | ISC |

Covered by CF rule **ASX cache: assets + /assets/cdn** (**1 year**) and `_headers` `max-age=31536000, immutable`.

Refresh: re-download from upstream pins if upgrading Three/D3 versions; keep SRI in `main.js` in sync.
