/**
 * ASX Desktop browser blocklist — adult / high-risk hosts.
 * Optimized: bare-host Set (O(1) + suffix walk) vs full-set scan.
 * Hermes H3-02/H3-03: confusable fold + host-scoped keywords (repair LOOP c3).
 * CLASS R0 policy list; soft client UX — not a network firewall.
 *
 * Public list inspiration (full files too large for guest JS; curated subset):
 * - github.com/StevenBlack/hosts (porn / unified hosts extensions)
 * - OISD NSFW (sjhgvr) / Pi-hole community adult lists
 * - Hagezi DNS blocklists (malware; NSFW often separate)
 * Research: agents/research/threejs → desktop browser note + blocklist_sources_20260810.md
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
  "\u039f": "o",
  "\u0420": "p",
  "\u0405": "s",
  "\u0410": "a",
  "\u0415": "e",
  "\u041e": "o",
  "\uff4f": "o", // fullwidth
  "\uff41": "a",
  "\uff45": "e",
  "\uff50": "p",
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

function hostMatchesBlocked(host, foldedExtra) {
  if (!host && !foldedExtra) return false;
  const h = String(host || "").replace(/^www\./, "");
  const folded = foldHostConfusable(foldedExtra || h);

  if (
    BLOCKED_BARE.has(h) ||
    BLOCKED_HOSTS.has(h) ||
    BLOCKED_HOSTS.has(`www.${h}`) ||
    BLOCKED_BARE.has(folded)
  ) {
    return true;
  }

  // suffix walk on both ASCII/puny and folded forms
  const walk = (base) => {
    let i = base.indexOf(".");
    while (i !== -1) {
      const rest = base.slice(i + 1);
      if (BLOCKED_BARE.has(rest) || BLOCKED_BARE.has(foldHostConfusable(rest))) return true;
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

/** O(1) host set + suffix + confusable fold; keywords host-scoped */
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
