/**
 * ASX Desktop applications — tools inspired by LibreOffice suite + Linux utilities,
 * implemented as web apps (not full LO). Containers = existing staging product.
 */
import { isBlockedUrl, normalizeNavUrl } from "./blocklist.js";
import { listDir, openNode, readFile, parentPath, joinPath } from "./fs.js";

/** Resolve Containers product URL for this host layout. */
export function containersUrl() {
  const p = location.pathname;
  if (p.includes("/desktop-os") || p.includes("/desktop/")) {
    // monorepo: website/desktop-os → website/staging
    // public:   /desktop/ → /website/staging/
    if (p.includes("/website/desktop-os")) return "../staging/";
    return "/website/staging/";
  }
  return "/website/staging/";
}

export function registerApps(wm) {
  const open = (id) => APP_OPENERS[id]?.(wm);
  return { open, catalog: APP_CATALOG };
}

export const APP_CATALOG = [
  { id: "terminal", label: "Terminal", glyph: "❯" },
  { id: "files", label: "Files", glyph: "📁" },
  { id: "browser", label: "Browser", glyph: "🌐" },
  { id: "chat", label: "ASX Chat", glyph: "💬" },
  { id: "containers", label: "Containers", glyph: "📦" },
  { id: "honeybee", label: "honeybee", glyph: "🐝" },
  { id: "calculator", label: "Calculator", glyph: "🧮" },
  { id: "notepad", label: "Notepad", glyph: "📝" },
  { id: "sticky", label: "Sticky Notes", glyph: "📌" },
  { id: "sheet", label: "Spreadsheet", glyph: "📊" },
  { id: "mindmap", label: "Mind Map", glyph: "🕸" },
  { id: "image", label: "Image Viewer", glyph: "🖼" },
  { id: "pdf", label: "PDF Viewer", glyph: "📄" },
  { id: "video", label: "Video Player", glyph: "🎬" },
  { id: "about", label: "About", glyph: "ℹ" },
  { id: "settings", label: "Settings", glyph: "⚙" },
];

const APP_OPENERS = {
  terminal: openTerminal,
  files: openFiles,
  browser: openBrowser,
  chat: openChat,
  containers: openContainers,
  honeybee: openHoneybee,
  calculator: openCalculator,
  notepad: openNotepad,
  sticky: openSticky,
  sheet: openSheet,
  mindmap: openMindmap,
  image: openImage,
  pdf: openPdf,
  video: openVideo,
  about: openAbout,
  settings: openSettings,
};

function accessDenied(wm, path, detail) {
  wm.open({
    id: `eaccess-${Date.now()}`,
    title: "Permission denied",
    w: 420,
    h: 260,
    body: `<div class="modal-error">
      <div class="big">🔒</div>
      <div class="msg">ACCESS DENIED</div>
      <div class="sub">${escapeHtml(path || "")}</div>
      <p class="sub" style="margin-top:12px">${escapeHtml(
        detail || "Only the administrator (Alison Scorpion) may open this path."
      )}</p>
    </div>`,
  });
}

/* ── Terminal ─────────────────────────────────────────────── */
function openTerminal(wm) {
  const wrap = document.createElement("div");
  wrap.className = "term";
  wrap.innerHTML = `
    <div class="term-out"></div>
    <div class="term-in">
      <span class="prompt">guest@asx:~$</span>
      <input type="text" spellcheck="false" autocomplete="off" aria-label="Terminal input" />
    </div>`;
  const out = wrap.querySelector(".term-out");
  const input = wrap.querySelector("input");
  const lines = [
    "ASX Terminal [guest session]",
    "(c) Alison Scorpion Desktop — you are using her workstation.",
    'Type "help" for available commands.',
    "",
  ];
  const paint = () => {
    out.innerHTML = lines
      .map((l) => {
        if (l.startsWith("ERR:")) return `<span class="err">${escapeHtml(l.slice(4))}</span>`;
        if (l.startsWith("OK:")) return `<span class="ok">${escapeHtml(l.slice(3))}</span>`;
        if (l.startsWith("DIM:")) return `<span class="dim">${escapeHtml(l.slice(4))}</span>`;
        return escapeHtml(l);
      })
      .join("\n");
    out.scrollTop = out.scrollHeight;
  };
  paint();

  let cwd = "/home/guest";
  const run = (cmd) => {
    const raw = cmd.trim();
    lines.push(`guest@asx:${cwd}$ ${raw}`);
    if (!raw) return paint();
    const [base, ...rest] = raw.split(/\s+/);
    const arg = rest.join(" ");
    switch (base) {
      case "help":
        lines.push(
          "DIM:help about clear ls cd pwd cat date whoami uname echo open containers honeybee"
        );
        break;
      case "about":
        lines.push("ASX OS Desktop — verification-first guest environment on Alison Scorpion's workstation.");
        break;
      case "clear":
        lines.length = 0;
        break;
      case "date":
        lines.push(new Date().toString());
        break;
      case "whoami":
        lines.push("guest");
        break;
      case "uname":
        lines.push("ASX-Linux asx-desktop 1.0 x86_64 GNU/Linux (guest)");
        break;
      case "pwd":
        lines.push(cwd);
        break;
      case "echo":
        lines.push(arg);
        break;
      case "ls": {
        const target = arg ? (arg.startsWith("/") ? arg : joinPath(cwd, arg)) : cwd;
        const r = listDir(target);
        if (r.error) lines.push("ERR:" + r.message);
        else lines.push(r.entries.map((e) => (e.type === "dir" ? e.name + "/" : e.name)).join("  ") || "DIM:(empty)");
        break;
      }
      case "cd": {
        const target = !arg ? "/home/guest" : arg.startsWith("/") ? arg : joinPath(cwd, arg);
        const r = openNode(target === ".." ? parentPath(cwd) : target === "." ? cwd : target);
        const path = arg === ".." ? parentPath(cwd) : arg === "." ? cwd : target;
        if (r.error === "EACCES") {
          lines.push("ERR:ACCESS DENIED — administrator only: " + path);
          accessDenied(wm, path, r.detail);
        } else if (r.error) lines.push("ERR:" + r.message);
        else if (r.node.type !== "dir") lines.push("ERR:Not a directory");
        else cwd = path;
        break;
      }
      case "cat": {
        if (!arg) {
          lines.push("ERR:usage: cat <file>");
          break;
        }
        const path = arg.startsWith("/") ? arg : joinPath(cwd, arg);
        const r = readFile(path);
        if (r.error === "EACCES") {
          lines.push("ERR:ACCESS DENIED");
          accessDenied(wm, path, r.detail);
        } else if (r.error) lines.push("ERR:" + r.message);
        else lines.push(r.content);
        break;
      }
      case "open":
      case "containers":
        openContainers(wm);
        lines.push("OK:opened Containers");
        break;
      case "honeybee":
        openHoneybee(wm);
        lines.push("OK:opened honeybee");
        break;
      default:
        lines.push(`ERR:command not found: ${base}`);
    }
    paint();
  };

  wm.open({
    id: "terminal",
    title: "ASX Terminal",
    w: 680,
    h: 420,
    body: wrap,
    onMount: () => {
      input.focus();
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          run(input.value);
          input.value = "";
        }
      });
    },
  });
}

/* ── Files (PCManFM-Qt style) ─────────────────────────────── */
function openFiles(wm) {
  let cwd = "/home/guest";
  const root = document.createElement("div");
  root.className = "files";
  root.innerHTML = `
    <div class="files-side">
      <div class="path"></div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:8px">PCManFM-Qt · guest</div>
      <div class="file-row" data-jump="/"><span>🖥</span><span class="n">Computer</span></div>
      <div class="file-row" data-jump="/home/guest"><span>🏠</span><span class="n">Home (guest)</span></div>
      <div class="file-row" data-jump="/home/alisonscorpion"><span>🦂</span><span class="n">/home/alisonscorpion</span></div>
      <div class="file-row" data-jump="/usr/share"><span>ℹ</span><span class="n">About</span></div>
    </div>
    <div class="files-main"></div>`;
  const pathEl = root.querySelector(".path");
  const main = root.querySelector(".files-main");

  const render = () => {
    pathEl.textContent = cwd;
    const r = listDir(cwd);
    main.innerHTML = "";
    if (r.error) {
      main.innerHTML = `<div class="modal-error"><div class="msg">${escapeHtml(r.message)}</div></div>`;
      return;
    }
    if (cwd !== "/") {
      const up = document.createElement("div");
      up.className = "file-row";
      up.innerHTML = `<span>⬆</span><span class="n">..</span>`;
      up.addEventListener("dblclick", () => {
        cwd = parentPath(cwd);
        render();
      });
      main.appendChild(up);
    }
    for (const e of r.entries) {
      const row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = `<span>${e.type === "dir" ? "📁" : "📄"}</span><span class="n">${escapeHtml(
        e.name
      )}</span><span class="m">${e.admin ? "admin" : e.type}</span>`;
      row.addEventListener("dblclick", () => {
        if (e.type === "dir") {
          const o = openNode(e.path);
          if (o.error === "EACCES") {
            accessDenied(wm, e.path, o.detail);
            return;
          }
          if (o.error) {
            accessDenied(wm, e.path, o.message);
            return;
          }
          cwd = e.path;
          render();
        } else {
          const o = readFile(e.path);
          if (o.error === "EACCES") {
            accessDenied(wm, e.path, o.detail);
            return;
          }
          if (o.error) {
            accessDenied(wm, e.path, o.message);
            return;
          }
          wm.open({
            id: `file-${e.path}`,
            title: e.name,
            w: 520,
            h: 360,
            body: `<div class="app-pad"><h2>${escapeHtml(e.name)}</h2><pre style="white-space:pre-wrap;color:var(--muted);font-size:12px">${escapeHtml(
              o.content
            )}</pre></div>`,
          });
        }
      });
      main.appendChild(row);
    }
  };

  root.querySelectorAll("[data-jump]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = el.getAttribute("data-jump");
      const o = openNode(p);
      if (o.error === "EACCES") {
        accessDenied(wm, p, o.detail);
        return;
      }
      cwd = p;
      render();
    });
  });

  wm.open({
    id: "files",
    title: "PCManFM-Qt — Files (guest)",
    w: 760,
    h: 480,
    body: root,
    onMount: () => {
      const ban = document.createElement("div");
      ban.style.cssText =
        "grid-column:1/-1;padding:6px 10px;font-size:10px;color:var(--gold);border-bottom:1px solid var(--border)";
      ban.textContent =
        "Guest virtual FS only — not the host disk. /home/alisonscorpion/* requires administrator ASX.";
      root.insertBefore(ban, root.firstChild);
      render();
    },
  });
}

/* ── Browser + ASX chat sidebar ───────────────────────────── */
function openBrowser(wm) {
  const root = document.createElement("div");
  root.className = "browser";
  root.innerHTML = `
    <div class="browser-bar">
      <button type="button" data-act="back" title="Back">◀</button>
      <button type="button" data-act="fwd" title="Forward">▶</button>
      <button type="button" data-act="reload" title="Reload">↻</button>
      <input type="text" class="url" value="https://example.com" spellcheck="false" />
      <button type="button" data-act="go">Go</button>
    </div>
    <div class="browser-frame"></div>
    <div class="browser-chat">
      <div class="log"></div>
      <div class="row">
        <input type="text" class="chat-in" placeholder="Ask ASX about this page…" />
        <button type="button" class="chat-send">ASX</button>
      </div>
    </div>`;
  const frame = root.querySelector(".browser-frame");
  const urlIn = root.querySelector(".url");
  const log = root.querySelector(".log");
  const history = [];
  let hi = -1;

  const asxSee = (url, note) => {
    const d = document.createElement("div");
    d.innerHTML = `<strong style="color:var(--brand)">ASX</strong> <span class="dim">${escapeHtml(
      note || "sees"
    )}:</span> ${escapeHtml(url)}`;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  };

  const navigate = (raw, push = true) => {
    const url = normalizeNavUrl(raw);
    urlIn.value = url;
    if (isBlockedUrl(url)) {
      frame.innerHTML = `<div class="browser-blocked">
        <h2 style="color:var(--fail);margin-bottom:8px">Blocked by ASX policy</h2>
        <p>Alison Scorpion does not allow adult / high-risk sites on her operating system.</p>
        <p style="margin-top:10px;color:var(--muted)">${escapeHtml(url)}</p>
        <p style="margin-top:10px;font-size:11px;color:var(--muted)">Policy: client-side soft blocklist (UX). Not a network firewall — hard controls require gateway.</p>
      </div>`;
      asxSee(url, "blocked");
      return;
    }
    if (push) {
      history.splice(hi + 1);
      history.push(url);
      hi = history.length - 1;
    }
    frame.innerHTML = "";
    const iframe = document.createElement("iframe");
    // OCodex T-03: drop allow-popups-to-escape-sandbox; keep scripts for sites that need them
    iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-popups");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.title = "ASX Browser";
    if (/^javascript:/i.test(url) || /^data:/i.test(url)) {
      frame.innerHTML = `<div class="browser-blocked"><p>Scheme blocked by ASX Browser policy.</p></div>`;
      asxSee(url, "scheme blocked");
      return;
    }
    iframe.src = url;
    iframe.addEventListener("error", () => {
      asxSee(url, "load error (X-Frame or network)");
    });
    frame.appendChild(iframe);
    asxSee(url, "navigating");
  };

  root.querySelector('[data-act="go"]').addEventListener("click", () => navigate(urlIn.value));
  urlIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") navigate(urlIn.value);
  });
  root.querySelector('[data-act="reload"]').addEventListener("click", () => {
    if (hi >= 0) navigate(history[hi], false);
  });
  root.querySelector('[data-act="back"]').addEventListener("click", () => {
    if (hi > 0) {
      hi--;
      navigate(history[hi], false);
    }
  });
  root.querySelector('[data-act="fwd"]').addEventListener("click", () => {
    if (hi < history.length - 1) {
      hi++;
      navigate(history[hi], false);
    }
  });

  const sendChat = () => {
    const inp = root.querySelector(".chat-in");
    const msg = inp.value.trim();
    if (!msg) return;
    const u = document.createElement("div");
    u.innerHTML = `<strong style="color:var(--gold)">You</strong> ${escapeHtml(msg)}`;
    log.appendChild(u);
    inp.value = "";
    setTimeout(() => {
      const a = document.createElement("div");
      const page = urlIn.value;
      a.innerHTML = `<strong style="color:var(--brand)">ASX</strong> <span class="dim">I can see the browser is on</span> ${escapeHtml(
        page
      )}. <span class="dim">Guest chat is local demo — wire to API when ready. "${escapeHtml(
        msg
      )}" noted.</span>`;
      log.appendChild(a);
      log.scrollTop = log.scrollHeight;
    }, 400);
  };
  root.querySelector(".chat-send").addEventListener("click", sendChat);
  root.querySelector(".chat-in").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });

  wm.open({
    id: "browser",
    title: "ASX Browser",
    w: 900,
    h: 620,
    x: 80,
    y: 30,
    body: root,
    onMount: () => navigate("https://example.com"),
  });
}

/* ── Chat ─────────────────────────────────────────────────── */
function openChat(wm) {
  const root = document.createElement("div");
  root.className = "term";
  root.innerHTML = `
    <div class="term-out" style="padding:12px"></div>
    <div class="term-in">
      <span class="prompt">you ›</span>
      <input type="text" placeholder="Message Alison Scorpion…" />
    </div>`;
  const out = root.querySelector(".term-out");
  const input = root.querySelector("input");
  const add = (who, text, cls) => {
    const d = document.createElement("div");
    d.style.marginBottom = "8px";
    d.innerHTML = `<span class="${cls || ""}" style="color:${
      who === "ASX" ? "var(--brand)" : "var(--gold)"
    }">${who}</span> ${escapeHtml(text)}`;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  };
  add("ASX", "You're on my desktop. Ask about Containers, Honey Bee Engine, or verification — guest mode is local-only for now.", "ok");

  const send = () => {
    const msg = input.value.trim();
    if (!msg) return;
    add("You", msg);
    input.value = "";
    setTimeout(() => {
      add(
        "ASX",
        `Heard: "${msg}". Full Claude/API bridge lands with backend session. Meanwhile open Containers for the product shell.`,
        "dim"
      );
    }, 450);
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());

  wm.open({ id: "chat", title: "ASX Chat", w: 480, h: 400, body: root, onMount: () => input.focus() });
}

/* ── Containers (existing website) ────────────────────────── */
function openContainers(wm) {
  const url = containersUrl();
  const body = document.createElement("div");
  body.style.cssText = "height:100%;display:flex;flex-direction:column";
  body.innerHTML = `
    <div style="padding:6px 10px;font-size:10px;color:var(--muted);border-bottom:1px solid var(--border);background:rgba(19,17,26,0.9)">
      Containers · product app (previous alisonscorpionpublic design) · <a href="${url}" target="_blank" rel="noopener" style="color:var(--brand)">open tab</a>
    </div>
    <iframe src="${url}" title="Containers" style="flex:1;border:0;background:#0a0809"></iframe>`;
  wm.open({
    id: "containers",
    title: "Containers",
    w: 980,
    h: 640,
    x: 40,
    y: 20,
    body,
  });
}

/* ── Honey Bee Engine ─────────────────────────────────────── */
function openHoneybee(wm) {
  wm.open({
    id: "honeybee",
    title: "honeybee — Honey Bee Engine",
    w: 560,
    h: 420,
    body: `<div class="app-pad">
      <h2>🐝 Honey Bee Engine</h2>
      <p style="color:var(--muted);margin-bottom:12px">Business · government · contracts workspace (public shell). Merges with Hakiri Governance Framework (private).</p>
      <p><strong style="color:var(--gold)">AI Frank</strong> — strategic pattern detector &amp; adversarial mapping lane.</p>
      <p><strong style="color:var(--gold)">AI Bee</strong> — structured contracts / governance lane.</p>
      <p style="margin-top:12px;color:var(--muted);font-size:12px">Private business plans remain offline. This desktop icon is the R0 product surface.</p>
      <button type="button" class="primary" id="hb-open-containers">Open related: Containers</button>
    </div>`,
    onMount: (body) => {
      body.querySelector("#hb-open-containers")?.addEventListener("click", () => openContainers(wm));
    },
  });
}

/* ── Calculator ───────────────────────────────────────────── */
function openCalculator(wm) {
  const root = document.createElement("div");
  root.className = "calc-grid";
  root.innerHTML = `<input type="text" readonly value="0" class="disp" />`;
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+", "C", "⌫", "(", ")"];
  let expr = "";
  const disp = () => {
    root.querySelector(".disp").value = expr || "0";
  };
  keys.forEach((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = k;
    if ("/*-+=".includes(k)) b.className = "op";
    b.addEventListener("click", () => {
      if (k === "C") expr = "";
      else if (k === "⌫") expr = expr.slice(0, -1);
      else if (k === "=") {
        try {
          expr = String(safeCalc(expr));
        } catch {
          expr = "Error";
        }
      } else expr = (expr === "Error" ? "" : expr) + k;
      disp();
    });
    root.appendChild(b);
  });
  wm.open({ id: "calculator", title: "Calculator", w: 300, h: 380, body: root });
}

/* ── Notepad ──────────────────────────────────────────────── */
function openNotepad(wm) {
  const key = "asx-notepad";
  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `
    <h2>Notepad</h2>
    <p style="color:var(--muted);font-size:11px;margin-bottom:8px">Stored in this browser only (localStorage). Not synced to ASX servers.</p>
    <textarea class="np"></textarea>
    <button type="button" class="primary save">Save (local)</button>
    <span class="status" style="margin-left:10px;color:var(--muted);font-size:11px"></span>`;
  const ta = root.querySelector(".np");
  ta.value = localStorage.getItem(key) || "";
  root.querySelector(".save").addEventListener("click", () => {
    localStorage.setItem(key, ta.value);
    root.querySelector(".status").textContent = "Saved local · " + new Date().toLocaleTimeString();
  });
  wm.open({ id: "notepad", title: "Notepad", w: 520, h: 400, body: root });
}

/* ── Sticky notes ─────────────────────────────────────────── */
function openSticky(wm) {
  const key = "asx-stickies";
  let notes = [];
  try {
    notes = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    notes = [];
  }
  if (!notes.length) notes = [{ id: 1, text: "Sticky on ASX desktop" }];

  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `<h2>Sticky Notes</h2><div class="list"></div><button type="button" class="primary add">+ Note</button>`;
  const list = root.querySelector(".list");
  const save = () => localStorage.setItem(key, JSON.stringify(notes));
  const paint = () => {
    list.innerHTML = "";
    notes.forEach((n, i) => {
      const box = document.createElement("div");
      box.style.cssText =
        "background:rgba(200,163,90,0.12);border:1px solid var(--border);border-radius:8px;padding:8px;margin:8px 0";
      const ta = document.createElement("textarea");
      ta.value = n.text;
      ta.style.minHeight = "80px";
      ta.addEventListener("input", () => {
        notes[i].text = ta.value;
        save();
      });
      box.appendChild(ta);
      list.appendChild(box);
    });
  };
  root.querySelector(".add").addEventListener("click", () => {
    notes.push({ id: Date.now(), text: "" });
    save();
    paint();
  });
  paint();
  wm.open({ id: "sticky", title: "Sticky Notes", w: 360, h: 420, body: root });
}

/* ── Spreadsheet (LibreOffice Calc-like grid) ─────────────── */
function openSheet(wm) {
  const rows = 12;
  const cols = 8;
  const root = document.createElement("div");
  root.className = "app-pad";
  root.style.padding = "8px";
  const table = document.createElement("table");
  table.className = "sheet";
  const head = document.createElement("tr");
  head.innerHTML = "<th></th>" + Array.from({ length: cols }, (_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join("");
  table.appendChild(head);
  for (let r = 1; r <= rows; r++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<th>${r}</th>` + Array.from({ length: cols }, () => "<td><input /></td>").join("");
    table.appendChild(tr);
  }
  root.appendChild(table);
  const hint = document.createElement("p");
  hint.style.cssText = "margin-top:8px;color:var(--muted);font-size:11px";
  hint.textContent = "Spreadsheet (guest) — LibreOffice Calc-inspired grid. Local only.";
  root.appendChild(hint);
  wm.open({ id: "sheet", title: "Spreadsheet", w: 720, h: 480, body: root });
}

/* ── Mind map ─────────────────────────────────────────────── */
function openMindmap(wm) {
  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `
    <h2>Mind Map</h2>
    <p style="color:var(--muted);font-size:12px;margin-bottom:8px">Simple node list (v1). Expand with Three.js force graph later.</p>
    <input class="node-in" placeholder="Add node…" />
    <button type="button" class="primary add">Add</button>
    <ul class="nodes" style="margin-top:12px;padding-left:18px;color:var(--text)"></ul>`;
  const ul = root.querySelector(".nodes");
  const nodes = ["ASX Desktop", "Containers", "Honey Bee", "Verification"];
  const paint = () => {
    ul.innerHTML = nodes.map((n) => `<li style="margin:6px 0">◉ ${escapeHtml(n)}</li>`).join("");
  };
  paint();
  root.querySelector(".add").addEventListener("click", () => {
    const v = root.querySelector(".node-in").value.trim();
    if (!v) return;
    nodes.push(v);
    root.querySelector(".node-in").value = "";
    paint();
  });
  wm.open({ id: "mindmap", title: "Mind Map", w: 420, h: 380, body: root });
}

/* ── Image viewer ─────────────────────────────────────────── */
function openImage(wm) {
  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `
    <h2>Image Viewer</h2>
    <p style="color:var(--muted);font-size:12px">Open JPG/PNG from your machine (File → local only, never uploaded).</p>
    <input type="file" accept="image/*" class="file" />
    <div class="preview" style="margin-top:12px;text-align:center"></div>`;
  root.querySelector(".file").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    root.querySelector(".preview").innerHTML = `<img src="${url}" alt="" style="max-width:100%;max-height:360px;border:1px solid var(--border);border-radius:8px" />`;
  });
  wm.open({ id: "image", title: "Image Viewer", w: 560, h: 480, body: root });
}

/* ── PDF viewer ───────────────────────────────────────────── */
function openPdf(wm) {
  const root = document.createElement("div");
  root.className = "app-pad";
  root.style.height = "100%";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.innerHTML = `
    <h2>PDF Viewer</h2>
    <p style="color:var(--muted);font-size:12px;margin-bottom:8px">Local PDF via browser renderer.</p>
    <input type="file" accept="application/pdf" class="file" />
    <iframe class="pdf-frame" style="flex:1;margin-top:8px;border:1px solid var(--border);border-radius:8px;min-height:320px;background:#111"></iframe>`;
  root.querySelector(".file").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    root.querySelector(".pdf-frame").src = URL.createObjectURL(f);
  });
  wm.open({ id: "pdf", title: "PDF Viewer", w: 720, h: 560, body: root });
}

/* ── Video player ─────────────────────────────────────────── */
function openVideo(wm) {
  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `
    <h2>Video Player</h2>
    <p style="color:var(--muted);font-size:12px">Launch a video from your own machine.</p>
    <input type="file" accept="video/*" class="file" />
    <video class="vid" controls style="width:100%;margin-top:12px;max-height:400px;background:#000;border-radius:8px"></video>`;
  root.querySelector(".file").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const v = root.querySelector(".vid");
    v.src = URL.createObjectURL(f);
    v.play().catch(() => {});
  });
  wm.open({ id: "video", title: "Video Player", w: 720, h: 520, body: root });
}

/* ── About ────────────────────────────────────────────────── */
function openAbout(wm) {
  wm.open({
    id: "about",
    title: "About ASX OS",
    w: 480,
    h: 400,
    body: `<div class="app-pad">
      <h2>◆ ASX Desktop</h2>
      <p>You are a guest on <strong style="color:var(--brand)">Alison Scorpion</strong>'s desktop. She is letting you use it.</p>
      <p style="margin-top:10px;color:var(--muted)">Thin terminal glass windows · universe purple · Three.js background (cdnjs r128).</p>
      <p style="margin-top:10px">Product app: <strong>Containers</strong> (previous site design).</p>
      <p>Contracts lane: <strong>honeybee</strong> (Honey Bee Engine).</p>
      <p style="margin-top:12px;font-size:11px;color:var(--muted)">Browser policy: adult hosts blocked. Admin FS: /home/alisonscorpion/* ACCESS DENIED for guests.</p>
    </div>`,
  });
}

/* ── Settings ─────────────────────────────────────────────── */
function openSettings(wm) {
  wm.open({
    id: "settings",
    title: "Settings",
    w: 440,
    h: 320,
    body: `<div class="app-pad">
      <h2>Settings</h2>
      <p style="color:var(--muted);font-size:12px;margin-bottom:10px">Claude designed multiple UI skins. Current default: glass purple terminal. Legacy skins remain available as Containers themes later.</p>
      <label style="display:block;margin:8px 0;font-size:12px">Theme
        <select style="width:100%;margin-top:4px;background:#0a0809;color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px">
          <option selected>Universe purple glass (default)</option>
          <option disabled>Gold institutional (soon)</option>
          <option disabled>Classic Containers (in-app)</option>
        </select>
      </label>
      <p style="font-size:11px;color:var(--muted);margin-top:12px">Guest session · no host system access.</p>
    </div>`,
  });
}

/** P2: single-pass escape (avoid re-scanning when no special chars) */
function escapeHtml(s) {
  const str = String(s);
  if (!/[&<>"]/.test(str)) return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** OCodex T-01: arithmetic only — no Function/eval */
function safeCalc(input) {
  const s = String(input || "").replace(/\s+/g, "");
  if (!s || !/^[\d.+\-*/()]+$/.test(s)) throw new Error("bad");
  if (/[+\-*/.]{2,}/.test(s.replace(/^\-/, ""))) throw new Error("bad");
  let i = 0;
  function peek() {
    return s[i];
  }
  function num() {
    let start = i;
    if (s[i] === "+" || s[i] === "-") i++;
    while (i < s.length && /[\d.]/.test(s[i])) i++;
    const n = Number(s.slice(start, i));
    if (!Number.isFinite(n)) throw new Error("bad");
    return n;
  }
  function factor() {
    if (peek() === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") throw new Error("bad");
      i++;
      return v;
    }
    return num();
  }
  function term() {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const v = expr();
  if (i !== s.length) throw new Error("bad");
  if (!Number.isFinite(v)) throw new Error("bad");
  return v;
}
