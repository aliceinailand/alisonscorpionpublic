/**
 * FastClick — remove residual 300ms tap delay on touch UIs (cdnjs).
 * https://cdnjs.com/libraries/fastclick
 *
 * Modern browsers + `touch-action: manipulation` already cut most lag.
 * We still attach FastClick on coarse-pointer / narrow viewports for older
 * WebViews and as a belt-and-suspenders guest phone experience.
 *
 * Desktop mouse: skipped (no attach).
 */

const FASTCLICK_VERSION = "1.0.6";
const FASTCLICK_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/fastclick/${FASTCLICK_VERSION}/fastclick.min.js`,
  `https://cdn.jsdelivr.net/npm/fastclick@${FASTCLICK_VERSION}/lib/fastclick.js`,
];

/** @type {Promise<boolean>|null} */
let attachPromise = null;

function wantsFastClick() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  // Explicit opt-out
  try {
    if (localStorage.getItem("asx-no-fastclick") === "1") return false;
  } catch {
    /* ignore */
  }
  // Prefer coarse pointer / touch / narrow
  const coarse =
    typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches;
  const narrow =
    typeof matchMedia === "function" && matchMedia("(max-width: 900px)").matches;
  const touch =
    "ontouchstart" in window ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  return !!(coarse || (touch && narrow));
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window.FastClick === "function" || window.FastClick?.attach) {
      resolve(window.FastClick);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => {
      const FC = window.FastClick;
      if (FC) resolve(FC);
      else reject(new Error("FastClick global missing"));
    };
    s.onerror = () => reject(new Error("FastClick failed: " + src));
    document.head.appendChild(s);
  });
}

/**
 * Load FastClick and attach to document.body when appropriate.
 * @returns {Promise<boolean>} true if attached
 */
export function initFastClick() {
  if (attachPromise) return attachPromise;
  if (!wantsFastClick()) {
    attachPromise = Promise.resolve(false);
    return attachPromise;
  }
  if (document.body?.dataset?.asxFastclick === "1") {
    attachPromise = Promise.resolve(true);
    return attachPromise;
  }

  attachPromise = (async () => {
    let FC = null;
    let last;
    for (const src of FASTCLICK_SOURCES) {
      try {
        FC = await loadScript(src);
        break;
      } catch (e) {
        last = e;
      }
    }
    if (!FC) {
      console.warn("[asx-touch] FastClick unavailable", last);
      return false;
    }
    try {
      const attach = typeof FC.attach === "function" ? FC.attach.bind(FC) : FC;
      // Layer = body so desktop chrome + windows get faster taps
      attach(document.body);
      document.body.dataset.asxFastclick = "1";
      console.info(
        "[asx-touch] FastClick",
        FASTCLICK_VERSION,
        "· attached (touch / coarse pointer)"
      );
      try {
        window.ASX = window.ASX || {};
        window.ASX.touch = { fastclick: true, version: FASTCLICK_VERSION };
      } catch {
        /* ignore */
      }
      return true;
    } catch (e) {
      console.warn("[asx-touch] FastClick.attach failed", e);
      return false;
    }
  })();
  return attachPromise;
}

export function fastClickVersion() {
  return FASTCLICK_VERSION;
}

export { wantsFastClick };
