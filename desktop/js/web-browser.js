/**
 * Desktop Browser — primary: ASX / Alison Scorpion Browser (Copper-class WebKit
 * via localhost bridge). Legacy Chromium Web Observer remains a secondary path.
 */
import { isBlockedUrlAsync, normalizeNavUrl } from "./blocklist.js?v=20261115sat2";

const ASX_BRIDGE = "http://127.0.0.1:4124";
const BRIDGE_HTTP = "http://127.0.0.1:8791";
const BRIDGE_WS = "ws://127.0.0.1:8791/session";
const GO = "asx-live-browser-go";
let activeGo = null;
let session = null;

window.addEventListener(GO, (ev) => {
  const url = ev.detail && ev.detail.url;
  if (url && activeGo) activeGo(url);
});

const STORY_TITLE = "The Alice and the Scorpion Framework Storybook";
const STORY_URL = "https://trippyalice.com";
const ASX_BROWSER = "ASX Satellite";
const OBSERVER = "ASX Web Observer (legacy Chromium)";
const PLUGIN_STORAGE_KEY = "asx-browser-plugins";
const PLUGIN_CATALOG = [
  {
    id: "ai-sidebar",
    label: "AI Sidebar",
    summary: "Keep an always-available provenance and source-monitor panel alongside the page.",
  },
  {
    id: "tab-groups",
    label: "Tab Groups",
    summary: "Organize work into lightweight workspaces without forcing a heavy browser shell.",
  },
  {
    id: "provenance-ledger",
    label: "Provenance Ledger",
    summary: "Record source, audit, and verification metadata for each browsing session.",
  },
  {
    id: "split-view",
    label: "Split View",
    summary: "Compare sources side-by-side while keeping the shell one-window and minimal.",
  },
  {
    id: "filters",
    label: "Source Filters",
    summary: "Reduce noise with blocklists, safe-domain allowlists, and filter-by-source tools.",
  },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, title, onClick) {
  const node = el("button", "", label);
  node.type = "button";
  if (title) node.title = title;
  node.addEventListener("click", onClick);
  return node;
}

function loadPluginState() {
  try {
    const raw = localStorage.getItem(PLUGIN_STORAGE_KEY);
    if (!raw) return Object.fromEntries(PLUGIN_CATALOG.map((plugin) => [plugin.id, false]));
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return Object.fromEntries(PLUGIN_CATALOG.map((plugin) => [plugin.id, false]));
    }
    return Object.fromEntries(
      PLUGIN_CATALOG.map((plugin) => [plugin.id, Boolean(parsed[plugin.id])])
    );
  } catch {
    return Object.fromEntries(PLUGIN_CATALOG.map((plugin) => [plugin.id, false]));
  }
}

function persistPluginState(state) {
  try {
    localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures in private or restricted browsing modes.
  }
}

function ensurePluginDialog() {
  let dialog = document.getElementById("asx-browser-plugin-dialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "asx-browser-plugin-dialog";
  dialog.setAttribute("aria-labelledby", "asx-browser-plugin-title");
  dialog.className = "asx-browser-plugin-dialog";

  const title = document.createElement("h2");
  title.id = "asx-browser-plugin-title";
  title.textContent = "ASX Satellite plugins";

  const list = document.createElement("div");
  list.className = "asx-browser-plugin-list";

  const state = loadPluginState();
  for (const plugin of PLUGIN_CATALOG) {
    const row = document.createElement("label");
    row.className = "asx-browser-plugin-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(state[plugin.id]);
    checkbox.setAttribute("aria-label", `${plugin.label} plugin toggle`);

    checkbox.addEventListener("change", () => {
      const nextState = loadPluginState();
      nextState[plugin.id] = checkbox.checked;
      persistPluginState(nextState);
    });

    const info = document.createElement("div");
    info.className = "asx-browser-plugin-info";
    const name = document.createElement("strong");
    name.textContent = plugin.label;
    const summary = document.createElement("span");
    summary.textContent = plugin.summary;
    info.append(name, summary);

    row.append(checkbox, info);
    list.appendChild(row);
  }

  const form = document.createElement("form");
  form.method = "dialog";
  form.className = "asx-browser-plugin-actions";

  const closeButton = document.createElement("button");
  closeButton.type = "submit";
  closeButton.textContent = "Close";
  closeButton.autofocus = true;
  form.appendChild(closeButton);

  dialog.append(title, list, form);
  document.body.appendChild(dialog);
  return dialog;
}

/** Guest-desktop Ask ASX panel — calls bridge /agent/* (external asx, not embedded). */
function ensureAskAsxDialog() {
  let dialog = document.getElementById("asx-browser-ask-dialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "asx-browser-ask-dialog";
  dialog.setAttribute("aria-labelledby", "asx-browser-ask-title");
  dialog.className = "asx-browser-ask-dialog";

  const title = document.createElement("h2");
  title.id = "asx-browser-ask-title";
  title.textContent = "Ask ASX";

  const blurb = el(
    "p",
    "asx-browser-ask-blurb",
    "Alison Scorpion via the local bridge (127.0.0.1:4124 → asx query). Same path as native Ctrl+E."
  );

  const health = el("p", "asx-browser-ask-health", "Checking bridge…");
  health.setAttribute("aria-live", "polite");

  const log = document.createElement("ol");
  log.className = "asx-browser-ask-log";
  log.setAttribute("aria-live", "polite");
  log.setAttribute("aria-relevant", "additions");

  const form = document.createElement("form");
  form.className = "asx-browser-ask-form";
  form.id = "asx-browser-ask-form";

  const label = document.createElement("label");
  label.className = "sr-only";
  label.htmlFor = "asx-browser-ask-q";
  label.textContent = "Ask ASX";

  const q = document.createElement("textarea");
  q.id = "asx-browser-ask-q";
  q.name = "q";
  q.rows = 3;
  q.required = true;
  q.setAttribute("enterkeyhint", "send");
  q.placeholder = "Ask Alison Scorpion…";

  const hint = el("p", "asx-browser-ask-hint", "Enter to send · Shift+Enter for newline");

  const actions = el("div", "asx-browser-ask-actions");
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "Health";
  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Ask ASX";
  actions.append(refresh, send);
  form.append(label, q, hint, actions);

  const closeForm = document.createElement("form");
  closeForm.method = "dialog";
  closeForm.className = "asx-browser-ask-close-form";
  const closeBtn = document.createElement("button");
  closeBtn.type = "submit";
  closeBtn.value = "close";
  closeBtn.textContent = "Close";
  closeForm.appendChild(closeBtn);

  dialog.append(title, blurb, health, log, form, closeForm);
  document.body.appendChild(dialog);

  const addBubble = (who, text) => {
    const li = document.createElement("li");
    const whoEl = el("div", "who" + (who === "ASX" ? " asx" : ""), who);
    const pre = document.createElement("pre");
    pre.textContent = text;
    li.append(whoEl, pre);
    log.appendChild(li);
    li.scrollIntoView({ block: "end" });
  };

  const setHealth = (ok, message) => {
    health.classList.toggle("ok", !!ok);
    health.classList.toggle("bad", !ok);
    health.textContent = message;
  };

  const checkHealth = async () => {
    setHealth(false, "Checking ASX bridge…");
    try {
      const res = await fetch(ASX_BRIDGE + "/agent/health", { method: "GET" });
      const data = await res.json();
      if (data && data.ok) {
        setHealth(true, "Bridge OK · external asx · not embedded");
        return true;
      }
      setHealth(false, (data && (data.error || data.status_preview)) || "Agent unhealthy");
      return false;
    } catch {
      setHealth(false, "Bridge unreachable — start asx_browser_bridge.py on :4124");
      return false;
    }
  };

  const ask = async (query) => {
    send.disabled = true;
    refresh.disabled = true;
    addBubble("You", query);
    try {
      const res = await fetch(ASX_BRIDGE + "/agent/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data && data.ok) {
        addBubble("ASX", String(data.output || "").trim() || "(empty reply)");
      } else {
        addBubble("ASX", (data && (data.error || data.stderr || data.output)) || "Ask failed");
      }
    } catch (err) {
      addBubble("ASX", "Bridge error: " + (err && err.message ? err.message : String(err)));
    } finally {
      send.disabled = false;
      refresh.disabled = false;
      q.focus();
    }
  };

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = q.value.trim();
    if (!text) return;
    q.value = "";
    ask(text);
  });

  q.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.shiftKey) return;
    ev.preventDefault();
    if (ev.isComposing || ev.keyCode === 229) return;
    form.requestSubmit();
  });

  refresh.addEventListener("click", () => {
    checkHealth();
  });

  dialog.addEventListener("close", () => {
    /* keep log across reopen */
  });

  dialog._asxPrepare = async () => {
    if (!log.children.length) {
      addBubble(
        "ASX",
        "Ready. Native Copper: Ctrl+E opens the Agent sidebar. Settings › Extensions lists the ASX Agent addon."
      );
    }
    await checkHealth();
    q.focus();
  };

  return dialog;
}

function openAskAsxDialog() {
  const dialog = ensureAskAsxDialog();
  const open = () => {
    if (typeof dialog._asxPrepare === "function") dialog._asxPrepare();
  };
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
    open();
    return;
  }
  dialog.setAttribute("open", "open");
  open();
}

export function openStorybook(wm) {
  return openLiveBrowser(wm, { title: STORY_TITLE, initialUrl: STORY_URL });
}

/** Primary guest Browser: Alison Scorpion / ASX Satellite (WebKit one-field). */
export function openLiveBrowser(wm, opts = {}) {
  if (opts.legacyChromium) {
    return openLegacyChromiumObserver(wm, opts);
  }
  return openAsxBrowserWindow(wm, opts);
}

function openAsxBrowserWindow(wm, opts = {}) {
  const root = el("div", "live-browser asx-browser");
  const bar = el("div", "browser-bar");
  const urlIn = document.createElement("input");
  urlIn.type = "text";
  urlIn.className = "url";
  urlIn.spellcheck = false;
  urlIn.autocomplete = "off";
  urlIn.setAttribute("aria-label", "Address or search");
  urlIn.placeholder = "Address or search — ASX Satellite (one field)";
  const pluginButton = button("Plugins", "Choose lightweight browser plugins", () => {
    const dialog = ensurePluginDialog();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "open");
  });
  const askButton = button("Ask ASX", "Ask Alison Scorpion via local bridge", () => {
    openAskAsxDialog();
  });
  bar.append(
    button("↻", "Refresh bridge status", () => refreshHealth()),
    urlIn,
    button("Go", "Open in ASX Satellite", () => go(urlIn.value)),
    button("Native", "Focus native ASX Satellite window", () => go(urlIn.value || "https://example.com", true)),
    askButton,
    pluginButton
  );

  const view = el("div", "live-view");
  const start = el("div", "live-start");
  const offline = el("div", "live-offline");
  const blocked = el("div", "live-block");
  const panel = el("div", "live-start");
  panel.style.overflow = "auto";
  panel.style.padding = "16px";
  view.append(start, offline, blocked, panel);

  const status = el("div", "live-status");
  root.append(bar, view, status);

  let closed = false;
  let pending = "";

  const setStatus = (text) => {
    status.textContent = text;
  };

  const show = (which) => {
    start.hidden = which !== "start";
    offline.hidden = which !== "offline";
    blocked.hidden = which !== "blocked";
    panel.hidden = which !== "page";
  };

  function fillStart() {
    start.replaceChildren();
    start.append(
      el("h2", "", "ASX Satellite"),
      el(
        "p",
        "",
        "Alison Scorpion Browser — Copper-class minimal WebKit (system WebKitGTK). One address field. Not BrowserOS; no bundled Chromium."
      ),
      el(
        "p",
        "",
        "Go opens the URL in the native ASX Satellite via the local bridge (127.0.0.1:4124 → asx-browser)."
      ),
      el(
        "p",
        "",
        "Ask ASX (toolbar) talks to the same bridge. In the native window: Ctrl+E toggles the Agent sidebar; Settings › Extensions lists the ASX Agent addon."
      )
    );
    const list = document.createElement("div");
    list.className = "live-picks";
    [
      ["example.com", "https://example.com"],
      ["trippyalice.com", STORY_URL],
      ["alisonscorpion.com", "https://alisonscorpion.com"],
      ["info.cern.ch", "https://info.cern.ch"],
    ].forEach(([label, href]) => {
      list.appendChild(button(label, href, () => go(href)));
    });
    start.appendChild(list);
    start.appendChild(
      button("Legacy Chromium Web Observer…", "Optional fallback", () => {
        openLegacyChromiumObserver(wm, { title: OBSERVER });
      })
    );
  }

  function fillOffline() {
    offline.replaceChildren();
    offline.append(
      el("h2", "", "ASX Satellite bridge is not running"),
      el(
        "p",
        "",
        "Start the bridge on this machine: python3 external-tools/asx-browser/bridge/asx_browser_bridge.py"
      ),
      el("p", "", "And ensure Copper / asx-browser is installed (WebKitGTK).")
    );
  }

  function showBlocked(url, reason) {
    blocked.replaceChildren();
    blocked.append(
      el("h2", "", "This address is blocked"),
      el("p", "live-url", url),
      el("p", "", reason || "Alison Scorpion refused this address.")
    );
    show("blocked");
    setStatus(reason || "Blocked");
  }

  async function refreshHealth() {
    try {
      const res = await fetch(ASX_BRIDGE + "/health", { method: "GET" });
      const data = await res.json();
      if (data && data.ok) {
        setStatus("ASX Satellite bridge OK · WebKit via copper · " + (data.health || "").split("\n")[0]);
        return true;
      }
      setStatus("ASX Satellite bridge responded but copper health failed");
      return false;
    } catch {
      show("offline");
      setStatus("ASX Satellite bridge not reachable on 127.0.0.1:4124");
      return false;
    }
  }

  async function go(raw, focus) {
    const url = normalizeNavUrl(raw);
    urlIn.value = url;
    if (await isBlockedUrlAsync(url)) {
      showBlocked(url, "category detection: adult website, blocked");
      return;
    }
    pending = url;
    setStatus("Opening in ASX Satellite… " + url);
    try {
      const res = await fetch(ASX_BRIDGE + "/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, focus: !!focus }),
      });
      const data = await res.json();
      if (!data.ok) {
        show("offline");
        setStatus("ASX Satellite open failed — is the bridge and copper running?");
        fillOffline();
        return;
      }
      panel.replaceChildren();
      panel.append(
        el("h2", "", "Opened in ASX Satellite"),
        el("p", "live-url", url),
        el("p", "", "Native Copper-class WebKit window / agent tab. One-field UX lives in the native browser.")
      );
      const pre = document.createElement("pre");
      pre.style.whiteSpace = "pre-wrap";
      pre.style.fontSize = "11px";
      pre.textContent = String(data.output || "").slice(0, 2500);
      panel.appendChild(pre);
      show("page");
      setStatus("ASX Satellite · " + url);
    } catch {
      show("offline");
      fillOffline();
      setStatus("ASX Satellite bridge not reachable on 127.0.0.1:4124");
    }
  }

  urlIn.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      if (ev.isComposing || ev.keyCode === 229) return;
      go(urlIn.value);
    }
  });

  fillStart();
  fillOffline();
  show("start");
  setStatus("ASX Satellite — checking local bridge…");

  const initial = opts.initialUrl || "";
  const already = wm.windows.has("browser");
  wm.open({
    id: "browser",
    title: opts.title || ASX_BROWSER,
    w: 960,
    h: 640,
    x: 48,
    y: 24,
    body: root,
    onMount: () => {
      session = { go, ensure: refreshHealth };
      activeGo = go;
      refreshHealth().then((ok) => {
        if (ok) show("start");
        if (initial) go(initial);
      });
    },
    onClose: () => {
      closed = true;
      if (activeGo === go) activeGo = null;
      if (session && session.go === go) session = null;
    },
  });
  if (already && initial && session) {
    session.ensure();
    session.go(initial);
  }
}

/** Legacy Chromium live-view bridge (optional fallback). */
function openLegacyChromiumObserver(wm, opts = {}) {
  const root = el("div", "live-browser");
  const bar = el("div", "browser-bar");
  const urlIn = document.createElement("input");
  urlIn.type = "text";
  urlIn.className = "url";
  urlIn.spellcheck = false;
  urlIn.autocomplete = "off";
  urlIn.setAttribute("aria-label", "Address");
  urlIn.placeholder = "https://";
  bar.append(
    button("◀", "Back", () => send({ type: "back" })),
    button("▶", "Forward", () => send({ type: "forward" })),
    button("↻", "Reload", () => send({ type: "reload" })),
    button("⌂", "Home", () => goHome()),
    urlIn,
    button("Go", "Open this address", () => go(urlIn.value))
  );

  const view = el("div", "live-view");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "ASX Web Observer page");
  canvas.tabIndex = 0;
  const start = el("div", "live-start");
  const offline = el("div", "live-offline");
  const blocked = el("div", "live-block");
  view.append(canvas, start, offline, blocked);

  const status = el("div", "live-status");
  root.append(bar, view, status);

  let socket = null;
  let viewW = 0;
  let viewH = 0;
  let pending = "";
  let closed = false;
  let engineMode = "";
  let holdFrames = false;
  let paintGeneration = 0;

  const setStatus = (text) => {
    status.textContent = text;
  };

  const show = (panel) => {
    start.hidden = panel !== "start";
    offline.hidden = panel !== "offline";
    blocked.hidden = panel !== "blocked";
    canvas.hidden = panel === "offline";
  };

  function fillStart() {
    start.replaceChildren();
    start.append(
      el("h2", "", OBSERVER),
      el(
        "p",
        "",
        "Legacy path: Chromium on this computer drawn into the window. Prefer ASX Satellite (WebKit) for the product guest Browser."
      )
    );
  }

  function fillOffline() {
    offline.replaceChildren();
    offline.append(
      el("h2", "", "Legacy Web Observer is not running"),
      el("p", "", "Chromium bridge on 127.0.0.1:8791 is down. Use ASX Satellite instead.")
    );
  }

  function showBlocked(url, reason) {
    blocked.replaceChildren();
    blocked.append(
      el("h2", "", "This address is blocked"),
      el("p", "live-url", url),
      el("p", "", reason || "Alison Scorpion refused this address.")
    );
    holdFrames = true;
    show("blocked");
    setStatus(reason || "Blocked");
  }

  function send(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function resize() {
    const rect = view.getBoundingClientRect();
    const width = Math.max(200, Math.min(1600, Math.round(rect.width)));
    const height = Math.max(160, Math.min(1200, Math.round(rect.height)));
    send({ type: "resize", width, height });
  }

  async function go(raw) {
    const url = normalizeNavUrl(raw);
    urlIn.value = url;
    if (await isBlockedUrlAsync(url)) {
      showBlocked(url, "category detection: adult website, blocked");
      return;
    }
    pending = url;
    holdFrames = true;
    show("page");
    if (!send({ type: "navigate", url })) {
      setStatus("Waiting for legacy Web Observer…");
    } else {
      setStatus("Opening " + url);
    }
  }

  function observerStatus() {
    const mode =
      engineMode === "headed"
        ? "real Chromium window"
        : engineMode === "headless"
          ? "headless Chromium"
          : "Chromium on this computer";
    return OBSERVER + " · " + mode;
  }

  function goHome() {
    pending = "";
    urlIn.value = "";
    show("start");
    send({ type: "home" });
    setStatus(observerStatus());
  }

  function draw(jpeg, w, h) {
    if (typeof jpeg !== "string" || !jpeg.startsWith("/9j/") || jpeg.length > 1500000) return;
    viewW = Number(w) || viewW;
    viewH = Number(h) || viewH;
    const generation = ++paintGeneration;
    const image = new Image();
    image.onload = () => {
      if (generation !== paintGeneration) return;
      const width = canvas.clientWidth || 800;
      const height = canvas.clientHeight || 500;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.drawImage(image, 0, 0, width, height);
    };
    image.src = "data:image/jpeg;base64," + jpeg;
  }

  function point(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * (viewW || rect.width);
    const y = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * (viewH || rect.height);
    return { x, y };
  }

  canvas.addEventListener("mousedown", (ev) => {
    const p = point(ev);
    send({ type: "mouse", action: "down", button: ev.button, x: p.x, y: p.y });
  });
  canvas.addEventListener("mouseup", (ev) => {
    const p = point(ev);
    send({ type: "mouse", action: "up", button: ev.button, x: p.x, y: p.y });
  });
  canvas.addEventListener("mousemove", (ev) => {
    const p = point(ev);
    send({ type: "mouse", action: "move", x: p.x, y: p.y });
  });
  canvas.addEventListener(
    "wheel",
    (ev) => {
      send({ type: "wheel", deltaX: ev.deltaX, deltaY: ev.deltaY });
      ev.preventDefault();
    },
    { passive: false }
  );
  canvas.addEventListener("keydown", (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key.length === 1) {
      send({ type: "type", text: ev.key });
      ev.preventDefault();
      return;
    }
    send({ type: "key", key: ev.key, code: ev.code });
    ev.preventDefault();
  });
  urlIn.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      if (ev.isComposing || ev.keyCode === 229) return;
      go(urlIn.value);
    }
  });

  function connect() {
    let ws;
    try {
      ws = new WebSocket(BRIDGE_WS);
    } catch {
      show("offline");
      setStatus("Legacy Web Observer is not running.");
      return;
    }
    socket = ws;
    ws.onopen = () => {
      show(pending ? "page" : "start");
      setStatus("Legacy Web Observer connected");
      resize();
      if (pending) send({ type: "navigate", url: pending });
    };
    ws.onmessage = (ev) => {
      let message;
      try {
        message = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;
      if (message.type === "frame") {
        if (holdFrames) return;
        show("page");
        draw(message.jpeg, message.w, message.h);
      } else if (message.type === "status") {
        if (typeof message.url === "string" && message.url && message.url !== "about:blank") {
          holdFrames = false;
          if (document.activeElement !== urlIn) urlIn.value = message.url;
          setStatus(message.url);
        }
      } else if (message.type === "blocked") {
        showBlocked(urlIn.value || pending, message.reason || "Blocked");
      } else if (message.type === "ready") {
        engineMode = message.mode === "headed" ? "headed" : "headless";
        setStatus(observerStatus());
      }
    };
    ws.onerror = () => {
      show("offline");
      setStatus("Legacy Web Observer is not running.");
    };
    ws.onclose = () => {
      if (closed) return;
      socket = null;
      show("offline");
      setStatus("Legacy Web Observer disconnected.");
    };
  }

  fillStart();
  fillOffline();
  show("start");
  setStatus("Looking for legacy Web Observer…");

  const initial = opts.initialUrl || "";
  wm.open({
    id: opts.id || "browser-legacy",
    title: opts.title || OBSERVER,
    w: 1040,
    h: 680,
    x: 64,
    y: 36,
    body: root,
    onMount: () => {
      connect();
      if (initial) go(initial);
      else goHome();
    },
    onClose: () => {
      closed = true;
      try {
        socket && socket.close();
      } catch {
        /* ignore */
      }
    },
  });
  void BRIDGE_HTTP;
}
