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
| [StevenBlack/hosts](https://github.com/StevenBlack/hosts) | Unified hosts; **porn extension** optional | Curated host subset in `blocklist.js` (full file too large for client) |
| OISD NSFW (community / Pi-hole) | Large adult DNS lists | Pattern + brand tokens inspiration |
| Hagezi DNS blocklists | Malware-oriented | Future malware tier; adult often separate |

**Cannot ship full hosts files** in guest JS (MBs). Client = curated Set + suffix + tokens + `.xxx/.porn/.sex/.adult` TLDs. Hard enforcement later = gateway / Cloudflare / DNS.

## Blocked screen design

Modeled on familiar filter pages: clear title, URL, category reason, soft disclaimer (“not a network firewall”). Soft client UX for guests.

## Guest product philosophy (operator)

No forced signup. Browser + Files + apps = explore Alison’s desktop. Registration later for account-owned persistence; **localStorage window geom** already remembers layout per browser profile.
