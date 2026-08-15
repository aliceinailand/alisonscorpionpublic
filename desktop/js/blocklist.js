/**
 * ASX Desktop browser blocklist — adult / high-risk hosts.
 *
 * Architecture (why not only raw GitHub hot-link):
 * 1. **Core Set** (this file) — instant, fail-closed brands/TLDs before any fetch.
 * 2. **safety/hosts/** (our public repo) — ~64k domains from StevenBlack porn
 *    extensions, sharded, same-origin, versioned with the site. Preferred.
 * 3. **Optional remote** raw.githubusercontent.com — CORS works (*), but 2–5 MB
 *    hosts files are a poor default for every guest visit; use for operator refresh.
 *
 * Soft client UX — not a network firewall.
 * Research: safety/readme.md · browser_blocklist_and_iframe_20260810.md
 */
export const BLOCKED_HOSTS = new Set([
  "pornhub.com", "www.pornhub.com",
  "xvideos.com", "www.xvideos.com",
  "xnxx.com", "www.xnxx.com",
  "xhamster.com", "www.xhamster.com",
  "redtube.com", "www.redtube.com",
  "youporn.com", "www.youporn.com",
  "porn.com", "www.porn.com",
  "pornhd.com", "www.pornhd.com",
  "pornmd.com", "www.pornmd.com",
  "onlyfans.com", "www.onlyfans.com",
  "fansly.com", "www.fansly.com",
  "chaturbate.com", "www.chaturbate.com",
  "stripchat.com", "www.stripchat.com",
  "bongacams.com", "www.bongacams.com",
  "livejasmin.com", "www.livejasmin.com",
  "camsoda.com", "www.camsoda.com",
  "myfreecams.com", "www.myfreecams.com",
  "spankbang.com", "www.spankbang.com",
  "eporner.com", "www.eporner.com",
  "hqporner.com", "www.hqporner.com",
  "motherless.com", "www.motherless.com",
  "porntrex.com", "www.porntrex.com",
  "tnaflix.com", "www.tnaflix.com",
  "tube8.com", "www.tube8.com",
  "beeg.com", "www.beeg.com",
  "xmoviesforyou.com", "www.xmoviesforyou.com",
  "rule34.xxx", "www.rule34.xxx",
  "nhentai.net", "www.nhentai.net",
  "hanime.tv", "www.hanime.tv",
  "sex.com", "www.sex.com",
  "xnxx.tv", "www.xnxx.tv",
  "xhamster.desi", "www.xhamster.desi",
  "pornhub.org", "www.pornhub.org",
  "pornhub.net", "www.pornhub.net",
  "youjizz.com", "www.youjizz.com",
  "drtuber.com", "www.drtuber.com",
  "sunporno.com", "www.sunporno.com",
  "nuvid.com", "www.nuvid.com",
  "perfectgirls.net", "www.perfectgirls.net",
  "gotporn.com", "www.gotporn.com",
  "porn300.com", "www.porn300.com",
  "ixxx.com", "www.ixxx.com",
  "fapdu.com", "www.fapdu.com",
  "hentaihaven.xxx", "www.hentaihaven.xxx",
  "e-hentai.org", "www.e-hentai.org",
  "exhentai.org", "www.exhentai.org",
]);

/** Bare registrable hosts (no www.) — built once */
export const BLOCKED_BARE = new Set(
  [...BLOCKED_HOSTS].map((h) => h.replace(/^www\./, ""))
);

/**
 * Host-only brand tokens (not path/query) — reduces H3-03 overblock on
 * example.com/?q=porn while still catching brand-like hosts.
 */
export const BLOCKED_HOST_TOKENS = Object.freeze([
  "pornhub",
  "xvideos",
  "xnxx",
  "xhamster",
  "redtube",
  "youporn",
  "onlyfans",
  "fansly",
  "chaturbate",
  "stripchat",
  "bongacams",
  "livejasmin",
  "camsoda",
  "myfreecams",
  "spankbang",
  "eporner",
  "hqporner",
  "motherless",
  "porntrex",
  "nhentai",
  "hanime",
  "rule34",
  "youjizz",
  "drtuber",
  "sunporno",
  "gotporn",
  "porn300",
  "hentaihaven",
  "exhentai",
  "e-hentai",
  "tnaflix",
]);

const SCHEME_DENY = /^(javascript|data|vbscript|file|blob):/i;
const HAS_SCHEME = /^https?:\/\//i;

/** Common Latin confusables → ASCII (Hermes H3-02) */
const CONFUSABLE_MAP = {
  "\u0430": "a", // Cyrillic a
  "\u0435": "e",
  "\u043e": "o",
  "\u0440": "p",
  "\u0441": "c",
  "\u0443": "y",
  "\u0445": "x",
  "\u0456": "i",
  "\u04cf": "l",
  "\u0391": "a",
  "\u0395": "e",
  "\u039f": "o", // Greek capital omicron
  "\u03bf": "o", // Greek small omicron (Hermes R2 — toLowerCase of U+039F)
  "\u03b1": "a", // Greek small alpha
  "\u03b5": "e", // Greek small epsilon
  "\u03c1": "p", // Greek small rho
  "\u03c5": "y", // Greek small upsilon (approx)
  "\u03c7": "x", // Greek small chi
  "\u03b9": "i", // Greek small iota
  "\u0420": "p",
  "\u0405": "s",
  "\u0410": "a",
  "\u0415": "e",
  "\u041e": "o",
  "\uff4f": "o", // fullwidth
  "\uff41": "a",
  "\uff45": "e",
  "\uff50": "p",
  "\uff52": "r",
  "\uff48": "h",
  "\uff55": "u",
  "\uff42": "b",
  "\uff4e": "n",
};

/**
 * Fold host for confusable brand match (ASCII + common Cyrillic/Greek lookalikes).
 * Not a full Unicode confusable table — closes known H3-02 class for adult brands.
 */
export function foldHostConfusable(host) {
  let s = String(host || "")
    .toLowerCase()
    .normalize("NFKC");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += CONFUSABLE_MAP[ch] || ch;
  }
  return out;
}

export function hostOf(url) {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Host label before URL/IDNA punycode (Hermes H3-02).
 * URL() converts confusable brands to xn--* and loses fold targets.
 */
export function hostUnicodeOf(url) {
  try {
    let s = String(url || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) {
      if (s.startsWith("//")) s = `https:${s}`;
      else s = `https://${s}`;
    }
    const m = s.match(/^https?:\/\/([^/?#]+)/i);
    if (!m) return "";
    let host = m[1];
    // strip userinfo
    const at = host.lastIndexOf("@");
    if (at !== -1) host = host.slice(at + 1);
    // strip port
    host = host.replace(/:\d+$/, "");
    // strip IPv6 brackets
    host = host.replace(/^\[|\]$/g, "");
    return host.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Domains loaded from safety/hosts/*.txt (StevenBlack-derived). */
const SAFETY_DOMAINS = new Set();
let safetyLoadPromise = null;
export const safetyLoadStatus = {
  loaded: false,
  loading: false,
  count: 0,
  error: null,
  base: null,
};

function safetyHostsBaseUrl() {
  // blocklist.js lives in js/ → ../safety/hosts/
  try {
    return new URL("../safety/hosts/", import.meta.url);
  } catch {
    return new URL("safety/hosts/", location.href);
  }
}

/**
 * Lazy-load public safety shards (same-origin). Safe to call many times.
 * Prefer this over hot-linking multi-MB raw hosts on every page load.
 * @returns {Promise<{ loaded: boolean, count: number, error?: string }>}
 */
export function ensureSafetyListsLoaded() {
  if (safetyLoadStatus.loaded) return Promise.resolve(safetyLoadStatus);
  if (safetyLoadPromise) return safetyLoadPromise;

  safetyLoadStatus.loading = true;
  safetyLoadPromise = (async () => {
    const base = safetyHostsBaseUrl();
    safetyLoadStatus.base = String(base);
    try {
      // Prefer HTTP cache (Cloudflare / browser). force-cache = use disk cache when valid.
      const fetchOpts = {
        credentials: "same-origin",
        cache: "force-cache",
        mode: "cors",
      };
      const manRes = await fetch(new URL("manifest.json", base), fetchOpts);
      if (!manRes.ok) throw new Error("manifest HTTP " + manRes.status);
      const man = await manRes.json();
      const parts = Array.isArray(man.parts) ? man.parts : [];
      // Parallel shard fetch — only when Browser opens (~1 MB total; CF-cacheable static)
      await Promise.all(
        parts.map(async (part) => {
          try {
            const r = await fetch(new URL(part, base), fetchOpts);
            if (!r.ok) return;
            const text = await r.text();
            const lines = text.split("\n");
            for (let i = 0; i < lines.length; i++) {
              let d = lines[i].trim().toLowerCase();
              if (!d || d.charCodeAt(0) === 35) continue; // #
              if (d.startsWith("www.")) d = d.slice(4);
              if (!d.includes(".")) continue;
              SAFETY_DOMAINS.add(d);
              BLOCKED_BARE.add(d);
            }
          } catch {
            /* single shard fail — keep others */
          }
        })
      );
      safetyLoadStatus.loaded = true;
      safetyLoadStatus.loading = false;
      safetyLoadStatus.count = SAFETY_DOMAINS.size;
      safetyLoadStatus.error = null;
      safetyLoadStatus.source = man.source || "safety/hosts";
      console.info(
        "[ASX] safety hosts loaded ·",
        safetyLoadStatus.count,
        "domains ·",
        safetyLoadStatus.source
      );
    } catch (e) {
      safetyLoadStatus.loaded = false;
      safetyLoadStatus.loading = false;
      safetyLoadStatus.error = String(e && e.message ? e.message : e);
      console.warn(
        "[ASX] safety/hosts load failed — core blocklist only:",
        safetyLoadStatus.error
      );
    }
    return safetyLoadStatus;
  })();
  return safetyLoadPromise;
}

function hostMatchesBlocked(host, foldedExtra) {
  if (!host && !foldedExtra) return false;
  const h = String(host || "").replace(/^www\./, "");
  const folded = foldHostConfusable(foldedExtra || h);

  if (
    BLOCKED_BARE.has(h) ||
    SAFETY_DOMAINS.has(h) ||
    BLOCKED_HOSTS.has(h) ||
    BLOCKED_HOSTS.has(`www.${h}`) ||
    BLOCKED_BARE.has(folded) ||
    SAFETY_DOMAINS.has(folded)
  ) {
    return true;
  }

  // suffix walk on both ASCII/puny and folded forms
  const walk = (base) => {
    let i = base.indexOf(".");
    while (i !== -1) {
      const rest = base.slice(i + 1);
      if (
        BLOCKED_BARE.has(rest) ||
        SAFETY_DOMAINS.has(rest) ||
        BLOCKED_BARE.has(foldHostConfusable(rest))
      ) {
        return true;
      }
      i = base.indexOf(".", i + 1);
    }
    return false;
  };
  if (walk(h) || walk(folded)) return true;

  // brand tokens on folded host labels only (not full URL)
  for (let k = 0; k < BLOCKED_HOST_TOKENS.length; k++) {
    const tok = BLOCKED_HOST_TOKENS[k];
    if (folded.includes(tok) || h.includes(tok)) return true;
  }

  // TLD-style adult
  if (
    h.endsWith(".xxx") ||
    folded.endsWith(".xxx") ||
    h.endsWith(".adult") ||
    h.endsWith(".sex") ||
    h.endsWith(".porn")
  ) {
    return true;
  }

  return false;
}

/**
 * Sync check against **already loaded** lists + core brands.
 * Does NOT fetch safety/hosts — Browser must call ensureSafetyListsLoaded() first.
 * (Guests who never open Browser never download the ~1 MB shards.)
 */
export function isBlockedUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return false;
  if (SCHEME_DENY.test(raw)) return true;

  const uni = hostUnicodeOf(raw);
  const idna = hostOf(raw);
  if (hostMatchesBlocked(idna, uni) || hostMatchesBlocked(uni, uni)) return true;

  // Also evaluate after normalize (defense in depth)
  try {
    const n = normalizeNavUrl(raw);
    if (n !== raw) {
      const uni2 = hostUnicodeOf(n);
      const idna2 = hostOf(n);
      if (hostMatchesBlocked(idna2, uni2) || hostMatchesBlocked(uni2, uni2)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Await safety shards then re-check. **Only** Browser / policy UI should call this.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function isBlockedUrlAsync(url) {
  await ensureSafetyListsLoaded();
  return isBlockedUrl(url);
}

export function normalizeNavUrl(input) {
  let s = String(input || "").trim();
  if (!s) return "https://example.com";
  if (SCHEME_DENY.test(s)) return "https://example.com";
  if (!HAS_SCHEME.test(s)) {
    if (s.startsWith("//")) {
      s = `https:${s}`;
    } else if (s.includes(" ") || !s.includes(".")) {
      s = `https://duckduckgo.com/?q=${encodeURIComponent(s)}`;
    } else {
      s = `https://${s}`;
    }
  }
  return s;
}
