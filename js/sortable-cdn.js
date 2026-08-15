/**
 * SortableJS loader — reorderable drag-and-drop lists (CDN fair-game).
 *
 * CDNJS: https://cdnjs.com/libraries/Sortable
 * Research: agents/research/construct/cdnjs_sortable_reorder_20260811.md
 *
 * Soft-fail: returns null if all CDNs blocked (lists stay static).
 */
const SORTABLE_VERSION = "1.15.7";

const SORTABLE_SOURCES = [
  {
    url: `https://cdnjs.cloudflare.com/ajax/libs/Sortable/${SORTABLE_VERSION}/Sortable.min.js`,
    integrity: "sha384-DgmC6Xe2bSN2WjTDXzWYbUbxyhNP+NNkGDR/g78pCXV7E7rcVTGxVg0uIVCUUcBc",
  },
  {
    url: `https://cdn.jsdelivr.net/npm/sortablejs@${SORTABLE_VERSION}/Sortable.min.js`,
    integrity: null,
  },
  {
    url: `https://unpkg.com/sortablejs@${SORTABLE_VERSION}/Sortable.min.js`,
    integrity: null,
  },
];

/** @type {Promise<typeof window.Sortable | null> | null} */
let loadPromise = null;

/**
 * Load Sortable once from public CDNs.
 * @returns {Promise<typeof window.Sortable | null>}
 */
export function ensureSortable() {
  if (typeof window !== "undefined" && typeof window.Sortable === "function") {
    return Promise.resolve(window.Sortable);
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    for (const src of SORTABLE_SOURCES) {
      try {
        await loadScript(src.url, src.integrity);
        if (typeof window.Sortable === "function") {
          return window.Sortable;
        }
      } catch {
        /* next CDN */
      }
    }
    console.info("ASX: Sortable unavailable (CDN) — lists remain static");
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
    s.onerror = () => reject(new Error("Sortable load failed: " + url));
    document.head.appendChild(s);
  });
}

/**
 * Bind reorder on a list element; optional persist callback with id order.
 *
 * @param {HTMLElement} listEl
 * @param {{
 *   handle?: string,
 *   animation?: number,
 *   onOrder?: (ids: string[]) => void,
 *   idAttr?: string,
 * }} [opts]
 * @returns {Promise<object | null>} Sortable instance or null
 */
export async function bindSortableList(listEl, opts = {}) {
  if (!listEl) return null;
  const Sortable = await ensureSortable();
  if (!Sortable) return null;

  const idAttr = opts.idAttr || "data-id";
  const instance = Sortable.create(listEl, {
    animation: opts.animation ?? 150,
    handle: opts.handle,
    ghostClass: "asx-sortable-ghost",
    chosenClass: "asx-sortable-chosen",
    dragClass: "asx-sortable-drag",
    forceFallback: false,
    onEnd() {
      if (typeof opts.onOrder !== "function") return;
      const ids = [...listEl.children]
        .map((n) => n.getAttribute(idAttr) || n.dataset.id || n.id)
        .filter(Boolean);
      opts.onOrder(ids);
    },
  });
  listEl.dataset.asxSortable = "1";
  return instance;
}

export { SORTABLE_VERSION, SORTABLE_SOURCES };
