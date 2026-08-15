/**
 * ASX Desktop preferences — almost everything on the guest desktop is
 * customizable and persisted in this browser (localStorage).
 *
 * Selecting an option applies in-place. Menus do not spawn a new window
 * just to flip a setting (Lubuntuesque File / Settings menus).
 */
import { applyTheme, getTheme, normalizeTheme } from "./themes.js?v=20260815t210000z";

export const PREFS_KEY = "asx-desktop-prefs-v1";

export const WALLPAPERS = [
  { id: "earth", label: "Earth (Three.js)", hint: "Satellite Earth + stars" },
  { id: "travel", label: "Travel through space", hint: "Stars fly toward you" },
  { id: "stars", label: "Stars only", hint: "Night sky, hide the globe" },
  { id: "void", label: "Universe void", hint: "Brand purple night" },
  { id: "nebula", label: "Nebula gradient", hint: "Violet / gold wash" },
  { id: "solid", label: "Solid color", hint: "Pick any color" },
  { id: "image", label: "Image from this device", hint: "Uses your OS file picker" },
];

export const ICON_SIZES = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

export const ACCENTS = [
  { id: "#7c3aed", label: "Universe purple" },
  { id: "#2563eb", label: "Blue" },
  { id: "#0d9488", label: "Teal" },
  { id: "#c8a35a", label: "Gold" },
  { id: "#dc2626", label: "Red" },
  { id: "#ea580c", label: "Orange" },
  { id: "#16a34a", label: "Green" },
  { id: "#db2777", label: "Pink" },
];

/** @typedef {ReturnType<typeof defaults>} DesktopPrefs */

function defaults() {
  return {
    theme: "thin-terminal",
    wallpaper: "earth",
    wallColor: "#0a0618",
    wallImage: "",
    accent: "#7c3aed",
    windowOpacity: 0.36,
    fontScale: 1,
    iconSize: "medium",
    iconLabels: true,
    iconSnap: true,
    hiddenIcons: /** @type {string[]} */ ([]),
    iconPos: /** @type {Record<string, {x:number,y:number}>} */ ({}),
    shortcuts: /** @type {{id:string,app:string,label:string,glyph:string}[]} */ ([]),
    taskbarPos: "bottom",
    taskbarAutohide: false,
    clock12: false,
    seoPanel: true,
    showNetwork: true,
    showVisitors: true,
    showEyes: true,
    showSession: true,
    filesView: "list",
  };
}

const listeners = new Set();

function safeParse(raw) {
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

function hexOk(s) {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return { r: 124, g: 58, b: 237 };
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}

function lighten(hex, amt = 0.22) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amt);
  return `#${[mix(r), mix(g), mix(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function getPrefs() {
  const out = defaults();
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      out.theme = getTheme();
      return out;
    }
    const o = safeParse(raw);
    if (o.theme) out.theme = normalizeTheme(o.theme);
    if (WALLPAPERS.some((w) => w.id === o.wallpaper)) out.wallpaper = o.wallpaper;
    if (hexOk(o.wallColor)) out.wallColor = o.wallColor;
    if (typeof o.wallImage === "string" && o.wallImage.startsWith("data:image/")) {
      out.wallImage = o.wallImage.slice(0, 1_800_000);
    }
    if (hexOk(o.accent)) out.accent = o.accent;
    if (Number.isFinite(Number(o.windowOpacity))) {
      out.windowOpacity = clamp(o.windowOpacity, 0.12, 0.92);
    }
    if (Number.isFinite(Number(o.fontScale))) {
      out.fontScale = clamp(o.fontScale, 0.85, 1.3);
    }
    if (ICON_SIZES.some((s) => s.id === o.iconSize)) out.iconSize = o.iconSize;
    if (typeof o.iconLabels === "boolean") out.iconLabels = o.iconLabels;
    if (typeof o.iconSnap === "boolean") out.iconSnap = o.iconSnap;
    if (Array.isArray(o.hiddenIcons)) {
      out.hiddenIcons = o.hiddenIcons.map(String).slice(0, 40);
    }
    if (o.iconPos && typeof o.iconPos === "object") {
      for (const [k, v] of Object.entries(o.iconPos)) {
        if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) {
          out.iconPos[k] = { x: Math.round(v.x), y: Math.round(v.y) };
        }
      }
    }
    if (Array.isArray(o.shortcuts)) {
      out.shortcuts = o.shortcuts
        .filter((s) => s && s.id && s.app)
        .slice(0, 16)
        .map((s) => ({
          id: String(s.id).slice(0, 40),
          app: String(s.app).slice(0, 40),
          label: String(s.label || s.app).slice(0, 32),
          glyph: String(s.glyph || "◆").slice(0, 4),
        }));
    }
    if (o.taskbarPos === "top" || o.taskbarPos === "bottom") out.taskbarPos = o.taskbarPos;
    if (typeof o.taskbarAutohide === "boolean") out.taskbarAutohide = o.taskbarAutohide;
    if (typeof o.clock12 === "boolean") out.clock12 = o.clock12;
    if (typeof o.seoPanel === "boolean") out.seoPanel = o.seoPanel;
    if (typeof o.showNetwork === "boolean") out.showNetwork = o.showNetwork;
    if (typeof o.showVisitors === "boolean") out.showVisitors = o.showVisitors;
    if (typeof o.showEyes === "boolean") out.showEyes = o.showEyes;
    if (typeof o.showSession === "boolean") out.showSession = o.showSession;
    if (o.filesView === "icons" || o.filesView === "list") out.filesView = o.filesView;
  } catch {
    /* private mode */
  }
  return out;
}

function persist(p) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* quota / private */
  }
}

/**
 * Merge a partial update, persist, apply to the live desktop, notify listeners.
 * @param {Partial<DesktopPrefs>} patch
 */
export function setPrefs(patch) {
  const next = { ...getPrefs(), ...(patch || {}) };
  persist(next);
  applyPrefs(next);
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* listener */
    }
  });
  return next;
}

export function setPref(key, value) {
  return setPrefs({ [key]: value });
}

export function resetPrefs() {
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch {
    /* ignore */
  }
  const next = defaults();
  applyPrefs(next);
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore */
    }
  });
  return next;
}

export function onPrefsChange(fn) {
  if (typeof fn === "function") listeners.add(fn);
  return () => listeners.delete(fn);
}

function setHidden(el, hide) {
  if (!el) return;
  el.hidden = !!hide;
  el.style.display = hide ? "none" : "";
}

/**
 * Paint prefs onto <body>, CSS variables, and chrome widgets.
 * Safe to call before or after first paint.
 * @param {DesktopPrefs} [p]
 */
export function applyPrefs(p) {
  const prefs = p || getPrefs();
  const body = document.body;
  if (!body) return prefs;

  applyTheme(prefs.theme);

  body.classList.toggle("asx-icon-sm", prefs.iconSize === "small");
  body.classList.toggle("asx-icon-md", prefs.iconSize === "medium");
  body.classList.toggle("asx-icon-lg", prefs.iconSize === "large");
  body.classList.toggle("asx-no-labels", !prefs.iconLabels);
  body.classList.toggle("asx-tb-top", prefs.taskbarPos === "top");
  body.classList.toggle("asx-tb-autohide", !!prefs.taskbarAutohide);

  for (const w of WALLPAPERS) {
    body.classList.toggle(`asx-wall-${w.id}`, prefs.wallpaper === w.id);
  }

  const accent = hexOk(prefs.accent) ? prefs.accent : "#7c3aed";
  const brand = lighten(accent, 0.28);
  const { r, g, b } = hexToRgb(accent);
  const op = clamp(prefs.windowOpacity, 0.12, 0.92);
  body.style.setProperty("--brand-deep", accent);
  body.style.setProperty("--brand", brand);
  body.style.setProperty("--border", `rgba(${r}, ${g}, ${b}, 0.42)`);
  body.style.setProperty("--font-scale", String(clamp(prefs.fontScale, 0.85, 1.3)));
  body.style.setProperty("--win-opacity", String(op));
  body.style.setProperty("--desk-solid", hexOk(prefs.wallColor) ? prefs.wallColor : "#0a0618");
  if (prefs.theme === "ultra-thin") {
    body.style.setProperty("--panel", `rgba(12, 10, 18, ${Math.max(0.12, op - 0.08)})`);
    body.style.setProperty("--panel-body", `rgba(6, 5, 10, ${Math.max(0.08, op - 0.16)})`);
    body.style.setProperty(
      "--titlebar-bg",
      `linear-gradient(to right, rgba(${r},${g},${b},0.7) 0%, rgba(${r},${g},${b},0.4) 18%, rgba(18,14,28,0.28) 18%)`
    );
  } else if (prefs.theme === "medium-chrome") {
    body.style.setProperty("--panel", `rgba(14, 12, 22, ${Math.min(0.78, op + 0.18)})`);
    body.style.setProperty("--panel-body", `rgba(8, 6, 14, ${Math.min(0.62, op + 0.08)})`);
    body.style.setProperty(
      "--titlebar-bg",
      `linear-gradient(180deg, rgba(${r},${g},${b},0.72), rgba(18,14,28,0.55))`
    );
  } else if (prefs.theme === "thick-panel") {
    body.style.setProperty("--panel", `rgba(19, 17, 26, ${Math.min(0.94, op + 0.4)})`);
    body.style.setProperty("--panel-body", `rgba(10, 8, 9, ${Math.min(0.85, op + 0.28)})`);
  } else {
    body.style.setProperty("--panel", `rgba(12, 10, 18, ${op})`);
    body.style.setProperty("--panel-body", `rgba(6, 5, 10, ${Math.max(0.12, op - 0.12)})`);
    body.style.setProperty(
      "--titlebar-bg",
      `linear-gradient(to right, rgba(${r},${g},${b},0.82) 0%, rgba(${r},${g},${b},0.55) 26%, rgba(18,14,28,0.42) 26%)`
    );
  }

  const imgLayer = document.getElementById("desk-wallpaper");
  if (imgLayer) {
    if (prefs.wallpaper === "image" && prefs.wallImage) {
      imgLayer.style.backgroundImage = `url("${prefs.wallImage}")`;
      imgLayer.hidden = false;
    } else {
      imgLayer.style.backgroundImage = "";
      imgLayer.hidden = true;
    }
  }

  setHidden(document.getElementById("tb-visitors"), !prefs.showVisitors);
  setHidden(document.getElementById("tb-session"), !prefs.showSession);
  setHidden(document.getElementById("tb-net"), !prefs.showNetwork);
  setHidden(document.getElementById("tb-eyes"), !prefs.showEyes);

  const seo = document.getElementById("seo-main");
  if (seo && !prefs.seoPanel) seo.classList.add("seo-minimized");

  try {
    document.dispatchEvent(new CustomEvent("asx-prefs", { detail: prefs }));
  } catch {
    /* ignore */
  }
  return prefs;
}

export function initPrefs() {
  return applyPrefs(getPrefs());
}

/** Snap a free-placed icon to a 16px grid (with a left gutter). */
export function snapIcon(x, y) {
  const gx = 16;
  const gy = 16;
  return {
    x: Math.max(8, Math.round(x / gx) * gx),
    y: Math.max(8, Math.round(y / gy) * gy),
  };
}
