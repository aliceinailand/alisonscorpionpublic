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

`js/blocklist.js` keeps a small instant core list, then loads these parts when the Browser app needs a check.
