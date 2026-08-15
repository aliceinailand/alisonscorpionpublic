/**
 * Browser capability + lite mode for ASX Desktop.
 *
 * - outdated-browser-rework (CDNJS) → upgrade notice for old browsers
 * - Lite / low-bandwidth / phone / tiny width → skip Three.js, use ambient bg
 * - Responsive resize to smallest breakpoint re-enters lite without reload
 *
 * Research: agents/research/construct/cdnjs_outdated_browser_lite_mode_20260811.md
 * CDNJS: https://cdnjs.com/libraries/outdated-browser-rework
 */
const OUTDATED_VERSION = "3.0.1";

const OUTDATED_JS = [
  {
    url: `https://cdnjs.cloudflare.com/ajax/libs/outdated-browser-rework/${OUTDATED_VERSION}/outdated-browser-rework.min.js`,
    integrity: "sha384-k0yfB3WIFg5+7obj2QyLoupOGlU7MCWsqIB3k7NNIK7VlCgizjZ/jXIYwFUNVXqU",
  },
  {
    url: `https://cdn.jsdelivr.net/npm/outdated-browser-rework@${OUTDATED_VERSION}/dist/outdated-browser-rework.min.js`,
    integrity: null,
  },
  {
    url: `https://unpkg.com/outdated-browser-rework@${OUTDATED_VERSION}/dist/outdated-browser-rework.min.js`,
    integrity: null,
  },
];

const OUTDATED_CSS = [
  {
    url: `https://cdnjs.cloudflare.com/ajax/libs/outdated-browser-rework/${OUTDATED_VERSION}/style.min.css`,
    integrity: "sha384-pkGhHX5kVj8mJAwf5HM8Ll3T4+izDslvu3tkKz40m9JERlWdyMA/zvjfthB5XSFt",
  },
  {
    url: `https://cdn.jsdelivr.net/npm/outdated-browser-rework@${OUTDATED_VERSION}/dist/style.css`,
    integrity: null,
  },
];

/** Smallest breakpoint — force ambient / lite (matches prior shouldUseAmbientBg). */
export const ASX_TINY_MAX_WIDTH = 420;
/** Phone / tablet shell class threshold. */
export const ASX_MOBILE_MAX_WIDTH = 768;

/** @type {Promise<Function | null> | null} */
let outdatedLoadPromise = null;

function viewportWidth() {
  if (typeof window === "undefined") return 0;
  return (
    window.visualViewport?.width ||
    window.innerWidth ||
    document.documentElement?.clientWidth ||
    0
  );
}

function queryFlag(name) {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

/**
 * Low-bandwidth / constrained surface — skip heavy Three.js attempt.
 * @returns {boolean}
 */
export function shouldUseLiteMode() {
  if (typeof window === "undefined") return true;

  const forceBg = queryFlag("bg");
  if (forceBg === "three" || forceBg === "earth") return false;
  if (forceBg === "ambient" || forceBg === "lite") return true;
  if (queryFlag("lite") === "1" || queryFlag("lite") === "true") return true;

  const w = viewportWidth();
  if (w > 0 && w <= ASX_TINY_MAX_WIDTH) return true;

  try {
    if (navigator.connection?.saveData) return true;
    const et = navigator.connection?.effectiveType;
    if (et === "slow-2g" || et === "2g") return true;
  } catch {
    /* ignore */
  }

  // Coarse pointer + narrow: treat as mobile lite for WebGL budget
  try {
    if (
      matchMedia("(pointer: coarse)").matches &&
      w > 0 &&
      w <= ASX_MOBILE_MAX_WIDTH
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }

  if (!isWebGlLikelyAvailable()) return true;

  return false;
}

/**
 * Cheap WebGL probe (no Three required).
 * @returns {boolean}
 */
export function isWebGlLikelyAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl") ||
      c.getContext("experimental-webgl") ||
      c.getContext("webgl2")
    );
  } catch {
    return false;
  }
}

export function isMobileUi() {
  try {
    if (matchMedia("(max-width: 768px)").matches) return true;
    if (matchMedia("(pointer: coarse)").matches && viewportWidth() <= 900) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Apply body classes for CSS + diagnostics.
 * @returns {{ lite: boolean, mobile: boolean, webgl: boolean }}
 */
export function applyCapabilityClasses() {
  const lite = shouldUseLiteMode();
  const mobile = isMobileUi();
  const webgl = isWebGlLikelyAvailable();
  const body = document.body;
  if (!body) return { lite, mobile, webgl };

  body.classList.toggle("asx-mobile", mobile);
  body.classList.toggle("asx-lite", lite);
  body.classList.toggle("asx-no-webgl", !webgl);
  body.dataset.asxLite = lite ? "1" : "0";
  body.dataset.asxWebgl = webgl ? "1" : "0";
  return { lite, mobile, webgl };
}

function loadScript(url, integrity) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.crossOrigin = "anonymous";
    if (integrity) s.integrity = integrity;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load failed: " + url));
    document.head.appendChild(s);
  });
}

function loadStylesheet(url, integrity) {
  return new Promise((resolve, reject) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = url;
    l.crossOrigin = "anonymous";
    if (integrity) l.integrity = integrity;
    l.onload = () => resolve();
    l.onerror = () => reject(new Error("css failed: " + url));
    document.head.appendChild(l);
  });
}

/**
 * Load outdated-browser-rework from public CDNs (soft-fail).
 * @returns {Promise<Function | null>}
 */
export function ensureOutdatedBrowserRework() {
  if (typeof window !== "undefined" && typeof window.outdatedBrowserRework === "function") {
    return Promise.resolve(window.outdatedBrowserRework);
  }
  if (outdatedLoadPromise) return outdatedLoadPromise;

  outdatedLoadPromise = (async () => {
    for (const css of OUTDATED_CSS) {
      try {
        await loadStylesheet(css.url, css.integrity);
        break;
      } catch {
        /* next */
      }
    }
    for (const src of OUTDATED_JS) {
      try {
        await loadScript(src.url, src.integrity);
        if (typeof window.outdatedBrowserRework === "function") {
          return window.outdatedBrowserRework;
        }
      } catch {
        /* next CDN */
      }
    }
    return null;
  })();

  return outdatedLoadPromise;
}

/**
 * Mount #outdated host + run outdated-browser-rework if needed.
 * Soft-fails entirely if CDN blocked (shell still boots).
 */
export async function initOutdatedBrowserBanner() {
  if (typeof document === "undefined") return false;

  let host = document.getElementById("outdated");
  if (!host) {
    host = document.createElement("div");
    host.id = "outdated";
    host.setAttribute("role", "alert");
    document.body.prepend(host);
  }

  const fn = await ensureOutdatedBrowserRework();
  if (!fn) {
    console.info("ASX: outdated-browser-rework unavailable (CDN) — shell continues");
    return false;
  }

  try {
    fn({
      browserSupport: {
        Chrome: 80,
        Edge: 80,
        Firefox: 78,
        Safari: 13,
        "Mobile Safari": 13,
        Opera: 67,
        Vivaldi: 3,
        Yandex: 20,
      },
      requireChromeOnAndroid: false,
      isUnknownBrowserOK: true,
      messages: {
        outOfDate:
          "Your browser is out of date for the full ASX desktop (Three.js / modern WebGL). " +
          "Please update, or continue in lite mode (lighter ambient background).",
        unsupported:
          "This browser is not fully supported. ASX will use a low-bandwidth lite layout where possible.",
        update: {
          web: "Update browser",
          googlePlay: "Update from Google Play",
          appStore: "Update from App Store",
        },
      },
    });
    return true;
  } catch (err) {
    console.warn("ASX outdated-browser-rework init failed", err);
    return false;
  }
}

/**
 * Watch resize / orientation — enter lite at smallest width; notify listener.
 * @param {(state: { lite: boolean, mobile: boolean, webgl: boolean, width: number }) => void} [onChange]
 * @returns {() => void} unbind
 */
export function watchCapabilityResize(onChange) {
  let lastLite = null;

  const fire = () => {
    const state = applyCapabilityClasses();
    const width = viewportWidth();
    const payload = { ...state, width };
    if (lastLite === null || lastLite !== state.lite) {
      lastLite = state.lite;
      try {
        onChange?.(payload);
      } catch (err) {
        console.warn("ASX capability onChange", err);
      }
    } else {
      try {
        onChange?.(payload);
      } catch {
        /* ignore */
      }
    }
  };

  fire();
  window.addEventListener("resize", fire);
  window.addEventListener("orientationchange", fire);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fire);
  }

  return () => {
    window.removeEventListener("resize", fire);
    window.removeEventListener("orientationchange", fire);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", fire);
    }
  };
}

export { OUTDATED_VERSION, OUTDATED_JS, OUTDATED_CSS };
