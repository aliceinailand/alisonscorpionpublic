# ASX Desktop OS

Guest desktop experience for **alisonscorpion.com** — thin universe-purple glass windows, Three.js background, product app = **Containers** (`../staging/`).

**Three.js documentation:** [threejs.md](./threejs.md) · full website map: [../docs/THREEJS_WEBSITE.md](../docs/THREEJS_WEBSITE.md)

## Local preview

```bash
cd /home/alice/alisonscorpion/website
python3 -m http.server 8765 --bind 127.0.0.1
# → http://127.0.0.1:8765/desktop-os/
```

## Apps

Terminal, Files (PCManFM-Qt style), Browser (+ blocklist + ASX see-strip), Chat, Containers, honeybee, Calculator, Notepad, Stickies, Spreadsheet, Mind Map, Image/PDF/Video viewers, About, Settings.

## Backup

Containers snapshot: `../website-backup-containers-20260810_061303Z` (sibling of `website/` under monorepo root).

## Architecture (LeoAI / Brave hybrid)

Illusion of a Linux desktop **in the browser** — not a real OS kernel.

| Layer | Tech |
|-------|------|
| Universe “room” | Three.js **or** ambient D3/SVG (`?bg=ambient` / auto ≤420px) |
| Windows / taskbar / apps | **DOM** (not 3D meshes) |
| VFS + terminal | In-memory `fs.js` + command parser |
| Mobile | Pointer events, `overscroll-behavior: none`, tap-to-open |

### Window modes (product, not a bug)

| Mode | When | Behavior |
|------|------|----------|
| **Phone / small pane** | Narrow guest area (phone or side-by-side strip) | Single-focus: large fitted windows; stacking is OK |
| **Desktop multi** | Wide enough live bounds | Cascade + smaller footprint so **multiple windows** stay usable |

`desktop = ability to work in multiple screens` (multi-window cascade).

See `agents/research/threejs/leoai_linux_os_threejs_review_20260810.md`.

## Security notes

- Calculator uses a safe arithmetic parser (no `eval` / `Function`).
- Browser blocklist is **soft/client** policy; confusable fold + SRI on Three CDN.
- Guest FS is virtual only (`normalizePath` for `..`).
