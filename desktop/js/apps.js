/**
 * ASX Desktop applications — tools inspired by LibreOffice suite + Linux utilities,
 * implemented as web apps (not full LO). Containers = existing staging product.
 */
import {
  isBlockedUrl,
  isBlockedUrlAsync,
  normalizeNavUrl,
  ensureSafetyListsLoaded,
} from "./blocklist.js?v=20260810t250000z";
import { listDir, openNode, readFile, parentPath, joinPath } from "./fs.js?v=20260810t250000z";
import { routeFreeChat } from "./chat-router.js?v=20260810t250000z";
import {
  createAccount,
  softDeleteAccount,
  restoreAccount,
  listActiveAccounts,
  listTrashedAccounts,
  getSessionUser,
  setSessionUser,
  daysLeftInTrash,
  randomOtherProfiles,
} from "./accounts.js?v=20260810t250000z";

/** Alison's public read-only GDrive (messages / downloads for guests). */
export const GDRIVE_PUBLIC_URL =
  "https://drive.google.com/drive/folders/1Qx-z9L8QkcKYF_4CMqEPEdoJkvG1chU6?usp=sharing";
export const GDRIVE_FOLDER_ID = "1Qx-z9L8QkcKYF_4CMqEPEdoJkvG1chU6";

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
  const open = (id, opts) => APP_OPENERS[id]?.(wm, opts);
  return { open, catalog: APP_CATALOG, categories: APP_CATEGORIES };
}

/** Apps available in Applications folder + start menu (not all on desktop). */
export const APP_CATALOG = [
  { id: "terminal", label: "Terminal", glyph: "❯" },
  { id: "computer", label: "Computer", glyph: "🖥" },
  { id: "files", label: "Files", glyph: "📁" },
  { id: "browser", label: "Browser", glyph: "🌐" },
  { id: "chat", label: "Chat", glyph: "💬" },
  { id: "trash", label: "Trash", glyph: "🗑" },
  { id: "network", label: "Network", glyph: "🖧" },
  { id: "gdrive", label: "GDrive", glyph: "☁" },
  { id: "youtube", label: "YouTube", glyph: "▶" },
  { id: "users", label: "Users", glyph: "👥" },
  { id: "applications", label: "Applications", glyph: "📦" },
  { id: "agent-asx", label: "Agent ASX", glyph: "α" },
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

/** Category folders inside Applications (desktop stays clean). */
export const APP_CATEGORIES = [
  {
    id: "system",
    label: "System",
    glyph: "⚙",
    apps: ["terminal", "computer", "files", "settings", "about", "users"],
  },
  {
    id: "internet",
    label: "Internet",
    glyph: "🌐",
    apps: ["browser", "network", "gdrive", "youtube", "chat"],
  },
  {
    id: "office",
    label: "Office",
    glyph: "📊",
    apps: ["notepad", "sticky", "sheet", "mindmap", "pdf"],
  },
  {
    id: "media",
    label: "Media",
    glyph: "🎬",
    apps: ["image", "video", "youtube"],
  },
  {
    id: "asx",
    label: "ASX Products",
    glyph: "🦂",
    apps: ["containers", "honeybee", "agent-asx", "chat"],
  },
  {
    id: "utils",
    label: "Utilities",
    glyph: "🔧",
    apps: ["calculator"],
  },
];

const APP_OPENERS = {
  terminal: openTerminal,
  computer: openComputer,
  files: openFiles,
  browser: openBrowser,
  chat: openChat,
  trash: openTrash,
  network: openNetwork,
  gdrive: openGDrive,
  youtube: openYoutube,
  users: openUsers,
  applications: openApplications,
  "agent-asx": openAgentAsx,
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

function accessDenied(wm, path, detail, opts = {}) {
  // Linux-style error (PCManFM / GIO): "Error opening directory …: Permission denied"
  const p = path || "";
  const isDir =
    opts.isDir != null
      ? opts.isDir
      : !/\.[a-z0-9]+$/i.test(p.split("/").pop() || "");
  const lead = isDir
    ? `Error opening directory "${p}": Permission denied`
    : `Error opening file "${p}": Permission denied`;
  const icon = opts.warn ? "⚠" : "🔒";
  wm.open({
    id: `eaccess-${Date.now()}`,
    title: "Permission denied",
    w: 460,
    h: 280,
    body: `<div class="modal-error">
      <div class="big ${opts.warn ? "warn" : ""}">${icon}</div>
      <div class="msg" style="color:var(--fail)">You do not have permission to view this file.</div>
      <div class="sub" style="margin-top:10px;text-align:left;font-family:var(--mono,monospace);font-size:12px;color:var(--text)">${escapeHtml(
        lead
      )}</div>
      <p class="sub" style="margin-top:14px;text-align:left">${escapeHtml(
        detail ||
          "You do not have the permissions necessary to view the contents of this location.\n\nOnly the administrator (Alison Scorpion / ASX) may open this path. You are a guest on her desktop."
      ).replace(/\n/g, "<br/>")}</p>
    </div>`,
  });
}

/* ── Terminal ─────────────────────────────────────────────── */
function openTerminal(wm, opts = {}) {
  const agentMode = !!opts.agentMode;
  const winId = opts.id || (agentMode ? "agent-asx" : "terminal");
  const title = opts.title || (agentMode ? "Agent ASX α — Terminal" : "ASX Terminal");
  const wrap = document.createElement("div");
  wrap.className = "term" + (agentMode ? " term-agent" : "");
  wrap.innerHTML = `
    <div class="term-out"></div>
    <div class="term-in">
      <span class="prompt">${agentMode ? "agent@asx ›" : "guest@asx:~$"}</span>
      <input type="text" spellcheck="false" autocomplete="off" aria-label="Terminal input" />
    </div>`;
  const out = wrap.querySelector(".term-out");
  const input = wrap.querySelector("input");
  const lines = agentMode
    ? [
        "Agent ASX α — desktop actions [free demo]",
        "DIM:Unlike Chat (Q&A only), Agent can open apps and navigate.",
        "DIM:Try: open settings | open browser | navigate to github.com | open youtube | help",
        "DIM:Downloadable full Agent ASX later. Complex multi-step AI still needs an account.",
        "",
      ]
    : [
        "ASX Terminal [guest session]",
        "(c) Alison Scorpion Desktop — you are using her workstation.",
        'Type "help" for available commands.',
        "",
      ];
  // P6/P7: batch terminal repaints to one frame (adaptive path — avoid N layouts per cmd)
  let paintScheduled = false;
  const paintNow = () => {
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
  const paint = () => {
    if (paintScheduled) return;
    paintScheduled = true;
    requestAnimationFrame(() => {
      paintScheduled = false;
      paintNow();
    });
  };
  paintNow();

  let cwd = "/home/guest";
  const run = (cmd) => {
    const raw = cmd.trim();
    lines.push(
      agentMode ? `agent@asx › ${raw}` : `guest@asx:${cwd}$ ${raw}`
    );
    if (!raw) return paint();
    const [base, ...rest] = raw.split(/\s+/);
    const arg = rest.join(" ");
    if (agentMode) {
      const acted = runAgentAction(wm, raw, lines);
      if (acted) return paint();
      if (!["help", "clear", "whoami", "status", "about", "date", "echo"].includes(base)) {
        lines.push(
          `DIM:Agent ASX α · no matching action. Try: open settings | open browser | navigate to github.com | open youtube | open drive | open chat | help`
        );
        return paint();
      }
    }
    switch (base) {
      case "help":
        lines.push(
          agentMode
            ? "DIM:help status whoami about clear date echo — free text is chat until agent tools ship"
            : "DIM:help about clear ls cd pwd cat date whoami uname echo open containers honeybee"
        );
        break;
      case "status":
        lines.push("OK:Agent ASX α online · guest session · verification-first · no seal required for chat");
        break;
      case "about":
        lines.push(
          agentMode
            ? "Agent ASX α — terminal chat surface on Alison Scorpion's desktop."
            : "ASX OS Desktop — verification-first guest environment on Alison Scorpion's workstation."
        );
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
    id: winId,
    title,
    w: 680,
    h: 420,
    body: wrap,
    onMount: (body) => {
      // LeoAI: mobile keyboards need focus inside/near trusted touch; re-focus on pointerdown
      const focusIn = () => {
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus();
        }
      };
      focusIn();
      body.addEventListener("pointerdown", focusIn, { passive: true });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          run(input.value);
          input.value = "";
        }
      });
    },
  });
}

/**
 * Agent ASX α — desktop actions (open apps, navigate). Free demo of a real agent.
 * Chat is Q&A only; Agent *does* things on the desktop.
 */
function runAgentAction(wm, raw, lines) {
  const q = String(raw || "").trim();
  const lower = q.toLowerCase();

  const goUrl = (url) => {
    openBrowser(wm, { id: "browser-agent", title: "Browser — Agent", initialUrl: url });
    lines.push(`OK:navigating browser → ${url}`);
    return true;
  };

  if (/^help\b/i.test(q)) {
    lines.push(
      "DIM:Agent actions: open settings | open browser | open files | open terminal | open youtube | open drive | open chat | open applications | navigate to <url> | go to github.com"
    );
    lines.push(
      "DIM:Full downloadable Agent ASX later. Free Chat = Q&A only (no actions)."
    );
    return true;
  }
  if (/open\s+settings/i.test(q)) {
    openSettings(wm);
    lines.push("OK:opened Settings");
    return true;
  }
  if (/open\s+browser|open\s+internet/i.test(q)) {
    openBrowser(wm);
    lines.push("OK:opened Browser");
    return true;
  }
  if (/open\s+files|open\s+file\s*manager/i.test(q)) {
    openFiles(wm);
    lines.push("OK:opened Files");
    return true;
  }
  if (/open\s+terminal/i.test(q)) {
    openTerminal(wm);
    lines.push("OK:opened Terminal");
    return true;
  }
  if (/open\s+youtube/i.test(q)) {
    openYoutube(wm);
    lines.push("OK:opened YouTube (AlisonScorpionX)");
    return true;
  }
  if (/open\s+drive|open\s+gdrive|open\s+google\s*drive/i.test(q)) {
    openGDrive(wm);
    lines.push("OK:opened Alison Drive");
    return true;
  }
  if (/open\s+chat/i.test(q)) {
    openChat(wm);
    lines.push("OK:opened Chat (Q&A — no desktop actions)");
    return true;
  }
  if (/open\s+applications|open\s+apps/i.test(q)) {
    openApplications(wm);
    lines.push("OK:opened Applications");
    return true;
  }
  if (/open\s+network/i.test(q)) {
    openNetwork(wm);
    lines.push("OK:opened Network");
    return true;
  }
  if (/open\s+users|sign\s*up|create\s+account/i.test(q)) {
    openUsers(wm);
    lines.push("OK:opened Users (Add = sign up)");
    return true;
  }
  if (/open\s+containers/i.test(q)) {
    openContainers(wm);
    lines.push("OK:opened Containers");
    return true;
  }
  if (/open\s+trash/i.test(q)) {
    openTrash(wm);
    lines.push("OK:opened Trash");
    return true;
  }

  const nav =
    q.match(/navigate\s+to\s+(\S+)/i) ||
    q.match(/go\s+to\s+(\S+)/i) ||
    q.match(/open\s+(https?:\/\/\S+)/i);
  if (nav) {
    let target = nav[1].replace(/[.,)]+$/, "");
    if (!/^https?:\/\//i.test(target) && target.includes(".")) {
      target = "https://" + target;
    }
    if (/github\.com/i.test(target) || /^github$/i.test(target)) {
      return goUrl("https://github.com");
    }
    return goUrl(normalizeNavUrl(target));
  }
  if (/github\.com|go\s+to\s+github/i.test(lower)) {
    return goUrl("https://github.com");
  }
  if (/youtube\.com|go\s+to\s+youtube/i.test(lower)) {
    openYoutube(wm);
    lines.push("OK:opened YouTube app (embeds work; full site needs Open outside)");
    return true;
  }
  return false;
}

function openAgentAsx(wm) {
  openTerminal(wm, {
    agentMode: true,
    id: "agent-asx",
    title: "Agent ASX α — actions",
  });
}

/* ── Computer (home / places — PCManFM-inspired) ─────────── */
function openComputer(wm) {
  const root = document.createElement("div");
  root.className = "places-view";
  root.innerHTML = `
    <div class="places-bar">
      <span class="places-uri">computer:///</span>
      <span class="places-hint">Alison's machine · guest view</span>
    </div>
    <div class="places-grid"></div>`;
  const grid = root.querySelector(".places-grid");
  const items = [
    {
      id: "home-alison",
      glyph: "🏠",
      label: "Alison",
      sub: "/home/alisonscorpion",
      action: () => openFiles(wm, { startPath: "/home/alisonscorpion" }),
    },
    {
      id: "home-guest",
      glyph: "👤",
      label: "Guest Home",
      sub: "/home/guest",
      action: () => openFiles(wm, { startPath: "/home/guest" }),
    },
    {
      id: "fs-root",
      glyph: "💿",
      label: "File System",
      sub: "/",
      action: () => openFiles(wm, { startPath: "/" }),
    },
    {
      id: "apps",
      glyph: "📦",
      label: "Applications",
      sub: "categories",
      action: () => openApplications(wm),
    },
    {
      id: "net",
      glyph: "🖧",
      label: "Network",
      sub: "network:///",
      action: () => openNetwork(wm),
    },
    {
      id: "trash",
      glyph: "🗑",
      label: "Trash",
      sub: "trash:///",
      action: () => openTrash(wm),
    },
  ];
  items.forEach((it) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "place-tile";
    el.innerHTML = `<span class="g">${it.glyph}</span><span class="n">${escapeHtml(
      it.label
    )}</span><span class="s">${escapeHtml(it.sub)}</span>`;
    el.addEventListener("dblclick", it.action);
    el.addEventListener("click", (e) => {
      if (matchMedia("(pointer: coarse)").matches) it.action();
      else {
        grid.querySelectorAll(".place-tile").forEach((t) => t.classList.remove("sel"));
        el.classList.add("sel");
      }
    });
    grid.appendChild(el);
  });
  wm.open({
    id: "computer",
    title: "Computer",
    w: 640,
    h: 420,
    body: root,
  });
}

/* ── Applications (category folders) ─────────────────────── */
function openApplications(wm, opts = {}) {
  let view = opts.categoryId || null; // null = category list
  const root = document.createElement("div");
  root.className = "apps-folder";
  root.innerHTML = `
    <div class="apps-folder-bar">
      <button type="button" class="apps-up" title="Up">⬆</button>
      <span class="apps-path">Applications</span>
    </div>
    <div class="apps-folder-grid"></div>`;
  const pathEl = root.querySelector(".apps-path");
  const grid = root.querySelector(".apps-folder-grid");
  const upBtn = root.querySelector(".apps-up");

  const openAppId = (id) => {
    if (id === "applications") return;
    APP_OPENERS[id]?.(wm);
  };

  const render = () => {
    grid.innerHTML = "";
    if (!view) {
      pathEl.textContent = "Applications";
      upBtn.disabled = true;
      APP_CATEGORIES.forEach((cat) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "apps-tile folder";
        el.innerHTML = `<span class="g">${cat.glyph}</span><span class="n">${escapeHtml(
          cat.label
        )}</span><span class="s">${cat.apps.length} items</span>`;
        const go = () => {
          view = cat.id;
          render();
        };
        el.addEventListener("dblclick", go);
        el.addEventListener("click", () => {
          if (matchMedia("(pointer: coarse)").matches) go();
        });
        grid.appendChild(el);
      });
      return;
    }
    const cat = APP_CATEGORIES.find((c) => c.id === view);
    pathEl.textContent = `Applications › ${cat ? cat.label : view}`;
    upBtn.disabled = false;
    (cat?.apps || []).forEach((id) => {
      const app = APP_CATALOG.find((a) => a.id === id);
      if (!app) return;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "apps-tile";
      el.innerHTML = `<span class="g">${app.glyph}</span><span class="n">${escapeHtml(
        app.label
      )}</span>`;
      const go = () => openAppId(id);
      el.addEventListener("dblclick", go);
      el.addEventListener("click", () => {
        if (matchMedia("(pointer: coarse)").matches) go();
      });
      grid.appendChild(el);
    });
  };

  upBtn.addEventListener("click", () => {
    view = null;
    render();
  });
  render();

  wm.open({
    id: "applications",
    title: "Applications",
    w: 560,
    h: 440,
    body: root,
  });
}

/* ── Trash (looks active; contents always denied) ─────────── */
const TRASH_POOL = [
  "draft-seal-notes.md",
  "old-screenshot.png",
  "meeting-scratch.txt",
  "tmp-verify-log.json",
  "asx-chat-history.bak",
  "untitled-sheet.ods",
  "download-partial.bin",
  "agent-trace-2026.log",
  "contract-wip.docx",
  "browser-cache-chunk",
];

function sessionTrashFiles() {
  try {
    const k = "asx-trash-files";
    const raw = sessionStorage.getItem(k);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a) && a.length) return a;
    }
    const n = 2 + Math.floor(Math.random() * 4);
    const shuffled = [...TRASH_POOL].sort(() => Math.random() - 0.5).slice(0, n);
    sessionStorage.setItem(k, JSON.stringify(shuffled));
    return shuffled;
  } catch {
    return TRASH_POOL.slice(0, 3);
  }
}

function openTrash(wm) {
  const files = sessionTrashFiles();
  const trashedUsers = listTrashedAccounts();
  const root = document.createElement("div");
  root.className = "trash-view";
  const total = files.length + trashedUsers.length;
  root.innerHTML = `
    <div class="places-bar">
      <span class="places-uri">trash:///</span>
      <span class="places-hint">${total} item(s) · 30-day account hold</span>
    </div>
    <div class="trash-list"></div>
    <p class="trash-foot">Deleted accounts stay 30 days. Other items are Alison's — guests cannot open them.</p>`;
  const list = root.querySelector(".trash-list");

  trashedUsers.forEach((u) => {
    const days = daysLeftInTrash(u);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "file-row trash-row";
    row.innerHTML = `<span>👤</span><span class="n">${escapeHtml(
      u.username
    )}</span><span class="m">account · ${days}d left</span>`;
    const ask = () => {
      const ok = window.confirm(
        `Accounts are deleted after 30 days. Once an account is deleted, this action cannot be undone.\n\nDo you want to restore your account “${u.username}”? (${days} day(s) remaining)`
      );
      if (!ok) return;
      const r = restoreAccount(u.id);
      if (r.error) window.alert(r.error);
      else {
        setSessionUser(u.id);
        window.alert(`Account “${u.username}” restored. You are signed in.`);
        openTrash(wm);
      }
    };
    row.addEventListener("dblclick", ask);
    row.addEventListener("click", () => {
      if (matchMedia("(pointer: coarse)").matches) ask();
    });
    list.appendChild(row);
  });

  files.forEach((name) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "file-row trash-row";
    row.innerHTML = `<span>📄</span><span class="n">${escapeHtml(
      name
    )}</span><span class="m">deleted</span>`;
    const deny = () =>
      accessDenied(
        wm,
        `trash:///${name}`,
        "You do not have permission to view this file.\n\nTrash contents belong to Alison Scorpion (ASX).",
        { isDir: false, warn: true }
      );
    row.addEventListener("dblclick", deny);
    row.addEventListener("click", () => {
      if (matchMedia("(pointer: coarse)").matches) deny();
    });
    list.appendChild(row);
  });
  wm.open({
    id: "trash",
    title: `Trash (${total} items)`,
    w: 480,
    h: 360,
    body: root,
  });
}

/* ── Network ─────────────────────────────────────────────── */
function openNetwork(wm) {
  const root = document.createElement("div");
  root.className = "places-view";
  root.innerHTML = `
    <div class="places-bar">
      <span class="places-uri">network:///</span>
      <span class="places-hint">Browse network (virtual)</span>
    </div>
    <div class="places-grid"></div>`;
  const grid = root.querySelector(".places-grid");
  const items = [
    {
      glyph: "👥",
      label: "Users",
      sub: "Add / Remove accounts",
      go: () => openUsers(wm),
    },
    {
      glyph: "☁",
      label: "GDrive",
      sub: "Alison Drive",
      go: () => openGDrive(wm),
    },
    {
      glyph: "▶",
      label: "YouTube",
      sub: "AlisonScorpionX",
      go: () => openYoutube(wm),
    },
    {
      glyph: "🌐",
      label: "Internet",
      sub: "ASX Browser",
      go: () => openBrowser(wm),
    },
    {
      glyph: "🖥",
      label: "asx-desktop",
      sub: "This workstation",
      go: () => openComputer(wm),
    },
    {
      glyph: "🔒",
      label: "Workgroup",
      sub: "admin only",
      go: () =>
        accessDenied(wm, "network:///Workgroup", "Network shares require ASX credentials.", {
          isDir: true,
          warn: true,
        }),
    },
  ];
  items.forEach((it) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "place-tile";
    el.innerHTML = `<span class="g">${it.glyph}</span><span class="n">${escapeHtml(
      it.label
    )}</span><span class="s">${escapeHtml(it.sub)}</span>`;
    el.addEventListener("dblclick", it.go);
    el.addEventListener("click", () => {
      if (matchMedia("(pointer: coarse)").matches) it.go();
    });
    grid.appendChild(el);
  });
  wm.open({ id: "network", title: "Network", w: 560, h: 400, body: root });
}

/* ── Users (signup / remove) ─────────────────────────────── */
function openUsers(wm) {
  const root = document.createElement("div");
  root.className = "places-view users-view";
  const me = getSessionUser();
  root.innerHTML = `
    <div class="places-bar">
      <span class="places-uri">network:///Users</span>
      <span class="places-hint">${me ? "signed in: " + escapeHtml(me.username) : "guest"}</span>
    </div>
    <div class="places-grid" id="users-grid"></div>
    <p class="trash-foot">Your work folder (future) lives under your user id. Other profiles are permission-denied.</p>`;
  const grid = root.querySelector("#users-grid");

  const tile = (glyph, label, sub, go) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "place-tile";
    el.innerHTML = `<span class="g">${glyph}</span><span class="n">${escapeHtml(
      label
    )}</span><span class="s">${escapeHtml(sub)}</span>`;
    el.addEventListener("dblclick", go);
    el.addEventListener("click", () => {
      if (matchMedia("(pointer: coarse)").matches) go();
    });
    grid.appendChild(el);
  };

  tile("➕", "Add", "Sign up", () => openSignup(wm));
  tile("➖", "Remove", "Delete my account", () => {
    const u = getSessionUser();
    if (!u) {
      window.alert("No account signed in on this device. Use Add to sign up first.");
      return;
    }
    if (
      !window.confirm(
        `Remove account “${u.username}”? It will move to Trash for 30 days, then be permanently deleted.`
      )
    ) {
      return;
    }
    softDeleteAccount(u.id);
    window.alert("Account moved to Trash (30-day hold). Open Trash to restore.");
    openUsers(wm);
  });

  // Active accounts on this browser
  listActiveAccounts().forEach((u) => {
    tile("👤", u.username, u.email, () => {
      setSessionUser(u.id);
      window.alert(`Signed in as ${u.username}. Your work folder will live here later.`);
    });
  });

  // Random decorative others
  randomOtherProfiles(Date.now()).forEach((p) => {
    tile("👤", p.username, "system", () =>
      accessDenied(
        wm,
        `network:///Users/${p.username}`,
        "You do not have permission to view this folder.",
        { isDir: true, warn: true }
      )
    );
  });

  wm.open({ id: "users", title: "Users", w: 560, h: 420, body: root });
}

function openSignup(wm) {
  const root = document.createElement("div");
  root.className = "app-pad signup-form";
  root.innerHTML = `
    <h2>Create account</h2>
    <p class="dim">Free guest signup is stored in this browser (localStorage) until the real backend ships. Advanced Chat reasoning will require this later.</p>
    <label>Username <input type="text" id="su-user" autocomplete="username" /></label>
    <label>Email <input type="email" id="su-email" autocomplete="email" /></label>
    <label>Password <input type="password" id="su-pass" autocomplete="new-password" /></label>
    <p id="su-err" class="err" hidden></p>
    <button type="button" class="primary" id="su-go">Create account</button>`;
  wm.open({
    id: "signup",
    title: "Sign up",
    w: 420,
    h: 400,
    body: root,
    onMount: (body) => {
      body.querySelector("#su-go")?.addEventListener("click", () => {
        const r = createAccount({
          username: body.querySelector("#su-user").value,
          email: body.querySelector("#su-email").value,
          password: body.querySelector("#su-pass").value,
        });
        const err = body.querySelector("#su-err");
        if (r.error) {
          err.hidden = false;
          err.textContent = r.error;
          return;
        }
        err.hidden = true;
        window.alert(`Welcome, ${r.user.username}. You are signed in on this device.`);
        wm.close("signup");
        openUsers(wm);
      });
    },
  });
}

/* ── Alison Drive (Drive-like UI; public share + local tree) ─ */
const ALISON_DRIVE_TREE = {
  "/": [
    { name: "Messages for guests", type: "folder", id: "messages" },
    { name: "Downloads", type: "folder", id: "downloads" },
    { name: "Public share", type: "folder", id: "public" },
    { name: "README-ASX.txt", type: "file", id: "readme" },
  ],
  messages: [
    { name: "welcome.txt", type: "file", id: "welcome" },
    { name: "from-alison.md", type: "file", id: "from-alison" },
  ],
  downloads: [
    { name: "brand-kit-note.txt", type: "file", id: "brand-note" },
  ],
  public: [
    {
      name: "Open real Google Drive folder…",
      type: "link",
      id: "real-drive",
      url: GDRIVE_PUBLIC_URL,
    },
  ],
};

const ALISON_DRIVE_FILES = {
  readme:
    "Alison Drive — simulated view of Alison Scorpion's shared workspace.\n\nPublic Google Drive folder (real files):\n" +
    GDRIVE_PUBLIC_URL +
    "\n\nListing the live Drive API needs an API key (Settings later). This UI shows structure + opens the public share outside when framed.",
  welcome:
    "Welcome to Alison's desktop, guest.\n\nChat = free Q&A (low router).\nAgent ASX α = open apps / navigate.\nSign up under Network → Users → Add for advanced processing later.",
  "from-alison":
    "# From Alison\n\nLeave messages and downloads in the public Drive share.\nYou're on my machine — be kind to the Earth wallpaper.",
  "brand-note":
    "Brand assets live under /brand on the site. Vendor libraries load from cdnjs/jsDelivr — not from this Drive.",
};

function openGDrive(wm) {
  let cwd = "/";
  const root = document.createElement("div");
  root.className = "drive-app";
  root.innerHTML = `
    <div class="drive-top">
      <div class="drive-brand">
        <img src="/brand/scorpion-universe-purple.png" alt="" width="28" height="28"
          onerror="this.src='/scorpion-icon-512.png'" />
        <span>Drive</span>
        <span class="drive-who">Alison Scorpion</span>
      </div>
      <button type="button" class="drive-real" title="Open public Google folder">Public folder ↗</button>
    </div>
    <div class="drive-path"></div>
    <div class="drive-list"></div>
    <p class="drive-foot">Simulated Drive UI · live files via public share (Open outside if framed)</p>`;
  const pathEl = root.querySelector(".drive-path");
  const list = root.querySelector(".drive-list");
  root.querySelector(".drive-real")?.addEventListener("click", () => {
    openBrowser(wm, {
      id: "browser-gdrive",
      title: "Browser — public Drive",
      initialUrl: GDRIVE_PUBLIC_URL,
    });
  });

  const render = () => {
    pathEl.textContent = "My Drive" + (cwd === "/" ? "" : " › " + cwd);
    list.innerHTML = "";
    if (cwd !== "/") {
      const up = document.createElement("button");
      up.type = "button";
      up.className = "drive-row";
      up.innerHTML = `<span>⬆</span><span>.. (up)</span>`;
      up.addEventListener("click", () => {
        cwd = "/";
        render();
      });
      list.appendChild(up);
    }
    const items = ALISON_DRIVE_TREE[cwd === "/" ? "/" : cwd] || [];
    items.forEach((it) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "drive-row";
      const icon = it.type === "folder" ? "📁" : it.type === "link" ? "☁" : "📄";
      row.innerHTML = `<span>${icon}</span><span>${escapeHtml(it.name)}</span>`;
      row.addEventListener("click", () => {
        if (it.type === "folder") {
          cwd = it.id;
          render();
        } else if (it.type === "link") {
          openBrowser(wm, {
            id: "browser-gdrive",
            title: "Browser — public Drive",
            initialUrl: it.url || GDRIVE_PUBLIC_URL,
          });
        } else {
          const body = ALISON_DRIVE_FILES[it.id] || "(empty)";
          wm.open({
            id: `drive-${it.id}`,
            title: it.name,
            w: 480,
            h: 360,
            body: `<div class="app-pad"><h2>${escapeHtml(it.name)}</h2><pre class="drive-pre">${escapeHtml(
              body
            )}</pre></div>`,
          });
        }
      });
      list.appendChild(row);
    });
  };
  render();
  wm.open({ id: "gdrive", title: "Alison Drive", w: 640, h: 480, body: root });
}

/* ── YouTube (AlisonScorpionX) — embeds work; full site does not ─ */
const YT_DEMO = [
  { id: "aqz-KE-bpKQ", title: "Big Buck Bunny", ch: "Blender Foundation" },
  { id: "eRsGyueVLvQ", title: "Sintel (trailer)", ch: "Blender Foundation" },
  { id: "YE7VzlLtp-4", title: "Elephants Dream", ch: "Blender Foundation" },
  { id: "ScMzIvxBSi4", title: "Sample — Peaceful Music", ch: "Public domain / demo" },
];

function parseYoutubeId(input) {
  const s = String(input || "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(
    /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

function openYoutube(wm) {
  let playing = YT_DEMO[0].id;
  const root = document.createElement("div");
  root.className = "yt-app";
  root.innerHTML = `
    <div class="yt-top">
      <div class="yt-logo">▶ YouTube</div>
      <form class="yt-search" action="javascript:void(0)">
        <input type="search" placeholder="Search or paste video URL / ID" class="yt-q" />
        <button type="submit">Search</button>
      </form>
      <div class="yt-user">
        <img class="yt-av" src="/brand/scorpion-universe-purple.png" alt="" width="32" height="32"
          onerror="this.src='/scorpion-icon-512.png'" />
        <span>AlisonScorpionX</span>
      </div>
    </div>
    <div class="yt-body">
      <div class="yt-player-wrap">
        <iframe class="yt-player" title="YouTube player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>
      <div class="yt-side">
        <div class="yt-now"></div>
        <div class="yt-list"></div>
        <p class="yt-note">Embed player (works in-frame). Full youtube.com needs Browser → Open outside. Free demo list + paste URL.</p>
      </div>
    </div>`;
  const player = root.querySelector(".yt-player");
  const list = root.querySelector(".yt-list");
  const now = root.querySelector(".yt-now");
  const qIn = root.querySelector(".yt-q");

  const play = (id, title) => {
    playing = id;
    player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
      id
    )}?rel=0`;
    now.innerHTML = `<strong>${escapeHtml(title || id)}</strong><br/><span class="dim">AlisonScorpionX · watching</span>`;
  };

  const renderList = (items) => {
    list.innerHTML = "";
    items.forEach((v) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "yt-row" + (v.id === playing ? " on" : "");
      row.innerHTML = `<span class="yt-thumb">▶</span><span><b>${escapeHtml(
        v.title
      )}</b><br/><span class="dim">${escapeHtml(v.ch || "")}</span></span>`;
      row.addEventListener("click", () => {
        play(v.id, v.title);
        renderList(items);
      });
      list.appendChild(row);
    });
  };

  root.querySelector(".yt-search")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = qIn.value.trim();
    const id = parseYoutubeId(raw);
    if (id) {
      play(id, raw);
      renderList([{ id, title: "Pasted video", ch: "YouTube" }, ...YT_DEMO]);
      return;
    }
    // No API key: filter demo + note
    const q = raw.toLowerCase();
    const filtered = YT_DEMO.filter(
      (v) => v.title.toLowerCase().includes(q) || v.ch.toLowerCase().includes(q)
    );
    if (filtered.length) {
      renderList(filtered);
      play(filtered[0].id, filtered[0].title);
    } else {
      window.alert(
        "Free YouTube app: paste a video URL/ID, or pick a demo. Full search needs a YouTube Data API key (account / Settings later)."
      );
      renderList(YT_DEMO);
    }
  });

  play(YT_DEMO[0].id, YT_DEMO[0].title);
  renderList(YT_DEMO);

  wm.open({
    id: "youtube",
    title: "YouTube — AlisonScorpionX",
    w: 900,
    h: 560,
    body: root,
  });
}

/* ── Files (PCManFM-Qt style) ─────────────────────────────── */
function openFiles(wm, opts = {}) {
  let cwd = opts.startPath || "/home/guest";
  const root = document.createElement("div");
  root.className = "files";
  root.innerHTML = `
    <div class="files-menubar" role="menubar" aria-label="File manager menus">
      <button type="button" data-menu="file">File</button>
      <button type="button" data-menu="edit">Edit</button>
      <button type="button" data-menu="view">View</button>
      <button type="button" data-menu="go">Go</button>
      <button type="button" data-menu="bookmarks">Bookmarks</button>
      <button type="button" data-menu="tools">Tools</button>
      <button type="button" data-menu="help">Help</button>
    </div>
    <div class="files-body">
      <div class="files-side">
        <div class="path"></div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:8px">PCManFM-Qt · guest</div>
        <div class="file-row" data-jump="/"><span>🖥</span><span class="n">Computer</span></div>
        <div class="file-row" data-jump="/home/guest"><span>🏠</span><span class="n">Home (guest)</span></div>
        <div class="file-row" data-jump="/home/alisonscorpion"><span>🦂</span><span class="n">/home/alisonscorpion</span></div>
        <div class="file-row" data-jump="/usr/share"><span>ℹ</span><span class="n">About</span></div>
      </div>
      <div class="files-main"></div>
    </div>`;
  const pathEl = root.querySelector(".path");
  const main = root.querySelector(".files-main");

  const goTo = (p) => {
    const o = openNode(p);
    if (o.error === "EACCES") {
      accessDenied(wm, p, o.detail);
      return;
    }
    if (o.error && o.error !== "ENOENT") {
      accessDenied(wm, p, o.message);
      return;
    }
    // Allow listing roots even if empty listing
    cwd = p;
    render();
  };

  const render = () => {
    pathEl.textContent = cwd;
    const r = listDir(cwd);
    main.innerHTML = "";
    if (r.error) {
      if (r.error === "EACCES") {
        accessDenied(wm, cwd, r.message);
        cwd = parentPath(cwd);
        render();
        return;
      }
      main.innerHTML = `<div class="modal-error"><div class="msg">${escapeHtml(r.message)}</div></div>`;
      return;
    }
    if (cwd !== "/") {
      const up = document.createElement("div");
      up.className = "file-row";
      up.innerHTML = `<span>⬆</span><span class="n">..</span>`;
      const upGo = () => {
        cwd = parentPath(cwd);
        render();
      };
      up.addEventListener("dblclick", upGo);
      up.addEventListener("click", upGo);
      main.appendChild(up);
    }
    for (const e of r.entries) {
      const row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = `<span>${e.type === "dir" ? "📁" : "📄"}</span><span class="n">${escapeHtml(
        e.name
      )}</span><span class="m">${e.admin ? "admin" : e.type}</span>`;
      const openEntry = () => {
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
      };
      row.addEventListener("dblclick", openEntry);
      // Mobile / single click: open (desktop still supports dblclick)
      row.addEventListener("click", (ev) => {
        if (ev.detail === 1 && matchMedia("(pointer: coarse)").matches) openEntry();
      });
      main.appendChild(row);
    }
  };

  root.querySelectorAll("[data-jump]").forEach((el) => {
    el.addEventListener("click", () => goTo(el.getAttribute("data-jump")));
  });

  // Menubar actions (PCManFM-Qt parity — realistic functions, guest-scoped)
  root.querySelectorAll("[data-menu]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const m = btn.getAttribute("data-menu");
      if (m === "go") {
        const pick = window.prompt(
          "Go to location (virtual FS):\n/home/guest  ·  /home/alisonscorpion  ·  /",
          cwd
        );
        if (pick) goTo(pick.trim());
        return;
      }
      if (m === "bookmarks") {
        goTo("/home/guest");
        return;
      }
      if (m === "view") {
        render();
        return;
      }
      if (m === "file") {
        wm.open({
          id: `files-new-${Date.now()}`,
          title: "New (guest)",
          w: 380,
          h: 200,
          body: `<div class="app-pad"><p>New folder/file is guest-local demo only. Use <strong>Notepad</strong> to write; host disk is never touched.</p></div>`,
        });
        return;
      }
      if (m === "help") {
        wm.open({
          id: "files-help",
          title: "About PCManFM-Qt (ASX)",
          w: 440,
          h: 280,
          body: `<div class="app-pad">
            <h2>PCManFM-Qt — guest mirror</h2>
            <p style="color:var(--muted);font-size:13px;margin-top:8px">Menus: File, Edit, View, Go, Bookmarks, Tools, Help — as on Alison's Linux desktop screenshots.</p>
            <p style="color:var(--muted);font-size:13px;margin-top:8px">You may list <code>/home/alisonscorpion</code> folder names. Opening them returns <strong>Permission denied</strong> (guest ≠ admin).</p>
          </div>`,
        });
        return;
      }
      // Edit / Tools — honest placeholders (Construct tools later)
      asxToast(
        m === "edit"
          ? "Edit: copy/paste in guest text apps only."
          : "Tools: ASX Construct / ftools — coming as free guest apps."
      );
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
      ban.className = "files-banner";
      ban.textContent =
        "Guest virtual FS only — not the host disk. /home/alisonscorpion/* requires administrator ASX.";
      root.insertBefore(ban, root.firstChild);
      render();
    },
  });
}

function asxToast(msg) {
  let t = document.getElementById("asx-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "asx-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(asxToast._tm);
  asxToast._tm = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ── Browser + ASX chat sidebar ───────────────────────────── */
const ASX_HOME = "asx://home";

function browserHomeHtml() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ASX Browser — Home</title>
<style>
  body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#0c0a10;color:#e8e4f0;padding:28px 24px}
  h1{font-size:1.35rem;color:#c4b5fd;margin:0 0 8px}
  p{color:#9b93a8;max-width:40rem}
  a{color:#a78bfa} a:hover{color:#ddd6fe}
  .card{margin-top:18px;padding:14px 16px;border:1px solid #2a2438;border-radius:10px;background:#13111a}
  ul{margin:8px 0 0;padding-left:1.2rem;color:#cfc8dc}
  .tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:#2a1f4a;color:#c4b5fd;margin-bottom:10px}
</style></head><body>
<span class="tag">Guest session · Alison's desktop</span>
<h1>ASX Browser</h1>
<p>You're on Alison Scorpion's workstation. Browse carefully — adult and high-risk hosts are blocked by policy (client blocklist inspired by public hosts lists such as StevenBlack/hosts &amp; OISD NSFW).</p>
<div class="card">
  <strong>Try these</strong>
  <ul>
    <li><a href="https://example.com">example.com</a> — usually embeds</li>
    <li><a href="https://info.cern.ch">info.cern.ch</a> — first website</li>
    <li><a href="https://example.com">example.com</a> — embeds OK</li>
    <li>YouTube / Google Drive — allowed, but need <em>Open outside</em> (they ban iframes)</li>
    <li><a href="https://alisonscorpion.com">alisonscorpion.com</a></li>
  </ul>
</div>
<div class="card">
  <strong>Why YouTube / Drive say “refused to connect”</strong>
  <p style="margin:8px 0 0">Not the adult filter. Those sites ban embedding in iframes (X-Frame-Options). ASX Browser is framed — use <em>Open outside</em> for a normal tab. Adult sites show a red 🛡 policy screen instead.</p>
</div>
</body></html>`;
}

function showPolicyBlocked(frame, url, reason) {
  frame.innerHTML = `<div class="browser-blocked browser-blocked-policy">
    <div class="blocked-icon" aria-hidden="true">🛡</div>
    <h2>This page has been blocked</h2>
    <p class="blocked-lead">Alison Scorpion's OS does not allow this site.</p>
    <p class="blocked-url">${escapeHtml(url)}</p>
    <p class="blocked-why">${escapeHtml(
      reason ||
        "Category: adult / high-risk content (ASX guest policy)."
    )}</p>
    <p class="blocked-foot">Looks like a corporate or school filter page on purpose — soft client blocklist for guests. Not a network firewall. Sources: curated hosts (StevenBlack porn extension, OISD-class NSFW patterns).</p>
  </div>`;
}

/**
 * Sites that refuse iframes (X-Frame-Options / CSP frame-ancestors).
 * NOT the adult blocklist — safe public sites that ban embedding.
 */
const NO_EMBED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "music.youtube.com",
  "drive.google.com",
  "docs.google.com",
  "sheets.google.com",
  "slides.google.com",
  "mail.google.com",
  "accounts.google.com",
  "google.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "tiktok.com",
  "linkedin.com",
  "github.com",
  "netflix.com",
  "open.spotify.com",
  "reddit.com",
];

function hostBare(url) {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isKnownNoEmbed(url) {
  const h = hostBare(url);
  if (!h) return false;
  if (h === "google.com" || h.endsWith(".google.com")) return true;
  if (h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be")
    return true;
  for (let i = 0; i < NO_EMBED_HOSTS.length; i++) {
    const b = NO_EMBED_HOSTS[i].replace(/^www\./, "");
    if (h === b || h.endsWith("." + b)) return true;
  }
  return false;
}

function noEmbedLabel(url) {
  const h = hostBare(url);
  if (h.includes("youtube") || h === "youtu.be") return "YouTube";
  if (h.includes("drive.google") || h.includes("docs.google"))
    return "Google Drive / Docs";
  if (h.endsWith("google.com") || h === "google.com") return "Google";
  if (h.includes("facebook")) return "Facebook";
  if (h === "x.com" || h.includes("twitter")) return "X / Twitter";
  if (h.includes("github")) return "GitHub";
  return h || "This site";
}

/**
 * Interstitial: site refuses iframe. Different from adult 🛡 policy block.
 */
function showNoEmbedPage(frame, url, openOutsideFn) {
  const name = noEmbedLabel(url);
  frame.innerHTML = `<div class="browser-blocked browser-noembed">
    <div class="blocked-icon" aria-hidden="true">⧉</div>
    <h2>${escapeHtml(name)} won’t open inside this window</h2>
    <p class="blocked-lead"><strong>This is not a porn / policy block.</strong>
      ${escapeHtml(name)} sets <code>X-Frame-Options</code> or CSP
      <code>frame-ancestors</code> so it cannot be embedded in another site’s iframe
      (anti–clickjacking). Browsers then show “refused to connect.”</p>
    <p class="blocked-url">${escapeHtml(url)}</p>
    <p class="blocked-why">ASX Browser is a framed guest view on Alison’s desktop.
      Use <strong>Open outside</strong> for a normal full browser tab — that works for
      public YouTube, Drive folders, Wikipedia, etc.</p>
    <p style="margin-top:18px">
      <button type="button" class="noembed-open">Open outside →</button>
    </p>
    <p class="blocked-foot">Adult sites are blocked separately (red 🛡 policy screen).
      YouTube / Drive are allowed — they just refuse the iframe.</p>
  </div>`;
  frame.querySelector(".noembed-open")?.addEventListener("click", () => {
    if (typeof openOutsideFn === "function") openOutsideFn(url);
    else {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
    }
  });
}

function showFrameHint(frame, url, openOutsideFn) {
  const bar = document.createElement("div");
  bar.className = "browser-frame-hint";
  bar.innerHTML = `<span>Blank panel? Site blocks embedding (X-Frame-Options) — not ASX policy. YouTube / Drive need Open outside.</span>
    <button type="button" class="open-out">Open outside</button>`;
  bar.querySelector(".open-out").addEventListener("click", () => {
    if (typeof openOutsideFn === "function") openOutsideFn(url);
    else {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
    }
  });
  frame.appendChild(bar);
}

function openBrowser(wm, opts = {}) {
  const winId = opts.id || "browser";
  const winTitle = opts.title || "ASX Browser";
  const startUrl = opts.initialUrl || ASX_HOME;
  const root = document.createElement("div");
  root.className = "browser";
  root.innerHTML = `
    <div class="browser-bar">
      <button type="button" data-act="back" title="Back">◀</button>
      <button type="button" data-act="fwd" title="Forward">▶</button>
      <button type="button" data-act="reload" title="Reload">↻</button>
      <button type="button" data-act="home" title="Home">⌂</button>
      <input type="text" class="url" value="${escapeHtml(startUrl)}" spellcheck="false" autocomplete="off" />
      <button type="button" data-act="go">Go</button>
      <button type="button" data-act="out" title="Open outside ASX frame">Open outside</button>
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
  let homeBlobUrl = null;
  let loadTimer = 0;

  const asxSee = (url, note) => {
    const d = document.createElement("div");
    d.innerHTML = `<strong style="color:var(--brand)">ASX</strong> <span class="dim">${escapeHtml(
      note || "sees"
    )}:</span> ${escapeHtml(url)}`;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  };

  const openOutside = (url) => {
    if (!url || url.startsWith("asx:")) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      asxSee(url, "opened outside");
    } catch {
      asxSee(url, "could not open outside");
    }
  };

  const navigate = async (raw, push = true) => {
    clearTimeout(loadTimer);
    let url = String(raw || "").trim();
    if (!url || url === ASX_HOME || /^asx:\/\/home/i.test(url)) {
      url = ASX_HOME;
    } else {
      url = normalizeNavUrl(url);
    }
    urlIn.value = url;

    // Wait for safety/hosts shards when checking external URLs (core list already sync)
    if (url !== ASX_HOME) {
      const blocked = await isBlockedUrlAsync(url);
      if (blocked) {
        showPolicyBlocked(frame, url);
        asxSee(url, "blocked by policy");
        if (push) {
          history.splice(hi + 1);
          history.push(url);
          hi = history.length - 1;
        }
        return;
      }
    }
    if (/^javascript:/i.test(url) || /^data:/i.test(url) || /^vbscript:/i.test(url)) {
      showPolicyBlocked(frame, url, "Scheme blocked by ASX Browser policy.");
      asxSee(url, "scheme blocked");
      return;
    }

    if (push) {
      history.splice(hi + 1);
      history.push(url);
      hi = history.length - 1;
    }

    // Known non-embeddable (YouTube, Drive, Google…) — not a policy block
    if (url !== ASX_HOME && isKnownNoEmbed(url)) {
      showNoEmbedPage(frame, url, openOutside);
      asxSee(url, "no-embed (open outside) — not policy blocked");
      return;
    }

    frame.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "browser-iframe-wrap";
    const iframe = document.createElement("iframe");
    iframe.className = "browser-iframe";
    // Sandbox: scripts/forms for real pages; no top-navigation escape
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
    );
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("loading", "eager");
    iframe.title = "ASX Browser content";

    if (url === ASX_HOME) {
      if (homeBlobUrl) URL.revokeObjectURL(homeBlobUrl);
      homeBlobUrl = URL.createObjectURL(
        new Blob([browserHomeHtml()], { type: "text/html" })
      );
      // Home is same-origin blob — needs allow-same-origin for links to work inside
      iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      );
      iframe.src = homeBlobUrl;
      wrap.appendChild(iframe);
      frame.appendChild(wrap);
      // Intercept in-home link clicks via load + try (blob same-origin)
      iframe.addEventListener("load", () => {
        try {
          const doc = iframe.contentDocument;
          if (!doc) return;
          doc.addEventListener("click", (ev) => {
            const a = ev.target.closest?.("a");
            if (!a || !a.href) return;
            ev.preventDefault();
            navigate(a.href);
          });
        } catch {
          /* ignore */
        }
      });
      asxSee(url, "home");
      return;
    }

    iframe.src = url;
    wrap.appendChild(iframe);
    frame.appendChild(wrap);
    showFrameHint(frame, url, openOutside);
    asxSee(url, "navigating");

    // After a moment, surface embed note if still on this URL
    loadTimer = setTimeout(() => {
      if (urlIn.value !== url) return;
      const hint = frame.querySelector(".browser-frame-hint");
      if (hint) hint.classList.add("pulse");
    }, 2200);
  };

  root.querySelector('[data-act="go"]').addEventListener("click", () => navigate(urlIn.value));
  root.querySelector('[data-act="home"]').addEventListener("click", () => navigate(ASX_HOME));
  root.querySelector('[data-act="out"]').addEventListener("click", () => openOutside(urlIn.value));
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
    id: winId,
    title: winTitle,
    w: 900,
    h: 620,
    x: 80,
    y: 30,
    body: root,
    onMount: () => {
      // Prefetch public safety list (same-origin shards) while showing home
      ensureSafetyListsLoaded();
      navigate(startUrl);
    },
    onClose: () => {
      clearTimeout(loadTimer);
      if (homeBlobUrl) URL.revokeObjectURL(homeBlobUrl);
    },
  });
}

/* ── Chat (free Q&A router — no desktop actions) ─────────── */
function openChat(wm) {
  const root = document.createElement("div");
  root.className = "term chat-free";
  root.innerHTML = `
    <div class="chat-banner">Free Chat · low router (query → logic → answer) · no app control</div>
    <div class="term-out" style="padding:12px"></div>
    <div class="term-in">
      <span class="prompt">you ›</span>
      <input type="text" placeholder="Ask a simple question…" />
    </div>`;
  const out = root.querySelector(".term-out");
  const input = root.querySelector("input");
  const add = (who, text, cls) => {
    const d = document.createElement("div");
    d.style.marginBottom = "8px";
    d.innerHTML = `<span class="${cls || ""}" style="color:${
      who === "Chat" || who === "ASX" ? "var(--brand)" : "var(--gold)"
    }">${who}</span> ${escapeHtml(text)}`;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  };
  const addLinks = (links) => {
    if (!links?.length) return;
    const d = document.createElement("div");
    d.className = "chat-links";
    links.forEach((L) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = L.label;
      b.addEventListener("click", () => {
        if (L.action === "signup") openUsers(wm);
        else if (L.action === "agent") openAgentAsx(wm);
      });
      d.appendChild(b);
    });
    out.appendChild(d);
  };
  add(
    "Chat",
    "Free path: simple questions only (local router / low LLM layer). Example: “Who was the first president?” For open/navigate actions, use Agent ASX α. Complex reasoning → sign up.",
    "ok"
  );

  const send = () => {
    const msg = input.value.trim();
    if (!msg) return;
    add("You", msg);
    input.value = "";
    setTimeout(() => {
      const r = routeFreeChat(msg);
      add("Chat", r.text, r.type === "upgrade" ? "err" : "dim");
      addLinks(r.links);
    }, 280);
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());

  wm.open({
    id: "chat",
    title: "Chat — free Q&A",
    w: 520,
    h: 440,
    body: root,
    onMount: () => input.focus(),
  });
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
  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `
      <h2>Settings</h2>
      <p style="color:var(--muted);font-size:12px;margin-bottom:10px">
        Default is <strong>thin terminal glass</strong> (Claude + PouyaOS-inspired, Earth shows through).
        The denser <strong>panel desktop</strong> look is kept as an optional theme.
      </p>
      <label style="display:block;margin:8px 0;font-size:12px">Theme
        <select id="asx-theme-select" style="width:100%;margin-top:4px;background:rgba(10,8,12,0.55);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font:12px var(--font)">
          <option value="thin-terminal">Thin terminal glass (default)</option>
          <option value="panel-desktop">Panel desktop (solid purple)</option>
        </select>
      </label>
      <p id="asx-theme-hint" style="font-size:11px;color:var(--muted);margin-top:8px"></p>
      <p style="font-size:11px;color:var(--muted);margin-top:12px">Guest session · no host system access.</p>
  `;
  wm.open({
    id: "settings",
    title: "Settings",
    w: 440,
    h: 340,
    body: root,
    onMount: async () => {
      const { getTheme, applyTheme, THEMES } = await import("./themes.js?v=20260810t290000z");
      const sel = root.querySelector("#asx-theme-select");
      const hint = root.querySelector("#asx-theme-hint");
      const cur = getTheme();
      if (sel) sel.value = cur;
      const setHint = (id) => {
        const t = THEMES.find((x) => x.id === id);
        if (hint) hint.textContent = t ? t.hint : "";
      };
      setHint(cur);
      sel?.addEventListener("change", () => {
        const id = applyTheme(sel.value);
        setHint(id);
      });
    },
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
