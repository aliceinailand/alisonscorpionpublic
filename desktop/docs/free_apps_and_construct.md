# Free apps (guest-ready now) · Construct later

**Status:** product lock — 2026-08-10  
**Surface:** ASX Desktop OS (`website/desktop-os/`)

## Intent

These free applications are **real tools a guest can hop on and use today** — not mockups.  
Later, **Construct** may open them and give the **illusion of using them** (drive UI, type, scroll, save) when that orchestration is ready.

| Layer | Who | Behavior |
|-------|-----|----------|
| **Now** | Guest human | Open apps from desktop / Applications / `#app/<id>` and work |
| **Later** | Construct | Optional automation: open app, stream actions, appear to operate tools |
| **Always** | Alison Scorpion | Host / admin owner of the desktop illusion |

Construct does **not** need to own the apps’ code. Free apps stay standalone; Construct calls a thin control surface when present.

## Guest-ready inventory

Grouped as in Applications (see `APP_CATEGORIES` in `js/apps.js`).

### System
| id | Label | Guest can use now |
|----|--------|-------------------|
| `terminal` | Terminal | Shell commands, guest FS |
| `computer` | Computer | Places / virtual machine root |
| `files` | Files | Browse + BrowserFS under `/home/guest` |
| `settings` | Settings | Theme, About you, desktop copy |
| `about` | About | Desktop branding + device profile |
| `users` | Users | Local signup / trash hold |

### Internet
| id | Label | Guest can use now |
|----|--------|-------------------|
| `browser` | Browser | Framed browse + policy blocklist |
| `network` | Network | Virtual network places |
| `gdrive` | GDrive | Public share / live list with API key |
| `youtube` | YouTube | Embed demo + search paste |

### Office
| id | Label | Guest can use now |
|----|--------|-------------------|
| `quill` | Quill | Rich text (WYSIWYG) |
| `notepad` | Notepad | Plain text; **Save to ASX desktop** (choose guest folder) or **Save to Downloads** on the host |
| `reader` | Reader | PDF / MD / TXT / LOG / DOCX / image / audio / video (local files) |
| `sticky` | Sticky Notes | Notes pad |
| `sheet` | Spreadsheet | Grid + ExcelJS XLSX + guest disk CSV/JSON + download |
| `impress` | Impress | impress.js CSS3 presentations |
| `mindmap` | Mind Map | Simple nodes |
| `pdf` | PDF Reader | pdf.js (PDF-only; prefer **Reader** for multi-format) |

### Media
| id | Label | Guest can use now |
|----|--------|-------------------|
| `image` | Image Viewer | BigPicture + compression |
| `video` | Video Player | Local file |
| `youtube` | YouTube | (also Internet) |

### Programming
| id | Label | Guest can use now |
|----|--------|-------------------|
| `monaco` | Monaco | **Sole** full code editor (VS Code / Monaco engine) |
| `terminal` | Terminal | (also System) |
| `jsfile` | JsFile | File inspect / hex / save toolkit — **not** a second code editor |

## One app per job (no duplicates)

Guests should never see two icons that do the same thing. Prefer the stronger tool; keep lighter tools only when the job is different.

| Job | Chosen free app | Not added (would duplicate) |
|-----|-----------------|------------------------------|
| **Code / IDE edit** | **Monaco** (`#app/monaco`) | CodeMirror, Ace, other editor cores |
| **Rich text / prose** | **Quill** | Extra WYSIWYG engines |
| **Plain scratch pad** | **Notepad** | (kept — no formatting, tiny; not a Monaco substitute) |
| **Presentations** | **Impress** | Second Prezi-style stack |
| **Spreadsheet** | **Spreadsheet** (ExcelJS) | Extra grid libraries as apps |
| **PDF view** | **PDF Reader** (pdf.js) | Second PDF engines as apps |
| **Image view** | **Image Viewer** | Second lightbox stacks as apps |
| **File open/inspect** | **JsFile** + **Files** | Extra “file editor” apps |

**CodeMirror** ([cdnjs](https://cdnjs.com/libraries/codemirror)) is a solid editor, but **Monaco already owns Programming → Monaco**. Do not ship both. If we ever need a lighter embed (e.g. tiny inline snippet field inside another app), that can use a *component*, not a second Applications icon.

**JsFile** is for reading/inspecting files in the browser (and saving to guest FS), not a competing source editor.

### ASX
| id | Label | Guest can use now |
|----|--------|-------------------|
| `containers` | Containers | Product shell link |
| `honeybee` | honeybee | Contracts lane |
| `agent-asx` | Agent | Desktop actions + stream UI |
| `chat` | Chat | Free Q&A router only |

### Utilities
| id | Label | Guest can use now |
|----|--------|-------------------|
| `reader` | Reader | PDF / MD / TXT / LOG / DOCX / image / audio / video (local files) |
| `notepad` | Notepad | Plain text; **Save to ASX desktop** (choose guest folder) or **Save to Downloads** on the host |
| `calculator` | Calculator | Local calc |
| `todo` | Todo | Checklist + download (account dual-save later) |

### Games
All first-party titles **pause on lose-focus** (another window, minimize, or tab hide) and **resume on regain-focus**. Toolbar **Pause** / **P** still work; a manual pause stays until Resume/P. Asteroids pause lives on its open PR branch until that merges.

| id | Label | Guest can use now |
|----|--------|-------------------|
| `games` | Games | Folder |
| `tic-tac-toe` | Tic Tac Toe | First-party · P pause |
| `pong` | Ping Pong | First-party · P pause |
| `blocks` | Blocks | Tetris-like first-party · P pause |
| `snake` | Snake | First-party · P pause |
| `breakout` | Breakout | First-party · P pause |
| `memory` | Memory | First-party · P pause |
| `mines` | Mines | First-party · P pause |
| `physics` | Physics | Matter.js CDN lazy · P pause |
| `invaders` | Space Invaders | First-party · P pause |
| `pacman` | Pac-Man | First-party · P pause |
| `camera` | Camera | webcamjs CDN · dual-save |
| **Creative Commons/** | CC / OSS shelf | VFS + Games UI; `cc.txt` per title |
| `Pacman` (CC shelf) | Pacman | Attribution ready; playable MIT/CC0 only |
| (later) | More CC titles / Doom+Freedoom | License isolation HOLD |

### Trust / open source
| id | Label | Guest can use now |
|----|--------|-------------------|
| `github` | GitHub | Opens public repo in Browser |

Guest id: `asxguest-####` via `js/guest-session.js` (auto on land).


### Desktop-only / shell (not all in Applications categories)
| id | Notes |
|----|--------|
| `trash` | Desktop + trash hold |
| `network` / `gdrive` | Also desktop icons |

Deep links: `#app/<id>` (Hasher). Example: `#app/quill`, `#app/monaco`, `#app/files/home/guest`.

## Construct control surface (future)

Stable contract — implement when Construct is ready to puppet the desktop:

```text
window.ASX.desktop.control = {
  open(appId, opts?)     → open free app (same as guest double-click)
  focus(appId)           → focus existing window if open
  close(appId)           → close window
  listApps()             → catalog + categories (ids only)
  isOpen(appId)          → boolean
  // optional per-app later:
  // invoke(appId, action, payload)  e.g. type, save, scroll
}
```

### Illusion guidelines (when building Construct drivers)

1. Prefer **real** open + real UI (not a video of the app).  
2. Use existing APIs where they exist (Agent actions, Files write, Monaco setValue, Quill setHTML).  
3. Fail soft: if an app is missing or CDN-blocked, narrate and skip — never block Construct crash.  
4. Guest remains able to interrupt (close window, type over agent).  
5. Do not grant Construct access to admin FS (`/home/alisonscorpion/*`).

### Agent α today (partial precedent)

`Agent` already opens apps and navigates for free-demo commands (`open settings`, `navigate to …`). That is a **manual guest agent**, not full Construct. Construct can later reuse the same `open(appId)` path and richer per-app drivers.

## CDN / size policy

Heavy vendors (Monaco, Quill, ExcelJS, pdf.js, Three) stay on **cdnjs / jsDelivr**, lazy on app open. Construct automation should not force-load every app at boot.

See: `RESOURCE_CDN_POLICY.md`.

## Non-goals (now)

- Construct recipe that automates every free app end-to-end  
- Real multi-user server for guest accounts  
- Host OS filesystem access  

## Related code

| File | Role |
|------|------|
| `js/apps.js` | `APP_CATALOG`, `APP_CATEGORIES`, openers |
| `js/hash-router.js` | `#app/<id>` deep links |
| `js/main.js` | Boot + `open` wrapper |
| Containers Construct | `website/src/lib/construct/*` (product; separate from desktop-os free apps) |


## Creative Commons / open-source Games policy

- **Only** OSS or Creative Commons licensed games.
- Path: `/home/guest/Games/Creative Commons/<Game>/cc.txt`
- **Child hang-out:** free comfort now; paid product optional later (Disney-style long relationship).
- See: `agents/research/desktop-os/games_child_psychology_cc_shelf_20260811.md`
