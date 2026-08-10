/**
 * ASX Desktop OS — boot, icons, taskbar, start menu.
 */
import { initThreeBg } from "./three-bg.js";
import { WindowManager } from "./wm.js";
import { registerApps, APP_CATALOG } from "./apps.js";

const DESKTOP_ICONS = [
  { id: "terminal", label: "Terminal", glyph: "❯", x: 18, y: 18 },
  { id: "files", label: "Files", glyph: "📁", x: 18, y: 110 },
  { id: "browser", label: "Browser", glyph: "🌐", x: 18, y: 202 },
  { id: "chat", label: "ASX Chat", glyph: "💬", x: 18, y: 294 },
  { id: "containers", label: "Containers", glyph: "📦", x: 18, y: 386 },
  { id: "honeybee", label: "honeybee", glyph: "🐝", x: 18, y: 478 },
  { id: "calculator", label: "Calculator", glyph: "🧮", x: 110, y: 18 },
  { id: "notepad", label: "Notepad", glyph: "📝", x: 110, y: 110 },
  { id: "sticky", label: "Stickies", glyph: "📌", x: 110, y: 202 },
  { id: "sheet", label: "Sheet", glyph: "📊", x: 110, y: 294 },
  { id: "mindmap", label: "Mind Map", glyph: "🕸", x: 110, y: 386 },
  { id: "image", label: "Images", glyph: "🖼", x: 202, y: 18 },
  { id: "pdf", label: "PDF", glyph: "📄", x: 202, y: 110 },
  { id: "video", label: "Video", glyph: "🎬", x: 202, y: 202 },
  { id: "about", label: "About", glyph: "ℹ", x: 202, y: 294 },
  { id: "settings", label: "Settings", glyph: "⚙", x: 202, y: 386 },
];

function bootSplash() {
  return new Promise((resolve) => {
    const el = document.getElementById("boot-splash");
    if (!el) return resolve();
    const steps = [
      "Loading verification core…",
      "Mounting guest session…",
      "Three.js universe…",
      "Window manager…",
      "Policy blocklist…",
      "Welcome, guest.",
    ];
    const sub = el.querySelector(".sub");
    let i = 0;
    const tick = () => {
      if (i < steps.length) {
        if (sub) sub.textContent = steps[i++];
        setTimeout(tick, 220);
      } else {
        el.classList.add("gone");
        setTimeout(() => {
          el.remove();
          resolve();
        }, 500);
      }
    };
    tick();
  });
}

function placeIcons(layer, openApp) {
  DESKTOP_ICONS.forEach((data) => {
    const el = document.createElement("div");
    el.className = "desk-icon";
    el.style.left = data.x + "px";
    el.style.top = data.y + "px";
    el.dataset.app = data.id;
    el.innerHTML = `<div class="glyph">${data.glyph}</div><div class="label">${data.label}</div>`;
    el.addEventListener("click", () => {
      layer.querySelectorAll(".desk-icon").forEach((i) => i.classList.remove("selected"));
      el.classList.add("selected");
    });
    el.addEventListener("dblclick", () => openApp(data.id));
    layer.appendChild(el);
  });
}

function buildStartMenu(menu, openApp) {
  menu.innerHTML = `<h3>◆ ASX applications</h3>`;
  APP_CATALOG.forEach((app) => {
    const row = document.createElement("div");
    row.className = "sm-item";
    row.innerHTML = `<span class="g">${app.glyph}</span><span>${app.label}</span>`;
    row.addEventListener("click", () => {
      openApp(app.id);
      menu.classList.remove("open");
    });
    menu.appendChild(row);
  });
}

function clock() {
  const el = document.getElementById("tb-clock");
  if (!el) return;
  const tick = () => {
    const n = new Date();
    el.textContent = n.toLocaleTimeString(undefined, { hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}

async function main() {
  await bootSplash();
  initThreeBg("three-bg");

  const wm = new WindowManager({
    rootId: "windows-root",
    taskbarId: "taskbar-windows",
  });
  const { open } = registerApps(wm);

  const layer = document.getElementById("desktop-layer");
  placeIcons(layer, open);

  const menu = document.getElementById("start-menu");
  buildStartMenu(menu, open);

  document.getElementById("tb-start")?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target.id !== "tb-start") {
      menu.classList.remove("open");
    }
  });

  // Desktop empty click deselect
  layer?.addEventListener("click", (e) => {
    if (e.target === layer) {
      layer.querySelectorAll(".desk-icon").forEach((i) => i.classList.remove("selected"));
    }
  });

  clock();

  // Open welcome terminal after short delay
  setTimeout(() => open("terminal"), 400);
}

main().catch((err) => {
  console.error("ASX Desktop boot failed", err);
  const sub = document.querySelector("#boot-splash .sub");
  if (sub) sub.textContent = "Boot error — see console";
});
