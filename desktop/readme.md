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

## Security notes (OCodex 2026-08-10)

- Calculator uses a safe arithmetic parser (no `eval` / `Function`).
- Browser blocklist is **soft/client** policy; label in UI.
- Three.js from cdnjs without SRI pin — pin integrity when locking production version.
- Guest FS is virtual only.
