/**
 * ASX purify layer — DOMPurify from public CDNs (never our origin).
 * https://cdnjs.com/libraries/dompurify
 *
 * Defense in depth for any string → DOM HTML path (window bodies, chat, errors).
 * Loads once; soft-fails to strict text escaping if CDNs are unreachable.
 */

const DOMPURIFY_VERSION = "3.4.11";
const DOMPURIFY_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/dompurify/${DOMPURIFY_VERSION}/purify.min.js`,
  `https://cdn.jsdelivr.net/npm/dompurify@${DOMPURIFY_VERSION}/dist/purify.min.js`,
];

/** @type {import("dompurify").DOMPurifyI | null} */
let purify = null;
/** @type {Promise<import("dompurify").DOMPurifyI | null> | null} */
let loadPromise = null;

/**
 * UI fragments (window chrome, folder tiles, chat bubbles).
 * Allows common layout tags; strips scripts, handlers, javascript: URLs.
 */
export const ASX_UI_PURIFY = {
  USE_PROFILES: { html: true },
  ALLOWED_TAGS: [
    "a",
    "b",
    "br",
    "button",
    "canvas",
    "code",
    "details",
    "div",
    "em",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "i",
    "img",
    "input",
    "label",
    "li",
    "ol",
    "option",
    "p",
    "pre",
    "section",
    "select",
    "small",
    "span",
    "strong",
    "summary",
    "table",
    "tbody",
    "td",
    "textarea",
    "th",
    "thead",
    "tr",
    "ul",
    "video",
  ],
  ALLOWED_ATTR: [
    "accept",
    "alt",
    "aria-hidden",
    "aria-label",
    "aria-live",
    "autocomplete",
    "checked",
    "class",
    "colspan",
    "controls",
    "disabled",
    "draggable",
    "for",
    "height",
    "hidden",
    "href",
    "id",
    "loading",
    "max",
    "min",
    "multiple",
    "name",
    "placeholder",
    "readonly",
    "rel",
    "role",
    "rowspan",
    "spellcheck",
    "src",
    "step",
    "style",
    "target",
    "title",
    "type",
    "value",
    "width",
    // ASX data hooks (no event handlers)
    "data-act",
    "data-bp",
    "data-caption",
    "data-compressed",
    "data-disp-bytes",
    "data-filename",
    "data-go",
    "data-orig-bytes",
    "data-power",
    "data-tb",
  ],
  ALLOW_DATA_ATTR: false, // explicit list only — blocks data-on* etc.
  // http(s), mailto, tel, blob (object URLs), data:image only
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|blob):|data:image\/[a-z0-9.+-]+;base64,|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link", "meta", "base"],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onblur",
    "oninput",
    "onchange",
    "onsubmit",
  ],
};

/** Even stricter — text-ish HTML only (chat, error strings, captions). */
export const ASX_TEXT_PURIFY = {
  ALLOWED_TAGS: ["b", "br", "code", "em", "i", "span", "strong"],
  ALLOWED_ATTR: ["class", "style"],
  ALLOW_DATA_ATTR: false,
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window.DOMPurify?.sanitize === "function") {
      resolve(window.DOMPurify);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => {
      if (typeof window.DOMPurify?.sanitize === "function") resolve(window.DOMPurify);
      else reject(new Error("DOMPurify global missing after load"));
    };
    s.onerror = () => reject(new Error("DOMPurify script failed: " + src));
    document.head.appendChild(s);
  });
}

/**
 * Ensure DOMPurify is loaded. Resolves to the instance or null if CDNs fail.
 * Safe to call repeatedly.
 */
export function ensureDomPurify() {
  if (purify) return Promise.resolve(purify);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (typeof window.DOMPurify?.sanitize === "function") {
      purify = window.DOMPurify;
      return purify;
    }
    for (const src of DOMPURIFY_SOURCES) {
      try {
        purify = await loadScript(src);
        // Harden defaults once
        if (purify?.setConfig) {
          try {
            purify.setConfig({
              ...ASX_UI_PURIFY,
              RETURN_DOM: false,
              RETURN_DOM_FRAGMENT: false,
              WHOLE_DOCUMENT: false,
            });
          } catch {
            /* older builds */
          }
        }
        return purify;
      } catch {
        /* next CDN */
      }
    }
    console.warn(
      "[asx-purify] DOMPurify unavailable — falling back to strict text escape"
    );
    purify = null;
    return null;
  })();
  return loadPromise;
}

/** Plain-text escape for attributes and pure text nodes (no tags preserved). */
export function escapeText(s) {
  const str = String(s == null ? "" : s);
  if (!/[&<>"']/.test(str)) return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitize untrusted or mixed HTML for insertion via innerHTML.
 * If DOMPurify is not loaded yet, strips tags and escapes (fail closed).
 */
export function sanitizeHtml(dirty, config = ASX_UI_PURIFY) {
  const str = dirty == null ? "" : String(dirty);
  if (!str) return "";
  if (purify && typeof purify.sanitize === "function") {
    try {
      return purify.sanitize(str, config);
    } catch (e) {
      console.warn("[asx-purify] sanitize error", e);
      return escapeText(str.replace(/<[^>]*>/g, ""));
    }
  }
  // Fail closed: no tags, escaped text only
  return escapeText(str.replace(/<[^>]*>/g, ""));
}

/** Sanitize then assign el.innerHTML. */
export function setSafeHtml(el, html, config = ASX_UI_PURIFY) {
  if (!el) return;
  el.innerHTML = sanitizeHtml(html, config);
}

/** Alias used across apps (text context). */
export function escapeHtml(s) {
  return escapeText(s);
}

export function purifyReady() {
  return !!purify;
}

export function purifyVersion() {
  return purify?.version || (purify ? DOMPURIFY_VERSION : null);
}

export { DOMPURIFY_VERSION };
