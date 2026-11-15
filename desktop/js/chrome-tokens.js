/**
 * Pure mothership / Deep Thought chrome tokens for ASX Desktop.
 * Titlebar/taskbar stay cool void + soft violet — accent does not wash them warm.
 * Fills are near-opaque so warm wallpapers (earth/nebula) cannot brown the chrome.
 * Exported for unit tests without opening a window.
 */

export const VOID_HEX = "#0a0809";
export const VOID_RGB = "10,8,9";
export const VOID_DEEP_RGB = "7,6,11";
/** Soft universe violet wash (stable mothership; not accent-driven). */
export const MOTHERSHIP_VIOLET_RGB = "124,58,237";
/** Opaque violet-void stops (hex) — wallpaper cannot bleed through. */
export const TITLEBAR_VIOLET_VOID = "#1a1230";
export const TITLEBAR_MID_VOID = "#100c18";
export const CHROME_MAX = "#3dbeb0";
export const CHROME_CLOSE = "#d4789a";
export const CHROME_MIN_DEFAULT = "#9b8af5";
/** Cool title text — never cream/gold on chrome. */
export const CHROME_TITLE = "#e4dff5";

function hexOk(s) {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return { r: 124, g: 58, b: 237 };
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}

export function lighten(hex, amt = 0.22) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amt);
  return `#${[mix(r), mix(g), mix(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Warm accents (gold/orange/red) must not drive titlebar fills — that reintroduces brown.
 */
export function isWarmAccent(hex) {
  if (!hexOk(hex)) return false;
  const { r, g, b } = hexToRgb(hex);
  return r > 160 && g > 80 && g < 200 && b < 120;
}

/**
 * @param {{ theme?: string, accent?: string }} opts
 * @returns {Record<string, string>} CSS custom properties to apply on body
 */
export function computeChromeTokens(opts = {}) {
  const theme = opts.theme || "thin-terminal";
  const accent = hexOk(opts.accent) ? opts.accent.trim() : "#7c3aed";
  const brand = lighten(accent, 0.28);
  const { r, g, b } = hexToRgb(accent);
  // Titlebar wash is always cool mothership violet → void (never warm accent).
  const vr = MOTHERSHIP_VIOLET_RGB;

  /** @type {Record<string, string>} */
  const vars = {
    "--brand-deep": accent,
    "--brand": brand,
    "--chrome-min": isWarmAccent(accent) ? CHROME_MIN_DEFAULT : lighten(accent, 0.18),
    "--chrome-max": CHROME_MAX,
    "--chrome-close": CHROME_CLOSE,
    "--chrome-title": CHROME_TITLE,
    "--border": `rgba(${r}, ${g}, ${b}, 0.28)`,
    "--desk-solid": VOID_HEX,
  };

  // Near-opaque cool stops (hex) so backdrop-filter + earth/nebula cannot brown chrome.
  // Soft violet reads as a left ambient into Deep Thought void — not a translucent wash.
  if (theme === "ultra-thin") {
    vars["--titlebar-bg"] =
      `linear-gradient(105deg, ${TITLEBAR_VIOLET_VOID} 0%, ${TITLEBAR_MID_VOID} 38%, ${VOID_HEX} 100%)`;
  } else if (theme === "medium-chrome") {
    vars["--titlebar-bg"] =
      `linear-gradient(180deg, ${TITLEBAR_VIOLET_VOID} 0%, ${VOID_HEX} 100%)`;
  } else if (theme === "thick-panel") {
    vars["--titlebar-bg"] =
      `linear-gradient(180deg, #221640 0%, ${VOID_HEX} 100%)`;
  } else {
    // thin-terminal default — soft violet-void into Deep Thought void
    vars["--titlebar-bg"] =
      `linear-gradient(105deg, ${TITLEBAR_VIOLET_VOID} 0%, ${TITLEBAR_MID_VOID} 36%, ${VOID_HEX} 72%, #07060b 100%)`;
  }

  vars["--taskbar-floor"] =
    `linear-gradient(180deg, #0f0c18 0%, #07060b 100%)`;

  // Keep violet RGB fingerprint for gating tests / mothership probes
  vars["--mothership-violet"] = `rgb(${vr})`;

  return vars;
}
