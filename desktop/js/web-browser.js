/**
 * Desktop browser. The page is a live Chromium on this computer, drawn into
 * the window as a picture. It is not an iframe of the site.
 */
import { isBlockedUrlAsync, normalizeNavUrl } from "./blocklist.js?v=20261028wiki1";

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
const OBSERVER = "ASX Web Observer";

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

export function openStorybook(wm) {
  return openLiveBrowser(wm, { title: STORY_TITLE, initialUrl: STORY_URL });
}

export function openLiveBrowser(wm, opts = {}) {
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
        "ASX Web Observer launches the Chromium installed on this computer and draws its window here. The page is not loaded inside a frame, and it does not need an account. Adult sites, private addresses, other ports, and downloads are refused."
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
  }

  function fillOffline() {
    offline.replaceChildren();
    offline.append(
      el("h2", "", "ASX Web Observer is not running"),
      el(
        "p",
        "",
        "The desktop is waiting for the Chromium installed on this computer. Websites are not placed in a frame while it is down."
      ),
      el(
        "p",
        "",
        "On this machine the engine listens only on 127.0.0.1. A public website cannot drive it."
      )
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
      setStatus("Waiting for ASX Web Observer…");
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
    return OBSERVER + " · " + mode + " · no account · pages are not loaded in a frame";
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
    // A slower older picture must not cover the keys just typed.
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
    const sx = viewW > 0 ? viewW / rect.width : 1;
    const sy = viewH > 0 ? viewH / rect.height : 1;
    return {
      x: (ev.clientX - rect.left) * sx,
      y: (ev.clientY - rect.top) * sy,
    };
  }

  canvas.addEventListener("mousedown", (ev) => {
    canvas.focus();
    const p = point(ev);
    const buttonName = ev.button === 2 ? "right" : ev.button === 1 ? "middle" : "left";
    send({ type: "click", x: p.x, y: p.y, button: buttonName });
    ev.preventDefault();
  });
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  let moving = false;
  canvas.addEventListener("mousemove", (ev) => {
    if (moving) return;
    moving = true;
    const p = point(ev);
    requestAnimationFrame(() => {
      moving = false;
      send({ type: "move", x: p.x, y: p.y });
    });
  });
  canvas.addEventListener(
    "wheel",
    (ev) => {
      const p = point(ev);
      send({
        type: "wheel",
        x: p.x,
        y: p.y,
        deltaX: ev.deltaX,
        deltaY: ev.deltaY,
      });
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
    if (ev.key === "Enter") go(urlIn.value);
  });

  function connect() {
    let ws;
    try {
      ws = new WebSocket(BRIDGE_WS);
    } catch {
      show("offline");
      setStatus("ASX Web Observer is not running on this computer.");
      return;
    }
    socket = ws;
    ws.onopen = () => {
      show(pending ? "page" : "start");
      setStatus("ASX Web Observer connected · the page is Chromium’s own window");
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
          // A late page address must not erase characters still being typed.
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
      setStatus("ASX Web Observer is not running on this computer.");
    };
    ws.onclose = () => {
      if (closed) return;
      socket = null;
      show("offline");
      setStatus("ASX Web Observer disconnected.");
    };
  }

  fillStart();
  fillOffline();
  show("start");
  setStatus("Looking for ASX Web Observer…");

  const initial = opts.initialUrl || "";
  const ensure = () => {
    if (!socket || socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
      connect();
    }
  };
  const already = wm.windows.has("browser");
  wm.open({
    id: "browser",
    title: opts.title || OBSERVER,
    w: 1040,
    h: 680,
    x: 48,
    y: 24,
    body: root,
    onMount: () => {
      session = { go, ensure };
      activeGo = go;
      ensure();
      if (initial) go(initial);
      else goHome();
    },
    onClose: () => {
      closed = true;
      if (activeGo === go) activeGo = null;
      if (session && session.go === go) session = null;
      try {
        socket && socket.close();
      } catch {
        /* ignore */
      }
    },
  });
  // One observer window. A second click navigates it instead of opening a dead icon.
  if (already && initial && session) {
    session.ensure();
    session.go(initial);
  }
}
