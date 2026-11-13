# Chrome DevTools for agents — example prompts + Observatory QA (2026-11-10)

Source: https://developer.chrome.com/docs/devtools/agents  
Use-cases: emulation · lighthouse-audit

## Emulate Experiences (docs demos)

### Mobile burger on developer.chrome.com
- Viewport: 390×844, `isMobile`
- Burger: **Open menu** (found + clicked)
- Top-level nav items sampled: Docs, Web Platform, Extensions, Chrome Web Store, DevTools, Lighthouse, Modern Web Guidance, Accessibility, AI, Performance, CSS and UI, Identity, Payments, Privacy and security, …

### Store locator + Berlin geolocation
- URL: https://chrome.dev/devtools-store-locator
- CDP `Emulation.setGeolocationOverride` → 52.5294, 13.4010 (Berlin / Mitte)
- **Rosenthaler Strasse branch present:** `Rosenthaler Strasse 40-41, 10119 Berlin` (AURA MITTE)

## Proactive QA — DSPE Observatory

Target: `http://127.0.0.1:8878/desktop/dspe-observatory.html` (draft PR #5 worktree)

| Category | Before | After |
| --- | --- | --- |
| Accessibility | 98 | **100** (expected after `<main>`) |
| SEO | 63 | 63 (intentional) |

### Findings
- **color-contrast:** pass (no low-contrast elements flagged)
- **image-alt:** notApplicable (no `<img>` on the page)
- **landmark-one-main:** failed → fixed by wrapping shell in `<main class="wrap">` (`863…` / this commit)
- **is-crawlable:** fail from `<meta name="robots" content="noindex,nofollow">` + robots.txt — **kept on purpose** for a local measurement scaffold

## Tooling note
- Lighthouse CLI used with `CHROME_PATH=/home/alice/.agent-browser/browsers/chrome-156.0.8078.80/chrome`
- chrome-devtools-mcp not wired in this Grok session; BrowserOS neo + puppeteer-core covered the demos
- chrome-devtools-mcp install for Grok is optional personal tooling (not an ASX stack product)

## ASX product-fit (docs page)
| Product | Fit |
| --- | --- |
| DSPE Observatory | **Yes** — proactive a11y/SEO QA before desktop merge |
| Agent harness / multi-AI | **Yes** — agent browser verification pattern |
| fweb / asxbot / fread / fcomp / fmerge / fdiff | **No** — not their job |
| BrowserOS / chrome-devtools-mcp | Personal agent tooling; not scored as ASX stack products |
