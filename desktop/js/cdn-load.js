/**
 * Lazy CDN script loader — cdnjs → jsDelivr → unpkg.
 * Multi-AI Convergence: Alice (Matthew Gates), Grok, Claude, Gemini, ChatGPT, Copilot.
 *
 * Soft-fail: never throw to crash the desktop shell.
 * SRI: integrity applied only when provided (typically primary cdnjs URL).
 */

/**
 * @param {string[]} sources ordered CDN URLs
 * @param {() => any} check global ready check
 * @param {{ integrityByUrl?: Record<string, string> }} [opts]
 * @returns {Promise<any|null>}
 */
export function loadScriptChain(sources, check, opts = {}) {
  const existing = check();
  if (existing) return Promise.resolve(existing);
  const integrityByUrl = opts.integrityByUrl || {};

  return (async () => {
    for (const src of sources) {
      try {
        await new Promise((resolve, reject) => {
          const found = Array.from(document.querySelectorAll("script[data-asx-cdn]")).find(
            (el) => el.getAttribute("data-asx-cdn") === src
          );
          if (found) {
            if (check()) {
              resolve();
              return;
            }
            found.addEventListener("load", () => resolve());
            found.addEventListener("error", () => reject());
            return;
          }
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.crossOrigin = "anonymous";
          s.referrerPolicy = "no-referrer";
          s.setAttribute("data-asx-cdn", src);
          const sri = integrityByUrl[src];
          if (sri) s.integrity = sri;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("cdn fail " + src));
          document.head.appendChild(s);
        });
        const g = check();
        if (g) return g;
      } catch {
        /* next */
      }
    }
    return null;
  })();
}

export const MATTER_JS_VERSION = "0.20.0";
export const MATTER_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/matter-js/${MATTER_JS_VERSION}/matter.min.js`,
  `https://cdn.jsdelivr.net/npm/matter-js@${MATTER_JS_VERSION}/build/matter.min.js`,
];
/** Hermes side-door close: SRI on primary cdnjs only */
export const MATTER_CDN_SRI = {
  [MATTER_SOURCES[0]]:
    "sha384-ZRKYEXtLBVeqs9z1WxyeKutCqnkqolS/r1EUWuoUpG4ZKbnRAIXnHhHdnNuiB6CL",
};

export const WEBCAMJS_VERSION = "1.0.26";
export const WEBCAM_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/webcamjs/${WEBCAMJS_VERSION}/webcam.min.js`,
  `https://cdn.jsdelivr.net/npm/webcamjs@${WEBCAMJS_VERSION}/webcam.min.js`,
];
export const WEBCAM_CDN_SRI = {
  [WEBCAM_SOURCES[0]]:
    "sha384-b46hotfhb40Li5r1NPs9XinOjGyeO75FcshkKIikdrHeatxb0kB3tOrQCzMeksuQ",
};

export const EXCELJS_VERSION = "4.4.0";
export const EXCELJS_CDNJS =
  `https://cdnjs.cloudflare.com/ajax/libs/exceljs/${EXCELJS_VERSION}/exceljs.min.js`;
export const EXCELJS_CDN_SRI = {
  [EXCELJS_CDNJS]:
    "sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz",
};
