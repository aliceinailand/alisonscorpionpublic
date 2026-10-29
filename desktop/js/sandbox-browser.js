/**
 * Site sandboxes. Each one shows its address and cannot leave that website.
 * Search happens on the page. The sandbox is separate from ASX Web Observer.
 */
import { isBlockedUrl } from "./blocklist.js?v=20261028wiki1";
import { rememberAction, recentActions } from "./local-memory.js?v=20261028mem1";

const BRIDGE_WS = "ws://127.0.0.1:8791/session";
const BRIDGE_HTTP = "http://127.0.0.1:8791";
const sessions = new Map();
const siteIcons = new Map();

const APP_LOCKS = {
  github: "github.com",
  wikipedia: "wikipedia.org",
  youtube: "youtube.com",
};

export function siteLockForApp(appId) {
  return APP_LOCKS[appId] || "";
}

function iconDataUrl(body) {
  if (!body || typeof body.data !== "string" || typeof body.mime !== "string") return "";
  if (!/^image\/(?:png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon)$/.test(body.mime)) return "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body.data) || body.data.length > 360000) return "";
  return "data:" + body.mime + ";base64," + body.data;
}

function loadSiteIcon(lock) {
  const existing = siteIcons.get(lock);
  if (typeof existing === "string") return Promise.resolve(existing);
  if (existing && typeof existing.then === "function") return existing;
  const job = fetch(BRIDGE_HTTP + "/favicon?u=" + encodeURIComponent("https://" + lock + "/"))
    .then((response) => response.json())
    .then((body) => {
      const dataUrl = iconDataUrl(body);
      if (dataUrl) siteIcons.set(lock, dataUrl);
      else siteIcons.delete(lock);
      return dataUrl;
    })
    .catch(() => {
      siteIcons.delete(lock);
      return "";
    });
  siteIcons.set(lock, job);
  return job;
}

export function bindSiteIcon(node, lock) {
  if (!node || !lock || !String(lock).includes(".")) return;
  loadSiteIcon(lock).then((dataUrl) => {
    if (!dataUrl) return;
    const img = document.createElement("img");
    img.className = "site-favicon";
    img.alt = "";
    img.src = dataUrl;
    node.replaceChildren(img);
  });
}

export function bindWindowIcon(wm, id, lock) {
  if (!wm || typeof wm.setWindowIcon !== "function" || !lock) return;
  loadSiteIcon(lock).then((dataUrl) => {
    if (dataUrl) wm.setWindowIcon(id, dataUrl);
  });
}

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

function lockOf(host) {
  let name = String(host || "").toLowerCase().replace(/\.$/, "");
  if (name.startsWith("www.")) name = name.slice(4);
  if (
    name === "wikipedia.com" ||
    name.endsWith(".wikipedia.com") ||
    name === "wikipedia.org" ||
    name.endsWith(".wikipedia.org")
  ) {
    return "wikipedia.org";
  }
  if (name === "github.com" || name.endsWith(".github.com")) return "github.com";
  if (name === "youtube.com" || name.endsWith(".youtube.com")) return "youtube.com";
  return name;
}

function plan(opts) {
  const raw = String((opts && (opts.url || opts.site)) || "").trim();
  const url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = String((opts && opts.site) || "");
  }
  const lock = lockOf(opts && opts.site ? opts.site : host);
  return { lock, url };
}

function windowId(lock) {
  return "sandbox-" + lock.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

const opening = new Map();
let paintProbe = null;
const ADULT_CATEGORY = "category detection: adult website, blocked";

function categoryReason(reason) {
  const text = String(reason || "");
  if (/adult/i.test(text)) return ADULT_CATEGORY;
  return text;
}

function finishReason(reason) {
  const text = String(reason || "This site does not work.").replace(/\s+/g, " ").trim();
  if (/nothing was created/i.test(text)) return text;
  return text + " Nothing was created.";
}

function paintAttempt(state) {
  if (typeof paintProbe === "function") paintProbe(state);
}

function askSite(raw) {
  const url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  if (isBlockedUrl(url)) {
    return Promise.resolve({ ok: false, reason: ADULT_CATEGORY });
  }
  return fetch(BRIDGE_HTTP + "/sandbox-check?u=" + encodeURIComponent(url))
    .then((response) =>
      response.json().then(
        (body) => ({ response, body }),
        () => ({ response, body: null })
      )
    )
    .then(({ response, body }) => {
      if (response.ok && body && body.ok === true && typeof body.lock === "string") {
        return {
          ok: true,
          lock: body.lock,
          url: typeof body.url === "string" ? body.url : url,
        };
      }
      const reason = body && typeof body.reason === "string" ? body.reason : "";
      return { ok: false, reason: categoryReason(reason) || "This site does not work." };
    })
    .catch(() => ({
      ok: false,
      reason: "The site check needs ASX Web Observer running on this computer.",
    }));
}

function showFailure(wm, raw, reason) {
  const detail = finishReason(reason);
  const draw = () =>
    paintAttempt({
      phase: "error",
      lines: ["Checking the address.", "Asking whether the site answers.", detail],
    });
  if (wm && wm.windows && !wm.windows.has("sandbox-navigator")) {
    openSandboxNavigator(wm);
  } else if (wm && typeof wm.focus === "function") {
    wm.focus("sandbox-navigator");
  }
  draw();
}

export function openSandbox(wm, opts = {}) {
  const planned = plan(opts);
  const key = planned.lock || "blank";
  const pending = opening.get(key);
  if (pending) return pending;
  const job = beginSandbox(wm, opts, planned).finally(() => {
    if (opening.get(key) === job) opening.delete(key);
  });
  opening.set(key, job);
  return job;
}

async function beginSandbox(wm, opts, planned) {
  const report = opts.report !== false;
  const { lock, url } = planned;
  const fail = (reason) => {
    const detail = finishReason(reason);
    if (report) showFailure(wm, url, reason);
    else {
      paintAttempt({
        phase: "error",
        lines: ["Checking the address.", "Asking whether the site answers.", detail],
      });
    }
    return { ok: false, reason: detail };
  };
  if (!lock || !lock.includes(".")) return fail("Enter a website.");
  const id = windowId(lock);
  if (isBlockedUrl(url) || isBlockedUrl("https://" + lock + "/")) {
    return fail(ADULT_CATEGORY);
  }
  if (wm.windows.has(id)) {
    if (typeof wm.focus === "function") wm.focus(id);
    const live = sessions.get(id);
    if (live) {
      live.ensure();
      live.go(url);
    }
    paintAttempt({ phase: "done", lines: ["The sandbox is already open."] });
    return { ok: true, lock, url };
  }
  paintAttempt({
    phase: "checking",
    lines: ["Checking the address.", "Asking whether the site answers."],
  });
  const checked = await askSite(url);
  if (!checked.ok) return fail(checked.reason);
  paintAttempt({
    phase: "creating",
    lines: ["Checking the address.", "The site answers.", "Creating the sandbox."],
  });
  mountSandbox(wm, opts, lock, url, id);
  paintAttempt({
    phase: "done",
    lines: ["Checking the address.", "The site answers.", "The sandbox is open."],
  });
  return { ok: true, lock, url };
}

function mountSandbox(wm, opts, lock, url, id) {
  const title = opts.title || lock + " sandbox";
  const root = el("div", "live-browser");
  const bar = el("div", "browser-bar");
  const urlIn = document.createElement("input");
  urlIn.type = "text";
  urlIn.className = "url";
  urlIn.readOnly = true;
  urlIn.spellcheck = false;
  urlIn.tabIndex = -1;
  urlIn.value = url;
  urlIn.title = "This address is shown and cannot be edited";
  urlIn.setAttribute("aria-label", "Current address");
  urlIn.setAttribute("aria-readonly", "true");
  bar.append(
    button("◀", "Back", () => send({ type: "back" })),
    button("▶", "Forward", () => send({ type: "forward" })),
    button("↻", "Reload", () => send({ type: "reload" })),
    button("⌂", "This website", () => send({ type: "home" })),
    el("span", "", "sandbox"),
    urlIn
  );

  const view = el("div", "live-view");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", title);
  canvas.tabIndex = 0;
  const offline = el("div", "live-offline");
  const blocked = el("div", "live-block");
  view.append(canvas, offline, blocked);
  const status = el("div", "live-status");
  root.append(bar, view, status);

  let socket = null;
  let viewW = 0;
  let viewH = 0;
  let closed = false;
  let sawPage = false;
  let paintGeneration = 0;

  const setStatus = (text) => {
    status.textContent = text;
  };

  function send(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function showOffline(text) {
    offline.replaceChildren();
    offline.append(el("h2", "", title), el("p", "", text));
    offline.hidden = false;
    blocked.hidden = true;
  }

  function showBlocked(reason) {
    setStatus(reason);
    if (sawPage) return;
    blocked.replaceChildren();
    blocked.append(
      el("h2", "", "This sandbox stayed put"),
      el("p", "", reason || "This sandbox stays on " + lock + ".")
    );
    blocked.hidden = false;
    offline.hidden = true;
  }

  function resize() {
    const rect = view.getBoundingClientRect();
    const width = Math.max(200, Math.min(1600, Math.round(rect.width)));
    const height = Math.max(160, Math.min(1200, Math.round(rect.height)));
    send({ type: "resize", width, height });
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
      sawPage = true;
      offline.hidden = true;
      blocked.hidden = true;
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
      send({ type: "wheel", x: p.x, y: p.y, deltaX: ev.deltaX, deltaY: ev.deltaY });
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

  function connect() {
    let ws;
    const target =
      BRIDGE_WS +
      "?site=" +
      encodeURIComponent(lock) +
      "&start=" +
      encodeURIComponent(url);
    try {
      ws = new WebSocket(target);
    } catch {
      showOffline("This sandbox needs ASX Web Observer running on this computer.");
      return;
    }
    socket = ws;
    ws.onopen = () => {
      setStatus("Sandbox · " + lock + " · the address cannot be edited");
      resize();
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
        draw(message.jpeg, message.w, message.h);
      } else if (message.type === "status") {
        if (typeof message.url === "string" && message.url && message.url !== "about:blank") {
          urlIn.value = message.url;
          setStatus(lock + " · " + message.url);
        }
      } else if (message.type === "blocked") {
        showBlocked(message.reason || "This sandbox stays on " + lock + ".");
      } else if (message.type === "ready") {
        setStatus("Sandbox · " + lock + " · search on the page");
      }
    };
    ws.onerror = () => {
      showOffline("This sandbox needs ASX Web Observer running on this computer.");
    };
    ws.onclose = () => {
      if (closed) return;
      socket = null;
      if (!sawPage) showOffline("This sandbox disconnected.");
    };
  }

  offline.hidden = true;
  blocked.hidden = true;
  setStatus("Opening the " + lock + " sandbox…");

  const ensure = () => {
    if (!socket || socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
      connect();
    }
  };
  const go = (next) => {
    send({ type: "navigate", url: next });
  };
  wm.open({
    id,
    title,
    w: 1040,
    h: 680,
    x: 72,
    y: 36,
    body: root,
    onMount: () => {
      sessions.set(id, { ensure, go });
      bindWindowIcon(wm, id, lock);
      ensure();
    },
    onClose: () => {
      closed = true;
      sessions.delete(id);
      try {
        socket && socket.close();
      } catch {
        /* ignore */
      }
    },
  });
  if (!isBlockedUrl("https://" + lock + "/")) {
    rememberAction({ kind: "sandbox", name: lock, ref: lock });
  }
}

export function openSandboxNavigator(wm) {
  if (wm.windows.has("sandbox-navigator")) {
    if (typeof wm.focus === "function") wm.focus("sandbox-navigator");
    return;
  }
  const root = el("div", "app-pad");
  const form = document.createElement("form");
  form.style.display = "flex";
  form.style.gap = "8px";
  form.style.margin = "12px 0";
  const input = document.createElement("input");
  input.type = "url";
  input.placeholder = "https://example.com";
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Website to sandbox");
  input.style.flex = "1";
  const submit = el("button", "primary", "Create");
  submit.type = "submit";
  const status = el(
    "p",
    "",
    "One website. The address is shown and cannot be edited. Search and links stay there."
  );
  const sim = el("ol", "probe-sim");
  sim.hidden = true;
  const paintThis = (state) => {
    const lines = state && Array.isArray(state.lines) ? state.lines : [];
    sim.hidden = lines.length === 0;
    sim.replaceChildren();
    lines.forEach((line, index) => {
      let className = "";
      if (index === lines.length - 1 && state.phase === "error") className = "fail";
      else if (index === lines.length - 1 && (state.phase === "checking" || state.phase === "creating")) {
        className = "now";
      }
      sim.append(el("li", className, line));
    });
    if (state && state.phase === "checking") {
      status.textContent = "Checking whether the site can open…";
    } else if (state && state.phase === "creating") {
      status.textContent = "The site answers. Creating the sandbox.";
    } else if (state && state.phase === "error") {
      status.textContent = lines[lines.length - 1] || "Nothing was created.";
    } else if (state && state.phase === "done") {
      status.textContent = lines[lines.length - 1] || "The sandbox is open.";
    }
  };
  paintProbe = paintThis;
  const recent = el("div", "recent-sites");
  const paintRecent = () => {
    recent.replaceChildren();
    const rows = recentActions(8).filter((row) => row.kind === "sandbox");
    recent.append(
      el("p", "dim", "Sites you open are remembered in this browser.")
    );
    rows.forEach((row) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "recent-site";
      const mark = document.createElement("span");
      mark.className = "g";
      bindSiteIcon(mark, row.ref);
      btn.append(mark, document.createTextNode(row.ref));
      btn.addEventListener("click", () => {
        Promise.resolve(openSandbox(wm, { url: "https://" + row.ref + "/", report: false })).then((result) => {
          if (result && result.ok) paintRecent();
        });
      });
      recent.append(btn);
    });
  };
  form.append(input, submit);
  root.append(
    el("h2", "", "Sandbox Navigator"),
    el(
      "p",
      "",
      "Creates a sandbox for the website you name. It is separate from ASX Web Observer and from the other sandboxes. If the site does not answer, nothing is created."
    ),
    form,
    status,
    sim,
    recent
  );
  paintRecent();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = input.value.trim();
    submit.disabled = true;
    Promise.resolve(openSandbox(wm, { url: raw, report: false }))
      .then((result) => {
        submit.disabled = false;
        if (result && result.ok) paintRecent();
      })
      .catch(() => {
        submit.disabled = false;
        paintAttempt({
          phase: "error",
          lines: ["Checking the address.", "This site does not work. Nothing was created."],
        });
      });
  });
  wm.open({
    id: "sandbox-navigator",
    title: "Sandbox Navigator",
    w: 520,
    h: 480,
    body: root,
    onClose: () => {
      if (paintProbe === paintThis) paintProbe = null;
    },
  });
}
