/**
 * JSLite — minimal jQuery-compatible DOM helper (cdnjs → jsDelivr).
 * https://cdnjs.com/libraries/jslite
 *
 * Policy for free desktop apps:
 * - We do **not** ship or load full jQuery.
 * - Prefer vanilla querySelector / modules for core shell code.
 * - When a jQuery-style API is handy (plugins, quick DOM chains), use JSLite.
 *
 * Global after load: window.JSLite  (and window.$ if free)
 * ASX alias: window.ASX.$  /  import { $ } after ensureJsLite()
 */

const JSLITE_VERSION = "1.1.12";
const JSLITE_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/jslite/${JSLITE_VERSION}/JSLite.min.js`,
  `https://cdn.jsdelivr.net/npm/jslite@${JSLITE_VERSION}/JSLite.min.js`,
];

/** @type {Promise<Function|null>|null} */
let loadPromise = null;
/** @type {Function|null} */
let jsliteFn = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window.JSLite === "function") {
      resolve(window.JSLite);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => {
      if (typeof window.JSLite === "function") resolve(window.JSLite);
      else reject(new Error("JSLite global missing after " + src));
    };
    s.onerror = () => reject(new Error("JSLite failed: " + src));
    document.head.appendChild(s);
  });
}

/**
 * Load JSLite once. Resolves to the JSLite/$ function, or null if CDN fails.
 */
export function ensureJsLite() {
  if (jsliteFn) return Promise.resolve(jsliteFn);
  if (loadPromise) return loadPromise;
  if (typeof window.JSLite === "function") {
    jsliteFn = window.JSLite;
    exposeAsxAlias(jsliteFn);
    loadPromise = Promise.resolve(jsliteFn);
    return loadPromise;
  }
  loadPromise = (async () => {
    let last;
    for (const src of JSLITE_SOURCES) {
      try {
        jsliteFn = await loadScript(src);
        // Only claim $ if nothing else owns it (never fight jQuery if someone added it)
        if (typeof window.$ === "undefined") {
          window.$ = jsliteFn;
        }
        exposeAsxAlias(jsliteFn);
        console.info(
          "[asx-dom] JSLite",
          JSLITE_VERSION,
          "· jQuery-compatible · not full jQuery"
        );
        return jsliteFn;
      } catch (e) {
        last = e;
      }
    }
    console.warn("[asx-dom] JSLite unavailable — use vanilla DOM", last);
    jsliteFn = null;
    return null;
  })();
  return loadPromise;
}

function exposeAsxAlias(fn) {
  try {
    window.ASX = window.ASX || {};
    window.ASX.$ = fn;
    window.ASX.JSLite = fn;
    window.ASX.domLite = {
      version: JSLITE_VERSION,
      ready: true,
      noJquery: true,
    };
  } catch {
    /* ignore */
  }
}

/**
 * jQuery-style $ after ensureJsLite(); falls back to a tiny query helper.
 * Usage: const $ = await getDomLite();  $('.desk-icon').addClass('…')
 */
export async function getDomLite() {
  const lite = await ensureJsLite();
  if (lite) return lite;
  // Minimal fallback: selector → NodeList-like with on/each only
  return function vanilla$(sel, ctx) {
    const root = ctx && ctx.querySelectorAll ? ctx : document;
    const list =
      typeof sel === "string"
        ? Array.from(root.querySelectorAll(sel))
        : sel instanceof Element
          ? [sel]
          : Array.from(sel || []);
    list.on = (ev, fn) => {
      list.forEach((el) => el.addEventListener(ev, fn));
      return list;
    };
    list.each = (fn) => {
      list.forEach((el, i) => fn.call(el, i, el));
      return list;
    };
    list.addClass = (c) => {
      list.forEach((el) => el.classList.add(c));
      return list;
    };
    list.removeClass = (c) => {
      list.forEach((el) => el.classList.remove(c));
      return list;
    };
    list.text = (v) => {
      if (v === undefined) return list[0]?.textContent ?? "";
      list.forEach((el) => {
        el.textContent = v;
      });
      return list;
    };
    list.html = (v) => {
      if (v === undefined) return list[0]?.innerHTML ?? "";
      // Prefer text for safety in fallback path
      list.forEach((el) => {
        el.textContent = String(v);
      });
      return list;
    };
    list.length = list.length;
    return list;
  };
}

/** Sync accessor after ensureJsLite resolved; otherwise null. */
export function $() {
  if (typeof window.JSLite === "function") return window.JSLite(...arguments);
  if (typeof window.$ === "function" && window.ASX?.domLite?.ready) {
    return window.$(...arguments);
  }
  return null;
}

export function isJsLiteReady() {
  return typeof window.JSLite === "function";
}

export function jsLiteVersion() {
  return JSLITE_VERSION;
}

export { JSLITE_VERSION };
