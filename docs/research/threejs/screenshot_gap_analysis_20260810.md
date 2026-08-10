# Screenshot gap analysis + theme decision (2026-08-10)

**Source folder:** `/home/alice/screenshots/` (459 files)  
**Focus:** 2026-08-10 ASX desktop captures + Claude extracts + PouyaOS reference shots

## What the screenshots show

| Shot (approx) | What it is | Status vs current |
|---------------|------------|-------------------|
| `screen-2026-08-10-06-23-*` | Computer / Network / Browser windows on Earth | **UI works**; windows read **solid/dark** (panel-like), little Earth bleed-through |
| `screen-2026-08-10-06-20/21-*` | Clean desktop, Earth + Moon, icons | Good shell layout; void was still black before starfield fix |
| `screen-2026-08-10-04-04-*` | Dense top icon dock + lattice Earth | Lattice removed by design; icons simplified to Linux-like column |
| `screen-2026-08-10-03-19-*` | Mobile narrow + Notepad | Mobile chrome still needs vigilance; lattice gone |
| `screen-2026-08-10-04-45-*` | Real Lubuntu “Computer” (host OS) | **Not ASX** — real desktop reference only |
| `asx-screen-2026-07-19-*` | Containers product overview | Exists via Containers app / staging |
| `asx_menu_screen-*` | Containers sidebar | Product UI, not guest WM |
| `screen-2026-08-08-23-02-*` | **PouyaOS** thin terminal over matrix | Reference for **thin terminal chrome** |
| Zero/glass gate shots | Draw-a-zero / hand | **Removed** by operator request |

## Claude HTML extracts (`website/brainstorm/claude_html_extracts/`)

| Extract | Style | Used as |
|---------|--------|---------|
| 00–01, 03–04, 10–11 | Mono institutional, accent **stripe titlebars**, square corners | **Thin terminal** title stripe |
| 06–08 | Solid dark panels, taskbar | Closer to **panel desktop** |
| 02, 05 | Gate / intro | Not shipping (gate ditched) |
| 09, 12 | Containers product | Staging product, not WM |

Claude’s desktop extracts are mostly **solid** `#242424` panels — the **transparency** goal is the ASX glass adaptation of that terminal chrome (stripe title + mono) so the Three.js Earth remains visible.

## Gaps → action

| Gap | Action |
|-----|--------|
| Windows too opaque (06:23) | **Default theme = thin-terminal** with low-alpha glass |
| Want to keep current solid look | **panel-desktop** theme (optional, Settings) |
| Theme select was stub | **Working** Settings → Theme |
| Constellation lines | Already removed |
| Hand gate | Already removed |
| Starfield | Shipped (pixel stars + purple void) |
| Dense dock icons (04:04) | Keep clean Linux column (not regressed) |
| Host Lubuntu “Computer” UX | Do not clone; virtual Computer is guest-only |

## Themes (shipped)

1. **`thin-terminal` (default)** — Claude accent-stripe titlebar, 3px radius, high glass transparency, Earth/stars show through  
2. **`panel-desktop`** — previous denser purple panels (what 06:23 looked like)

`localStorage.asx-ui-theme` · `js/themes.js` · body classes `asx-theme-thin` | `asx-theme-panel`
