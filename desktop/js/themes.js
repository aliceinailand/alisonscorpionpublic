/**
 * ASX Desktop UI themes.
 *
 * thin-terminal (default) — Claude + PouyaOS-inspired thin chrome, high glass
 * transparency so Earth/stars show through windows.
 * panel-desktop — denser solid panels (current shipping look as of 2026-08-10);
 * kept as an optional theme, not removed.
 */
export const THEME_KEY = "asx-ui-theme";
export const THEME_DEFAULT = "thin-terminal";

export const THEMES = [
  {
    id: "thin-terminal",
    label: "Thin terminal glass (default)",
    hint: "Transparent mono chrome — Earth shows through",
  },
  {
    id: "panel-desktop",
    label: "Panel desktop",
    hint: "Solider purple panels — previous default look",
  },
];

export function getTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "panel-desktop" || t === "thin-terminal") return t;
  } catch {
    /* ignore */
  }
  return THEME_DEFAULT;
}

/**
 * Apply theme class on <body>. Safe to call before/after paint.
 * @param {string} [id]
 */
export function applyTheme(id) {
  const theme = id === "panel-desktop" ? "panel-desktop" : "thin-terminal";
  const body = document.body;
  if (!body) return theme;
  body.classList.remove("asx-theme-thin", "asx-theme-panel");
  body.classList.add(theme === "panel-desktop" ? "asx-theme-panel" : "asx-theme-thin");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  return theme;
}

export function initTheme() {
  return applyTheme(getTheme());
}
