/**
 * ASX Desktop OS — boot, icons, taskbar, start menu.
 * SEO: Three.js loaded dynamically after first paint (not blocking HTML content).
 * Mobile: tap-to-open, asx-mobile class, layout hints (2026-08-10).
 *
 * Resource policy: major CDNs deliver vendor assets first; our origin is shell +
 * fallback only (docs/RESOURCE_CDN_POLICY.md). Offload delivery to their edges.
 */
import { initThreeBg, shouldUseAmbientBg } from "./three-bg.js?v=20260810t251500z";
import { initAmbientD3Bg } from "./ambient-d3-bg.js?v=20260810t251500z";
import { WindowManager } from "./wm.js?v=20260810t251500z";
import { registerApps, APP_CATALOG, APP_CATEGORIES } from "./apps.js?v=20260810t251500z";
import {
  initPresence,
  initSessionTimer,
  initTravelingEyes,
  bindShowDesktop,
  restoreLockIfNeeded,
  promptLock,
  showShutdownScreen,
  showRebootScreen,
  showLogoutScreen,
} from "./shell-chrome.js?v=20260810t251500z";
import { runGlassGate } from "./glass-gate.js?v=20260810t251500z";

/**
 * Three.js: public CDNs only — never our origin.
 * #1 Cloudflare via cdnjs → #2 jsDelivr → #3 unpkg
 * (alisonscorpion.com is not in this chain; rank #4 is shell-only.)
 */
const THREE_SOURCES = [
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
  "https://unpkg.com/three@0.128.0/build/three.min.js",
];
/** Hermes H3-08 / T-05: SRI for cdnjs r128 three.min.js only (first URL) */
const THREE_CDN_SRI =
  "sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu";

/**
 * Clean desktop — only core places (inspired by Alison's Linux layout, not a replica).
 * Everything else lives under Applications/ by category.
 * Trash badge count is cosmetic (ASX "active") — contents always permission-denied.
 */
function trashBadgeCount() {
  // Stable-ish per session, 2–5 items so Trash looks used
  try {
    const k = "asx-trash-badge";
    let n = parseInt(sessionStorage.getItem(k), 10);
    if (!(n >= 2 && n <= 7)) {
      n = 2 + Math.floor(Math.random() * 4);
      sessionStorage.setItem(k, String(n));
    }
    return n;
  } catch {
    return 3;
  }
}

const TRASH_N = trashBadgeCount();

/** Left column, top → bottom — organized workstation */
const DESKTOP_ICONS = [
  { id: "terminal", label: "Terminal", glyph: "❯", x: 18, y: 16 },
  { id: "computer", label: "Computer", glyph: "🖥", x: 18, y: 108 },
  { id: "browser", label: "Browser", glyph: "🌐", x: 18, y: 200 },
  { id: "chat", label: "Chat", glyph: "💬", x: 18, y: 292 },
  {
    id: "trash",
    label: `Trash (${TRASH_N})`,
    glyph: "🗑",
    x: 18,
    y: 384,
    badge: TRASH_N,
  },
  { id: "network", label: "Network", glyph: "🖧", x: 18, y: 476 },
  { id: "gdrive", label: "GDrive", glyph: "☁", x: 18, y: 568 },
  { id: "applications", label: "Applications", glyph: "📦", x: 110, y: 16 },
  { id: "agent-asx", label: "Agent ASX", glyph: "α", x: 110, y: 108, agent: true },
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
  const inject = (src, useSri) =>
    new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      if (useSri) {
        s.integrity = THREE_CDN_SRI;
        s.crossOrigin = "anonymous";
      } else {
        s.crossOrigin = "anonymous";
      }
      s.referrerPolicy = "no-referrer";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Three.js load failed: " + src));
      document.head.appendChild(s);
    });
  // Walk major CDNs only — never fall back to our origin for vendor JS
  let chain = Promise.reject(new Error("start"));
  THREE_SOURCES.forEach((src, i) => {
    chain = chain.catch(() => inject(src, i === 0));
  });
  return chain;
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
    el.className = "desk-icon" + (data.agent ? " desk-icon-agent" : "");
    el.style.left = data.x + "px";
    el.style.top = data.y + "px";
    el.dataset.app = data.id;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `Open ${data.label}`);
    const badge =
      data.badge != null
        ? `<span class="desk-badge" aria-hidden="true">${data.badge}</span>`
        : "";
    el.innerHTML = `<div class="glyph">${data.glyph}${badge}</div><div class="label">${data.label}</div>`;

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
  menu.innerHTML = `<h3>◆ Alison's desktop</h3>
    <div class="sm-item" data-go="applications"><span class="g">📦</span><span>Applications</span></div>
    <div class="sm-sep"></div>`;
  // Categorized (same as Applications folder)
  (APP_CATEGORIES || []).forEach((cat) => {
    const h = document.createElement("div");
    h.className = "sm-cat";
    h.textContent = cat.label;
    menu.appendChild(h);
    (cat.apps || []).forEach((id) => {
      const app = APP_CATALOG.find((a) => a.id === id);
      if (!app) return;
      const row = document.createElement("div");
      row.className = "sm-item";
      row.innerHTML = `<span class="g">${app.glyph}</span><span>${app.label}</span>`;
      row.addEventListener("click", () => {
        openApp(app.id);
        menu.classList.remove("open");
      });
      menu.appendChild(row);
    });
  });
  menu.querySelector('[data-go="applications"]')?.addEventListener("click", () => {
    openApp("applications");
    menu.classList.remove("open");
  });

  // Linux-style power bar (buttons only)
  const power = document.createElement("div");
  power.className = "sm-power";
  power.setAttribute("role", "group");
  power.setAttribute("aria-label", "Power");
  power.innerHTML = `
    <button type="button" data-power="shutdown" title="Shut down">Shut down</button>
    <button type="button" data-power="reboot" title="Reboot">Reboot</button>
    <button type="button" data-power="logout" title="Log out">Logout</button>
    <button type="button" data-power="lock" title="Lock screen">Lock</button>`;
  power.querySelectorAll("[data-power]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.remove("open");
      const act = btn.getAttribute("data-power");
      if (act === "shutdown") showShutdownScreen();
      else if (act === "reboot") showRebootScreen();
      else if (act === "logout") showLogoutScreen();
      else if (act === "lock") promptLock();
    });
  });
  menu.appendChild(power);
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
  // Zero-inspired glass captcha (draw circle) → then boot splash → desktop
  await runGlassGate();
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
  // Taskbar widgets (no safety/hosts fetch here)
  initPresence(document.getElementById("tb-visitors"));
  initSessionTimer(document.getElementById("tb-session"));
  initTravelingEyes(document.getElementById("tb-eyes"));
  bindShowDesktop(document.getElementById("tb-show-desktop"), wm);
  restoreLockIfNeeded();

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
