/**
 * interact.js loader for natural window drag/resize (inertia, snap, multi-touch).
 *
 * Fair game: cdnjs → jsDelivr → unpkg (never our origin for vendor).
 * Research: agents/research/construct/cdnjs_interactjs_window_effects_20260811.md
 * CDNJS: https://cdnjs.com/libraries/interact.js
 *
 * Soft-fail: if CDNs blocked, returns null — WindowManager keeps hand-rolled pointers.
 */
const INTERACT_VERSION = "1.10.27";

/** Primary = cdnjs (Cloudflare) with measured SRI */
const INTERACT_SOURCES = [
  {
    url: `https://cdnjs.cloudflare.com/ajax/libs/interact.js/${INTERACT_VERSION}/interact.min.js`,
    integrity: "sha384-N3H1mDackcFNb3oKRPjCVhDV6IToMfPPDTKJF9ufjBSs/wNeQVMFsbPH5btvcSNH",
  },
  {
    url: `https://cdn.jsdelivr.net/npm/interactjs@${INTERACT_VERSION}/dist/interact.min.js`,
    integrity: null,
  },
  {
    url: `https://unpkg.com/interactjs@${INTERACT_VERSION}/dist/interact.min.js`,
    integrity: null,
  },
];

/** @type {Promise<typeof window.interact | null> | null} */
let loadPromise = null;

function reduceMotionPreferred() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Load interact.js once. Resolves to global `interact` or null.
 * @returns {Promise<Function | null>}
 */
export function ensureInteract() {
  if (typeof window !== "undefined" && typeof window.interact === "function") {
    return Promise.resolve(window.interact);
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    for (const src of INTERACT_SOURCES) {
      try {
        await loadScript(src.url, src.integrity);
        if (typeof window.interact === "function") {
          return window.interact;
        }
      } catch {
        /* try next CDN */
      }
    }
    return null;
  })();

  return loadPromise;
}

function loadScript(url, integrity) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.crossOrigin = "anonymous";
    if (integrity) s.integrity = integrity;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`interact load failed: ${url}`));
    document.head.appendChild(s);
  });
}

/**
 * Optional: bind natural drag (titlebar) + resize on an ASX window element.
 * Does not remove existing listeners — prefer calling only when migrating off hand-rolled WM path.
 * Uses left/top (ASX geom store) rather than transform-only.
 *
 * @param {HTMLElement} winEl  .asx-window root
 * @param {{
 *   titlebar?: string,
 *   onGeomEnd?: (el: HTMLElement) => void,
 *   boundsEl?: HTMLElement | string,
 * }} [opts]
 * @returns {Promise<boolean>} true if interact bound
 */
export async function bindNaturalWindow(winEl, opts = {}) {
  if (!winEl || winEl.classList.contains("maximized")) return false;
  const interact = await ensureInteract();
  if (!interact) return false;

  const titleSel = opts.titlebar || ".titlebar";
  const restriction =
    typeof opts.boundsEl === "string"
      ? opts.boundsEl
      : opts.boundsEl || "#windows-root";
  const inertia = !reduceMotionPreferred();

  interact(winEl).draggable({
    allowFrom: titleSel,
    ignoreFrom: "button, input, textarea, a, .resize-handle",
    inertia,
    listeners: {
      move(event) {
        const t = event.target;
        if (t.classList.contains("maximized")) return;
        const left = (parseFloat(t.style.left) || 0) + event.dx;
        const top = (parseFloat(t.style.top) || 0) + event.dy;
        t.style.left = `${Math.max(0, left)}px`;
        t.style.top = `${Math.max(0, top)}px`;
      },
      end(event) {
        opts.onGeomEnd?.(event.target);
      },
    },
    modifiers: [
      interact.modifiers.restrictRect({
        restriction,
        endOnly: true,
      }),
    ],
  });

  interact(winEl).resizable({
    edges: { left: true, right: true, bottom: true, top: false },
    inertia,
    listeners: {
      move(event) {
        const t = event.target;
        if (t.classList.contains("maximized")) return;
        let { width, height } = event.rect;
        width = Math.max(140, width);
        height = Math.max(120, height);
        t.style.width = `${width}px`;
        t.style.height = `${height}px`;
        if (event.deltaRect) {
          t.style.left = `${(parseFloat(t.style.left) || 0) + event.deltaRect.left}px`;
          t.style.top = `${(parseFloat(t.style.top) || 0) + event.deltaRect.top}px`;
        }
      },
      end(event) {
        opts.onGeomEnd?.(event.target);
      },
    },
    modifiers: [
      interact.modifiers.restrictEdges({ outer: restriction }),
      interact.modifiers.restrictSize({ min: { width: 140, height: 120 } }),
    ],
  });

  winEl.dataset.asxInteract = "1";
  return true;
}

export { INTERACT_VERSION, INTERACT_SOURCES };
