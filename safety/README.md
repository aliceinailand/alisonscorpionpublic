# ASX safety lists (public transparency)

Guest browser policy data. **Not** a network firewall — client-side UX block.

## Why this folder (not only a live raw GitHub link)

| Approach | Pros | Cons for guest desktop |
|----------|------|-------------------------|
| **Hot-link raw.githubusercontent.com** | Always latest | 2–5 MB per visit, GitHub runtime dependency, guest phones home to GH, parse cost on main thread, break if path renames |
| **safety/ in our repo (chosen)** | Same-origin, versioned with site, offline/CDN cacheable, can shard, audit in public git | Must refresh periodically (script or CI) |
| **Inline JS Set only** | Instant | Tiny coverage |

**CORS:** raw.githubusercontent.com *does* send `Access-Control-Allow-Origin: *`, so a live fetch is *possible*. We still prefer **shipped shards** + optional remote refresh.

## Format

- `hosts/manifest.json` — part list + upstream attribution  
- `hosts/adult-NN.txt` — one bare domain per line (no `www.`, no IP)  
- Derived from [StevenBlack/hosts](https://github.com/StevenBlack/hosts) `extensions/porn/*` (MIT)

## Refresh

```bash
# from a machine with network (operator):
python3 tools/refresh_safety_hosts.py   # if present
# or re-run the convert pipeline documented in research notes
```

## Loader

`js/blocklist.js` keeps a small instant core list. **Shards load only when the Browser app opens** (not on Earth wallpaper / desktop boot). Guests who never open Browser never download ~1 MB of lists.

### Caching

- Browser: `fetch(..., { cache: "force-cache" })`
- Origin headers: repo root `_headers` for `/safety/*` → `max-age=86400` (CF Pages / compatible hosts)
- **Edge Cache Rule (intended):** zone `alisonscorpion.com`  
  `starts_with(http.request.uri.path, "/safety/")` → cache on, edge/browser TTL 1 day  

**Apply via API (operator):**

```bash
export CLOUDFLARE_API_TOKEN=…   # Zone → Cache Rules → Edit
export CF_ZONE_ID=fdfc2f6f3598393dc37bd9a4bed467b6
python3 tools/apply_cf_safety_cache_rule.py
```

Or GitHub Actions: workflow `cf-safety-cache-rule` (uses secret `CLOUDFLARE_API_TOKEN`).

**2026-08-10 note:** workflow ran; CF API returned `10000 Authentication error` for that secret — token missing, expired, or lacks *Cache Rules Edit*. Fix token in GitHub repo secrets, re-run workflow.

### Why not always hot-link raw GitHub?

Possible (CORS allows it), but multi-MB + every visit + no version pin. Prefer this folder + optional operator refresh script.
