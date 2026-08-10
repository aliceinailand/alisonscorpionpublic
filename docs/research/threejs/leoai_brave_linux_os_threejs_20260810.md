# LeoAI / Brave — “make a linux os from threejs” (ingest)

**Source:** `/home/alice/Documents/AI_DATA/LeoAI/brave-leo-ai-linux-os-three-js-render.txt`  
**Date:** 2026-08-10  
**Role:** Architecture inspiration for ASX guest desktop (not a CSS dump)

## Core claim (Leo)

You **cannot** build a Linux **kernel/OS** in Three.js. You **can** build the **illusion of a desktop** in the browser: Three.js (or WebGL) for the “room/space,” **HTML/CSS/JS** for real windows, terminal text, and focus.

That matches ASX product intent: *guest on Alison’s desktop*, not a real OS.

## What Leo recommends (mapped to ASX)

| Leo idea | ASX implementation (current) |
|----------|------------------------------|
| 3D environment / room / space | Earth–Moon–Sun **Three.js** wallpaper (`three-bg.js`); ambient D3/SVG fallback |
| Glass / depth materials | CSS glass panels: `backdrop-filter`, low-opacity `win-body` / `.term` / places views |
| Transparent HTML over 3D | `#windows-root` + `.asx-window` **DOM** over `#three-bg` canvas (`pointer-events` split) |
| Terminal = overlay input + JS parser | `openTerminal` + `fs.js` virtual FS (`ls`/`cd`/`cat`) |
| Window z-order / focus | `WindowManager` z-index stack |
| Drag / resize | Titlebar pointer drag + resize handle (2D DOM, not 3D raycast) |
| Minimize / close / taskbar | Taskbar items + show-desktop strip |
| Persist VFS | Guest apps use **localStorage** (notepad, accounts); full IndexedDB VFS = later |
| Raycast 3D windows | **Not used** — Leo hybrid “CSS3D/HTML overlay” path chosen (more reliable for inputs) |

## Explicit non-goals (Leo + ASX)

- No real host filesystem access  
- No kernel, drivers, or true process isolation  
- Illusion + product shell (Containers, Chat, Agent demo)

## Glass style note

This Leo file does **not** include specific Claude CSS numbers. It does recommend **glass-like materials** and **transparent HTML overlays**. ASX glass now uses stronger blur + lower panel opacity so the Earth wallpaper reads through terminal/files (Claude-era aesthetic, Leo hybrid architecture).

## Libraries Leo mentions

- CSS2DRenderer / CSS3DRenderer — labels on 3D meshes  
- React Three Fiber + Drei `<Html>` — if we ever go R3F  
- ASX stays **vanilla DOM + Three wallpaper** for guest load weight and reliability  

## Follow-ups (optional)

1. Optional CSS3D “monitor” frame around active window (Leo CRT/glass)  
2. IndexedDB VFS persistence (Leo “persist virtual FS”)  
3. Pinch/mobile pointer capture hardening (Leo mobile notes) — partly done via pointer events  

## Operator

When Claude produces “parts” (shaders, glass snippets), re-check this map so Grok keeps **one** working desktop: DOM windows + Three skybox, not pure-3D windows that break focus.
