/**
 * Hash deep-links for ASX Desktop apps via Hasher + js-signals (cdnjs).
 * https://cdnjs.com/libraries/hasher
 * https://cdnjs.com/libraries/js-signals
 *
 * Format:
 *   #app/<id>                  → open app
 *   #app/files/<path>          → Files at path (path URI-encoded, no leading #)
 *   #app/browser/<url>         → Browser with initial URL (encoded)
 *
 * Soft-fails to a tiny native hashchange fallback if CDNs are down.
 */

const SIGNALS_VERSION = "1.0.0";
const HASHER_VERSION = "1.2.0";

const SIGNALS_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/js-signals/${SIGNALS_VERSION}/js-signals.min.js`,
  `https://cdn.jsdelivr.net/npm/signals@${SIGNALS_VERSION}/dist/signals.min.js`,
];

const HASHER_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/hasher/${HASHER_VERSION}/hasher.min.js`,
  `https://cdn.jsdelivr.net/npm/hasher@${HASHER_VERSION}/dist/js/hasher.min.js`,
];

/** @type {object|null} */
let hasherLib = null;
let applyingFromHash = false;
let applyingFromUi = false;
/** @type {((id: string, opts?: object) => void)|null} */
let openAppFn = null;
/** @type {Set<string>} */
let knownAppIds = new Set();

function loadScript(src, check) {
  return new Promise((resolve, reject) => {
    if (check()) {
      resolve(true);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => {
      if (check()) resolve(true);
      else reject(new Error("global missing after " + src));
    };
    s.onerror = () => reject(new Error("failed " + src));
    document.head.appendChild(s);
  });
}

async function loadChain(sources, check) {
  let last;
  for (const src of sources) {
    try {
      await loadScript(src, check);
      return true;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("CDN chain failed");
}

/**
 * Parse desktop route from hash string (without #).
 * @returns {{ id: string, opts: object }|null}
 */
export function parseAppHash(raw) {
  let h = String(raw || "").replace(/^#/, "").replace(/^\/+/, "");
  // strip query-like noise
  h = h.split("?")[0];
  if (!h) return null;
  // app/<id> or app/<id>/<rest>
  const m = h.match(/^app\/([a-z0-9-]+)(?:\/(.*))?$/i);
  if (!m) return null;
  const id = m[1].toLowerCase();
  const rest = m[2] ? decodeURIComponent(m[2]) : "";
  const opts = {};
  if (id === "files" && rest) {
    opts.startPath = rest.startsWith("/") ? rest : `/${rest}`;
  } else if (id === "browser" && rest) {
    opts.initialUrl = rest;
  } else if (id === "pdf" && rest) {
    opts.url = rest;
  } else if (id === "image" && rest) {
    opts.url = rest;
  }
  return { id, opts };
}

export function buildAppHash(id, opts = {}) {
  const app = String(id || "").toLowerCase();
  if (!app) return "";
  if (app === "files" && opts.startPath) {
    const p = String(opts.startPath).replace(/^\/+/, "");
    return `app/files/${encodeURIComponent("/" + p).replace(/%2F/gi, "/")}`;
    // keep slashes readable: app/files/home/guest
  }
  if ((app === "browser" || app === "pdf" || app === "image") && (opts.initialUrl || opts.url)) {
    const u = opts.initialUrl || opts.url;
    return `app/${app}/${encodeURIComponent(u)}`;
  }
  return `app/${app}`;
}

/** Readable path segment form: app/files/home/guest */
function buildAppHashReadable(id, opts = {}) {
  const app = String(id || "").toLowerCase();
  if (!app) return "";
  if (app === "files" && opts.startPath) {
    const p = String(opts.startPath).replace(/^\/+/, "");
    return `app/files/${p}`;
  }
  if ((app === "browser" || app === "pdf" || app === "image") && (opts.initialUrl || opts.url)) {
    return `app/${app}/${encodeURIComponent(opts.initialUrl || opts.url)}`;
  }
  return `app/${app}`;
}

function applyRoute(hash) {
  if (!openAppFn) return;
  const route = parseAppHash(hash);
  if (!route) return;
  if (knownAppIds.size && !knownAppIds.has(route.id)) {
    console.info("[asx-hash] unknown app id:", route.id);
    return;
  }
  applyingFromHash = true;
  try {
    openAppFn(route.id, route.opts);
  } finally {
    // allow nested setHash from open to no-op
    setTimeout(() => {
      applyingFromHash = false;
    }, 0);
  }
}

/**
 * Update URL hash to reflect the open app (browser history / shareable links).
 */
export function setAppRoute(id, opts = {}) {
  if (applyingFromHash) return;
  const next = buildAppHashReadable(id, opts);
  if (!next) return;
  applyingFromUi = true;
  try {
    if (hasherLib && typeof hasherLib.setHash === "function") {
      if (hasherLib.getHash() !== next) hasherLib.setHash(next);
    } else {
      const cur = (location.hash || "").replace(/^#/, "").replace(/^\/+/, "");
      if (cur !== next) location.hash = next;
    }
  } finally {
    setTimeout(() => {
      applyingFromUi = false;
    }, 0);
  }
}

/**
 * @param {{ open: Function, catalog?: {id:string}[] }} opts
 */
export async function initHashRouter(opts) {
  openAppFn = opts.open;
  knownAppIds = new Set((opts.catalog || []).map((a) => a.id));
  // always allow explorer places opened as apps
  ["computer", "files", "network", "trash", "applications", "gdrive"].forEach((id) =>
    knownAppIds.add(id)
  );

  try {
    // js-signals → window.signals (factory needs signals.Signal)
    await loadChain(SIGNALS_SOURCES, () => typeof window.signals !== "undefined");
    await loadChain(HASHER_SOURCES, () => typeof window.hasher !== "undefined");
    hasherLib = window.hasher;

    // Prefer clean hashes: #app/files not #/app/files
    try {
      hasherLib.prependHash = "";
      hasherLib.appendHash = "";
    } catch {
      /* ignore */
    }

    const onChange = (newHash) => {
      if (applyingFromUi) return;
      applyRoute(newHash);
    };

    // initialized fires once with current hash; changed on navigation
    if (hasherLib.initialized?.add) hasherLib.initialized.add(onChange);
    if (hasherLib.changed?.add) hasherLib.changed.add(onChange);
    hasherLib.init();
    console.info("[asx-hash] Hasher", HASHER_VERSION, "· deep links #app/<id>");
    return { hasher: hasherLib, mode: "hasher" };
  } catch (e) {
    console.warn("[asx-hash] Hasher CDN failed — native hashchange fallback", e);
    const native = () => {
      if (applyingFromUi) return;
      applyRoute((location.hash || "").replace(/^#/, ""));
    };
    window.addEventListener("hashchange", native);
    // initial
    native();
    return { hasher: null, mode: "native" };
  }
}

export function getHashRouterVersion() {
  return { hasher: HASHER_VERSION, signals: SIGNALS_VERSION };
}
