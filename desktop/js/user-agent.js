/**
 * Client / guest profile for Settings & About screens.
 * Uses @egjs/agent (cdnjs) for browser + OS detection.
 * https://cdnjs.com/libraries/egjs-agent
 *
 * Never fingerprints server-side; all data stays in the guest browser UI.
 */

const EGJS_AGENT_VERSION = "2.4.4";
const EGJS_AGENT_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/egjs-agent/${EGJS_AGENT_VERSION}/agent.min.js`,
  `https://cdn.jsdelivr.net/npm/@egjs/agent@${EGJS_AGENT_VERSION}/dist/agent.min.js`,
];

/** @type {Promise<Function|null>|null} */
let loadPromise = null;
/** @type {Function|null} */
let agentFn = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window.eg?.agent === "function") {
      resolve(window.eg.agent);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => {
      if (typeof window.eg?.agent === "function") resolve(window.eg.agent);
      else reject(new Error("eg.agent missing after " + src));
    };
    s.onerror = () => reject(new Error("egjs-agent failed: " + src));
    document.head.appendChild(s);
  });
}

/**
 * Load @egjs/agent. Resolves to the agent() function or null.
 */
export function ensureEgjsAgent() {
  if (agentFn) return Promise.resolve(agentFn);
  if (loadPromise) return loadPromise;
  if (typeof window.eg?.agent === "function") {
    agentFn = window.eg.agent;
    loadPromise = Promise.resolve(agentFn);
    return loadPromise;
  }
  loadPromise = (async () => {
    let last;
    for (const src of EGJS_AGENT_SOURCES) {
      try {
        agentFn = await loadScript(src);
        return agentFn;
      } catch (e) {
        last = e;
      }
    }
    console.warn("[asx-agent] egjs-agent unavailable — UA fallback only", last);
    agentFn = null;
    return null;
  })();
  return loadPromise;
}

function parseUaFallback() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  let browser = "Unknown";
  let browserVer = "";
  let os = "Unknown";
  if (/Edg\//.test(ua)) {
    browser = "Edge";
    browserVer = (ua.match(/Edg\/([\d.]+)/) || [])[1] || "";
  } else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) {
    browser = "Chrome";
    browserVer = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || "";
  } else if (/Firefox\//.test(ua)) {
    browser = "Firefox";
    browserVer = (ua.match(/Firefox\/([\d.]+)/) || [])[1] || "";
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    browser = "Safari";
    browserVer = (ua.match(/Version\/([\d.]+)/) || [])[1] || "";
  }
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return {
    browser: { name: browser, version: browserVer },
    os: { name: os, version: "" },
    isMobile: /Mobi|Android/i.test(ua),
    isDesktop: !/Mobi|Android/i.test(ua),
    raw: ua,
    source: "fallback",
  };
}

/**
 * Run eg.agent() (or fallback) and normalize fields.
 */
export async function detectAgent() {
  const fn = await ensureEgjsAgent();
  if (!fn) return parseUaFallback();
  try {
    const info = fn();
    return {
      browser: {
        name: info?.browser?.name || "Unknown",
        version: info?.browser?.version || "",
        majorVersion: info?.browser?.majorVersion,
        webkit: !!info?.browser?.webkit,
        chromium: !!info?.browser?.chromium,
      },
      os: {
        name: info?.os?.name || "Unknown",
        version: info?.os?.version || "",
      },
      isMobile: !!info?.isMobile,
      isDesktop: info?.isDesktop != null ? !!info.isDesktop : !info?.isMobile,
      isTablet: !!info?.isTablet,
      raw: typeof navigator !== "undefined" ? navigator.userAgent || "" : "",
      source: "egjs-agent",
      accurate: false,
    };
  } catch (e) {
    console.warn("[asx-agent] parse error", e);
    return parseUaFallback();
  }
}

/**
 * Full “About you” profile for Settings / About UI.
 * Combines account session + egjs-agent + environment (all local).
 */
export async function getUserAboutProfile(sessionUser) {
  const agent = await detectAgent();
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const scr = typeof screen !== "undefined" ? screen : {};
  const tz =
    (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch {
        return "";
      }
    })() || "";

  const online = typeof navigator !== "undefined" ? navigator.onLine !== false : true;

  return {
    host: {
      title: "Alison Scorpion Desktop",
      owner: "Alison Scorpion (ASX)",
      role: "You are a guest on her workstation",
      product: "ASX OS Desktop · free apps",
    },
    guest: sessionUser
      ? {
          signedIn: true,
          username: sessionUser.username || "",
          email: sessionUser.email || "",
          id: sessionUser.id || "",
          createdAt: sessionUser.createdAt || null,
        }
      : {
          signedIn: false,
          username: "guest",
          email: "",
          id: "",
          createdAt: null,
          hint: "Sign up under Network → Users → Add for a local account on this device.",
        },
    device: {
      browser: agent.browser.name,
      browserVersion: agent.browser.version,
      os: agent.os.name,
      osVersion: agent.os.version,
      form: agent.isMobile ? "mobile" : agent.isTablet ? "tablet" : "desktop",
      isMobile: agent.isMobile,
      isDesktop: agent.isDesktop,
      language: nav.language || "",
      languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 5) : [],
      platform: nav.platform || "",
      hardwareConcurrency: nav.hardwareConcurrency || null,
      deviceMemory: nav.deviceMemory || null,
      cookieEnabled: !!nav.cookieEnabled,
      online,
      timezone: tz,
      screen: {
        width: scr.width || 0,
        height: scr.height || 0,
        availWidth: scr.availWidth || 0,
        availHeight: scr.availHeight || 0,
        colorDepth: scr.colorDepth || 0,
        pixelRatio:
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      },
      viewport: {
        width: typeof window !== "undefined" ? window.innerWidth : 0,
        height: typeof window !== "undefined" ? window.innerHeight : 0,
      },
      agentSource: agent.source,
      userAgent: agent.raw,
    },
    egjsAgentVersion: EGJS_AGENT_VERSION,
  };
}

/**
 * Build HTML rows for a definition list (escaped by caller via escapeHtml).
 */
export function profileToRows(profile) {
  const d = profile.device;
  const g = profile.guest;
  const h = profile.host;
  const rows = [
    ["Desktop", h.title],
    ["Owner", h.owner],
    ["Your role", h.role],
    ["Account", g.signedIn ? g.username : "guest (not signed in)"],
  ];
  if (g.signedIn && g.email) rows.push(["Email", g.email]);
  if (g.signedIn && g.id) rows.push(["Account id", g.id]);
  if (!g.signedIn && g.hint) rows.push(["Sign up", g.hint]);
  rows.push(
    ["Browser", `${d.browser}${d.browserVersion ? " " + d.browserVersion : ""}`],
    ["Operating system", `${d.os}${d.osVersion ? " " + d.osVersion : ""}`],
    ["Device form", d.form],
    ["Language", d.language || "—"],
    ["Timezone", d.timezone || "—"],
    ["Screen", `${d.screen.width}×${d.screen.height} @${d.screen.pixelRatio}x`],
    ["Viewport", `${d.viewport.width}×${d.viewport.height}`],
    ["Network", d.online ? "Online" : "Offline"],
    ["Platform", d.platform || "—"]
  );
  if (d.hardwareConcurrency) rows.push(["CPU threads", String(d.hardwareConcurrency)]);
  if (d.deviceMemory) rows.push(["Device memory", `${d.deviceMemory} GB (approx)`]);
  rows.push(["UA parser", d.agentSource === "egjs-agent" ? `egjs-agent ${profile.egjsAgentVersion}` : "fallback"]);
  return rows;
}

export { EGJS_AGENT_VERSION };
