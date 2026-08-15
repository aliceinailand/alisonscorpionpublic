/**
 * ASX Desktop OS — boot, icons, taskbar, start menu.
 * SEO: Three.js loaded dynamically after first paint (not blocking HTML content).
 * Mobile: tap-to-open, asx-mobile class, layout hints (2026-08-10).
 *
 * Resource policy: major CDNs deliver vendor assets first; our origin is shell +
 * fallback only (docs/RESOURCE_CDN_POLICY.md). Offload delivery to their edges.
 *
 * Multi-AI Convergence: Alice (Matthew Gates), Grok, Claude, Gemini, ChatGPT, and Copilot.
 * Public repo: https://github.com/aliceinailand/alisonscorpionpublic
 */
import { initThreeBg, shouldUseAmbientBg } from "./three-bg.js?v=20260810t480000z";
import { initAmbientD3Bg } from "./ambient-d3-bg.js?v=20260810t480000z";
import { initSpaceBg, syncSpaceBg } from "./space-bg.js?v=20260815t210000z";
import { WindowManager } from "./wm.js?v=20260815t231500z";
import {
  applyCapabilityClasses,
  initOutdatedBrowserBanner,
  shouldUseLiteMode,
  watchCapabilityResize,
  isMobileUi as isMobileUiCap,
} from "./browser-capability.js?v=20260811t010000z";
import { registerApps, APP_CATALOG, APP_CATEGORIES } from "./apps.js?v=20260815t221800z";
import {
  initPresence,
  initSessionTimer,
  initTravelingEyes,
  initNetworkStatus,
  bindShowDesktop,
  restoreLockIfNeeded,
  promptLock,
  showShutdownScreen,
  showRebootScreen,
  showLogoutScreen,
} from "./shell-chrome.js?v=20260811t140000z";
import {
  ensureGuestSession,
  paintGuestStatus,
  resolveWhoami,
} from "./guest-session.js?v=20260811t140000z";
import { getSessionUser } from "./accounts.js?v=20260810t250000z";
import { initTheme } from "./themes.js?v=20260815t210000z";
import {
  initPrefs,
  getPrefs,
  setPrefs,
  setPref,
  resetPrefs,
  onPrefsChange,
  snapIcon,
} from "./prefs.js?v=20260815t210000z";
import {
  showMenu,
  closeMenus,
  pickLocalFiles,
  fileToDataUrl,
} from "./menus.js?v=20260815t220000z";
import { ensureDomPurify, sanitizeHtml, escapeHtml } from "./sanitize.js?v=20260810t480000z";
import { initBrowserFs } from "./fs.js?v=20260810t480000z";
import { initHashRouter, setAppRoute } from "./hash-router.js?v=20260810t480000z";
import { ensureJsLite } from "./dom-lite.js?v=20260810t480000z";
import { initFastClick } from "./touch-boost.js?v=20260810t480000z";

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

/**
 * Left column, top → bottom — organized workstation.
 * Browser + Terminal live under Applications (not on the desktop face).
 */
const DESKTOP_ICONS = [
  { id: "computer", label: "Computer", glyph: "🖥", x: 18, y: 16 },
  { id: "games", label: "Games", glyph: "🎮", x: 18, y: 108 },
  { id: "chat", label: "Chat", glyph: "💬", x: 18, y: 200 },
  {
    id: "trash",
    label: `Trash (${TRASH_N})`,
    glyph: "🗑",
    x: 18,
    y: 292,
    badge: TRASH_N,
  },
  { id: "network", label: "Network", glyph: "🖧", x: 18, y: 384 },
  { id: "applications", label: "Applications", glyph: "📦", x: 110, y: 16 },
  { id: "agent-asx", label: "Agent", glyph: "α", x: 110, y: 108, agent: true },
  { id: "github", label: "GitHub", glyph: "⌥", x: 110, y: 200 },
  { id: "gdrive", label: "GDrive", glyph: "☁", x: 110, y: 292 },
  { id: "camera", label: "Camera", glyph: "📷", x: 110, y: 384 },
];

function isMobileUi() {
  return isMobileUiCap();
}

function applyMobileClass() {
  applyCapabilityClasses();
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

function allDesktopIcons() {
  const prefs = getPrefs();
  const extras = (prefs.shortcuts || []).map((s, i) => ({
    id: s.id,
    app: s.app,
    label: s.label,
    glyph: s.glyph,
    x: 202,
    y: 16 + i * 92,
    shortcut: true,
  }));
  return [
    ...DESKTOP_ICONS.map((d) => ({ ...d, app: d.id })),
    ...extras,
  ];
}

function placeIcons(layer, openApp) {
  const mobile = isMobileUi();
  const prefs = getPrefs();
  layer.querySelectorAll(".desk-icon").forEach((n) => n.remove());

  allDesktopIcons().forEach((data) => {
    if ((prefs.hiddenIcons || []).includes(data.id)) return;
    const el = document.createElement("div");
    el.className = "desk-icon" + (data.agent ? " desk-icon-agent" : "");
    const saved = prefs.iconPos?.[data.id];
    const x = saved && Number.isFinite(saved.x) ? saved.x : data.x;
    const y = saved && Number.isFinite(saved.y) ? saved.y : data.y;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.dataset.app = data.app || data.id;
    el.dataset.iconId = data.id;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `Open ${data.label}`);
    const badge =
      data.badge != null
        ? `<span class="desk-badge" aria-hidden="true">${escapeHtml(String(data.badge))}</span>`
        : "";
    el.innerHTML = sanitizeHtml(
      `<div class="glyph">${escapeHtml(data.glyph)}${badge}</div><div class="label">${escapeHtml(
        data.label
      )}</div>`
    );

    const select = () => {
      layer.querySelectorAll(".desk-icon").forEach((i) => i.classList.remove("selected"));
      el.classList.add("selected");
    };

    let dragged = false;
    const allowDrag = !mobile && !matchMedia("(pointer: coarse)").matches;
    if (allowDrag) {
      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        select();
        dragged = false;
        const sx = e.clientX;
        const sy = e.clientY;
        const sl = parseInt(el.style.left, 10) || 0;
        const st = parseInt(el.style.top, 10) || 0;
        const onMove = (ev) => {
          if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
          dragged = true;
          el.classList.add("is-dragging");
          el.style.left = sl + ev.clientX - sx + "px";
          el.style.top = st + ev.clientY - sy + "px";
        };
        const onUp = () => {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          el.classList.remove("is-dragging");
          if (!dragged) return;
          let nx = parseInt(el.style.left, 10) || 0;
          let ny = parseInt(el.style.top, 10) || 0;
          if (getPrefs().iconSnap) {
            const s = snapIcon(nx, ny);
            nx = s.x;
            ny = s.y;
            el.style.left = nx + "px";
            el.style.top = ny + "px";
          }
          const pos = { ...getPrefs().iconPos, [data.id]: { x: nx, y: ny } };
          setPrefs({ iconPos: pos });
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
      });
    }

    const launch = () => {
      if (dragged) return;
      openApp(data.app || data.id);
    };

    // Mobile / coarse pointer: single tap opens (dblclick is unreliable on touch)
    if (mobile) {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        select();
        launch();
      });
    } else {
      el.addEventListener("click", (e) => {
        if (dragged) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        select();
      });
      el.addEventListener("dblclick", launch);
    }
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        launch();
      }
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      select();
      showIconMenu(e, data, openApp, layer);
    });
    layer.appendChild(el);
  });
}

function showIconMenu(e, data, openApp, layer) {
  const prefs = getPrefs();
  const appId = data.app || data.id;
  showMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: "Open", kbd: "Enter", action: () => openApp(appId) },
      { label: "Open Settings", action: () => openApp("settings") },
      { sep: true },
      {
        label: "Hide from desktop",
        action: () => {
          const hidden = [...new Set([...(prefs.hiddenIcons || []), data.id])];
          setPrefs({ hiddenIcons: hidden });
          placeIcons(layer, openApp);
        },
      },
      data.shortcut
        ? {
            label: "Remove shortcut",
            action: () => {
              setPrefs({
                shortcuts: (getPrefs().shortcuts || []).filter((s) => s.id !== data.id),
              });
              placeIcons(layer, openApp);
            },
          }
        : {
            label: "Reset position",
            action: () => {
              const pos = { ...getPrefs().iconPos };
              delete pos[data.id];
              setPrefs({ iconPos: pos });
              placeIcons(layer, openApp);
            },
          },
      { sep: true },
      {
        label: "Properties",
        action: () => {
          window.alert(
            `${data.label}\n\nType: ${data.shortcut ? "shortcut" : "desktop place"}\nOpens: ${appId}\nThis is Alison's guest desktop — not the host disk.`
          );
        },
      },
    ],
  });
}

async function pickWallpaperImage() {
  const files = await pickLocalFiles({ accept: "image/*" });
  const f = files[0];
  if (!f) return;
  try {
    const url = await fileToDataUrl(f);
    setPrefs({ wallpaper: "image", wallImage: url });
  } catch (err) {
    window.alert(err?.message || "Could not use that image");
  }
}

function showDesktopMenu(e, openApp, layer) {
  const prefs = getPrefs();
  const catalog = (window.ASX?.desktop?.control?.listApps?.().catalog) || [];
  showMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      {
        label: "Create new",
        submenu: [
          { label: "Text file…", action: () => openApp("files") },
          { label: "Folder…", action: () => openApp("files") },
          { sep: true },
          {
            label: "Shortcut to app",
            submenu: catalog.slice(0, 24).map((a) => ({
              label: a.label,
              icon: a.glyph,
              action: () => {
                const id = "sc-" + a.id + "-" + Date.now().toString(36);
                setPrefs({
                  shortcuts: [
                    ...(getPrefs().shortcuts || []),
                    { id, app: a.id, label: a.label, glyph: a.glyph || "◆" },
                  ],
                });
                placeIcons(layer, openApp);
              },
            })),
          },
        ],
      },
      { sep: true },
      {
        label: "Icon size",
        submenu: [
          {
            label: "Small",
            checked: prefs.iconSize === "small",
            action: () => setPref("iconSize", "small"),
          },
          {
            label: "Medium",
            checked: prefs.iconSize === "medium",
            action: () => setPref("iconSize", "medium"),
          },
          {
            label: "Large",
            checked: prefs.iconSize === "large",
            action: () => setPref("iconSize", "large"),
          },
        ],
      },
      {
        label: "Show icon labels",
        checked: !!prefs.iconLabels,
        action: () => setPref("iconLabels", !prefs.iconLabels),
      },
      {
        label: "Snap icons to grid",
        checked: !!prefs.iconSnap,
        action: () => setPref("iconSnap", !prefs.iconSnap),
      },
      {
        label: "Arrange icons",
        submenu: [
          {
            label: "Reset positions",
            action: () => {
              setPrefs({ iconPos: {} });
              placeIcons(layer, openApp);
            },
          },
          {
            label: "Show hidden icons",
            action: () => {
              setPrefs({ hiddenIcons: [] });
              placeIcons(layer, openApp);
            },
          },
        ],
      },
      { sep: true },
      {
        label: "Look & feel",
        submenu: [
          {
            label: "Ultra thin",
            checked: prefs.theme === "ultra-thin",
            action: () => setPref("theme", "ultra-thin"),
          },
          {
            label: "Thin terminal",
            checked: prefs.theme === "thin-terminal",
            action: () => setPref("theme", "thin-terminal"),
          },
          {
            label: "Medium",
            checked: prefs.theme === "medium-chrome",
            action: () => setPref("theme", "medium-chrome"),
          },
          {
            label: "Thick panel",
            checked: prefs.theme === "thick-panel",
            action: () => setPref("theme", "thick-panel"),
          },
        ],
      },
      {
        label: "Change wallpaper",
        submenu: [
          {
            label: "Earth (Three.js)",
            checked: prefs.wallpaper === "earth",
            action: () => setPref("wallpaper", "earth"),
          },
          {
            label: "Travel through space",
            checked: prefs.wallpaper === "travel",
            action: () => setPref("wallpaper", "travel"),
          },
          {
            label: "Stars only",
            checked: prefs.wallpaper === "stars",
            action: () => setPref("wallpaper", "stars"),
          },
          {
            label: "Universe void",
            checked: prefs.wallpaper === "void",
            action: () => setPref("wallpaper", "void"),
          },
          {
            label: "Nebula",
            checked: prefs.wallpaper === "nebula",
            action: () => setPref("wallpaper", "nebula"),
          },
          { sep: true },
          { label: "Image from this device…", action: () => pickWallpaperImage() },
        ],
      },
      {
        label: "Desktop settings",
        action: () => openApp("settings", { section: "desktop" }),
      },
      {
        label: "Appearance",
        action: () => openApp("settings", { section: "appearance" }),
      },
      { sep: true },
      { label: "Refresh", action: () => placeIcons(layer, openApp) },
      { label: "Open Terminal", action: () => openApp("terminal") },
      { label: "Settings", action: () => openApp("settings") },
    ],
  });
}

function showTaskbarMenu(e, openApp) {
  const prefs = getPrefs();
  showMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      {
        label: "Taskbar position",
        submenu: [
          {
            label: "Bottom",
            checked: prefs.taskbarPos === "bottom",
            action: () => setPref("taskbarPos", "bottom"),
          },
          {
            label: "Top",
            checked: prefs.taskbarPos === "top",
            action: () => setPref("taskbarPos", "top"),
          },
        ],
      },
      {
        label: "Auto-hide taskbar",
        checked: !!prefs.taskbarAutohide,
        action: () => setPref("taskbarAutohide", !prefs.taskbarAutohide),
      },
      {
        label: "24-hour clock",
        checked: !prefs.clock12,
        action: () => setPref("clock12", !prefs.clock12),
      },
      { sep: true },
      {
        label: "Show visitors",
        checked: !!prefs.showVisitors,
        action: () => setPref("showVisitors", !prefs.showVisitors),
      },
      {
        label: "Show session timer",
        checked: !!prefs.showSession,
        action: () => setPref("showSession", !prefs.showSession),
      },
      {
        label: "Show network",
        checked: !!prefs.showNetwork,
        action: () => setPref("showNetwork", !prefs.showNetwork),
      },
      {
        label: "Show traveling eyes",
        checked: !!prefs.showEyes,
        action: () => setPref("showEyes", !prefs.showEyes),
      },
      { sep: true },
      { label: "Settings", action: () => openApp("settings", { section: "taskbar" }) },
    ],
  });
}

function buildStartMenu(menu, openApp) {
  menu.innerHTML = `<h3>◆ Alison's desktop</h3>
    <div class="sm-item" data-go="settings"><span class="g">⚙</span><span>Settings</span></div>
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
      row.innerHTML = sanitizeHtml(
        `<span class="g">${escapeHtml(app.glyph)}</span><span>${escapeHtml(app.label)}</span>`
      );
      row.addEventListener("click", () => {
        openApp(app.id);
        menu.classList.remove("open");
        document.body.classList.remove("start-open");
      });
      menu.appendChild(row);
    });
  });
  menu.querySelector('[data-go="applications"]')?.addEventListener("click", () => {
    openApp("applications");
    menu.classList.remove("open");
    document.body.classList.remove("start-open");
  });
  menu.querySelector('[data-go="settings"]')?.addEventListener("click", () => {
    openApp("settings");
    menu.classList.remove("open");
    document.body.classList.remove("start-open");
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
      document.body.classList.remove("start-open");
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
    el.textContent = n.toLocaleTimeString(undefined, { hour12: !!getPrefs().clock12 });
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
  // Thin terminal glass is default; guest prefs override (theme, wallpaper, chrome)
  initTheme();
  initPrefs();
  initSpaceBg();
  syncSpaceBg(getPrefs().wallpaper);
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
  // Boot splash → desktop (no pre-desktop captcha / hand gate)
  await bootSplash();

  // DOMPurify layer warm before any window HTML (cdnjs → jsDelivr; soft-fail OK)
  await ensureDomPurify();
  // BrowserFS guest VFS (IndexedDB) — soft-fail → static skeleton only
  await initBrowserFs();
  // JSLite (not jQuery) — optional $ API for free apps; core shell stays vanilla
  ensureJsLite().catch(() => {});
  // FastClick on touch / coarse-pointer only (speeds taps; desktop mouse skipped)
  initFastClick().catch(() => {});

  // Desktop shell first; Three.js after paint (SEO + LCP)
  const wm = new WindowManager({
    rootId: "windows-root",
    taskbarId: "taskbar-windows",
  });
  const { open: openRaw } = registerApps(wm);
  /** Open app + sync Hasher deep-link (#app/…) for history / shareable URLs */
  const open = (id, opts = {}) => {
    openRaw(id, opts);
    try {
      setAppRoute(id, opts);
    } catch {
      /* ignore */
    }
  };

  /**
   * Free apps are guest-usable now. Construct may later call this surface to
   * open tools and give the illusion of using them (see docs/free_apps_and_construct.md).
   */
  try {
    window.ASX = window.ASX || {};
    window.ASX.desktop = {
      version: "2026-08-11",
      control: {
        open: (appId, opts) => open(appId, opts || {}),
        focus: (appId) => {
          open(appId);
        },
        close: (appId) => {
          try {
            wm.close?.(String(appId || ""));
          } catch {
            /* ignore */
          }
        },
        isOpen: (appId) => {
          try {
            return !!wm.windows?.has?.(String(appId || ""));
          } catch {
            return false;
          }
        },
        listApps: () => ({
          catalog: APP_CATALOG.map((a) => ({ id: a.id, label: a.label, glyph: a.glyph })),
          categories: APP_CATEGORIES.map((c) => ({
            id: c.id,
            label: c.label,
            apps: [...(c.apps || [])],
          })),
        }),
        prefs: {
          get: getPrefs,
          set: setPrefs,
          reset: resetPrefs,
        },
      },
    };
  } catch {
    /* ignore */
  }

  // Hasher (js-signals) hash router — #app/files, #app/browser, …
  await initHashRouter({ open, catalog: APP_CATALOG });

  const layer = document.getElementById("desktop-layer");
  placeIcons(layer, open);
  placeIcons._sig = JSON.stringify({
    h: getPrefs().hiddenIcons,
    s: getPrefs().shortcuts,
    i: getPrefs().iconPos,
  });
  onPrefsChange((p) => {
    const sig = JSON.stringify({
      h: p.hiddenIcons,
      s: p.shortcuts,
      i: p.iconPos,
    });
    if (placeIcons._sig && placeIcons._sig !== sig) placeIcons(layer, open);
    placeIcons._sig = sig;
  });

  const menu = document.getElementById("start-menu");
  buildStartMenu(menu, open);

  document.getElementById("tb-start")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeMenus();
    menu.classList.toggle("open");
    document.body.classList.toggle("start-open", menu.classList.contains("open"));
  });
  document.getElementById("tb-start")?.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Settings", action: () => open("settings") },
        { label: "Applications", action: () => open("applications") },
        { sep: true },
        { label: "Lock screen", action: () => promptLock() },
      ],
    });
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target.id !== "tb-start") {
      menu.classList.remove("open");
      document.body.classList.remove("start-open");
    }
  });

  layer?.addEventListener("click", (e) => {
    if (e.target === layer) {
      layer.querySelectorAll(".desk-icon").forEach((i) => i.classList.remove("selected"));
      closeMenus();
    }
  });
  layer?.addEventListener("contextmenu", (e) => {
    if (e.target !== layer && !e.target.classList.contains("desk-icon")) {
      if (e.target.closest?.(".desk-icon")) return;
    }
    if (e.target !== layer) return;
    e.preventDefault();
    showDesktopMenu(e, open, layer);
  });
  document.getElementById("taskbar")?.addEventListener("contextmenu", (e) => {
    if (e.target.closest("#tb-start") || e.target.closest("#taskbar-windows")) return;
    e.preventDefault();
    showTaskbarMenu(e, open);
  });

  clock();
  // Guest identity: asxguest-#### (auto session; no login wall)
  const guest = ensureGuestSession();
  paintGuestStatus(
    document.querySelector(".tb-status"),
    resolveWhoami(getSessionUser())
  );
  try {
    window.ASX = window.ASX || {};
    window.ASX.guest = guest;
  } catch {
    /* ignore */
  }
  // Taskbar widgets (no safety/hosts fetch here)
  initPresence(document.getElementById("tb-visitors"));
  initSessionTimer(document.getElementById("tb-session"));
  initNetworkStatus(document.getElementById("tb-net"));
  initTravelingEyes(document.getElementById("tb-eyes"));
  bindShowDesktop(document.getElementById("tb-show-desktop"), wm);
  restoreLockIfNeeded();
  // Do not auto-open Terminal — clean desktop until the guest opens something.

  /**
   * Background dual-path:
   * - Lite / phone / tiny width / save-data / no WebGL / ?bg=ambient → D3/SVG (no Three)
   * - Else Three.js with context-lost → ambient fallback
   * - ?bg=three forces Three attempt
   * - Resize to smallest (≤420) re-enters ambient via watchCapabilityResize
   * - outdated-browser-rework (CDNJS) may show upgrade banner on old UAs
   */
  let bgMode = null; // "ambient" | "three"
  let threeHandle = null;

  const startAmbient = async (reason) => {
    try {
      await initAmbientD3Bg("three-bg");
      bgMode = "ambient";
      threeHandle = null;
      console.info("ASX bg: ambient (D3/SVG) —", reason);
    } catch (err) {
      console.warn("ASX ambient bg failed", err);
    }
  };

  const startThree = async () => {
    try {
      await loadThreeJs();
      const handle = initThreeBg("three-bg", {
        onContextLost: () => {
          startAmbient("webgl-context-lost");
        },
      });
      if (!handle) {
        await startAmbient("three-unavailable");
        return;
      }
      threeHandle = handle;
      bgMode = "three";
      if (layer && typeof handle.bindOrbitTarget === "function") {
        handle.bindOrbitTarget(layer);
      }
      console.info("ASX bg: three.js Earth satellite view");
    } catch (err) {
      console.warn("ASX Three.js background skipped", err);
      await startAmbient("three-load-error");
    }
  };

  const startBg = async () => {
    applyCapabilityClasses();
    const useAmbient = shouldUseAmbientBg() || shouldUseLiteMode();
    if (useAmbient) {
      await startAmbient("lite/small-screen/save-data/no-webgl");
      return;
    }
    await startThree();
  };

  // Old-browser upgrade notice (CDN soft-fail)
  initOutdatedBrowserBanner().catch(() => {});

  // Responsive: enter lite/ambient when viewport shrinks to smallest (once per transition)
  let wasLite = shouldUseLiteMode();
  watchCapabilityResize((state) => {
    applyCapabilityClasses();
    if (state.lite && !wasLite && bgMode === "three") {
      startAmbient("resize-to-lite");
    }
    wasLite = state.lite;
  });

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
