# ASX Browser: blocklists, blocked UX, iframe limits

**Date:** 2026-08-10

## Why the browser felt “broken”

Most major sites send **X-Frame-Options: SAMEORIGIN/DENY** or CSP **frame-ancestors**. A guest iframe on `alisonscorpion.com` **cannot** render them. That is site security (anti-clickjacking), not a bug in the Go button.

**ASX fix:**

1. Local **asx://home** start page (blob HTML) that always works  
2. Toolbar **Open outside** for full browser tab  
3. Persistent hint when embedding may fail  
4. Policy blocks show a **deliberate filter interstitial** (school/corp style)

## Safe vs unsafe (research)

| Source | Role | How ASX uses it |
|--------|------|-----------------|
| [StevenBlack/hosts](https://github.com/StevenBlack/hosts) | Unified hosts; **porn extension** optional | Converted to `safety/hosts/adult-*.txt` (~64k bare domains) |
| OISD NSFW (community / Pi-hole) | Large adult DNS lists | Pattern + brand tokens inspiration |
| Hagezi DNS blocklists | Malware-oriented | Future malware tier; adult often separate |

### Why not only hot-link raw GitHub?

| | Live `raw.githubusercontent.com` | **safety/ in our public repo** |
|--|----------------------------------|--------------------------------|
| CORS | Works (`Access-Control-Allow-Origin: *`) | Same-origin |
| Size | Hosts format **2–5 MB** | Compact domains **~1.1 MB** sharded |
| Every guest visit | Pulls from GitHub | CDN / GH Pages cache of *our* deploy |
| Audit | External moving target | Versioned with site commit |
| Offline-ish | No | Yes once cached |

**Conclusion:** Linking raw is *possible*; shipping under **`safety/`** is better for a public guest desktop. Refresh with `tools/refresh_safety_hosts.py`. Core brands stay in `blocklist.js` for fail-closed before shards load.

## Blocked screen design

Modeled on familiar filter pages: clear title, URL, category reason, soft disclaimer (“not a network firewall”). Soft client UX for guests.

## Guest product philosophy (operator)

No forced signup. Browser + Files + apps = explore Alison’s desktop. Registration later for account-owned persistence; **localStorage window geom** already remembers layout per browser profile.
