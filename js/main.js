/**
 * ASX Desktop OS — boot, icons, taskbar, start menu.
 * SEO: Three.js loaded dynamically after first paint (not blocking HTML content).
 * Mobile: tap-to-open, asx-mobile class, layout hints (2026-08-10).
 */
import { initThreeBg, shouldUseAmbientBg } from "./three-bg.js?v=20260810t200000z";
import { initAmbientD3Bg } from "./ambient-d3-bg.js?v=20260810t200000z";
import { WindowManager } from "./wm.js?v=20260810t200000z";
import { registerApps, APP_CATALOG } from "./apps.js?v=20260810t200000z";

const THREE_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
/** Hermes H3-08 / T-05: pin integrity for r128 three.min.js (cdnjs, sha384) */
const THREE_CDN_SRI =
  "sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu";
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

function isMobileUi() {
  return (
    (typeof matchMedia === "function" && matchMedia("(max-width: 768px)").matches) ||
    (typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches &&
      window.innerWidth <= 900)
  );
}

function applyMobileClass() {
  document.body.classList.toggle("asx-mobile", isMobileUi());
}

function loadThreeJs() {
  if (typeof THREE !== "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = THREE_CDN;
    s.async = true;
    s.integrity = THREE_CDN_SRI;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Three.js CDN load failed (SRI or network)"));
    document.head.appendChild(s);
  });
}

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
  const mobile = isMobileUi();
  DESKTOP_ICONS.forEach((data) => {
    const el = document.createElement("div");
    el.className = "desk-icon";
    el.style.left = data.x + "px";
    el.style.top = data.y + "px";
    el.dataset.app = data.id;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `Open ${data.label}`);
    el.innerHTML = `<div class="glyph">${data.glyph}</div><div class="label">${data.label}</div>`;

    const select = () => {
      layer.querySelectorAll(".desk-icon").forEach((i) => i.classList.remove("selected"));
      el.classList.add("selected");
    };

    // Mobile / coarse pointer: single tap opens (dblclick is unreliable on touch)
    if (mobile) {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        select();
        openApp(data.id);
      });
    } else {
      el.addEventListener("click", () => select());
      el.addEventListener("dblclick", () => openApp(data.id));
    }
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openApp(data.id);
      }
    });
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

function wireSeoPanel() {
  const main = document.getElementById("seo-main");
  const btn = document.getElementById("seo-minimize");
  if (!main || !btn) return;
  const key = "asx-seo-panel-min";
  const apply = (min) => {
    main.classList.toggle("seo-minimized", min);
    btn.textContent = min ? "Expand about" : "Minimize panel";
    try {
      localStorage.setItem(key, min ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  try {
    if (localStorage.getItem(key) === "1") apply(true);
  } catch {
    /* ignore */
  }
  btn.addEventListener("click", () => {
    apply(!main.classList.contains("seo-minimized"));
  });
}

async function main() {
  applyMobileClass();
  window.addEventListener("resize", applyMobileClass);
  window.addEventListener("orientationchange", () => setTimeout(applyMobileClass, 100));

  wireSeoPanel();
  // On mobile, default SEO panel minimized so icons are usable
  if (isMobileUi()) {
    try {
      if (localStorage.getItem("asx-seo-panel-min") == null) {
        localStorage.setItem("asx-seo-panel-min", "1");
      }
    } catch {
      /* ignore */
    }
  }
  await bootSplash();

  // Desktop shell first; Three.js after paint (SEO + LCP)
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

  layer?.addEventListener("click", (e) => {
    if (e.target === layer) {
      layer.querySelectorAll(".desk-icon").forEach((i) => i.classList.remove("selected"));
    }
  });

  clock();
  // Auto-open terminal on desktop only — on mobile it steals the whole screen
  if (!isMobileUi()) {
    setTimeout(() => open("terminal"), 400);
  }

  /**
   * Background dual-path:
   * - Smallest width / save-data / ?bg=ambient → D3/SVG ambient (no WebGL)
   * - Else Three.js with context-lost → ambient fallback
   * - ?bg=three forces Three attempt
   */
  const startBg = async () => {
    const useAmbient = shouldUseAmbientBg();
    if (useAmbient) {
      try {
        await initAmbientD3Bg("three-bg");
        console.info("ASX bg: ambient (D3/SVG) — small-screen / save-data path");
        return;
      } catch (err) {
        console.warn("ASX ambient bg failed", err);
      }
    }
    try {
      await loadThreeJs();
      const handle = initThreeBg("three-bg", {
        onContextLost: () => {
          initAmbientD3Bg("three-bg").catch((e) =>
            console.warn("ASX ambient after context lost failed", e)
          );
        },
      });
      if (!handle) {
        await initAmbientD3Bg("three-bg");
        console.info("ASX bg: ambient fallback (Three unavailable)");
      } else {
        // Drag empty desktop (not icons) to orbit Earth; release resumes satellite spin
        if (layer && typeof handle.bindOrbitTarget === "function") {
          handle.bindOrbitTarget(layer);
        }
        console.info("ASX bg: three.js Earth satellite view");
      }
    } catch (err) {
      console.warn("ASX Three.js background skipped", err);
      try {
        await initAmbientD3Bg("three-bg");
      } catch (e2) {
        console.warn("ASX ambient fallback failed", e2);
      }
    }
  };
  // Mobile: defer bg so shell paints first
  const bgTimeout = isMobileUi() ? 1800 : 1200;
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => {
      startBg();
    }, { timeout: bgTimeout });
  } else {
    setTimeout(startBg, isMobileUi() ? 200 : 0);
  }
}

main().catch((err) => {
  console.error("ASX Desktop boot failed", err);
  const splash = document.getElementById("boot-splash");
  const sub = document.querySelector("#boot-splash .sub");
  if (sub) {
    sub.textContent =
      "Boot error — " + (err && err.message ? err.message : "see console");
  }
  if (splash) {
    splash.classList.remove("gone");
    splash.style.opacity = "1";
    splash.style.pointerEvents = "auto";
  }
});
