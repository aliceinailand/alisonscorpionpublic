/**
 * ASX Desktop browser blocklist — adult / high-risk hosts.
 * Optimized: bare-host Set (O(1) + suffix walk) vs full-set scan.
 * Pattern: pyreferctror fail-fast + all_in_one precomputed lookup tables.
 * CLASS R0 policy list; expand offline.
 */
export const BLOCKED_HOSTS = new Set([
  "pornhub.com", "www.pornhub.com",
  "xvideos.com", "www.xvideos.com",
  "xnxx.com", "www.xnxx.com",
  "xhamster.com", "www.xhamster.com",
  "redtube.com", "www.redtube.com",
  "youporn.com", "www.youporn.com",
  "porn.com", "www.porn.com",
  "onlyfans.com", "www.onlyfans.com",
  "chaturbate.com", "www.chaturbate.com",
  "stripchat.com", "www.stripchat.com",
  "bongacams.com", "www.bongacams.com",
  "livejasmin.com", "www.livejasmin.com",
  "spankbang.com", "www.spankbang.com",
  "eporner.com", "www.eporner.com",
  "hqporner.com", "www.hqporner.com",
  "motherless.com", "www.motherless.com",
  "porntrex.com", "www.porntrex.com",
  "rule34.xxx", "www.rule34.xxx",
  "nhentai.net", "www.nhentai.net",
  "hanime.tv", "www.hanime.tv",
]);

/** Bare registrable hosts (no www.) — built once */
export const BLOCKED_BARE = new Set(
  [...BLOCKED_HOSTS].map((h) => h.replace(/^www\./, ""))
);

export const BLOCKED_KEYWORDS = Object.freeze([
  "porn", "xxx", "nsfw", "onlyfans", "hentai", "xvideos", "pornhub",
]);

const SCHEME_DENY = /^(javascript|data|vbscript|file):/i;
const HAS_SCHEME = /^https?:\/\//i;

export function hostOf(url) {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** O(1) host set + suffix labels; early return on empty */
export function isBlockedUrl(url) {
  const raw = String(url || "").toLowerCase();
  if (!raw) return false;
  const host = hostOf(url);
  if (host) {
    if (BLOCKED_BARE.has(host) || BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(`www.${host}`)) {
      return true;
    }
    // subdomain: foo.bar.pornhub.com → walk labels
    let i = host.indexOf(".");
    while (i !== -1) {
      const rest = host.slice(i + 1);
      if (BLOCKED_BARE.has(rest)) return true;
      i = host.indexOf(".", i + 1);
    }
  }
  for (let k = 0; k < BLOCKED_KEYWORDS.length; k++) {
    const kw = BLOCKED_KEYWORDS[k];
    if (host.includes(kw) || raw.includes(kw)) return true;
  }
  return false;
}

export function normalizeNavUrl(input) {
  let s = String(input || "").trim();
  if (!s) return "https://example.com";
  if (SCHEME_DENY.test(s)) return "https://example.com";
  if (!HAS_SCHEME.test(s)) {
    if (s.includes(" ") || !s.includes(".")) {
      s = `https://duckduckgo.com/?q=${encodeURIComponent(s)}`;
    } else {
      s = `https://${s}`;
    }
  }
  return s;
}
