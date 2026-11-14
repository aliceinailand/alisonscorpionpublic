# Modern Web Guidance — DSPE Observatory + desktop (2026-11-10)

Source: https://developer.chrome.com/docs/modern-web-guidance  
Skill: `modern-web-guidance` (`npx -y modern-web-guidance@latest`)  
Branch: `agent/wave-a-plans-preview-20261110` (draft PR #5 worktree)

## What ran

1. `legacy-scan desktop` → 15 findings (9× `ime-safe-enter-submit`, 6× `sanitize-untrusted-html`).
2. Focused `search` / `retrieve`: `ime-safe-enter-submit`, `sanitize-untrusted-html`, `forms`, `accessibility`, `html`.
3. Applied fixes; re-scan → **1 residual** (intentional DOMPurify fallback line in `sanitize.js` when allowlist exceeds native Sanitizer envelope).
4. BrowserOS neo verified Observatory measure flow on `http://127.0.0.1:8878/desktop/dspe-observatory.html`.

## Verified drops (not edited)

- Menu / dock `Enter`/`Space` on non-text widgets (`menus.js`, `main.js` icons).
- Spreadsheet cell-grid `Enter` navigation (`apps.js` ~3817) — not submit/search.

## Changes

| Area | Change |
| --- | --- |
| Observatory UI | Semantic `<form aria-labelledby>`, visible `<label for>`, `type=submit`, `role=status` + `aria-live` report, `maxlength`, Ctrl/Cmd+Enter (IME-safe), `:focus-visible`, `font-size: max(1rem,1em)`, 48px tap target |
| IME Enter | `isComposing \|\| keyCode === 229` gates in `apps.js`, `public-chat.js`, `shell-chrome.js`, `web-browser.js` |
| Sanitize | `setSafeHtml` prefers `Element.setHTML` when allowlist fits native XSS-safe envelope; else DOMPurify + `innerHTML`. Call sites in `main.js` / `wm.js` / impress slides routed through `setSafeHtml` |

## Tests

- `node --test js/dspe-observatory.test.js js/public-chat.test.js` — pass
- Neo: paste + Measure locally → report with `dspe-observatory-v0.4-dataset-weights`, `style_only_risk=true`, composite capped

## Holds

- No merge of draft PR until Alice says.
- Copilot stories lane unchanged; this is Grok Observatory/desktop MWG only.
