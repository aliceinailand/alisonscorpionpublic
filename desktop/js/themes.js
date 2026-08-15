/**
 * ASX Desktop UI themes — thickness / look-and-feel.
 *
 * ultra-thin     — hairline chrome, max glass
 * thin-terminal  — default Claude + PouyaOS thin glass
 * medium-chrome  — balanced bars and radius
 * thick-panel    — chunky titlebars / taskbar (was panel-desktop)
 */
export const THEME_KEY = "asx-ui-theme";
export const THEME_DEFAULT = "thin-terminal";

export const THEMES = [
  {
    id: "ultra-thin",
    label: "Ultra thin",
    hint: "Hairline chrome — almost no chrome, Earth shows through",
  },
  {
    id: "thin-terminal",
    label: "Thin terminal (default)",
    hint: "Transparent mono chrome — Earth shows through",
  },
  {
    id: "medium-chrome",
    label: "Medium",
    hint: "Balanced bars and corners — between glass and panel",
  },
  {
    id: "thick-panel",
    label: "Thick panel",
    hint: "Chunky titlebars, taller taskbar, solider glass",
  },
];

const THEME_IDS = new Set(THEMES.map((t) => t.id));

const CLASS_BY_THEME = {
  "ultra-thin": "asx-theme-ultra",
  "thin-terminal": "asx-theme-thin",
  "medium-chrome": "asx-theme-medium",
  "thick-panel": "asx-theme-panel",
};

const ALL_THEME_CLASSES = [
  "asx-theme-ultra",
  "asx-theme-thin",
  "asx-theme-medium",
  "asx-theme-panel",
];

/** Map legacy ids so old localStorage still works. */
export function normalizeTheme(id) {
  if (id === "panel-desktop") return "thick-panel";
  if (THEME_IDS.has(id)) return id;
  return THEME_DEFAULT;
}

export function getTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return THEME_DEFAULT;
  }
}

/**
 * Apply theme class on <body>. Safe to call before/after paint.
 * @param {string} [id]
 */
export function applyTheme(id) {
  const theme = normalizeTheme(id);
  const body = document.body;
  if (!body) return theme;
  body.classList.remove(...ALL_THEME_CLASSES);
  body.classList.add(CLASS_BY_THEME[theme] || "asx-theme-thin");
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
