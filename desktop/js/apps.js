/**
 * ASX Desktop applications — tools inspired by LibreOffice suite + Linux utilities,
 * implemented as web apps (not full LO). Containers = existing staging product.
 *
 * Multi-AI Convergence: Alice (Matthew Gates), Grok, Claude, Gemini, ChatGPT, and Copilot.
 * Public mirror: https://github.com/aliceinailand/alisonscorpionpublic
 */
import {
  isBlockedUrl,
  isBlockedUrlAsync,
  normalizeNavUrl,
  ensureSafetyListsLoaded,
} from "./blocklist.js?v=20260810t250000z";
import {
  listDirAsync,
  openNodeAsync,
  readFileAsync,
  writeFile,
  mkdir,
  parentPath,
  joinPath,
  canWrite,
  isBrowserFsReady,
} from "./fs.js?v=20260810t390000z";
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
import {
  getGuestId,
  resolveWhoami,
  ensureGuestSession,
} from "./guest-session.js?v=20260811t140000z";
import {
  openGameWindow,
  mountTicTacToe,
  mountPong,
  mountBlocks,
  mountSnake,
  mountBreakout,
  mountMemory,
  mountMines,
  mountPhysics,
} from "./games.js?v=20260811t150000z";
import {
  loadScriptChain,
  MATTER_SOURCES,
  WEBCAM_SOURCES,
  MATTER_CDN_SRI,
  WEBCAM_CDN_SRI,
  EXCELJS_CDN_SRI,
  EXCELJS_CDNJS,
} from "./cdn-load.js?v=20260811t210000z";
import {
  showRebootScreen,
  showLogoutScreen,
  getSessionStart,
  formatDuration,
} from "./shell-chrome.js?v=20260811t140000z";
import {
  sanitizeHtml,
  setSafeHtml,
  escapeHtml,
  ASX_TEXT_PURIFY,
} from "./sanitize.js?v=20260810t410000z";
import {
  getUserAboutProfile,
  profileToRows,
  EGJS_AGENT_VERSION,
} from "./user-agent.js?v=20260810t420000z";
import {
  ensureTrackpadScrollCss,
  attachTrackpadScroll,
  streamTextInto,
  streamAgentSteps,
  TSE_VERSION,
} from "./scroll-chrome.js?v=20260810t430000z";

/** Alison's public read-only GDrive (messages / downloads for guests). */
export const GDRIVE_PUBLIC_URL =
  "https://drive.google.com/drive/folders/1Qx-z9L8QkcKYF_4CMqEPEdoJkvG1chU6?usp=sharing";
export const GDRIVE_FOLDER_ID = "1Qx-z9L8QkcKYF_4CMqEPEdoJkvG1chU6";

/**
 * Single place window for Computer / Files / Network / Trash / Applications / Drive / Users.
 * Diving into a folder replaces this window instead of stacking new ones.
 */
const EXPLORER_ID = "explorer";

/**
 * @param {import("./wm.js").WindowManager} wm
 * @param {{ title: string, w?: number, h?: number, body: HTMLElement|string, onMount?: Function }} opts
 */
function showExplorer(wm, opts) {
  return wm.open({
    id: EXPLORER_ID,
    title: opts.title,
    w: opts.w ?? 640,
    h: opts.h ?? 440,
    body: opts.body,
    replace: true,
    onMount: opts.onMount,
  });
}

/** Optional Drive API key for live public-folder listing (no OAuth). */
function getGdriveApiKey() {
  try {
    if (typeof window !== "undefined" && window.ASX_GDRIVE_API_KEY) {
      return String(window.ASX_GDRIVE_API_KEY).trim();
    }
    const k = localStorage.getItem("asx-gdrive-api-key");
    return k ? String(k).trim() : "";
  } catch {
    return "";
  }
}

function setGdriveApiKey(key) {
  try {
    const v = String(key || "").trim();
    if (v) localStorage.setItem("asx-gdrive-api-key", v);
    else localStorage.removeItem("asx-gdrive-api-key");
  } catch {
    /* private mode */
  }
}

/**
 * List a publicly shared Drive folder via Drive API v3 + API key (no OAuth).
 * Pure client JS cannot scrape drive.google.com (CORS); API key is required for listing.
 * @returns {Promise<{ files?: object[], error?: string }>}
 */
async function listPublicDriveFolder(folderId, apiKey) {
  if (!apiKey) {
    return {
      error:
        "No API key. Public Drive listing needs a Google Cloud API key with Drive API enabled (Anyone-with-link folders). Set in Settings or localStorage asx-gdrive-api-key.",
    };
  }
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    "nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)"
  );
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${q}` +
    `&fields=${fields}&pageSize=100&orderBy=folder,name&key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.error?.message ||
        `Drive API HTTP ${res.status}` +
          (res.status === 403
            ? " — enable Drive API + restrict key, or folder not public."
            : "");
      return { error: msg };
    }
    return { files: Array.isArray(data.files) ? data.files : [] };
  } catch (e) {
    return { error: e?.message || "Network error talking to Drive API" };
  }
}

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
  { id: "agent-asx", label: "Agent", glyph: "α" },
  { id: "containers", label: "Containers", glyph: "📦" },
  { id: "honeybee", label: "honeybee", glyph: "🐝" },
  { id: "calculator", label: "Calculator", glyph: "🧮" },
  { id: "notepad", label: "Notepad", glyph: "📝" },
  { id: "quill", label: "Quill", glyph: "🪶" },
  { id: "sticky", label: "Sticky Notes", glyph: "📌" },
  { id: "sheet", label: "Spreadsheet", glyph: "📊" },
  { id: "impress", label: "Impress", glyph: "◈" },
  { id: "mindmap", label: "Mind Map", glyph: "🕸" },
  { id: "image", label: "Image Viewer", glyph: "🖼" },
  { id: "pdf", label: "PDF Reader", glyph: "📕" },
  { id: "video", label: "Video Player", glyph: "🎬" },
  { id: "monaco", label: "Monaco", glyph: "💻" },
  { id: "jsfile", label: "JsFile", glyph: "📎" },
  { id: "about", label: "About", glyph: "ℹ" },
  { id: "settings", label: "Settings", glyph: "⚙" },
  { id: "github", label: "GitHub", glyph: "⌥" },
  { id: "todo", label: "Todo", glyph: "☑" },
  { id: "games", label: "Games", glyph: "🎮" },
  { id: "tic-tac-toe", label: "Tic Tac Toe", glyph: "✕" },
  { id: "pong", label: "Ping Pong", glyph: "🏓" },
  { id: "blocks", label: "Blocks", glyph: "▦" },
  { id: "snake", label: "Snake", glyph: "〰" },
  { id: "breakout", label: "Breakout", glyph: "▣" },
  { id: "memory", label: "Memory", glyph: "🃏" },
  { id: "mines", label: "Mines", glyph: "⚑" },
  { id: "physics", label: "Physics", glyph: "⚛" },
  { id: "camera", label: "Camera", glyph: "📷" },
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
    apps: ["browser", "network", "gdrive", "youtube", "github"],
  },
  {
    id: "office",
    label: "Office",
    glyph: "📊",
    apps: ["quill", "notepad", "sticky", "sheet", "impress", "mindmap", "todo", "pdf"],
  },
  {
    id: "media",
    label: "Media",
    glyph: "🎬",
    apps: ["image", "video", "youtube", "camera"],
  },
  {
    id: "programming",
    label: "Programming",
    glyph: "⌘",
    apps: ["monaco", "terminal", "jsfile"],
  },
  {
    id: "asx",
    label: "ASX",
    glyph: "🦂",
    apps: ["containers", "honeybee", "agent-asx", "chat"],
  },
  {
    id: "utils",
    label: "Utilities",
    glyph: "🔧",
    apps: ["calculator", "jsfile"],
  },
  {
    id: "games",
    label: "Games",
    glyph: "🎮",
    apps: ["tic-tac-toe", "pong", "blocks", "snake", "breakout", "memory", "mines", "physics"],
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
  quill: openQuill,
  sticky: openSticky,
  sheet: openSheet,
  impress: openImpress,
  mindmap: openMindmap,
  image: openImage,
  pdf: openPdf,
  video: openVideo,
  monaco: openMonaco,
  jsfile: openJsFile,
  about: openAbout,
  settings: openSettings,
  github: openGithub,
  todo: openTodo,
  games: openGamesFolder,
  "tic-tac-toe": openTicTacToe,
  pong: openPong,
  blocks: openBlocks,
  snake: openSnake,
  breakout: openBreakout,
  memory: openMemory,
  mines: openMines,
  physics: openPhysics,
  camera: openCamera,
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
  const title = opts.title || (agentMode ? "Agent α — Terminal" : "ASX Terminal");
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
        "Agent α — desktop actions [free demo]",
        "DIM:Unlike Chat (Q&A only), Agent can open apps and navigate.",
        "DIM:Try: open settings | open browser | navigate to github.com | open youtube | help",
        "DIM:Downloadable full Agent later. Complex multi-step AI still needs an account.",
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
    setSafeHtml(
      out,
      lines
        .map((l) => {
          if (l.startsWith("ERR:")) return `<span class="err">${escapeHtml(l.slice(4))}</span>`;
          if (l.startsWith("OK:")) return `<span class="ok">${escapeHtml(l.slice(3))}</span>`;
          if (l.startsWith("DIM:")) return `<span class="dim">${escapeHtml(l.slice(4))}</span>`;
          return escapeHtml(l);
        })
        .join("\n")
    );
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
          `DIM:Agent α · no matching action. Try: open settings | open browser | navigate to github.com | open youtube | open drive | open chat | help`
        );
        return paint();
      }
    }
    switch (base) {
      case "help":
        lines.push(
          agentMode
            ? "DIM:help status whoami about clear date echo — free text is chat until agent tools ship"
            : "DIM:help contact chat open <app> ls cd pwd cat touch mkdir write rm date whoami id uname hostname uptime history clear echo reboot logout exit neofetch asxfetch containers honeybee github games"
        );
        break;
      case "contact":
        lines.push("OK:Alison Scorpion · https://alisonscorpion.com");
        lines.push("DIM:Public code: https://github.com/aliceinailand/alisonscorpionpublic");
        lines.push("DIM:Open Chat (chat) or Agent for interactive help.");
        break;
      case "chat":
        openChat(wm);
        lines.push("OK:opened Chat");
        break;
      case "github":
        openGithub(wm);
        lines.push("OK:opened GitHub (public repo)");
        break;
      case "games":
        openGamesFolder(wm);
        lines.push("OK:opened Games");
        break;
      case "id":
        lines.push(`uid=${resolveWhoami(getSessionUser())} gid=guest groups=asx-guest`);
        break;
      case "hostname":
        lines.push("asx-desktop");
        break;
      case "uptime":
        try {
          const ms = Date.now() - getSessionStart();
          lines.push(`up ${formatDuration(ms)} (this guest session)`);
        } catch {
          lines.push("up ?");
        }
        break;
      case "history":
        lines.push("DIM:(session history not persisted — use ↑ in a future build)");
        break;
      case "reboot":
      case "restart":
        lines.push("OK:Rebooting ASX Desktop…");
        paint();
        setTimeout(() => showRebootScreen(), 400);
        return;
      case "logout":
      case "exit":
      case "logoff":
        lines.push("OK:Logging out…");
        paint();
        setTimeout(() => showLogoutScreen(), 400);
        return;
      case "neofetch":
      case "asxfetch":
        lines.push("          🦂");
        lines.push("  guest@asx-desktop");
        lines.push("  ----------------");
        lines.push(`  User:     ${resolveWhoami(getSessionUser())}`);
        lines.push("  OS:       ASX-Linux (guest illusion)");
        lines.push("  Shell:    asx-term");
        lines.push("  Desktop:  Alison Scorpion Three.js + DOM");
        lines.push("  Repo:     github.com/aliceinailand/alisonscorpionpublic");
        lines.push("  Note:     Free face · Construct is the kitchen");
        break;
      case "status":
        lines.push("OK:Agent α online · guest session · verification-first · no seal required for chat");
        break;
      case "about":
        lines.push(
          agentMode
            ? "Agent α — terminal chat surface on Alison Scorpion's desktop."
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
        lines.push(resolveWhoami(getSessionUser()));
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
        listDirAsync(target).then((r) => {
          if (r.error) lines.push("ERR:" + r.message);
          else
            lines.push(
              r.entries.map((e) => (e.type === "dir" ? e.name + "/" : e.name)).join("  ") ||
                "DIM:(empty)"
            );
          paint();
        });
        return paint();
      }
      case "cd": {
        const target = !arg ? "/home/guest" : arg.startsWith("/") ? arg : joinPath(cwd, arg);
        const path = arg === ".." ? parentPath(cwd) : arg === "." ? cwd : target;
        openNodeAsync(path).then((r) => {
          if (r.error === "EACCES") {
            lines.push("ERR:ACCESS DENIED — administrator only: " + path);
            accessDenied(wm, path, r.detail);
          } else if (r.error) lines.push("ERR:" + r.message);
          else if (r.node?.type !== "dir") lines.push("ERR:Not a directory");
          else cwd = path;
          paint();
        });
        return paint();
      }
      case "cat": {
        if (!arg) {
          lines.push("ERR:usage: cat <file>");
          break;
        }
        const path = arg.startsWith("/") ? arg : joinPath(cwd, arg);
        readFileAsync(path).then((r) => {
          if (r.error === "EACCES") {
            lines.push("ERR:ACCESS DENIED");
            accessDenied(wm, path, r.detail);
          } else if (r.error) lines.push("ERR:" + r.message);
          else lines.push(r.content);
          paint();
        });
        return paint();
      }
      case "touch": {
        if (!arg) {
          lines.push("ERR:usage: touch <file>");
          break;
        }
        const path = arg.startsWith("/") ? arg : joinPath(cwd, arg);
        writeFile(path, "").then((r) => {
          if (r.error) lines.push("ERR:" + (r.message || r.error));
          else lines.push("OK:touched " + path + (isBrowserFsReady() ? " (BrowserFS)" : ""));
          paint();
        });
        return paint();
      }
      case "mkdir": {
        if (!arg) {
          lines.push("ERR:usage: mkdir <dir>");
          break;
        }
        const path = arg.startsWith("/") ? arg : joinPath(cwd, arg);
        mkdir(path).then((r) => {
          if (r.error) lines.push("ERR:" + (r.message || r.error));
          else lines.push("OK:mkdir " + path);
          paint();
        });
        return paint();
      }
      case "write":
      case "save": {
        // write path << text  OR  write path text…
        const sp = arg.indexOf(" ");
        if (sp < 0) {
          lines.push("ERR:usage: write <file> <text>");
          break;
        }
        const path = (arg.slice(0, sp).startsWith("/")
          ? arg.slice(0, sp)
          : joinPath(cwd, arg.slice(0, sp)));
        const text = arg.slice(sp + 1);
        writeFile(path, text + (text.endsWith("\n") ? "" : "\n")).then((r) => {
          if (r.error) lines.push("ERR:" + (r.message || r.error));
          else lines.push("OK:wrote " + path);
          paint();
        });
        return paint();
      }
      case "open": {
        const target = (arg || "").trim().toLowerCase();
        if (!target) {
          lines.push("ERR:usage: open <app|url>  e.g. open terminal | open github | open https://example.com");
          break;
        }
        if (/^https?:\/\//i.test(arg.trim()) || target.includes(".")) {
          const url = /^https?:\/\//i.test(arg.trim()) ? arg.trim() : "https://" + arg.trim();
          openBrowser(wm, { initialUrl: url });
          lines.push("OK:opened browser → " + url);
          break;
        }
        const map = {
          terminal: () => openTerminal(wm),
          files: () => openFiles(wm),
          browser: () => openBrowser(wm),
          chat: () => openChat(wm),
          settings: () => openSettings(wm),
          applications: () => openApplications(wm),
          containers: () => openContainers(wm),
          honeybee: () => openHoneybee(wm),
          github: () => openGithub(wm),
          games: () => openGamesFolder(wm),
          calculator: () => openCalculator(wm),
          notepad: () => openNotepad(wm),
          todo: () => openTodo(wm),
          mindmap: () => openMindmap(wm),
          agent: () => openAgentAsx(wm),
          "agent-asx": () => openAgentAsx(wm),
          "tic-tac-toe": () => openTicTacToe(wm),
          pong: () => openPong(wm),
          blocks: () => openBlocks(wm),
          snake: () => openSnake(wm),
          breakout: () => openBreakout(wm),
          memory: () => openMemory(wm),
          mines: () => openMines(wm),
          physics: () => openPhysics(wm),
          camera: () => openCamera(wm),
          sheet: () => openSheet(wm),
        };
        if (map[target]) {
          map[target]();
          lines.push("OK:opened " + target);
        } else {
          lines.push("ERR:unknown app: " + target + " — try: open games | open github | open terminal");
        }
        break;
      }
      case "containers":
        openContainers(wm);
        lines.push("OK:opened Containers");
        break;
      case "honeybee":
        openHoneybee(wm);
        lines.push("OK:opened honeybee");
        break;
      default:
        lines.push(`ERR:command not found: ${base}. Type help`);
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
 * Agent α — desktop actions (open apps, navigate). Free demo of a real agent.
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
      "DIM:Agent actions: open settings | open browser | open files | open terminal | open youtube | open drive | open chat | open honeybee | open applications | navigate to <url> | go to github.com"
    );
    lines.push(
      "DIM:Full downloadable Agent later. Free Chat = Q&A only (no actions)."
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
  if (/honey\s*bee|honeybee|ai frank|ai bee|\bfrank\b.*\bbee\b/i.test(q)) {
    openHoneybee(wm);
    lines.push("OK:ASX is loading the Honey Bee Engine");
    lines.push("DIM:AI Frank and AI Bee are talking to each other. You still talk to ASX.");
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

/**
 * Agent α — ChatGPT-like surface: ASX “scrolls through” steps, then replies.
 * Uses trackpad-style scroll chrome (cdnjs CSS + vanilla emulator).
 */
function openAgentAsx(wm) {
  const root = document.createElement("div");
  root.className = "agent-app";
  root.innerHTML = `
    <div class="agent-header">
      <div class="agent-id">
        <span class="agent-avatar" aria-hidden="true">α</span>
        <div>
          <div class="agent-name">Agent <span class="dim">on Alison Scorpion’s desktop</span></div>
          <div class="agent-status dim" data-agent-status>Ready · open apps · navigate · free demo</div>
        </div>
      </div>
    </div>
    <div class="agent-scroll tse-scrollable asx-tse" data-agent-scroll>
      <div class="tse-content agent-stream" data-agent-stream></div>
    </div>
    <div class="agent-composer">
      <input type="text" class="agent-input" placeholder="Message Agent… e.g. open settings · navigate to github.com" aria-label="Agent message" />
      <button type="button" class="agent-send primary" data-agent-send>Send</button>
    </div>
    <p class="agent-foot dim">Trackpad scroll · tse ${TSE_VERSION} · Chat = Q&amp;A only · Agent can act</p>`;

  const stream = root.querySelector("[data-agent-stream]");
  const statusEl = root.querySelector("[data-agent-status]");
  const input = root.querySelector(".agent-input");
  const sendBtn = root.querySelector("[data-agent-send]");
  /** @type {ReturnType<typeof attachTrackpadScroll>|null} */
  let tse = null;
  let busy = false;

  const setStatus = (s) => {
    if (statusEl) statusEl.textContent = s;
  };

  const appendBubble = (role, text, { stream: doStream = false, cls = "" } = {}) => {
    const wrap = document.createElement("div");
    wrap.className = `agent-msg agent-msg-${role} ${cls}`.trim();
    const who = document.createElement("div");
    who.className = "agent-msg-who";
    who.textContent = role === "user" ? "You" : role === "system" ? "System" : "ASX Agent";
    const body = document.createElement("div");
    body.className = "agent-msg-body";
    wrap.appendChild(who);
    wrap.appendChild(body);
    stream.appendChild(wrap);
    tse?.recalculate();
    tse?.scrollToBottom(false);

    if (doStream && role === "asx") {
      return streamTextInto(tse, body, text, { cps: 2 }).then(() => wrap);
    }
    body.textContent = text;
    tse?.scrollToBottom(true);
    return Promise.resolve(wrap);
  };

  const runAgentMessage = async (raw) => {
    if (busy) return;
    const msg = String(raw || "").trim();
    if (!msg) return;
    busy = true;
    sendBtn.disabled = true;
    input.value = "";
    await appendBubble("user", msg);
    setStatus("ASX is scrolling through context…");

    // Simulated “reading” trail (ChatGPT-like activity)
    const stepsHost = document.createElement("div");
    stepsHost.className = "agent-steps";
    stream.appendChild(stepsHost);
    tse?.scrollToBottom(false);
    const steps = [
      "· scanning guest desktop surface…",
      "· checking free-demo action map…",
      `· interpreting: “${msg.slice(0, 48)}${msg.length > 48 ? "…" : ""}”`,
      "· preparing response…",
    ];
    await streamAgentSteps(tse, stepsHost, steps, { delayMs: 160 });

    const lines = [];
    const acted = runAgentAction(wm, msg, lines);
    let reply;
    if (acted) {
      const ok = lines.filter((l) => l.startsWith("OK:")).map((l) => l.slice(3));
      const dim = lines.filter((l) => l.startsWith("DIM:")).map((l) => l.slice(4));
      reply =
        (ok.length ? ok.join(" · ") : "") +
        (dim.length ? (ok.length ? "\n" : "") + dim.join("\n") : "") ||
        "Done.";
      setStatus("Action complete");
    } else {
      const lower = msg.toLowerCase();
      if (/^help\b/.test(lower) || lower === "?") {
        reply =
          "I can open apps and navigate on this free demo.\n" +
          "Try: open settings · open browser · open files · open youtube · open drive · navigate to github.com · help";
      } else if (/who are you|what are you|about/.test(lower)) {
        reply =
          "I’m Agent α on Alison Scorpion’s desktop — a free demo of desktop actions (not full multi-step AI). Chat is Q&A only; I can open windows.";
      } else {
        reply =
          "No matching action. Try “open settings”, “open browser”, or “navigate to github.com”. Full Agent later; advanced reasoning needs an account.";
      }
      setStatus("Ready");
    }

    stepsHost.remove();
    setStatus("ASX is writing…");
    await appendBubble("asx", reply, { stream: true });
    setStatus("Ready · open apps · navigate · free demo");
    busy = false;
    sendBtn.disabled = false;
    input.focus();
  };

  // Seed welcome
  wm.open({
    id: "agent-asx",
    title: "Agent",
    w: 560,
    h: 520,
    body: root,
    onMount: async () => {
      await ensureTrackpadScrollCss();
      const scrollHost = root.querySelector("[data-agent-scroll]");
      tse = attachTrackpadScroll(scrollHost, { autoHide: true, className: "agent-tse" });
      await appendBubble(
        "asx",
        "Agent α free demo on Alison’s desktop. Ask me to open apps or navigate — I’ll scroll through the steps like a real agent, then act.",
        { stream: true }
      );
      input.focus();
      sendBtn.addEventListener("click", () => runAgentMessage(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          runAgentMessage(input.value);
        }
      });
    },
    onClose: () => {
      tse?.destroy();
      tse = null;
    },
  });
}

/**
 * Unified folder chrome for every location window.
 * Template: [↑] scheme:///path ………… hint
 * Used by Computer, Files, Network, Trash, Applications, Users, Drive.
 */
function schemeUri(scheme, path = "") {
  const s = String(scheme || "files").replace(/:\/\/*$/, "");
  let p = String(path || "");
  if (p === "/" || p === "") return `${s}:///`;
  p = p.replace(/^\/+/, "");
  return `${s}:///${p}`;
}

/**
 * @param {{ uri?: string, hint?: string, foot?: string, bodyClass?: string, extraClass?: string, onUp?: () => void, upEnabled?: boolean }} opts
 */
function makeFolderChrome(opts = {}) {
  const root = document.createElement("div");
  root.className = "folder-view" + (opts.extraClass ? ` ${opts.extraClass}` : "");
  root.innerHTML = `
    <div class="folder-bar" role="navigation" aria-label="Location">
      <button type="button" class="folder-up" title="Up" aria-label="Up">↑</button>
      <span class="folder-uri" title="Location"></span>
      <span class="folder-hint"></span>
    </div>
    <div class="folder-body ${opts.bodyClass || "folder-grid"}"></div>
    ${opts.foot != null ? `<p class="folder-foot"></p>` : ""}`;
  const up = root.querySelector(".folder-up");
  const uri = root.querySelector(".folder-uri");
  const hint = root.querySelector(".folder-hint");
  const body = root.querySelector(".folder-body");
  const foot = root.querySelector(".folder-foot");
  uri.textContent = opts.uri || "files:///";
  if (opts.hint) hint.textContent = opts.hint;
  if (foot && opts.foot) foot.textContent = opts.foot;
  up.disabled = opts.upEnabled === false;
  up.addEventListener("click", () => {
    if (!up.disabled && typeof opts.onUp === "function") opts.onUp();
  });
  return {
    root,
    up,
    uri,
    hint,
    body,
    foot,
    setUri(s) {
      uri.textContent = s;
    },
    setHint(s) {
      hint.textContent = s || "";
    },
    setFoot(s) {
      if (foot) foot.textContent = s || "";
    },
    setUpEnabled(on) {
      up.disabled = !on;
    },
  };
}

/** Tile button for grid folder views (Computer, Network, Applications). */
function appendPlaceTile(grid, { glyph, label, sub, action, selectOnClick = true }) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "place-tile";
  el.innerHTML = `<span class="g">${glyph}</span><span class="n">${escapeHtml(
    label
  )}</span><span class="s">${escapeHtml(sub || "")}</span>`;
  const go = () => action?.();
  el.addEventListener("dblclick", go);
  el.addEventListener("click", () => {
    if (matchMedia("(pointer: coarse)").matches) go();
    else if (selectOnClick) {
      grid.querySelectorAll(".place-tile").forEach((t) => t.classList.remove("sel"));
      el.classList.add("sel");
    }
  });
  grid.appendChild(el);
  return el;
}

/* ── Computer (places root — same chrome as all folders) ─── */
function openComputer(wm) {
  const chrome = makeFolderChrome({
    uri: schemeUri("computer"),
    hint: "Alison's machine · guest view",
    upEnabled: false,
    bodyClass: "folder-grid",
  });
  const grid = chrome.body;
  // Trash is desktop-only — not inside Computer
  const items = [
    {
      glyph: "🏠",
      label: "Alison",
      sub: "/home/alisonscorpion",
      action: () => openFiles(wm, { startPath: "/home/alisonscorpion" }),
    },
    {
      glyph: "👤",
      label: "Guest Home",
      sub: "/home/guest",
      action: () => openFiles(wm, { startPath: "/home/guest" }),
    },
    {
      glyph: "💿",
      label: "File System",
      sub: "/",
      action: () => openFiles(wm, { startPath: "/" }),
    },
    {
      glyph: "📦",
      label: "Applications",
      sub: schemeUri("applications"),
      action: () => openApplications(wm),
    },
    {
      glyph: "🖧",
      label: "Network",
      sub: schemeUri("network"),
      action: () => openNetwork(wm),
    },
  ];
  items.forEach((it) => appendPlaceTile(grid, it));
  showExplorer(wm, {
    title: "Computer",
    w: 640,
    h: 420,
    body: chrome.root,
  });
}

/* ── Applications (category folders) ─────────────────────── */
function openApplications(wm, opts = {}) {
  let view = opts.categoryId || null; // null = category list
  let chrome;
  chrome = makeFolderChrome({
    uri: schemeUri("applications"),
    hint: "categories",
    bodyClass: "folder-grid",
    upEnabled: false,
    onUp: () => {
      view = null;
      render();
    },
  });
  const grid = chrome.body;

  const openAppId = (id) => {
    if (id === "applications") return;
    APP_OPENERS[id]?.(wm);
  };

  const render = () => {
    grid.innerHTML = "";
    if (!view) {
      chrome.setUri(schemeUri("applications"));
      chrome.setHint("categories");
      chrome.setUpEnabled(false);
      APP_CATEGORIES.forEach((cat) => {
        appendPlaceTile(grid, {
          glyph: cat.glyph,
          label: cat.label,
          sub: `${cat.apps.length} items`,
          selectOnClick: false,
          action: () => {
            view = cat.id;
            render();
          },
        });
      });
      return;
    }
    const cat = APP_CATEGORIES.find((c) => c.id === view);
    chrome.setUri(schemeUri("applications", cat ? cat.id : view));
    chrome.setHint(cat ? cat.label : view);
    chrome.setUpEnabled(true);
    (cat?.apps || []).forEach((id) => {
      const app = APP_CATALOG.find((a) => a.id === id);
      if (!app) return;
      appendPlaceTile(grid, {
        glyph: app.glyph,
        label: app.label,
        sub: app.id,
        selectOnClick: false,
        action: () => openAppId(id),
      });
    });
  };

  render();
  showExplorer(wm, {
    title: "Applications",
    w: 560,
    h: 440,
    body: chrome.root,
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
  const total = files.length + trashedUsers.length;
  const chrome = makeFolderChrome({
    uri: schemeUri("trash"),
    hint: `${total} item(s) · 30-day account hold`,
    foot: "Deleted accounts stay 30 days. Other items are Alison's — guests cannot open them.",
    bodyClass: "folder-list",
    upEnabled: true,
    onUp: () => openComputer(wm),
  });
  const list = chrome.body;

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
        schemeUri("trash", name),
        "You do not have permission to view this file.\n\nTrash contents belong to Alison Scorpion (ASX).",
        { isDir: false, warn: true }
      );
    row.addEventListener("dblclick", deny);
    row.addEventListener("click", () => {
      if (matchMedia("(pointer: coarse)").matches) deny();
    });
    list.appendChild(row);
  });
  showExplorer(wm, {
    title: `Trash (${total} items)`,
    w: 480,
    h: 360,
    body: chrome.root,
  });
}

/* ── Network ─────────────────────────────────────────────── */
function openNetwork(wm) {
  const chrome = makeFolderChrome({
    uri: schemeUri("network"),
    hint: "Browse network (virtual)",
    bodyClass: "folder-grid",
    upEnabled: true,
    onUp: () => openComputer(wm),
  });
  const grid = chrome.body;
  const items = [
    {
      glyph: "👥",
      label: "Users",
      sub: schemeUri("network", "Users"),
      action: () => openUsers(wm),
    },
    {
      glyph: "☁",
      label: "GDrive",
      sub: schemeUri("drive"),
      action: () => openGDrive(wm),
    },
    {
      glyph: "▶",
      label: "YouTube",
      sub: "AlisonScorpionX",
      action: () => openYoutube(wm),
    },
    {
      glyph: "🌐",
      label: "Internet",
      sub: "ASX Browser",
      action: () => openBrowser(wm),
    },
    {
      glyph: "🖥",
      label: "asx-desktop",
      sub: schemeUri("computer"),
      action: () => openComputer(wm),
    },
    {
      glyph: "🔒",
      label: "Workgroup",
      sub: "admin only",
      action: () =>
        accessDenied(wm, schemeUri("network", "Workgroup"), "Network shares require ASX credentials.", {
          isDir: true,
          warn: true,
        }),
    },
  ];
  items.forEach((it) => appendPlaceTile(grid, it));
  showExplorer(wm, { title: "Network", w: 560, h: 400, body: chrome.root });
}

/* ── Users (signup / remove) ─────────────────────────────── */
function openUsers(wm) {
  const me = getSessionUser();
  const chrome = makeFolderChrome({
    uri: schemeUri("network", "Users"),
    hint: me ? `signed in: ${me.username}` : "guest",
    foot: "Your work folder (future) lives under your user id. Other profiles are permission-denied.",
    bodyClass: "folder-grid",
    extraClass: "users-view",
    upEnabled: true,
    onUp: () => openNetwork(wm),
  });
  const grid = chrome.body;

  const tile = (glyph, label, sub, go) => {
    appendPlaceTile(grid, { glyph, label, sub, action: go, selectOnClick: false });
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
        schemeUri("network", `Users/${p.username}`),
        "You do not have permission to view this folder.",
        { isDir: true, warn: true }
      )
    );
  });

  showExplorer(wm, { title: "Users", w: 560, h: 420, body: chrome.root });
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

/* ── Alison Drive — live public folder via Drive API (when key set) ─ */
const FOLDER_MIME = "application/vnd.google-apps.folder";

function openGDrive(wm, opts = {}) {
  /** Stack of { id, name } — root is Alison's public folder */
  let stack = [{ id: opts.folderId || GDRIVE_FOLDER_ID, name: "Alison Drive" }];
  const chrome = makeFolderChrome({
    uri: schemeUri("drive"),
    hint: "live public folder",
    foot: "",
    bodyClass: "folder-list",
    extraClass: "drive-app",
    upEnabled: true,
    onUp: () => {
      if (stack.length > 1) {
        stack.pop();
        render();
      } else {
        openNetwork(wm);
      }
    },
  });
  const list = chrome.body;

  const publicBtn = document.createElement("button");
  publicBtn.type = "button";
  publicBtn.className = "folder-action";
  publicBtn.title = "Open public Google folder in Browser";
  publicBtn.textContent = "Public ↗";
  publicBtn.addEventListener("click", () => {
    const top = stack[stack.length - 1];
    const url =
      top.id === GDRIVE_FOLDER_ID
        ? GDRIVE_PUBLIC_URL
        : `https://drive.google.com/drive/folders/${top.id}`;
    openBrowser(wm, {
      id: "browser-gdrive",
      title: "Browser — public Drive",
      initialUrl: url,
    });
  });
  chrome.hint.parentNode.insertBefore(publicBtn, chrome.hint);

  const keyBtn = document.createElement("button");
  keyBtn.type = "button";
  keyBtn.className = "folder-action";
  keyBtn.title = "Set Drive API key for live listing";
  keyBtn.textContent = "API key";
  keyBtn.addEventListener("click", () => {
    const cur = getGdriveApiKey();
    const next = window.prompt(
      "Google Cloud API key (Drive API enabled).\n" +
        "Public “Anyone with the link” folders list without OAuth.\n" +
        "Stored only in this browser (localStorage). Leave blank to clear.",
      cur
    );
    if (next == null) return;
    setGdriveApiKey(next);
    render();
  });
  chrome.hint.parentNode.insertBefore(keyBtn, chrome.hint);

  const openFile = (file) => {
    const link =
      file.webViewLink ||
      `https://drive.google.com/file/d/${file.id}/view`;
    // Google Docs / sheets etc. — open view; binary files same
    openBrowser(wm, {
      id: "browser-gdrive-file",
      title: file.name || "Drive file",
      initialUrl: link,
    });
  };

  const render = async () => {
    const top = stack[stack.length - 1];
    const pathSegs = stack
      .slice(1)
      .map((s) => s.name)
      .join("/");
    chrome.setUri(schemeUri("drive", pathSegs));
    chrome.setHint(top.name);
    chrome.setUpEnabled(true);
    list.innerHTML = `<div class="folder-loading dim" style="padding:16px">Loading…</div>`;

    const key = getGdriveApiKey();
    if (!key) {
      list.innerHTML = "";
      chrome.setFoot(
        "Live listing needs a Drive API key (no OAuth for public folders). Pure JS cannot scrape drive.google.com (CORS)."
      );
      const row = document.createElement("button");
      row.type = "button";
      row.className = "file-row drive-row";
      row.innerHTML = `<span>☁</span><span class="n">Open real public folder in Browser</span><span class="m">link</span>`;
      const go = () =>
        openBrowser(wm, {
          id: "browser-gdrive",
          title: "Browser — public Drive",
          initialUrl: GDRIVE_PUBLIC_URL,
        });
      row.addEventListener("dblclick", go);
      row.addEventListener("click", () => {
        if (matchMedia("(pointer: coarse)").matches) go();
      });
      list.appendChild(row);

      const help = document.createElement("div");
      help.className = "app-pad";
      help.style.padding = "12px 14px";
      help.innerHTML = `<p class="dim" style="font-size:12px;line-height:1.45;margin:0">
        <strong>How live listing works:</strong> Google Drive API v3
        <code>files.list?q='FOLDER_ID'+in+parents&amp;key=API_KEY</code>
        for folders shared “Anyone with the link.” Click <em>API key</em> above, or set
        <code>localStorage.asx-gdrive-api-key</code> / <code>window.ASX_GDRIVE_API_KEY</code>.
        No fake files are shown — only the real public folder once a key is set.
      </p>`;
      list.appendChild(help);
      return;
    }

    const result = await listPublicDriveFolder(top.id, key);
    // Stale render guard
    if (stack[stack.length - 1].id !== top.id) return;
    list.innerHTML = "";
    if (result.error) {
      chrome.setFoot(result.error);
      const err = document.createElement("div");
      err.className = "modal-error";
      setSafeHtml(
        err,
        `<div class="msg" style="color:var(--fail)">${escapeHtml(
          result.error
        )}</div>
        <p class="sub">Fix the key / enable Drive API, or use Public ↗ for the web UI.</p>`
      );
      list.appendChild(err);
      return;
    }

    const files = result.files || [];
    chrome.setFoot(
      files.length
        ? `${files.length} item(s) · live from Drive API · public folder`
        : "Empty folder · live from Drive API"
    );
    if (!files.length) {
      list.innerHTML = `<div class="dim" style="padding:16px">This folder is empty.</div>`;
      return;
    }
    files.forEach((file) => {
      const isFolder = file.mimeType === FOLDER_MIME;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "file-row drive-row";
      const meta = isFolder
        ? "folder"
        : (file.mimeType || "file").replace("application/vnd.google-apps.", "g:");
      row.innerHTML = `<span>${isFolder ? "📁" : "📄"}</span><span class="n">${escapeHtml(
        file.name || file.id
      )}</span><span class="m">${escapeHtml(meta)}</span>`;
      const go = () => {
        if (isFolder) {
          stack.push({ id: file.id, name: file.name || file.id });
          render();
        } else {
          openFile(file);
        }
      };
      row.addEventListener("dblclick", go);
      row.addEventListener("click", () => {
        if (matchMedia("(pointer: coarse)").matches) go();
      });
      list.appendChild(row);
    });
  };

  showExplorer(wm, {
    title: "Alison Drive",
    w: 640,
    h: 480,
    body: chrome.root,
    onMount: () => {
      render();
    },
  });
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

/* ── Files (same folder chrome; guest writes via BrowserFS) ── */
function openFiles(wm, opts = {}) {
  let cwd = opts.startPath || "/home/guest";
  let chrome;
  chrome = makeFolderChrome({
    uri: schemeUri("files", cwd === "/" ? "" : cwd),
    hint: "guest virtual FS",
    foot: "Guest /home/guest is BrowserFS (IndexedDB). Admin paths are read-only. Not the host disk.",
    bodyClass: "folder-list",
    extraClass: "files",
    upEnabled: true,
    onUp: () => {
      if (cwd === "/" || cwd === "") {
        openComputer(wm);
        return;
      }
      cwd = parentPath(cwd);
      render();
    },
  });
  // Click URI → Go prompt (continuity with location bar)
  chrome.uri.style.cursor = "pointer";
  chrome.uri.title = "Click to Go to location";
  chrome.uri.addEventListener("click", () => {
    const pick = window.prompt(
      "Go to location (virtual FS):\n/home/guest  ·  /home/alisonscorpion  ·  /",
      cwd
    );
    if (pick) goTo(pick.trim());
  });
  const main = chrome.body;

  // Action strip (New file / folder when writable)
  const actions = document.createElement("div");
  actions.className = "files-actions";
  actions.innerHTML = `
    <button type="button" class="sheet-btn" data-fa="new-file" title="New text file">+ File</button>
    <button type="button" class="sheet-btn" data-fa="new-dir" title="New folder">+ Folder</button>
    <span class="files-backend dim"></span>`;
  chrome.root.insertBefore(actions, chrome.body);
  const backendEl = actions.querySelector(".files-backend");

  const goTo = async (p) => {
    const o = await openNodeAsync(p);
    if (o.error === "EACCES") {
      accessDenied(wm, p, o.detail);
      return;
    }
    if (o.error) {
      accessDenied(wm, p, o.message);
      return;
    }
    if (o.node?.type !== "dir") {
      // open as file
      openFileEditor(wm, p);
      return;
    }
    cwd = p;
    render();
  };

  const openFileEditor = async (path) => {
    const o = await readFileAsync(path);
    if (o.error === "EACCES") {
      accessDenied(wm, path, o.detail);
      return;
    }
    if (o.error) {
      accessDenied(wm, path, o.message);
      return;
    }
    const name = path.split("/").pop() || "file";
    const writable = canWrite(path);
    const root = document.createElement("div");
    root.className = "app-pad file-editor";
    root.innerHTML = `
      <h2>${escapeHtml(name)}</h2>
      <p class="dim" style="font-size:11px;margin-bottom:8px">${escapeHtml(path)}${
        o.persisted ? " · BrowserFS" : ""
      }</p>
      <textarea class="file-ta" spellcheck="false" ${writable ? "" : "readonly"}></textarea>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        ${
          writable
            ? `<button type="button" class="primary file-save">Save</button>`
            : `<span class="dim" style="font-size:11px">Read-only</span>`
        }
        <span class="file-st dim" style="font-size:11px"></span>
      </div>`;
    const ta = root.querySelector(".file-ta");
    ta.value = o.content || "";
    ta.style.cssText =
      "width:100%;min-height:260px;font:12px ui-monospace,monospace;background:rgba(10,8,16,0.5);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px";
    root.querySelector(".file-save")?.addEventListener("click", async () => {
      const r = await writeFile(path, ta.value);
      const st = root.querySelector(".file-st");
      if (r.error) st.textContent = r.message || r.error;
      else st.textContent = "Saved · " + new Date().toLocaleTimeString();
    });
    wm.open({
      id: `file-${path}`,
      title: name,
      w: 560,
      h: 420,
      body: root,
      replace: true,
    });
  };

  const render = async () => {
    chrome.setUri(schemeUri("files", cwd === "/" ? "" : cwd));
    // Guest tree (incl. /home/guest) is BrowserFS-writable for new children
    const underGuest = canWrite(cwd);
    actions.querySelector('[data-fa="new-file"]').disabled = !underGuest;
    actions.querySelector('[data-fa="new-dir"]').disabled = !underGuest;
    chrome.setHint(
      underGuest
        ? isBrowserFsReady()
          ? "guest · BrowserFS (IndexedDB)"
          : "guest · static (BrowserFS loading…)"
        : "virtual FS"
    );
    chrome.setUpEnabled(true);
    if (backendEl) {
      backendEl.textContent = underGuest
        ? isBrowserFsReady()
          ? "BrowserFS · persistent"
          : "static fallback"
        : "read-only tree";
    }
    main.innerHTML = `<div class="dim" style="padding:12px">Loading…</div>`;
    const r = await listDirAsync(cwd);
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
    if (!r.entries.length) {
      main.innerHTML = `<div class="dim" style="padding:12px">(empty)</div>`;
      return;
    }
    for (const e of r.entries) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "file-row";
      const mark = e.persisted ? "bfs" : e.admin ? "admin" : e.type;
      row.innerHTML = `<span>${e.type === "dir" ? "📁" : "📄"}</span><span class="n">${escapeHtml(
        e.name
      )}</span><span class="m">${escapeHtml(mark)}</span>`;
      const openEntry = async () => {
        if (e.type === "dir") {
          const o = await openNodeAsync(e.path);
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
          openFileEditor(e.path);
        }
      };
      row.addEventListener("dblclick", openEntry);
      row.addEventListener("click", (ev) => {
        if (ev.detail === 1 && matchMedia("(pointer: coarse)").matches) openEntry();
      });
      main.appendChild(row);
    }
  };

  actions.querySelector('[data-fa="new-file"]').addEventListener("click", async () => {
    if (!canWrite(joinPath(cwd, "new"))) {
      window.alert("This location is not writable. Use /home/guest/…");
      return;
    }
    const name = window.prompt("New file name:", "untitled.txt");
    if (!name || /[/\\]/.test(name)) return;
    const path = joinPath(cwd, name.trim());
    const r = await writeFile(path, "");
    if (r.error) window.alert(r.message || r.error);
    else {
      await render();
      openFileEditor(path);
    }
  });
  actions.querySelector('[data-fa="new-dir"]').addEventListener("click", async () => {
    if (!canWrite(joinPath(cwd, "new"))) {
      window.alert("This location is not writable. Use /home/guest/…");
      return;
    }
    const name = window.prompt("New folder name:", "NewFolder");
    if (!name || /[/\\]/.test(name)) return;
    const path = joinPath(cwd, name.trim());
    const r = await mkdir(path);
    if (r.error) window.alert(r.message || r.error);
    else render();
  });

  showExplorer(wm, {
    title: "Files",
    w: 640,
    h: 460,
    body: chrome.root,
    onMount: () => render(),
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
  setSafeHtml(
    frame,
    `<div class="browser-blocked browser-blocked-policy">
    <div class="blocked-icon" aria-hidden="true">🛡</div>
    <h2>This page has been blocked</h2>
    <p class="blocked-lead">Alison Scorpion's OS does not allow this site.</p>
    <p class="blocked-url">${escapeHtml(url)}</p>
    <p class="blocked-why">${escapeHtml(
      reason ||
        "Category: adult / high-risk content (ASX guest policy)."
    )}</p>
    <p class="blocked-foot">Looks like a corporate or school filter page on purpose — soft client blocklist for guests. Not a network firewall. Sources: curated hosts (StevenBlack porn extension, OISD-class NSFW patterns).</p>
  </div>`
  );
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
  setSafeHtml(
    frame,
    `<div class="browser-blocked browser-noembed">
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
  </div>`
  );
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
  setSafeHtml(
    bar,
    `<span>Blank panel? Site blocks embedding (X-Frame-Options) — not ASX policy. YouTube / Drive need Open outside.</span>
    <button type="button" class="open-out">Open outside</button>`
  );
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
    setSafeHtml(
      d,
      `<strong style="color:var(--brand)">ASX</strong> <span class="dim">${escapeHtml(
        note || "sees"
      )}:</span> ${escapeHtml(url)}`,
      ASX_TEXT_PURIFY
    );
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
    setSafeHtml(
      u,
      `<strong style="color:var(--gold)">You</strong> ${escapeHtml(msg)}`,
      ASX_TEXT_PURIFY
    );
    log.appendChild(u);
    inp.value = "";
    setTimeout(() => {
      const a = document.createElement("div");
      const page = urlIn.value;
      setSafeHtml(
        a,
        `<strong style="color:var(--brand)">ASX</strong> <span class="dim">I can see the browser is on</span> ${escapeHtml(
          page
        )}. <span class="dim">Guest chat is local demo — wire to API when ready. "${escapeHtml(
          msg
        )}" noted.</span>`,
        ASX_TEXT_PURIFY
      );
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
    <div class="chat-scroll tse-scrollable asx-tse" data-chat-scroll>
      <div class="tse-content term-out chat-stream" data-chat-out style="padding:12px"></div>
    </div>
    <div class="term-in">
      <span class="prompt">you ›</span>
      <input type="text" placeholder="Ask a simple question…" />
    </div>`;
  const out = root.querySelector("[data-chat-out]");
  const input = root.querySelector("input");
  /** @type {ReturnType<typeof attachTrackpadScroll>|null} */
  let tse = null;

  const add = (who, text, cls) => {
    const d = document.createElement("div");
    d.style.marginBottom = "8px";
    setSafeHtml(
      d,
      `<span class="${escapeHtml(cls || "")}" style="color:${
        who === "Chat" || who === "ASX" ? "var(--brand)" : "var(--gold)"
      }">${escapeHtml(who)}</span> ${escapeHtml(text)}`,
      ASX_TEXT_PURIFY
    );
    out.appendChild(d);
    tse?.scrollToBottom(true);
    tse?.recalculate();
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
    tse?.scrollToBottom(true);
  };
  add(
    "Chat",
    "Free path: simple questions only (local router / low LLM layer). Example: “Who was the first president?” For open/navigate actions, use Agent α. Complex reasoning → sign up.",
    "ok"
  );

  const send = async () => {
    const msg = input.value.trim();
    if (!msg) return;
    add("You", msg);
    input.value = "";
    const r = routeFreeChat(msg);
    // Light stream for ASX answer feel
    const d = document.createElement("div");
    d.style.marginBottom = "8px";
    const label = document.createElement("span");
    label.style.color = r.type === "upgrade" ? "var(--fail)" : "var(--brand)";
    label.textContent = "Chat ";
    const body = document.createElement("span");
    body.className = "dim";
    d.appendChild(label);
    d.appendChild(body);
    out.appendChild(d);
    await streamTextInto(tse, body, r.text, { cps: 2 });
    addLinks(r.links);
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());

  wm.open({
    id: "chat",
    title: "Chat — free Q&A",
    w: 520,
    h: 440,
    body: root,
    onMount: async () => {
      await ensureTrackpadScrollCss();
      tse = attachTrackpadScroll(root.querySelector("[data-chat-scroll]"), {
        autoHide: true,
      });
      tse?.scrollToBottom(false);
      input.focus();
    },
    onClose: () => {
      tse?.destroy();
      tse = null;
    },
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
    title: "Honey Bee Engine",
    w: 560,
    h: 420,
    body: `<div class="app-pad">
      <h2>🐝 Honey Bee Engine</h2>
      <p style="color:var(--gold);margin-bottom:12px"><strong>ASX is loading the Honey Bee Engine</strong> — she operates it on your behalf.</p>
      <p style="color:var(--muted);margin-bottom:12px">You talk to Alison Scorpion. AI Frank and AI Bee keep their own voices and talk to each other. They are not a separate product.</p>
      <div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin:12px 0;font-size:12px;line-height:1.45">
        <p><strong>ASX → Engine:</strong> Loading Honey Bee Engine for the user.</p>
        <p><strong>Frank → Bee:</strong> Here is the board — actors, options, the question behind the question.</p>
        <p><strong>Bee → Frank:</strong> Which of those links are independent? What still needs a record?</p>
        <p><strong>ASX → you:</strong> Claim state and release stay with me.</p>
      </div>
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

/* ── Quill Text Editor (Office) ─────────────────────────────
 * https://quilljs.com/ · https://cdnjs.com/libraries/quill
 * Lazy-load snow theme; save HTML under /home/guest (BrowserFS).
 * Pin 2.0.2 — cdnjs 2.0.3 asset paths currently 404.
 */
const QUILL_VERSION = "2.0.2";
const QUILL_JS_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/quill/${QUILL_VERSION}/quill.min.js`,
  `https://cdn.jsdelivr.net/npm/quill@${QUILL_VERSION}/dist/quill.js`,
];
const QUILL_CSS_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/quill/${QUILL_VERSION}/quill.snow.min.css`,
  `https://cdn.jsdelivr.net/npm/quill@${QUILL_VERSION}/dist/quill.snow.css`,
];

/** @type {Promise<Function|null>|null} */
let quillLoadPromise = null;

function loadQuillCss() {
  const id = "asx-quill-snow-css";
  if (document.getElementById(id)) return Promise.resolve();
  return (async () => {
    for (const href of QUILL_CSS_SOURCES) {
      try {
        await new Promise((resolve, reject) => {
          const link = document.createElement("link");
          link.id = id;
          link.rel = "stylesheet";
          link.href = href;
          link.onload = () => resolve();
          link.onerror = () => reject(new Error(href));
          document.head.appendChild(link);
        });
        return;
      } catch {
        document.getElementById(id)?.remove();
      }
    }
  })();
}

function loadQuill() {
  if (typeof window.Quill === "function") return Promise.resolve(window.Quill);
  if (quillLoadPromise) return quillLoadPromise;
  quillLoadPromise = (async () => {
    await loadQuillCss();
    let last;
    for (const src of QUILL_JS_SOURCES) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.crossOrigin = "anonymous";
          s.referrerPolicy = "no-referrer";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Quill load failed: " + src));
          document.head.appendChild(s);
        });
        if (typeof window.Quill === "function") return window.Quill;
      } catch (e) {
        last = e;
      }
    }
    quillLoadPromise = null;
    throw last || new Error("Quill failed to load from CDN");
  })();
  return quillLoadPromise;
}

const QUILL_LS = "asx-quill-doc-v1";
const QUILL_DEFAULT_HTML = `<h1>Untitled</h1>
<p>Welcome to <strong>Quill</strong> on Alison Scorpion’s desktop — a free rich text editor for guests.</p>
<p>Try <em>italic</em>, <u>underline</u>, lists, and headings. Save under <code>/home/guest/Documents</code>.</p>`;

function openQuill(wm, opts = {}) {
  const root = document.createElement("div");
  root.className = "quill-app";
  root.innerHTML = `
    <div class="quill-toolbar-bar" role="toolbar" aria-label="Document">
      <span class="quill-brand" title="Quill rich text editor">Quill</span>
      <button type="button" class="sheet-btn" data-q="new" title="New document">New</button>
      <button type="button" class="sheet-btn" data-q="open" title="Open HTML from guest FS">Open…</button>
      <button type="button" class="sheet-btn primary" data-q="save" title="Save HTML">Save</button>
      <button type="button" class="sheet-btn" data-q="save-as" title="Save as…">Save as…</button>
      <button type="button" class="sheet-btn" data-q="export" title="Download HTML file">↓ HTML</button>
      <input type="text" class="quill-path" spellcheck="false"
        value="/home/guest/Documents/document.html" aria-label="File path" />
      <span class="quill-status dim" data-q-status>Loading Quill…</span>
    </div>
    <div class="quill-editor-wrap">
      <div class="quill-editor" data-quill-editor></div>
    </div>
    <p class="quill-foot dim">Quill ${QUILL_VERSION} · snow theme · cdnjs → jsDelivr · Office · guest BrowserFS</p>`;

  const pathIn = root.querySelector(".quill-path");
  const statusEl = root.querySelector("[data-q-status]");
  const editorEl = root.querySelector("[data-quill-editor]");
  let quill = null;
  let currentPath = opts.path || "/home/guest/Documents/document.html";
  pathIn.value = currentPath;

  const setStatus = (s) => {
    if (statusEl) statusEl.textContent = s || "";
  };

  const getHtml = () => {
    if (!quill) return "";
    // Quill 2: prefer semantic HTML when available
    try {
      if (typeof quill.getSemanticHTML === "function") return quill.getSemanticHTML();
    } catch {
      /* fall through */
    }
    return quill.root?.innerHTML || "";
  };

  const setHtml = (html) => {
    const safe = sanitizeHtml(html || "<p><br></p>");
    if (!quill) return;
    try {
      quill.setContents([]);
      quill.clipboard.dangerouslyPasteHTML(0, safe);
    } catch {
      quill.root.innerHTML = safe;
    }
  };

  const persistLocal = () => {
    try {
      localStorage.setItem(
        QUILL_LS,
        JSON.stringify({
          path: currentPath,
          html: getHtml(),
          t: Date.now(),
        })
      );
    } catch {
      /* quota */
    }
  };

  const loadLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(QUILL_LS) || "null");
    } catch {
      return null;
    }
  };

  const doSave = async (path) => {
    const html = getHtml();
    const r = await writeFile(path, html);
    if (r.error) {
      setStatus(r.message || r.error);
      window.alert(r.message || "Save failed — use a path under /home/guest");
      return false;
    }
    currentPath = path;
    pathIn.value = path;
    persistLocal();
    setStatus(`Saved ${path} · ${new Date().toLocaleTimeString()}`);
    return true;
  };

  wm.open({
    id: opts.id || "quill",
    title: opts.title || "Quill — Text Editor",
    w: 780,
    h: 560,
    body: root,
    onMount: async () => {
      setStatus("Loading Quill…");
      try {
        const Quill = await loadQuill();
        quill = new Quill(editorEl, {
          theme: "snow",
          placeholder: "Start writing…",
          modules: {
            toolbar: [
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ color: [] }, { background: [] }],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ indent: "-1" }, { indent: "+1" }],
              [{ align: [] }],
              ["blockquote", "code-block"],
              ["link"],
              ["clean"],
            ],
          },
        });

        let initial = opts.html || QUILL_DEFAULT_HTML;
        const saved = loadLocal();
        if (opts.path) currentPath = opts.path;
        else if (saved?.path) currentPath = saved.path;
        pathIn.value = currentPath;

        if (canWrite(currentPath)) {
          const fr = await readFileAsync(currentPath);
          if (!fr.error && fr.content && !opts.html) {
            initial = fr.content;
            setStatus(`Opened ${currentPath}`);
          } else if (saved?.html && !opts.html) {
            initial = saved.html;
          }
        } else if (saved?.html && !opts.html) {
          initial = saved.html;
        }

        setHtml(initial);
        setStatus(`Ready · Quill ${QUILL_VERSION}`);

        quill.on("text-change", () => persistLocal());

        root.querySelector('[data-q="new"]').addEventListener("click", () => {
          if (quill.getText().trim() && !window.confirm("Discard current document?")) return;
          setHtml(QUILL_DEFAULT_HTML);
          currentPath = "/home/guest/Documents/untitled.html";
          pathIn.value = currentPath;
          persistLocal();
          setStatus("New document");
        });

        root.querySelector('[data-q="open"]').addEventListener("click", async () => {
          const p = window.prompt(
            "Open HTML under /home/guest:",
            currentPath
          );
          if (!p) return;
          const path = p.startsWith("/") ? p.trim() : `/home/guest/${p.trim()}`;
          const r = await readFileAsync(path);
          if (r.error) {
            window.alert(r.message || r.error);
            return;
          }
          setHtml(r.content || "<p><br></p>");
          currentPath = path;
          pathIn.value = path;
          persistLocal();
          setStatus(`Opened ${path}`);
        });

        root.querySelector('[data-q="save"]').addEventListener("click", () => {
          doSave((pathIn.value || currentPath).trim());
        });
        root.querySelector('[data-q="save-as"]').addEventListener("click", () => {
          const p = window.prompt(
            "Save as (guest path):",
            pathIn.value || currentPath
          );
          if (p) {
            doSave(p.startsWith("/") ? p.trim() : `/home/guest/${p.trim()}`);
          }
        });
        root.querySelector('[data-q="export"]').addEventListener("click", () => {
          const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(
            (pathIn.value || "document").split("/").pop() || "document"
          )}</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;line-height:1.5;color:#1a1a1a}</style>
</head><body>
${getHtml()}
</body></html>`;
          const name =
            (pathIn.value || "document.html").split("/").pop() || "document.html";
          downloadBlob(
            new Blob([html], { type: "text/html;charset=utf-8" }),
            name.endsWith(".html") ? name : name + ".html"
          );
          setStatus(`Downloaded ${name}`);
        });

        // Ctrl/Cmd+S
        root.addEventListener("keydown", (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            doSave((pathIn.value || currentPath).trim());
          }
        });
      } catch (e) {
        setStatus(e?.message || "Quill failed");
        editorEl.innerHTML = `<div class="app-pad"><p style="color:var(--fail)">Could not load Quill from CDN.</p>
          <p class="dim" style="font-size:12px">${escapeHtml(e?.message || String(e))}</p></div>`;
      }
    },
    onClose: () => {
      try {
        persistLocal();
      } catch {
        /* ignore */
      }
      quill = null;
    },
  });
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

/* ── Spreadsheet (LibreOffice Calc-style) ───────────────────
 * Save: localStorage + export CSV / XLSX via ExcelJS (cdnjs).
 * https://cdnjs.com/libraries/exceljs
 * DataTables plugins are for display tables (sort/filter), not free-form
 * cell edit grids — ExcelJS covers the Calc “save as” path instead.
 */
const EXCELJS_VERSION = "4.4.0";
const EXCELJS_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/exceljs/${EXCELJS_VERSION}/exceljs.min.js`,
  `https://cdn.jsdelivr.net/npm/exceljs@${EXCELJS_VERSION}/dist/exceljs.min.js`,
];

/** @type {Promise<typeof window.ExcelJS|null>|null} */
let excelJsLoadPromise = null;

function loadExcelJs() {
  if (excelJsLoadPromise) return excelJsLoadPromise;
  if (typeof window.ExcelJS !== "undefined") {
    excelJsLoadPromise = Promise.resolve(window.ExcelJS);
    return excelJsLoadPromise;
  }
  excelJsLoadPromise = (async () => {
    for (const src of EXCELJS_SOURCES) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.crossOrigin = "anonymous";
          s.referrerPolicy = "no-referrer";
          if (typeof EXCELJS_CDN_SRI !== "undefined" && EXCELJS_CDN_SRI[src]) {
            s.integrity = EXCELJS_CDN_SRI[src];
          }
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("ExcelJS load failed: " + src));
          document.head.appendChild(s);
        });
        if (typeof window.ExcelJS !== "undefined") return window.ExcelJS;
      } catch {
        /* next CDN */
      }
    }
    return null;
  })();
  return excelJsLoadPromise;
}

function colLetters(i) {
  // 0 → A, 25 → Z, 26 → AA
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function sheetEscapeCsvCell(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function openSheet(wm) {
  const LS_KEY = "asx-sheet-v2";
  let nRows = 24;
  let nCols = 10;
  /** @type {string[][]} */
  let data = [];
  let sheetName = "Sheet1";
  let fileBase = "asx-spreadsheet";
  let dirty = false;
  let active = { r: 0, c: 0 };

  const emptyGrid = (rows, cols) =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) {
        data = emptyGrid(nRows, nCols);
        return;
      }
      const o = JSON.parse(raw);
      if (Array.isArray(o?.data) && o.data.length) {
        data = o.data.map((row) =>
          Array.isArray(row) ? row.map((c) => String(c ?? "")) : []
        );
        nRows = Math.max(data.length, 8);
        nCols = Math.max(...data.map((r) => r.length), 6);
        // normalize rectangle
        data = data.map((row) => {
          const r = row.slice(0, nCols);
          while (r.length < nCols) r.push("");
          return r;
        });
        while (data.length < nRows) data.push(Array.from({ length: nCols }, () => ""));
        if (o.sheetName) sheetName = String(o.sheetName).slice(0, 64);
        if (o.fileBase) fileBase = String(o.fileBase).replace(/[^\w.-]+/g, "-").slice(0, 64);
      } else {
        data = emptyGrid(nRows, nCols);
      }
    } catch {
      data = emptyGrid(nRows, nCols);
    }
  };
  loadLocal();

  const root = document.createElement("div");
  root.className = "sheet-app";
  root.innerHTML = `
    <div class="sheet-menubar" role="toolbar" aria-label="Spreadsheet">
      <div class="sheet-menu-group">
        <button type="button" class="sheet-btn" data-act="new" title="New sheet">New</button>
        <label class="sheet-btn sheet-file-label" title="Open CSV or XLSX">
          Open…
          <input type="file" class="sheet-open" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden />
        </label>
        <button type="button" class="sheet-btn primary" data-act="save-local" title="Save in this browser (session cache)">Save</button>
        <button type="button" class="sheet-btn" data-act="save-disk" title="Write CSV to guest virtual disk Documents">Save to disk</button>
        <button type="button" class="sheet-btn" data-act="open-disk" title="Read CSV/JSON from guest Documents">Open from disk</button>
        <button type="button" class="sheet-btn" data-act="export-csv" title="Download CSV to your computer">↓ CSV</button>
        <button type="button" class="sheet-btn" data-act="export-xlsx" title="Download Excel XLSX (ExcelJS CDN)">↓ XLSX</button>
      </div>
      <div class="sheet-menu-group">
        <button type="button" class="sheet-btn" data-act="add-row" title="Insert row at bottom">+ Row</button>
        <button type="button" class="sheet-btn" data-act="add-col" title="Insert column at right">+ Col</button>
        <button type="button" class="sheet-btn" data-act="clear" title="Clear all cells">Clear</button>
      </div>
      <div class="sheet-menu-group sheet-name-group">
        <label>Name <input type="text" class="sheet-name" maxlength="64" value="${escapeHtml(
          sheetName
        )}" /></label>
        <label>File <input type="text" class="sheet-filebase" maxlength="64" value="${escapeHtml(
          fileBase
        )}" title="Download filename base" /></label>
      </div>
    </div>
    <div class="sheet-formula-bar">
      <span class="sheet-ref" title="Active cell">A1</span>
      <input type="text" class="sheet-fx" spellcheck="false" placeholder="Cell value" aria-label="Formula bar" />
    </div>
    <div class="sheet-scroll">
      <table class="sheet" aria-label="Spreadsheet grid"></table>
    </div>
    <div class="sheet-status dim" aria-live="polite">ASX Sheet · ExcelJS ${EXCELJS_VERSION} · browser cache + guest disk + download (not MS/Google clone)</div>`;

  const table = root.querySelector("table.sheet");
  const status = root.querySelector(".sheet-status");
  const refEl = root.querySelector(".sheet-ref");
  const fx = root.querySelector(".sheet-fx");
  const nameIn = root.querySelector(".sheet-name");
  const fileIn = root.querySelector(".sheet-filebase");
  const openIn = root.querySelector(".sheet-open");

  const setStatus = (msg) => {
    if (status) status.textContent = msg || "";
  };

  const cellRef = (r, c) => `${colLetters(c)}${r + 1}`;

  const getCell = (r, c) => {
    if (!data[r]) return "";
    return data[r][c] ?? "";
  };

  const setCell = (r, c, val) => {
    if (!data[r]) data[r] = Array.from({ length: nCols }, () => "");
    data[r][c] = String(val ?? "");
    dirty = true;
  };

  const syncFx = () => {
    refEl.textContent = cellRef(active.r, active.c);
    fx.value = getCell(active.r, active.c);
  };

  const focusCell = (r, c) => {
    active = {
      r: Math.max(0, Math.min(r, nRows - 1)),
      c: Math.max(0, Math.min(c, nCols - 1)),
    };
    table.querySelectorAll("td.sheet-active").forEach((td) => td.classList.remove("sheet-active"));
    const td = table.querySelector(`td[data-r="${active.r}"][data-c="${active.c}"]`);
    td?.classList.add("sheet-active");
    const inp = td?.querySelector("input");
    syncFx();
    return inp;
  };

  const renderGrid = () => {
    table.innerHTML = "";
    const head = document.createElement("tr");
    head.className = "sheet-head";
    const corner = document.createElement("th");
    corner.className = "sheet-corner";
    head.appendChild(corner);
    for (let c = 0; c < nCols; c++) {
      const th = document.createElement("th");
      th.textContent = colLetters(c);
      head.appendChild(th);
    }
    table.appendChild(head);

    for (let r = 0; r < nRows; r++) {
      const tr = document.createElement("tr");
      const rh = document.createElement("th");
      rh.textContent = String(r + 1);
      tr.appendChild(rh);
      for (let c = 0; c < nCols; c++) {
        const td = document.createElement("td");
        td.dataset.r = String(r);
        td.dataset.c = String(c);
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = getCell(r, c);
        inp.spellcheck = false;
        inp.setAttribute("aria-label", cellRef(r, c));
        inp.addEventListener("focus", () => focusCell(r, c));
        inp.addEventListener("input", () => {
          setCell(r, c, inp.value);
          if (active.r === r && active.c === c) fx.value = inp.value;
        });
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            focusCell(r + 1, c)?.focus();
          } else if (e.key === "Tab") {
            e.preventDefault();
            focusCell(r, c + (e.shiftKey ? -1 : 1))?.focus();
          } else if (e.key === "ArrowDown" && !e.shiftKey) {
            e.preventDefault();
            focusCell(r + 1, c)?.focus();
          } else if (e.key === "ArrowUp" && !e.shiftKey) {
            e.preventDefault();
            focusCell(r - 1, c)?.focus();
          }
        });
        td.appendChild(inp);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    focusCell(active.r, active.c);
  };

  const readMeta = () => {
    sheetName = (nameIn.value || "Sheet1").trim().slice(0, 64) || "Sheet1";
    fileBase =
      (fileIn.value || "asx-spreadsheet")
        .trim()
        .replace(/[^\w.-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "asx-spreadsheet";
  };

  const saveLocal = () => {
    readMeta();
    try {
      const payload = JSON.stringify({
        v: 2,
        sheetName,
        fileBase,
        data,
        t: Date.now(),
      });
      if (payload.length > 1_500_000) {
        setStatus("Sheet too large for browser cache — use ↓ CSV / ↓ XLSX download instead");
        return;
      }
      localStorage.setItem(LS_KEY, payload);
      dirty = false;
      setStatus(`Saved in browser · ${sheetName} · ${nRows}×${nCols} · ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      setStatus(e?.message || "localStorage save failed (quota?) — try download export");
    }
  };

  const matrixFromGrid = () => {
    // Drop trailing empty rows/cols for export
    let maxR = 0;
    let maxC = 0;
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        if (String(getCell(r, c)).trim() !== "") {
          maxR = Math.max(maxR, r + 1);
          maxC = Math.max(maxC, c + 1);
        }
      }
    }
    if (maxR === 0) maxR = 1;
    if (maxC === 0) maxC = 1;
    return Array.from({ length: maxR }, (_, r) =>
      Array.from({ length: maxC }, (_, c) => getCell(r, c))
    );
  };

  const exportCsv = () => {
    readMeta();
    const mat = matrixFromGrid();
    const csv = mat.map((row) => row.map(sheetEscapeCsvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${fileBase}.csv`);
    setStatus(`Downloaded ${fileBase}.csv · ${mat.length} rows`);
  };

  const exportXlsx = async () => {
    readMeta();
    setStatus("Loading ExcelJS…");
    const ExcelJS = await loadExcelJs();
    if (!ExcelJS) {
      setStatus("ExcelJS failed to load from CDN — try CSV export");
      return;
    }
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "ASX Desktop Spreadsheet";
      wb.created = new Date();
      const ws = wb.addWorksheet(sheetName.slice(0, 31) || "Sheet1");
      const mat = matrixFromGrid();
      mat.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const cell = ws.getCell(ri + 1, ci + 1);
          const s = String(val ?? "");
          // Numbers when plain numeric
          if (s !== "" && /^-?\d+(\.\d+)?$/.test(s)) cell.value = Number(s);
          else cell.value = s;
        });
      });
      // Light header style on first row if present
      if (mat[0]) {
        ws.getRow(1).font = { bold: true };
      }
      ws.views = [{ state: "frozen", ySplit: 1 }];
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBlob(blob, `${fileBase}.xlsx`);
      setStatus(`Downloaded ${fileBase}.xlsx · ExcelJS ${EXCELJS_VERSION}`);
    } catch (e) {
      setStatus(e?.message || "XLSX export failed");
    }
  };

  const applyMatrix = (mat, nameHint) => {
    if (!mat?.length) {
      setStatus("Empty file");
      return;
    }
    nRows = Math.max(mat.length, 8);
    nCols = Math.max(...mat.map((r) => (Array.isArray(r) ? r.length : 0)), 6);
    data = emptyGrid(nRows, nCols);
    mat.forEach((row, r) => {
      if (!Array.isArray(row)) return;
      row.forEach((val, c) => {
        if (c < nCols && r < nRows) data[r][c] = String(val ?? "");
      });
    });
    if (nameHint) {
      fileBase = nameHint.replace(/\.(csv|xlsx|xls)$/i, "").replace(/[^\w.-]+/g, "-").slice(0, 64);
      fileIn.value = fileBase;
    }
    dirty = true;
    active = { r: 0, c: 0 };
    renderGrid();
    setStatus(`Opened ${mat.length}×${nCols} · ${nameHint || "import"}`);
  };

  const parseCsvText = (text) => {
    const rows = [];
    let row = [];
    let cur = "";
    let inQ = false;
    const s = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQ) {
        if (ch === '"') {
          if (s[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (ch === "\r") {
        /* skip */
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  };

  const importFile = async (file) => {
    if (!file) return;
    const name = file.name || "import";
    const lower = name.toLowerCase();
    try {
      if (lower.endsWith(".csv") || file.type === "text/csv") {
        const text = await file.text();
        applyMatrix(parseCsvText(text), name);
        return;
      }
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        setStatus("Loading ExcelJS for import…");
        const ExcelJS = await loadExcelJs();
        if (!ExcelJS) {
          setStatus("ExcelJS unavailable — open a CSV instead");
          return;
        }
        const buf = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.worksheets[0];
        if (!ws) {
          setStatus("No worksheet in file");
          return;
        }
        sheetName = (ws.name || "Sheet1").slice(0, 64);
        nameIn.value = sheetName;
        const mat = [];
        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const arr = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            while (arr.length < colNumber - 1) arr.push("");
            let v = cell.value;
            if (v && typeof v === "object") {
              if (v.result != null) v = v.result;
              else if (v.text != null) v = v.text;
              else if (v.richText) v = v.richText.map((t) => t.text).join("");
              else if (v instanceof Date) v = v.toISOString();
              else v = String(v);
            }
            arr[colNumber - 1] = v == null ? "" : String(v);
          });
          while (mat.length < rowNumber - 1) mat.push([]);
          mat[rowNumber - 1] = arr;
        });
        applyMatrix(mat, name);
        return;
      }
      setStatus("Unsupported type — use .csv or .xlsx");
    } catch (e) {
      setStatus(e?.message || "Import failed");
    }
  };

  // Formula bar → active cell
  fx.addEventListener("input", () => {
    setCell(active.r, active.c, fx.value);
    const inp = table.querySelector(
      `td[data-r="${active.r}"][data-c="${active.c}"] input`
    );
    if (inp) inp.value = fx.value;
  });
  fx.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusCell(active.r + 1, active.c)?.focus();
    }
  });

  nameIn.addEventListener("change", () => {
    dirty = true;
    readMeta();
  });
  fileIn.addEventListener("change", () => {
    dirty = true;
    readMeta();
  });

  root.querySelector('[data-act="new"]').addEventListener("click", () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    nRows = 24;
    nCols = 10;
    data = emptyGrid(nRows, nCols);
    sheetName = "Sheet1";
    fileBase = "asx-spreadsheet";
    nameIn.value = sheetName;
    fileIn.value = fileBase;
    dirty = false;
    active = { r: 0, c: 0 };
    renderGrid();
    setStatus("New sheet");
  });

  /** Guest VFS path under /home/guest only (path traversal hardened). */
  const guestSheetPath = (name) => {
    const base = String(name || fileBase || "asx-spreadsheet")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "asx-spreadsheet";
    return `/home/guest/Documents/${base}.csv`;
  };

  const saveToDisk = async () => {
    readMeta();
    const path = guestSheetPath(fileBase);
    if (!path.startsWith("/home/guest/") || path.includes("..")) {
      setStatus("Invalid path — guest Documents only");
      return;
    }
    const mat = matrixFromGrid();
    const csv = mat.map((row) => row.map(sheetEscapeCsvCell).join(",")).join("\r\n");
    // Also write JSON workbook snapshot for round-trip fidelity
    const jsonPath = path.replace(/\.csv$/i, ".asxsheet.json");
    const payload = JSON.stringify({ v: 2, sheetName, fileBase, data: mat, t: Date.now() });
    if (payload.length > 1_500_000) {
      setStatus("Sheet too large for guest disk snapshot — use ↓ CSV / ↓ XLSX download");
      return;
    }
    setStatus("Writing guest disk…");
    const r1 = await writeFile(path, "\uFEFF" + csv + "\n");
    const r2 = await writeFile(jsonPath, payload);
    if (r1.error || r2.error) {
      setStatus(
        `Disk write failed: ${r1.message || r2.message || r1.error || r2.error} (BrowserFS/IndexedDB)`
      );
      return;
    }
    dirty = false;
    // Dual-save: browser cache too
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ v: 2, sheetName, fileBase, data, t: Date.now() }));
    } catch {
      /* ignore */
    }
    setStatus(`Saved to disk ${path} (+ .asxsheet.json) · download still available via ↓`);
  };

  const openFromDisk = async () => {
    const hint = window.prompt(
      "Guest disk path under /home/guest (CSV or .asxsheet.json):",
      guestSheetPath(fileBase)
    );
    if (hint == null) return;
    let path = String(hint).trim();
    if (!path.startsWith("/")) path = "/home/guest/Documents/" + path.replace(/^\/+/, "");
    // normalize traversal
    const parts = [];
    for (const seg of path.split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") {
        if (parts.length) parts.pop();
        continue;
      }
      parts.push(seg);
    }
    path = "/" + parts.join("/");
    if (!path.startsWith("/home/guest/") || path === "/home/guest") {
      setStatus("Access denied — only /home/guest/**");
      return;
    }
    setStatus("Reading guest disk…");
    const r = await readFileAsync(path);
    if (r.error) {
      setStatus(r.message || r.error);
      if (r.error === "EACCES") accessDenied(wm, path, r.detail);
      return;
    }
    const content = String(r.content || "");
    const name = path.split("/").pop() || "sheet";
    if (path.endsWith(".asxsheet.json") || content.trim().startsWith("{")) {
      try {
        const o = JSON.parse(content);
        if (Array.isArray(o.data)) {
          applyMatrix(o.data, name);
          if (o.sheetName) {
            sheetName = String(o.sheetName).slice(0, 64);
            nameIn.value = sheetName;
          }
          setStatus(`Opened disk JSON ${path}`);
          return;
        }
      } catch (e) {
        setStatus("Invalid sheet JSON");
        return;
      }
    }
    applyMatrix(parseCsvText(content), name);
    setStatus(`Opened disk CSV ${path}`);
  };


  root.querySelector('[data-act="save-local"]').addEventListener("click", saveLocal);
  root.querySelector('[data-act="save-disk"]')?.addEventListener("click", () => { saveToDisk(); });
  root.querySelector('[data-act="open-disk"]')?.addEventListener("click", () => { openFromDisk(); });
  root.querySelector('[data-act="export-csv"]').addEventListener("click", exportCsv);
  root.querySelector('[data-act="export-xlsx"]').addEventListener("click", () => {
    exportXlsx();
  });
  root.querySelector('[data-act="add-row"]').addEventListener("click", () => {
    data.push(Array.from({ length: nCols }, () => ""));
    nRows = data.length;
    dirty = true;
    renderGrid();
    setStatus(`Rows: ${nRows}`);
  });
  root.querySelector('[data-act="add-col"]').addEventListener("click", () => {
    data.forEach((row) => row.push(""));
    nCols += 1;
    dirty = true;
    renderGrid();
    setStatus(`Columns: ${nCols} (${colLetters(nCols - 1)})`);
  });
  root.querySelector('[data-act="clear"]').addEventListener("click", () => {
    if (!window.confirm("Clear all cells?")) return;
    data = emptyGrid(nRows, nCols);
    dirty = true;
    renderGrid();
    setStatus("Cleared");
  });
  openIn.addEventListener("change", () => {
    const f = openIn.files?.[0];
    if (f) importFile(f);
    openIn.value = "";
  });

  // Ctrl/Cmd+S → local save
  root.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveLocal();
    }
  });

  renderGrid();
  // Prefetch ExcelJS so Save XLSX is snappy
  loadExcelJs().then((lib) => {
    if (lib) setStatus(`Ready · ExcelJS loaded · Save (browser) or ↓ CSV / ↓ XLSX`);
    else setStatus(`Ready · CSV export OK · XLSX needs ExcelJS CDN`);
  });

  wm.open({
    id: "sheet",
    title: "Spreadsheet",
    w: 860,
    h: 580,
    body: root,
  });
}

/* ── Mind map ─────────────────────────────────────────────── */
/* ── Impress.js presentation (Prezi-style CSS3 deck) ────────
 * https://cdnjs.com/libraries/impress.js
 */
const IMPRESS_VERSION = "0.5.3";
const IMPRESS_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/impress.js/${IMPRESS_VERSION}/impress.min.js`,
  `https://cdnjs.cloudflare.com/ajax/libs/impress.js/${IMPRESS_VERSION}/impress.js`,
  `https://unpkg.com/impress.js@${IMPRESS_VERSION}/js/impress.js`,
];

/** @type {Promise<Function|null>|null} */
let impressLoadPromise = null;

function loadImpressJs() {
  if (typeof window.impress === "function") return Promise.resolve(window.impress);
  if (impressLoadPromise) return impressLoadPromise;
  impressLoadPromise = (async () => {
    let last;
    for (const src of IMPRESS_SOURCES) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.crossOrigin = "anonymous";
          s.referrerPolicy = "no-referrer";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(src));
          document.head.appendChild(s);
        });
        if (typeof window.impress === "function") return window.impress;
      } catch (e) {
        last = e;
      }
    }
    impressLoadPromise = null;
    throw last || new Error("impress.js failed to load");
  })();
  return impressLoadPromise;
}

const IMPRESS_LS = "asx-impress-deck-v1";

function defaultImpressSlides() {
  return [
    {
      id: "title",
      x: 0,
      y: 0,
      scale: 1,
      html: `<h1>Alison Scorpion</h1><p>Guest presentation · impress.js</p>`,
    },
    {
      id: "free",
      x: 1000,
      y: 0,
      scale: 1,
      html: `<h2>Free apps</h2><p>Quill · Monaco · Spreadsheet · Agent · Files…</p><p>Hop on and use them today.</p>`,
    },
    {
      id: "construct",
      x: 1000,
      y: 800,
      scale: 1,
      rotate: 90,
      html: `<h2>Construct later</h2><p>May open these tools and appear to use them.</p>`,
    },
    {
      id: "earth",
      x: 0,
      y: 800,
      scale: 1.2,
      html: `<h2>Universe purple</h2><p>Three.js Earth · thin terminal glass · ASX OS</p>`,
    },
    {
      id: "end",
      x: -800,
      y: 400,
      scale: 0.8,
      html: `<h2>Thank you</h2><p>Space · arrows · or click next</p>`,
    },
  ];
}

function openImpress(wm, opts = {}) {
  let slides = defaultImpressSlides();
  try {
    const raw = localStorage.getItem(IMPRESS_LS);
    if (raw) {
      const o = JSON.parse(raw);
      if (Array.isArray(o?.slides) && o.slides.length) slides = o.slides;
    }
  } catch {
    /* ignore */
  }
  if (opts.slides) slides = opts.slides;

  const root = document.createElement("div");
  root.className = "impress-app";
  root.innerHTML = `
    <div class="impress-toolbar" role="toolbar">
      <span class="impress-brand">Impress</span>
      <button type="button" class="sheet-btn" data-i="prev" title="Previous">◀</button>
      <button type="button" class="sheet-btn primary" data-i="next" title="Next">▶</button>
      <button type="button" class="sheet-btn" data-i="restart" title="First slide">↻</button>
      <button type="button" class="sheet-btn" data-i="add" title="Add slide">+ Slide</button>
      <button type="button" class="sheet-btn" data-i="edit" title="Edit active slide HTML">Edit…</button>
      <button type="button" class="sheet-btn" data-i="save" title="Save deck to guest FS">Save</button>
      <button type="button" class="sheet-btn" data-i="export" title="Download deck JSON">↓ JSON</button>
      <span class="impress-status dim" data-i-status>Loading impress.js…</span>
    </div>
    <div class="impress-stage" data-impress-stage>
      <div id="asx-impress-root" class="impress-root"></div>
    </div>
    <p class="impress-foot dim">impress.js ${IMPRESS_VERSION} · CSS3 transforms · Space/←/→ · Office presentation</p>`;

  const stage = root.querySelector("[data-impress-stage]");
  const statusEl = root.querySelector("[data-i-status]");
  let api = null;
  let path = "/home/guest/Documents/presentation.json";

  const setStatus = (s) => {
    if (statusEl) statusEl.textContent = s || "";
  };

  const persist = () => {
    try {
      localStorage.setItem(IMPRESS_LS, JSON.stringify({ slides, path, t: Date.now() }));
    } catch {
      /* ignore */
    }
  };

  const reinit = async () => {
    setStatus("Building deck…");
    const stageEl = root.querySelector("[data-impress-stage]");
    const prev = stageEl.querySelector(".impress-root");
    const rootEl = document.createElement("div");
    rootEl.id = "asx-impress-root";
    rootEl.className = "impress-root";
    if (prev) prev.replaceWith(rootEl);
    else stageEl.appendChild(rootEl);

    slides.forEach((s, i) => {
      const step = document.createElement("div");
      step.className = "step slide";
      step.id = s.id || `step-${i}`;
      step.dataset.x = String(s.x ?? i * 1000);
      step.dataset.y = String(s.y ?? 0);
      step.dataset.z = String(s.z ?? 0);
      step.dataset.scale = String(s.scale ?? 1);
      if (s.rotate != null) step.dataset.rotate = String(s.rotate);
      if (s.rotateX != null) step.dataset.rotateX = String(s.rotateX);
      if (s.rotateY != null) step.dataset.rotateY = String(s.rotateY);
      step.innerHTML = sanitizeHtml(s.html || `<p>Slide ${i + 1}</p>`);
      rootEl.appendChild(step);
    });
    try {
      const impress = await loadImpressJs();
      api = impress("asx-impress-root");
      api.init();
      setStatus(`${slides.length} slides · Space / arrows`);
      persist();
    } catch (e) {
      setStatus(e?.message || "impress.js failed");
    }
  };

  wm.open({
    id: "impress",
    title: "Impress",
    w: 900,
    h: 620,
    body: root,
    onMount: async () => {
      await reinit();
      root.querySelector('[data-i="next"]').addEventListener("click", () => api?.next());
      root.querySelector('[data-i="prev"]').addEventListener("click", () => api?.prev());
      root.querySelector('[data-i="restart"]').addEventListener("click", () => {
        const first = root.querySelector(".impress-root .step");
        if (first && api?.goto) api.goto(first);
      });
      root.querySelector('[data-i="add"]').addEventListener("click", async () => {
        const n = slides.length;
        slides.push({
          id: `slide-${Date.now()}`,
          x: (n % 4) * 1000,
          y: Math.floor(n / 4) * 800,
          scale: 1,
          html: `<h2>Slide ${n + 1}</h2><p>Edit me…</p>`,
        });
        await reinit();
        setStatus(`Added slide ${n + 1}`);
      });
      root.querySelector('[data-i="edit"]').addEventListener("click", async () => {
        const active = root.querySelector(".impress-root .step.active");
        const id = active?.id;
        const idx = slides.findIndex((s, i) => (s.id || `step-${i}`) === id);
        const i = idx >= 0 ? idx : 0;
        const html = window.prompt("Slide HTML:", slides[i]?.html || "");
        if (html == null) return;
        slides[i].html = html;
        await reinit();
        if (api?.goto && slides[i]) {
          const el = root.querySelector(`#${CSS.escape(slides[i].id || `step-${i}`)}`);
          if (el) api.goto(el);
        }
      });
      root.querySelector('[data-i="save"]').addEventListener("click", async () => {
        const p =
          window.prompt("Save deck JSON path:", path) || path;
        path = p.startsWith("/") ? p.trim() : `/home/guest/${p.trim()}`;
        const body = JSON.stringify({ v: 1, engine: "impress.js", slides }, null, 2);
        const r = await writeFile(path, body);
        if (r.error) window.alert(r.message || r.error);
        else {
          persist();
          setStatus(`Saved ${path}`);
        }
      });
      root.querySelector('[data-i="export"]').addEventListener("click", () => {
        downloadBlob(
          new Blob([JSON.stringify({ v: 1, slides }, null, 2)], {
            type: "application/json",
          }),
          "asx-presentation.json"
        );
        setStatus("Downloaded asx-presentation.json");
      });
      // Keyboard when stage focused
      stage.tabIndex = 0;
      stage.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "ArrowRight" || e.key === "PageDown") {
          e.preventDefault();
          api?.next();
        } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
          e.preventDefault();
          api?.prev();
        }
      });
    },
  });
}

/* ── JsFile — browser file toolkit (read / preview / guest save) ─
 * https://cdnjs.com/libraries/jsfile
 * Engines for full office parse are pluggable; base lib + FileReader for guests.
 */
const JSFILE_VERSION = "0.1.17";
const JSFILE_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/jsfile/${JSFILE_VERSION}/jsfile.min.js`,
  `https://cdn.jsdelivr.net/npm/jsfile@${JSFILE_VERSION}/dist/jsfile.min.js`,
];

/** @type {Promise<object|null>|null} */
let jsFileLoadPromise = null;

function loadJsFileLib() {
  if (typeof window.JsFile !== "undefined") return Promise.resolve(window.JsFile);
  if (jsFileLoadPromise) return jsFileLoadPromise;
  jsFileLoadPromise = (async () => {
    let last;
    for (const src of JSFILE_SOURCES) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.crossOrigin = "anonymous";
          s.referrerPolicy = "no-referrer";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(src));
          document.head.appendChild(s);
        });
        if (typeof window.JsFile !== "undefined") return window.JsFile;
      } catch (e) {
        last = e;
      }
    }
    jsFileLoadPromise = null;
    throw last || new Error("JsFile failed to load");
  })();
  return jsFileLoadPromise;
}

function bytesToHex(buf, max = 256) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const n = Math.min(u8.length, max);
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(u8[i].toString(16).padStart(2, "0"));
    if ((i + 1) % 16 === 0) parts.push("\n");
    else parts.push(" ");
  }
  if (u8.length > max) parts.push(`\n… +${u8.length - max} bytes`);
  return parts.join("");
}

function openJsFile(wm, opts = {}) {
  const root = document.createElement("div");
  root.className = "jsfile-app";
  root.innerHTML = `
    <div class="jsfile-toolbar" role="toolbar">
      <span class="jsfile-brand">JsFile</span>
      <label class="sheet-btn sheet-file-label">Open local…
        <input type="file" class="jsfile-local" hidden />
      </label>
      <button type="button" class="sheet-btn" data-j="guest" title="Open from /home/guest">Guest FS…</button>
      <button type="button" class="sheet-btn primary" data-j="save" title="Save text to guest FS" disabled>Save text</button>
      <button type="button" class="sheet-btn" data-j="download" title="Download original" disabled>↓ Download</button>
      <span class="jsfile-status dim" data-j-status>Load a file to inspect</span>
    </div>
    <div class="jsfile-body">
      <aside class="jsfile-meta" data-j-meta>
        <p class="dim">Open a local file or guest path. JsFile ${JSFILE_VERSION} assists browser file IO; full office engines are optional plugins.</p>
      </aside>
      <div class="jsfile-preview-wrap">
        <div class="jsfile-tabs">
          <button type="button" class="settings-tab is-active" data-jtab="text">Text</button>
          <button type="button" class="settings-tab" data-jtab="hex">Hex</button>
        </div>
        <textarea class="jsfile-text" data-j-text spellcheck="false" placeholder="Text preview / editor…"></textarea>
        <pre class="jsfile-hex" data-j-hex hidden></pre>
      </div>
    </div>
    <p class="jsfile-foot dim">JsFile ${JSFILE_VERSION} · cdnjs · Programming / Utilities · guest BrowserFS save</p>`;

  const statusEl = root.querySelector("[data-j-status]");
  const metaEl = root.querySelector("[data-j-meta]");
  const textEl = root.querySelector("[data-j-text]");
  const hexEl = root.querySelector("[data-j-hex]");
  const localIn = root.querySelector(".jsfile-local");
  const saveBtn = root.querySelector('[data-j="save"]');
  const dlBtn = root.querySelector('[data-j="download"]');

  /** @type {{ name: string, type: string, size: number, buffer: ArrayBuffer|null, path: string }|null} */
  let current = null;
  let jsFileApi = null;

  const setStatus = (s) => {
    if (statusEl) statusEl.textContent = s || "";
  };

  const showMeta = (info, extra = "") => {
    setSafeHtml(
      metaEl,
      `<h3 class="about-h3">File</h3>
      <div class="about-dl">
        <div class="about-row"><span class="about-k">Name</span><span class="about-v">${escapeHtml(
          info.name
        )}</span></div>
        <div class="about-row"><span class="about-k">Type</span><span class="about-v">${escapeHtml(
          info.type || "—"
        )}</span></div>
        <div class="about-row"><span class="about-k">Size</span><span class="about-v">${escapeHtml(
          String(info.size)
        )} bytes</span></div>
        <div class="about-row"><span class="about-k">Path</span><span class="about-v">${escapeHtml(
          info.path || "(local only)"
        )}</span></div>
      </div>
      <p class="dim" style="font-size:10px;margin-top:10px">${escapeHtml(extra)}</p>`
    );
  };

  const loadBuffer = async (name, type, size, buffer, path = "") => {
    current = { name, type, size, buffer, path };
    saveBtn.disabled = false;
    dlBtn.disabled = false;
    showMeta(current, "JsFile loaded · text decode + hex preview");

    // Text decode attempt
    let text = "";
    try {
      text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      // strip NULs for display
      if (text.includes("\0")) {
        text = text.replace(/\0/g, "·");
      }
    } catch {
      text = "(binary — see Hex tab)";
    }
    textEl.value = text;
    hexEl.textContent = bytesToHex(buffer);

    // Try JsFile engine path if any engines registered
    let engineNote = "No office engines registered (base toolkit).";
    try {
      if (jsFileApi) {
        const blob = new Blob([buffer], { type: type || "application/octet-stream" });
        const file =
          typeof File !== "undefined"
            ? new File([blob], name, { type: type || "application/octet-stream" })
            : blob;
        const inst = new jsFileApi(file, {
          workerPath: `https://cdnjs.cloudflare.com/ajax/libs/jsfile/${JSFILE_VERSION}/workers/`,
        });
        const Engine = typeof inst.findEngine === "function" ? inst.findEngine() : null;
        if (Engine) {
          engineNote = `Engine matched: ${Engine.name || "custom"}`;
          try {
            if (typeof inst.read === "function") {
              const doc = await new Promise((resolve, reject) => {
                const p = inst.read();
                if (p && typeof p.then === "function") p.then(resolve, reject);
                else resolve(p);
              });
              if (doc) engineNote += " · document read OK";
            }
          } catch (e) {
            engineNote += ` · read: ${e?.message || e}`;
          }
        }
      }
    } catch (e) {
      engineNote = e?.message || String(e);
    }
    showMeta(current, engineNote);
    setStatus(`${name} · ${size} B`);
  };

  const openLocalFile = async (file) => {
    if (!file) return;
    setStatus("Reading…");
    const buffer = await file.arrayBuffer();
    await loadBuffer(file.name, file.type, file.size, buffer, "");
  };

  wm.open({
    id: "jsfile",
    title: "JsFile",
    w: 820,
    h: 560,
    body: root,
    onMount: async () => {
      try {
        jsFileApi = await loadJsFileLib();
        setStatus(`JsFile ${JSFILE_VERSION} ready · open a file`);
      } catch (e) {
        setStatus(e?.message || "JsFile CDN failed — FileReader still works");
      }

      root.querySelectorAll("[data-jtab]").forEach((tab) => {
        tab.addEventListener("click", () => {
          root.querySelectorAll("[data-jtab]").forEach((t) => t.classList.remove("is-active"));
          tab.classList.add("is-active");
          const id = tab.getAttribute("data-jtab");
          textEl.hidden = id !== "text";
          hexEl.hidden = id !== "hex";
        });
      });

      localIn.addEventListener("change", () => {
        const f = localIn.files?.[0];
        if (f) openLocalFile(f);
        localIn.value = "";
      });

      root.querySelector('[data-j="guest"]').addEventListener("click", async () => {
        const p = window.prompt(
          "Guest path to open:",
          "/home/guest/Documents/notes.txt"
        );
        if (!p) return;
        const path = p.startsWith("/") ? p.trim() : `/home/guest/${p.trim()}`;
        const r = await readFileAsync(path);
        if (r.error) {
          window.alert(r.message || r.error);
          return;
        }
        const enc = new TextEncoder().encode(r.content || "");
        await loadBuffer(
          path.split("/").pop() || "file",
          "text/plain",
          enc.byteLength,
          enc.buffer,
          path
        );
      });

      saveBtn.addEventListener("click", async () => {
        if (!current) return;
        const def =
          current.path ||
          `/home/guest/Documents/${current.name || "file.txt"}`;
        const p = window.prompt("Save text as guest path:", def);
        if (!p) return;
        const path = p.startsWith("/") ? p.trim() : `/home/guest/${p.trim()}`;
        const r = await writeFile(path, textEl.value);
        if (r.error) window.alert(r.message || r.error);
        else {
          current.path = path;
          showMeta(current, "Saved text to BrowserFS");
          setStatus(`Saved ${path}`);
        }
      });

      dlBtn.addEventListener("click", () => {
        if (!current?.buffer) return;
        downloadBlob(
          new Blob([current.buffer], {
            type: current.type || "application/octet-stream",
          }),
          current.name || "download.bin"
        );
      });

      if (opts.file) openLocalFile(opts.file);
    },
  });
}

function openMindmap(wm) {
  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `
    <h2>Mind Map</h2>
    <p style="color:var(--muted);font-size:12px;margin-bottom:8px">
      Idea map (not a todo list — use <strong>Todo</strong> for checklists). Node list v1; markmap/force-graph via CDN next.
    </p>
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

/* ── Image Viewer (BigPicture + browser-image-compression via cdnjs)
 * https://cdnjs.com/libraries/bigpicture
 * https://cdnjs.com/libraries/browser-image-compression
 * Compress large local images client-side (never uploaded) for lighter tiles/lightbox.
 * Load only when this app opens.
 */
const BIGPICTURE_VERSION = "2.6.4";
const BIGPICTURE_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/bigpicture/${BIGPICTURE_VERSION}/BigPicture.min.js`,
  `https://cdn.jsdelivr.net/npm/bigpicture@${BIGPICTURE_VERSION}/dist/BigPicture.min.js`,
];

const IMAGE_COMPRESSION_VERSION = "2.0.2";
const IMAGE_COMPRESSION_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/browser-image-compression/${IMAGE_COMPRESSION_VERSION}/browser-image-compression.min.js`,
  `https://cdn.jsdelivr.net/npm/browser-image-compression@${IMAGE_COMPRESSION_VERSION}/dist/browser-image-compression.js`,
];

/** Compress when file is at least this large (bytes). */
const IMG_COMPRESS_MIN_BYTES = 400 * 1024; // 400 KB
/** Skip files larger than this without trying (pathological). */
const IMG_COMPRESS_MAX_INPUT = 80 * 1024 * 1024;

/** @type {Promise<Function>|null} */
let bigPictureLoadPromise = null;
/** @type {Promise<Function|null>|null} */
let imageCompressionLoadPromise = null;

function loadScriptGlobal(src, check) {
  return new Promise((resolve, reject) => {
    const existing = check();
    if (existing) {
      resolve(existing);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => {
      const g = check();
      if (g) resolve(g);
      else reject(new Error("Global missing after load: " + src));
    };
    s.onerror = () => reject(new Error("Script failed: " + src));
    document.head.appendChild(s);
  });
}

function loadBigPicture() {
  if (bigPictureLoadPromise) return bigPictureLoadPromise;
  bigPictureLoadPromise = (async () => {
    let lastErr;
    for (const src of BIGPICTURE_SOURCES) {
      try {
        return await loadScriptGlobal(
          src,
          () => (typeof window.BigPicture === "function" ? window.BigPicture : null)
        );
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Failed to load BigPicture from public CDNs");
  })();
  return bigPictureLoadPromise;
}

/**
 * browser-image-compression UMD → window.imageCompression
 * Soft-fail: viewer still works without it.
 */
function loadImageCompression() {
  if (imageCompressionLoadPromise) return imageCompressionLoadPromise;
  imageCompressionLoadPromise = (async () => {
    if (typeof window.imageCompression === "function") {
      return window.imageCompression;
    }
    for (const src of IMAGE_COMPRESSION_SOURCES) {
      try {
        return await loadScriptGlobal(
          src,
          () =>
            typeof window.imageCompression === "function"
              ? window.imageCompression
              : null
        );
      } catch {
        /* try next CDN */
      }
    }
    return null;
  })();
  return imageCompressionLoadPromise;
}

function formatBytes(n) {
  const x = Number(n) || 0;
  if (x < 1024) return `${x} B`;
  if (x < 1024 * 1024) return `${(x / 1024).toFixed(1)} KB`;
  return `${(x / (1024 * 1024)).toFixed(2)} MB`;
}

function canCompressImageFile(file) {
  if (!file) return false;
  const t = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  // GIF animation + SVG vectors: leave alone
  if (t === "image/gif" || t === "image/svg+xml") return false;
  if (/\.gif$/i.test(name) || /\.svg$/i.test(name)) return false;
  if (t.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|bmp|avif)$/i.test(name);
}

function openImage(wm, opts = {}) {
  const root = document.createElement("div");
  root.className = "img-viewer";
  root.innerHTML = `
    <div class="img-toolbar" role="toolbar" aria-label="Image Viewer">
      <label class="img-open">
        <span class="img-open-label">Open</span>
        <input type="file" accept="image/*" class="img-file" multiple aria-label="Open image files" />
      </label>
      <button type="button" class="img-btn" data-act="clear" title="Clear gallery" disabled>Clear</button>
      <label class="img-compress-toggle" title="Compress large images in-browser for lighter display (never uploaded)">
        <input type="checkbox" class="img-compress-cb" checked />
        <span>Compress large</span>
      </label>
      <span class="img-status dim" aria-live="polite">Loading…</span>
    </div>
    <div class="img-stage">
      <div class="img-empty dim">
        Open or drop images (JPG/PNG/WebP/GIF · local only · never uploaded).<br/>
        Large files are compressed in-browser for smoother viewing · click for lightbox.
      </div>
      <div class="img-gallery" hidden role="list"></div>
    </div>
    <p class="img-foot dim">BigPicture ${BIGPICTURE_VERSION} · browser-image-compression ${IMAGE_COMPRESSION_VERSION} · cdnjs → jsDelivr</p>`;

  const status = root.querySelector(".img-status");
  const gallery = root.querySelector(".img-gallery");
  const empty = root.querySelector(".img-empty");
  const stage = root.querySelector(".img-stage");
  const fileIn = root.querySelector(".img-file");
  const clearBtn = root.querySelector('[data-act="clear"]');
  const compressCb = root.querySelector(".img-compress-cb");

  /** @type {string[]} */
  let objectUrls = [];
  /** @type {Function|null} */
  let BigPictureFn = null;
  /** @type {Function|null} */
  let imageCompressionFn = null;
  let addGen = 0;

  const setStatus = (msg) => {
    if (status) status.textContent = msg || "";
  };

  const wantCompress = () => !!compressCb?.checked;

  const revokeAll = () => {
    objectUrls.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* ignore */
      }
    });
    objectUrls = [];
  };

  const trackUrl = (url) => {
    if (url && url.startsWith("blob:")) objectUrls.push(url);
    return url;
  };

  /**
   * @returns {Promise<{ file: File|Blob, url: string, originalBytes: number, displayBytes: number, compressed: boolean, note: string }>}
   */
  async function prepareDisplayFile(file) {
    const originalBytes = file.size || 0;
    const name = file.name || "image";
    const skip =
      !wantCompress() ||
      !imageCompressionFn ||
      !canCompressImageFile(file) ||
      originalBytes < IMG_COMPRESS_MIN_BYTES ||
      originalBytes > IMG_COMPRESS_MAX_INPUT;

    if (skip) {
      const url = trackUrl(URL.createObjectURL(file));
      return {
        file,
        url,
        originalBytes,
        displayBytes: originalBytes,
        compressed: false,
        note:
          originalBytes < IMG_COMPRESS_MIN_BYTES
            ? "small · as-is"
            : !imageCompressionFn
              ? "as-is"
              : !canCompressImageFile(file)
                ? "format kept"
                : "as-is",
      };
    }

    try {
      setStatus(`Compressing ${name}…`);
      const out = await imageCompressionFn(file, {
        maxSizeMB: 1.25,
        maxWidthOrHeight: 2560,
        useWebWorker: true,
        // Prefer jpeg for huge png screenshots when much smaller
        initialQuality: 0.85,
        alwaysKeepResolution: false,
      });
      const displayBytes = out.size || 0;
      // Only use compressed if we actually saved meaningful bytes
      if (displayBytes > 0 && displayBytes < originalBytes * 0.95) {
        const url = trackUrl(URL.createObjectURL(out));
        const saved = Math.round((1 - displayBytes / originalBytes) * 100);
        return {
          file: out,
          url,
          originalBytes,
          displayBytes,
          compressed: true,
          note: `−${saved}% · ${formatBytes(originalBytes)} → ${formatBytes(displayBytes)}`,
        };
      }
    } catch (e) {
      // fall through to original
      console.warn("[asx-image] compress failed", e);
    }
    const url = trackUrl(URL.createObjectURL(file));
    return {
      file,
      url,
      originalBytes,
      displayBytes: originalBytes,
      compressed: false,
      note: "compress skipped · original",
    };
  }

  const openLightbox = (el, position) => {
    if (!BigPictureFn || !el) return;
    const items = Array.from(gallery.querySelectorAll(".img-tile"));
    const galleryData = items
      .map((tile) => ({
        src: tile.getAttribute("data-bp") || tile.querySelector("img")?.src || "",
        caption:
          tile.getAttribute("data-caption") || tile.querySelector("img")?.alt || "",
      }))
      .filter((g) => g.src);
    if (!galleryData.length) {
      setStatus("No image source");
      return;
    }
    const pos = Math.max(0, Math.min(position ?? 0, galleryData.length - 1));
    try {
      BigPictureFn({
        el,
        imgSrc: galleryData[pos].src,
        gallery: galleryData.length > 1 ? galleryData : undefined,
        position: galleryData.length > 1 ? pos : undefined,
        loop: galleryData.length > 1,
        animationStart() {
          setStatus(galleryData[pos].caption || "Viewing…");
        },
        onChangeImage(props) {
          try {
            const i = props?.index ?? props?.position;
            if (typeof i === "number" && galleryData[i]) {
              setStatus(galleryData[i].caption || `Image ${i + 1}`);
            } else if (props?.el?.caption) {
              setStatus(props.el.caption);
            }
          } catch {
            /* ignore */
          }
        },
        onClose() {
          const n = gallery.querySelectorAll(".img-tile").length;
          setStatus(
            n
              ? `${n} image(s) · click to enlarge · large files compressed locally`
              : "Open or drop images"
          );
        },
        onError() {
          setStatus("Could not display that image");
        },
      });
    } catch (e) {
      setStatus(e?.message || "BigPicture open failed");
    }
  };

  const refreshGalleryUi = (statusOverride) => {
    const tiles = gallery.querySelectorAll(".img-tile");
    if (!tiles.length) {
      gallery.hidden = true;
      empty.hidden = false;
      clearBtn.disabled = true;
      setStatus(statusOverride || "Open or drop images");
      return;
    }
    empty.hidden = true;
    gallery.hidden = false;
    clearBtn.disabled = false;
    const compressedN = gallery.querySelectorAll(".img-tile[data-compressed='1']").length;
    setStatus(
      statusOverride ||
        `${tiles.length} image(s)` +
          (compressedN ? ` · ${compressedN} compressed` : "") +
          " · click to enlarge"
    );
  };

  const appendTile = ({ url, name, note, compressed, originalBytes, displayBytes }) => {
    const caption = note ? `${name} · ${note}` : name;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "img-tile" + (compressed ? " img-tile-compressed" : "");
    btn.setAttribute("role", "listitem");
    btn.setAttribute("data-caption", caption);
    btn.setAttribute("data-bp", url);
    btn.setAttribute("data-compressed", compressed ? "1" : "0");
    btn.setAttribute("data-orig-bytes", String(originalBytes));
    btn.setAttribute("data-disp-bytes", String(displayBytes));
    btn.title = compressed
      ? `${name}\nCompressed for display (${note})\nLocal only — never uploaded`
      : `${name}\n${formatBytes(originalBytes)}`;
    const img = document.createElement("img");
    img.src = url;
    img.alt = name;
    img.loading = "lazy";
    img.draggable = false;
    img.setAttribute("data-bp", url);
    img.setAttribute("data-caption", caption);
    const cap = document.createElement("span");
    cap.className = "img-tile-cap";
    setSafeHtml(
      cap,
      compressed
        ? `${escapeHtml(name)} <em class="img-badge">cmp</em>`
        : escapeHtml(name),
      ASX_TEXT_PURIFY
    );
    btn.appendChild(img);
    btn.appendChild(cap);
    const pos = gallery.querySelectorAll(".img-tile").length;
    btn.addEventListener("click", () => openLightbox(btn, pos));
    gallery.appendChild(btn);
  };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(
      (f) =>
        f &&
        (/^image\//i.test(f.type) ||
          /\.(jpe?g|png|gif|webp|bmp|svg|avif)$/i.test(f.name))
    );
    if (!files.length) {
      setStatus("No image files selected");
      return;
    }
    const gen = ++addGen;
    let i = 0;
    for (const f of files) {
      if (gen !== addGen) return; // cleared mid-batch
      i += 1;
      setStatus(`Preparing ${i}/${files.length}: ${f.name || "image"}…`);
      try {
        const prep = await prepareDisplayFile(f);
        if (gen !== addGen) return;
        appendTile({
          url: prep.url,
          name: f.name || "image",
          note: prep.note,
          compressed: prep.compressed,
          originalBytes: prep.originalBytes,
          displayBytes: prep.displayBytes,
        });
        refreshGalleryUi(
          `Added ${i}/${files.length}` +
            (prep.compressed ? ` · ${prep.note}` : "")
        );
      } catch (e) {
        setStatus(e?.message || `Failed: ${f.name}`);
      }
    }
    if (gen === addGen) refreshGalleryUi();
  };

  const clearGallery = () => {
    addGen += 1;
    gallery.innerHTML = "";
    revokeAll();
    fileIn.value = "";
    refreshGalleryUi();
  };

  fileIn.addEventListener("change", () => {
    if (fileIn.files?.length) addFiles(fileIn.files);
  });
  clearBtn.addEventListener("click", clearGallery);

  stage.addEventListener("dragover", (e) => {
    e.preventDefault();
    stage.classList.add("img-drop");
  });
  stage.addEventListener("dragleave", () => stage.classList.remove("img-drop"));
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    stage.classList.remove("img-drop");
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  wm.open({
    id: opts.id || "image",
    title: opts.title || "Image Viewer",
    w: 780,
    h: 620,
    body: root,
    onMount: async () => {
      try {
        const [bp, ic] = await Promise.all([
          loadBigPicture(),
          loadImageCompression(),
        ]);
        BigPictureFn = bp;
        imageCompressionFn = ic;
        setStatus(
          ic
            ? "Open or drop images · large files auto-compress locally"
            : "Open or drop images · compression CDN unavailable (originals only)"
        );
        if (!ic && compressCb) {
          compressCb.checked = false;
          compressCb.disabled = true;
          compressCb.parentElement?.setAttribute(
            "title",
            "browser-image-compression failed to load from CDN"
          );
        }
        if (opts.file) await addFiles([opts.file]);
        else if (opts.files) await addFiles(opts.files);
        else if (opts.url) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "img-tile";
          btn.setAttribute("data-caption", opts.name || "image");
          btn.setAttribute("data-bp", opts.url);
          const img = document.createElement("img");
          img.src = opts.url;
          img.alt = opts.name || "image";
          img.setAttribute("data-bp", opts.url);
          const cap = document.createElement("span");
          cap.className = "img-tile-cap";
          cap.textContent = opts.name || "image";
          btn.appendChild(img);
          btn.appendChild(cap);
          btn.addEventListener("click", () => openLightbox(btn, 0));
          gallery.appendChild(btn);
          refreshGalleryUi();
          openLightbox(btn, 0);
        }
      } catch (e) {
        setStatus(e?.message || "Image libraries failed to load from CDN");
        empty.innerHTML =
          "Could not load BigPicture / compression libs from cdnjs/jsDelivr.";
      }
    },
    onClose: () => {
      addGen += 1;
      revokeAll();
    },
  });
}

/* ── PDF Reader (Mozilla pdf.js via cdnjs — never our origin) ─
 * https://cdnjs.com/libraries/pdf.js
 * Load only when this app opens (not on desktop boot).
 */
const PDFJS_VERSION = "6.2.108";
const PDFJS_SOURCES = [
  {
    lib: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`,
    worker: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`,
  },
  {
    lib: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`,
    worker: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
  },
];

/** @type {Promise<object>|null} */
let pdfjsLoadPromise = null;

function loadPdfJs() {
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = (async () => {
    let lastErr;
    for (const src of PDFJS_SOURCES) {
      try {
        const mod = await import(/* @vite-ignore */ src.lib);
        const pdfjs = mod.default || mod;
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = src.worker;
        }
        if (typeof pdfjs.getDocument !== "function") {
          throw new Error("pdf.js module missing getDocument");
        }
        return pdfjs;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Failed to load pdf.js from public CDNs");
  })();
  return pdfjsLoadPromise;
}

function openPdf(wm, opts = {}) {
  const root = document.createElement("div");
  root.className = "pdf-reader";
  root.innerHTML = `
    <div class="pdf-toolbar" role="toolbar" aria-label="PDF Reader">
      <label class="pdf-open">
        <span class="pdf-open-label">Open</span>
        <input type="file" accept="application/pdf,.pdf" class="pdf-file" aria-label="Open PDF file" />
      </label>
      <button type="button" class="pdf-btn" data-act="prev" title="Previous page" aria-label="Previous page">◀</button>
      <span class="pdf-page-wrap">
        <input type="number" class="pdf-page-num" min="1" value="1" aria-label="Page number" />
        <span class="pdf-page-of">/ <span class="pdf-page-count">0</span></span>
      </span>
      <button type="button" class="pdf-btn" data-act="next" title="Next page" aria-label="Next page">▶</button>
      <span class="pdf-sep" aria-hidden="true"></span>
      <button type="button" class="pdf-btn" data-act="zoom-out" title="Zoom out" aria-label="Zoom out">−</button>
      <span class="pdf-zoom-label">100%</span>
      <button type="button" class="pdf-btn" data-act="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
      <button type="button" class="pdf-btn" data-act="fit" title="Fit width" aria-label="Fit width">Fit</button>
      <span class="pdf-status dim" aria-live="polite">Loading pdf.js…</span>
    </div>
    <div class="pdf-viewport">
      <canvas class="pdf-canvas"></canvas>
    </div>
    <p class="pdf-foot dim">PDF.js ${PDFJS_VERSION} · cdnjs → jsDelivr · local files only (never uploaded)</p>`;

  const status = root.querySelector(".pdf-status");
  const canvas = root.querySelector(".pdf-canvas");
  const pageNumIn = root.querySelector(".pdf-page-num");
  const pageCountEl = root.querySelector(".pdf-page-count");
  const zoomLabel = root.querySelector(".pdf-zoom-label");
  const fileIn = root.querySelector(".pdf-file");
  const viewport = root.querySelector(".pdf-viewport");

  let pdfDoc = null;
  let pageNum = 1;
  let scale = 1.1;
  let fitWidth = false;
  let renderTask = null;
  let objectUrl = null;

  const setStatus = (msg) => {
    if (status) status.textContent = msg || "";
  };

  const updateChrome = () => {
    const n = pdfDoc ? pdfDoc.numPages : 0;
    pageCountEl.textContent = String(n);
    pageNumIn.value = String(pageNum);
    pageNumIn.max = String(Math.max(1, n));
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    root.querySelector('[data-act="prev"]').disabled = !pdfDoc || pageNum <= 1;
    root.querySelector('[data-act="next"]').disabled =
      !pdfDoc || pageNum >= n;
  };

  const renderPage = async (num) => {
    if (!pdfDoc) return;
    pageNum = Math.max(1, Math.min(num, pdfDoc.numPages));
    try {
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* ignore */
        }
        renderTask = null;
      }
      const page = await pdfDoc.getPage(pageNum);
      let viewportPdf = page.getViewport({ scale: 1 });
      if (fitWidth && viewport.clientWidth > 40) {
        const pad = 24;
        scale = Math.max(0.25, (viewport.clientWidth - pad) / viewportPdf.width);
      }
      viewportPdf = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewportPdf.width * dpr);
      canvas.height = Math.floor(viewportPdf.height * dpr);
      canvas.style.width = `${Math.floor(viewportPdf.width)}px`;
      canvas.style.height = `${Math.floor(viewportPdf.height)}px`;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, viewportPdf.width, viewportPdf.height);
      renderTask = page.render({ canvasContext: ctx, viewport: viewportPdf });
      await renderTask.promise;
      renderTask = null;
      setStatus(pdfDoc._asxName || "PDF");
      updateChrome();
    } catch (e) {
      if (e?.name === "RenderingCancelledException") return;
      setStatus(e?.message || "Render failed");
    }
  };

  const openBytes = async (data, name) => {
    setStatus("Opening…");
    const pdfjs = await loadPdfJs();
    if (pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch {
        /* ignore */
      }
      pdfDoc = null;
    }
    const loading = pdfjs.getDocument({ data });
    pdfDoc = await loading.promise;
    pdfDoc._asxName = name || "document.pdf";
    pageNum = 1;
    fitWidth = true;
    await renderPage(1);
  };

  const openFile = async (file) => {
    if (!file) return;
    try {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      const buf = await file.arrayBuffer();
      await openBytes(new Uint8Array(buf), file.name);
    } catch (e) {
      setStatus(e?.message || "Could not open PDF");
      canvas.width = 0;
      canvas.height = 0;
    }
  };

  fileIn.addEventListener("change", () => {
    const f = fileIn.files?.[0];
    if (f) openFile(f);
  });

  root.querySelector('[data-act="prev"]').addEventListener("click", () => {
    if (pageNum > 1) renderPage(pageNum - 1);
  });
  root.querySelector('[data-act="next"]').addEventListener("click", () => {
    if (pdfDoc && pageNum < pdfDoc.numPages) renderPage(pageNum + 1);
  });
  pageNumIn.addEventListener("change", () => {
    const n = parseInt(pageNumIn.value, 10);
    if (pdfDoc && n >= 1 && n <= pdfDoc.numPages) renderPage(n);
    else updateChrome();
  });
  root.querySelector('[data-act="zoom-in"]').addEventListener("click", () => {
    fitWidth = false;
    scale = Math.min(4, scale + 0.15);
    renderPage(pageNum);
  });
  root.querySelector('[data-act="zoom-out"]').addEventListener("click", () => {
    fitWidth = false;
    scale = Math.max(0.25, scale - 0.15);
    renderPage(pageNum);
  });
  root.querySelector('[data-act="fit"]').addEventListener("click", () => {
    fitWidth = true;
    renderPage(pageNum);
  });

  // Drag-and-drop PDFs onto the viewport
  viewport.addEventListener("dragover", (e) => {
    e.preventDefault();
    viewport.classList.add("pdf-drop");
  });
  viewport.addEventListener("dragleave", () => viewport.classList.remove("pdf-drop"));
  viewport.addEventListener("drop", (e) => {
    e.preventDefault();
    viewport.classList.remove("pdf-drop");
    const f = e.dataTransfer?.files?.[0];
    if (f && (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name))) openFile(f);
    else setStatus("Drop a .pdf file");
  });

  wm.open({
    id: opts.id || "pdf",
    title: opts.title || "PDF Reader",
    w: 760,
    h: 600,
    body: root,
    onMount: async () => {
      try {
        await loadPdfJs();
        setStatus("Open a PDF (local file · never uploaded)");
        updateChrome();
        if (opts.file) await openFile(opts.file);
        else if (opts.url) {
          // Same-origin or CORS-enabled URL only
          setStatus("Fetching…");
          const res = await fetch(opts.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = new Uint8Array(await res.arrayBuffer());
          await openBytes(buf, opts.name || "remote.pdf");
        }
      } catch (e) {
        setStatus(e?.message || "pdf.js failed to load from CDN");
      }
    },
    onClose: () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (pdfDoc) {
        try {
          pdfDoc.destroy();
        } catch {
          /* ignore */
        }
      }
    },
  });
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

/* ── Monaco Editor (VS Code engine via cdnjs — Programming folder) ─
 * https://cdnjs.com/libraries/monaco-editor
 * https://microsoft.github.io/monaco-editor/
 * Lazy-loaded only when this app opens (large vendor payload).
 *
 * Sole code-editor app — do NOT also ship CodeMirror/Ace as Applications icons.
 * (See docs/free_apps_and_construct.md § “One app per job”.)
 */
const MONACO_VERSION = "0.55.0";
const MONACO_CDN_BASES = [
  `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${MONACO_VERSION}/min`,
  `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`,
];

/** @type {Promise<object>|null} */
let monacoLoadPromise = null;

function loadMonacoEditor() {
  if (typeof window.monaco !== "undefined" && window.monaco?.editor) {
    return Promise.resolve(window.monaco);
  }
  if (monacoLoadPromise) return monacoLoadPromise;
  monacoLoadPromise = (async () => {
    let lastErr;
    for (const base of MONACO_CDN_BASES) {
      try {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector("script[data-asx-monaco-loader]");
          if (existing && typeof window.require === "function") {
            resolve();
            return;
          }
          const s = document.createElement("script");
          s.src = `${base}/vs/loader.js`;
          s.async = true;
          s.crossOrigin = "anonymous";
          s.dataset.asxMonacoLoader = "1";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Monaco loader failed: " + base));
          document.head.appendChild(s);
        });
        const req = window.require;
        if (typeof req !== "function") throw new Error("AMD require missing");
        req.config({
          paths: { vs: `${base}/vs` },
        });
        await new Promise((resolve, reject) => {
          try {
            req(["vs/editor/editor.main"], () => resolve(), (err) =>
              reject(err || new Error("editor.main failed"))
            );
          } catch (e) {
            reject(e);
          }
        });
        if (!window.monaco?.editor) throw new Error("monaco global missing");
        return window.monaco;
      } catch (e) {
        lastErr = e;
        document.querySelector("script[data-asx-monaco-loader]")?.remove();
      }
    }
    monacoLoadPromise = null;
    throw lastErr || new Error("Monaco Editor failed to load from CDNs");
  })();
  return monacoLoadPromise;
}

const MONACO_LANGS = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "python", label: "Python" },
  { id: "markdown", label: "Markdown" },
  { id: "shell", label: "Shell" },
  { id: "sql", label: "SQL" },
  { id: "xml", label: "XML" },
  { id: "plaintext", label: "Plain text" },
];

const MONACO_LS = "asx-monaco-session-v1";
const MONACO_DEFAULT = `// Monaco Editor on Alison Scorpion's desktop
// Free guest app · code stays in this browser (BrowserFS / localStorage)
// https://microsoft.github.io/monaco-editor/

function greet(name) {
  return \`Hello, \${name} — from ASX Desktop\`;
}

console.log(greet("guest"));
`;

function openMonaco(wm, opts = {}) {
  const root = document.createElement("div");
  root.className = "monaco-app";
  root.innerHTML = `
    <div class="monaco-toolbar" role="toolbar" aria-label="Monaco">
      <span class="monaco-brand" title="VS Code editor engine">Monaco</span>
      <label class="monaco-lbl">Lang
        <select class="monaco-lang" aria-label="Language"></select>
      </label>
      <label class="monaco-lbl">Theme
        <select class="monaco-theme" aria-label="Theme">
          <option value="vs-dark">Dark</option>
          <option value="vs">Light</option>
          <option value="hc-black">High contrast</option>
        </select>
      </label>
      <button type="button" class="sheet-btn" data-m="new" title="New buffer">New</button>
      <button type="button" class="sheet-btn" data-m="open" title="Open from guest FS">Open…</button>
      <button type="button" class="sheet-btn primary" data-m="save" title="Save to guest FS + local">Save</button>
      <button type="button" class="sheet-btn" data-m="save-as" title="Save as path under /home/guest">Save as…</button>
      <input type="text" class="monaco-path" spellcheck="false" placeholder="/home/guest/Documents/main.js" aria-label="File path" />
      <span class="monaco-status dim" data-m-status>Loading Monaco…</span>
    </div>
    <div class="monaco-host" data-monaco-host></div>
    <p class="monaco-foot dim">Monaco Editor ${MONACO_VERSION} · cdnjs → jsDelivr · Programming folder · guest paths via BrowserFS</p>`;

  const langSel = root.querySelector(".monaco-lang");
  const themeSel = root.querySelector(".monaco-theme");
  const pathIn = root.querySelector(".monaco-path");
  const statusEl = root.querySelector("[data-m-status]");
  const host = root.querySelector("[data-monaco-host]");
  MONACO_LANGS.forEach((l) => {
    const o = document.createElement("option");
    o.value = l.id;
    o.textContent = l.label;
    langSel.appendChild(o);
  });

  let editor = null;
  let monacoApi = null;
  let currentPath = opts.path || "/home/guest/Documents/main.js";
  pathIn.value = currentPath;

  const setStatus = (s) => {
    if (statusEl) statusEl.textContent = s || "";
  };

  const persistLocal = () => {
    try {
      localStorage.setItem(
        MONACO_LS,
        JSON.stringify({
          path: currentPath,
          language: langSel.value,
          theme: themeSel.value,
          value: editor?.getValue?.() ?? "",
          t: Date.now(),
        })
      );
    } catch {
      /* quota */
    }
  };

  const loadLocal = () => {
    try {
      const o = JSON.parse(localStorage.getItem(MONACO_LS) || "null");
      return o && typeof o === "object" ? o : null;
    } catch {
      return null;
    }
  };

  const layout = () => {
    try {
      editor?.layout?.();
    } catch {
      /* ignore */
    }
  };

  wm.open({
    id: opts.id || "monaco",
    title: opts.title || "Monaco",
    w: 900,
    h: 600,
    body: root,
    onMount: async () => {
      setStatus("Loading Monaco Editor from CDN…");
      try {
        monacoApi = await loadMonacoEditor();
        const saved = loadLocal();
        let initial = opts.value ?? saved?.value ?? MONACO_DEFAULT;
        let lang = opts.language || saved?.language || "javascript";
        let theme = opts.theme || saved?.theme || "vs-dark";
        if (opts.path) currentPath = opts.path;
        else if (saved?.path) currentPath = saved.path;
        pathIn.value = currentPath;
        langSel.value = lang;
        themeSel.value = theme;

        // If path exists in BrowserFS, prefer that over local cache
        if (canWrite(currentPath)) {
          const fr = await readFileAsync(currentPath);
          if (!fr.error && fr.content != null && !opts.value) {
            initial = fr.content;
            setStatus(`Opened ${currentPath}`);
          }
        }

        editor = monacoApi.editor.create(host, {
          value: initial,
          language: lang,
          theme,
          automaticLayout: true,
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          renderWhitespace: "selection",
          padding: { top: 8 },
        });

        setStatus(`Ready · ${lang} · ${MONACO_VERSION}`);
        // Resize when window geometry changes
        const ro =
          typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(() => layout())
            : null;
        ro?.observe(host);
        root._asxMonacoRo = ro;

        langSel.addEventListener("change", () => {
          const model = editor.getModel();
          if (model) monacoApi.editor.setModelLanguage(model, langSel.value);
          persistLocal();
          setStatus(`Language: ${langSel.value}`);
        });
        themeSel.addEventListener("change", () => {
          monacoApi.editor.setTheme(themeSel.value);
          persistLocal();
        });
        editor.onDidChangeModelContent(() => persistLocal());

        root.querySelector('[data-m="new"]').addEventListener("click", () => {
          if (
            editor.getValue() &&
            !window.confirm("Replace buffer with a new empty file?")
          ) {
            return;
          }
          editor.setValue("");
          currentPath = "/home/guest/Documents/untitled.js";
          pathIn.value = currentPath;
          langSel.value = "javascript";
          monacoApi.editor.setModelLanguage(editor.getModel(), "javascript");
          persistLocal();
          setStatus("New buffer");
        });

        root.querySelector('[data-m="open"]').addEventListener("click", async () => {
          const p = window.prompt(
            "Open path under /home/guest (BrowserFS):",
            currentPath
          );
          if (!p) return;
          const path = p.startsWith("/") ? p.trim() : `/home/guest/${p.trim()}`;
          const r = await readFileAsync(path);
          if (r.error) {
            window.alert(r.message || r.error);
            return;
          }
          editor.setValue(r.content || "");
          currentPath = path;
          pathIn.value = path;
          // Guess language from extension
          const ext = (path.split(".").pop() || "").toLowerCase();
          const map = {
            js: "javascript",
            mjs: "javascript",
            cjs: "javascript",
            ts: "typescript",
            tsx: "typescript",
            jsx: "javascript",
            py: "python",
            md: "markdown",
            json: "json",
            css: "css",
            html: "html",
            htm: "html",
            sh: "shell",
            bash: "shell",
            sql: "sql",
            xml: "xml",
            txt: "plaintext",
          };
          const L = map[ext] || "plaintext";
          langSel.value = L;
          monacoApi.editor.setModelLanguage(editor.getModel(), L);
          persistLocal();
          setStatus(`Opened ${path}`);
        });

        const doSave = async (path) => {
          const r = await writeFile(path, editor.getValue());
          if (r.error) {
            setStatus(r.message || r.error);
            window.alert(r.message || "Save failed — use a path under /home/guest");
            return false;
          }
          currentPath = path;
          pathIn.value = path;
          persistLocal();
          setStatus(`Saved ${path} · ${new Date().toLocaleTimeString()}`);
          return true;
        };

        root.querySelector('[data-m="save"]').addEventListener("click", () => {
          const path = (pathIn.value || currentPath).trim();
          doSave(path);
        });
        root.querySelector('[data-m="save-as"]').addEventListener("click", () => {
          const p = window.prompt("Save as (guest path):", pathIn.value || currentPath);
          if (p) doSave(p.startsWith("/") ? p.trim() : `/home/guest/${p.trim()}`);
        });

        // Ctrl/Cmd+S
        editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyS, () => {
          doSave((pathIn.value || currentPath).trim());
        });
      } catch (e) {
        setStatus(e?.message || "Monaco failed to load");
        host.innerHTML = `<div class="app-pad"><p style="color:var(--fail)">Could not load Monaco Editor from CDN.</p>
          <p class="dim" style="font-size:12px">${escapeHtml(e?.message || String(e))}</p>
          <p class="dim" style="font-size:11px;margin-top:8px">Check network / cdnjs.cloudflare.com access.</p></div>`;
      }
    },
    onClose: () => {
      try {
        persistLocal();
        editor?.dispose?.();
      } catch {
        /* ignore */
      }
      root._asxMonacoRo?.disconnect?.();
      editor = null;
    },
  });
}

/**
 * Shared About panel: Alison's desktop + this guest's device (egjs-agent).
 */
async function fillAboutPanel(hostEl) {
  if (!hostEl) return;
  hostEl.innerHTML = `<p class="dim" style="font-size:12px">Reading device profile…</p>`;
  try {
    const profile = await getUserAboutProfile(getSessionUser());
    const rows = profileToRows(profile);
    const rowHtml = rows
      .map(
        ([k, v]) =>
          `<div class="about-row"><span class="about-k">${escapeHtml(
            k
          )}</span><span class="about-v">${escapeHtml(String(v ?? "—"))}</span></div>`
      )
      .join("");
    const uaShort = (profile.device.userAgent || "").slice(0, 160);
    setSafeHtml(
      hostEl,
      `
      <section class="about-host">
        <div class="about-brand">
          <span class="about-brand-mark" aria-hidden="true">◆</span>
          <div>
            <h2 class="about-title">Alison Scorpion Desktop</h2>
            <p class="about-sub">ASX OS · free guest apps · you are on <strong>her</strong> workstation</p>
          </div>
        </div>
        <p class="about-lead">
          This is <strong style="color:var(--brand)">Alison Scorpion</strong>'s desktop.
          Product surfaces: <strong>Containers</strong>, <strong>honeybee</strong>.
          Thin terminal glass · universe purple · Three.js Earth.
        </p>
      </section>
      <section class="about-you">
        <h3 class="about-h3">About you (this browser)</h3>
        <p class="dim about-note">Detected with egjs-agent ${escapeHtml(
          EGJS_AGENT_VERSION
        )} · stays on this device · not uploaded to ASX</p>
        <div class="about-dl" role="list">${rowHtml}</div>
        <details class="about-ua">
          <summary>User-Agent string</summary>
          <code class="about-ua-code">${escapeHtml(uaShort)}${
            (profile.device.userAgent || "").length > 160 ? "…" : ""
          }</code>
        </details>
      </section>
      <section class="about-policy dim">
        <p>Guest FS: BrowserFS under <code>/home/guest</code>. Admin paths: ACCESS DENIED.
        Browser policy: adult hosts blocked. DOM helper: JSLite (not jQuery).</p>
      </section>`
    );
  } catch (e) {
    hostEl.innerHTML = `<p class="dim" style="color:var(--fail)">Could not build About profile: ${escapeHtml(
      e?.message || String(e)
    )}</p>`;
  }
}

/* ── About ────────────────────────────────────────────────── */
function openAbout(wm) {
  const root = document.createElement("div");
  root.className = "app-pad about-app";
  root.innerHTML = `<div class="about-panel" id="about-panel"></div>`;
  wm.open({
    id: "about",
    title: "About",
    w: 520,
    h: 560,
    body: root,
    onMount: () => fillAboutPanel(root.querySelector(".about-panel")),
  });
}

/* ── Settings (theme + about you + desktop) ───────────────── */
function openSettings(wm) {
  const root = document.createElement("div");
  root.className = "app-pad settings-app";
  root.innerHTML = `
    <div class="settings-tabs" role="tablist" aria-label="Settings sections">
      <button type="button" class="settings-tab is-active" data-tab="prefs" role="tab" aria-selected="true">Preferences</button>
      <button type="button" class="settings-tab" data-tab="about" role="tab" aria-selected="false">About you</button>
      <button type="button" class="settings-tab" data-tab="desktop" role="tab" aria-selected="false">This desktop</button>
    </div>
    <div class="settings-panels">
      <section class="settings-panel is-active" data-panel="prefs">
        <h2>Preferences</h2>
        <p class="dim settings-lead">
          Default is <strong>thin terminal glass</strong> (Claude + PouyaOS-inspired, Earth shows through).
          The denser <strong>panel desktop</strong> look is kept as an optional theme.
        </p>
        <label class="settings-label">Theme
          <select id="asx-theme-select" class="settings-input">
            <option value="thin-terminal">Thin terminal glass (default)</option>
            <option value="panel-desktop">Panel desktop (solid purple)</option>
          </select>
        </label>
        <p id="asx-theme-hint" class="dim settings-hint"></p>
        <label class="settings-label">GDrive API key (public folder list)
          <input id="asx-gdrive-key" class="settings-input" type="password" autocomplete="off" spellcheck="false"
            placeholder="optional · Drive API only · stored in this browser" />
        </label>
        <p class="dim settings-hint">Live GDrive listing uses Drive API v3 + key (no OAuth for “Anyone with the link” folders).</p>
        <p class="dim settings-hint">Guest session · no host system access.</p>
      </section>
      <section class="settings-panel" data-panel="about" hidden>
        <div class="about-panel" id="settings-about-panel"></div>
      </section>
      <section class="settings-panel" data-panel="desktop" hidden>
        <h2>This desktop</h2>
        <p class="settings-lead">You are using <strong style="color:var(--brand)">Alison Scorpion</strong>'s free guest desktop — not a copy of her private machine.</p>
        <ul class="settings-list dim">
          <li><strong>Owner:</strong> Alison Scorpion (ASX) — administrator</li>
          <li><strong>You:</strong> guest · hop on free apps anytime (Office, Programming, Media, …)</li>
          <li><strong>Products:</strong> Containers, honeybee</li>
          <li><strong>Wallpaper:</strong> Three.js Earth / ambient (cdnjs)</li>
          <li><strong>Guest disk:</strong> BrowserFS → IndexedDB (<code>/home/guest</code>)</li>
          <li><strong>Deep links:</strong> <code>#app/quill</code>, <code>#app/monaco</code>, <code>#app/settings</code>, …</li>
          <li><strong>Later:</strong> Construct may open these tools and appear to use them — guests still use them for real today</li>
        </ul>
        <p class="dim settings-hint">Inventory + Construct hooks: <code>docs/free_apps_and_construct.md</code> · control: <code>ASX.desktop.control</code></p>
      </section>
    </div>
  `;
  wm.open({
    id: "settings",
    title: "Settings",
    w: 520,
    h: 560,
    body: root,
    onMount: async () => {
      const { getTheme, applyTheme, THEMES } = await import(
        "./themes.js?v=20260810t410000z"
      );
      const sel = root.querySelector("#asx-theme-select");
      const hint = root.querySelector("#asx-theme-hint");
      const keyIn = root.querySelector("#asx-gdrive-key");
      const cur = getTheme();
      if (sel) sel.value = cur;
      if (keyIn) keyIn.value = getGdriveApiKey();
      const setHint = (id) => {
        const t = THEMES.find((x) => x.id === id);
        if (hint) hint.textContent = t ? t.hint : "";
      };
      setHint(cur);
      sel?.addEventListener("change", () => {
        const id = applyTheme(sel.value);
        setHint(id);
      });
      keyIn?.addEventListener("change", () => setGdriveApiKey(keyIn.value));
      keyIn?.addEventListener("blur", () => setGdriveApiKey(keyIn.value));

      // Tabs
      const tabs = root.querySelectorAll(".settings-tab");
      const panels = root.querySelectorAll(".settings-panel");
      let aboutLoaded = false;
      tabs.forEach((tab) => {
        tab.addEventListener("click", async () => {
          const id = tab.getAttribute("data-tab");
          tabs.forEach((t) => {
            t.classList.toggle("is-active", t === tab);
            t.setAttribute("aria-selected", t === tab ? "true" : "false");
          });
          panels.forEach((p) => {
            const on = p.getAttribute("data-panel") === id;
            p.classList.toggle("is-active", on);
            p.hidden = !on;
          });
          if (id === "about" && !aboutLoaded) {
            aboutLoaded = true;
            await fillAboutPanel(root.querySelector("#settings-about-panel"));
          }
        });
      });
    },
  });
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


/* ── GitHub (public repo) ───────────────────────────────── */
const PUBLIC_GITHUB = "https://github.com/aliceinailand/alisonscorpionpublic";

function openGithub(wm) {
  openBrowser(wm, {
    id: "browser-github",
    title: "GitHub — alisonscorpionpublic",
    initialUrl: PUBLIC_GITHUB,
  });
}

/* ── Todo (checklist — not a mindmap) ───────────────────── */
function openTodo(wm) {
  const KEY = "asx-todo-v1";
  const root = document.createElement("div");
  root.className = "app-pad";
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }
  root.innerHTML = `
    <h2>Todo</h2>
    <p style="color:var(--muted);font-size:12px;margin-bottom:8px">
      Checklist for this browser. Download always works; account save ships with login.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <input class="todo-in" placeholder="New task…" style="flex:1;min-width:140px" />
      <button type="button" class="primary todo-add">Add</button>
      <button type="button" class="todo-dl">Download .txt</button>
    </div>
    <ul class="todo-list" style="list-style:none;padding:0;margin:0"></ul>`;
  const ul = root.querySelector(".todo-list");
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  };
  const paint = () => {
    ul.innerHTML = items
      .map(
        (it, i) => `
      <li style="display:flex;align-items:center;gap:8px;margin:6px 0;color:var(--text)">
        <input type="checkbox" data-i="${i}" ${it.done ? "checked" : ""} />
        <span style="${it.done ? "text-decoration:line-through;opacity:.6" : ""}">${escapeHtml(
          it.text
        )}</span>
        <button type="button" data-del="${i}" style="margin-left:auto;font-size:11px">✕</button>
      </li>`
      )
      .join("") || `<li style="color:var(--muted);font-size:12px">No tasks yet.</li>`;
    ul.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        items[+cb.dataset.i].done = cb.checked;
        persist();
        paint();
      });
    });
    ul.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        items.splice(+btn.dataset.del, 1);
        persist();
        paint();
      });
    });
  };
  paint();
  root.querySelector(".todo-add").addEventListener("click", () => {
    const v = root.querySelector(".todo-in").value.trim();
    if (!v) return;
    items.push({ text: v, done: false });
    root.querySelector(".todo-in").value = "";
    persist();
    paint();
  });
  root.querySelector(".todo-dl").addEventListener("click", () => {
    const body = items.map((it) => `${it.done ? "[x]" : "[ ]"} ${it.text}`).join("\n");
    const blob = new Blob([body + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "asx-todo.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  wm.open({ id: "todo", title: "Todo", w: 420, h: 420, body: root });
}

/* ── Games folder ─────────────────────────────────────────
 * Open-source / first-party only. Creative Commons shelf for
 * licensed free games (children welcome — hang-out free tier).
 */
function openGamesFolder(wm) {
  const root = document.createElement("div");
  root.className = "app-pad games-folder";
  root.innerHTML = `
    <h2>Games</h2>
    <p style="color:var(--muted);font-size:12px;margin-bottom:10px;line-height:1.45">
      Alison plays too — not only work. <strong>Open-source / Creative Commons only</strong>
      (no proprietary ROMs). Kids are welcome to hang out free; paid Construct is optional later.
    </p>
    <h3 class="games-sec">ASX first-party</h3>
    <div class="games-grid games-grid-first" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px"></div>
    <h3 class="games-sec" style="margin-top:16px">Creative Commons</h3>
    <p style="color:var(--muted);font-size:11px;margin:0 0 8px;line-height:1.4">
      Licensed free games with <code>cc.txt</code> in each folder.
      Disk path: <code>/home/guest/Games/Creative Commons/</code>
    </p>
    <div class="games-grid games-grid-cc" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px"></div>`;

  const first = [
    { id: "tic-tac-toe", label: "Tic Tac Toe", glyph: "✕" },
    { id: "pong", label: "Ping Pong", glyph: "🏓" },
    { id: "blocks", label: "Blocks", glyph: "▦" },
    { id: "snake", label: "Snake", glyph: "〰" },
    { id: "breakout", label: "Breakout", glyph: "▣" },
    { id: "memory", label: "Memory", glyph: "🃏" },
    { id: "mines", label: "Mines", glyph: "⚑" },
    { id: "physics", label: "Physics", glyph: "⚛" },
  ];
  const paintBtns = (el, list, openFn) => {
    list.forEach((g) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "primary";
      b.style.cssText =
        "min-height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px";
      b.innerHTML = `<span style="font-size:22px">${escapeHtml(g.glyph)}</span><span>${escapeHtml(
        g.label
      )}</span>`;
      b.addEventListener("click", () => openFn(g));
      el.appendChild(b);
    });
  };
  paintBtns(root.querySelector(".games-grid-first"), first, (g) => APP_OPENERS[g.id]?.(wm));
  paintBtns(
    root.querySelector(".games-grid-cc"),
    [
      { id: "cc-folder", label: "Open CC folder", glyph: "📂" },
      { id: "pacman-cc", label: "Pacman", glyph: "ᗧ" },
    ],
    (g) => {
      if (g.id === "cc-folder") openCreativeCommonsFolder(wm);
      else if (g.id === "pacman-cc") openPacmanCcShelf(wm);
    }
  );
  wm.open({ id: "games", title: "Games", w: 520, h: 480, body: root });
}

/** Creative Commons shelf — open-source licensed titles only. */
function openCreativeCommonsFolder(wm) {
  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `
    <h2>Creative Commons</h2>
    <p style="color:var(--muted);font-size:12px;line-height:1.45;margin-bottom:12px">
      Open-source / CC-licensed games only. Each title keeps a <strong>cc.txt</strong> attribution file.
      Guest disk: <code>/home/guest/Games/Creative Commons/</code>
    </p>
    <div class="cc-list" style="display:flex;flex-direction:column;gap:8px"></div>
    <p style="color:var(--muted);font-size:11px;margin-top:14px;line-height:1.4">
      Policy: no commercial ROMs or unlicensed clones. Children welcome — free hang-out.
    </p>`;
  const list = root.querySelector(".cc-list");
  const rows = [
    { label: "Pacman", hint: "cc.txt + MIT/CC0 candidates", open: () => openPacmanCcShelf(wm) },
    {
      label: "Open in Files",
      hint: "Browse VFS license tree",
      open: () => openFiles(wm, { startPath: "/home/guest/Games/Creative Commons" }),
    },
  ];
  rows.forEach((r) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "primary";
    b.style.cssText = "text-align:left;padding:12px 14px;display:flex;flex-direction:column;gap:4px";
    b.innerHTML = `<strong>${escapeHtml(r.label)}</strong><span style="font-size:11px;opacity:.8">${escapeHtml(
      r.hint
    )}</span>`;
    b.addEventListener("click", r.open);
    list.appendChild(b);
  });
  wm.open({ id: "games-cc", title: "Creative Commons", w: 440, h: 360, body: root });
}

/** Pacman CC shelf — attribution first; playable only from OSS/CC sources. */
function openPacmanCcShelf(wm) {
  const root = document.createElement("div");
  root.className = "app-pad";
  root.innerHTML = `
    <h2>Pacman · Creative Commons</h2>
    <p style="color:var(--muted);font-size:12px;line-height:1.45">
      Open-source shelf only. Read <code>cc.txt</code> before any embed. No proprietary Namco assets.
    </p>
    <pre class="cc-pre" style="font-size:11px;max-height:220px;overflow:auto;padding:10px;border-radius:8px;background:rgba(0,0,0,.25);white-space:pre-wrap"></pre>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
      <button type="button" class="primary cc-open-files">Open folder in Files</button>
      <button type="button" class="primary cc-open-txt">Show cc.txt path</button>
    </div>
    <p class="cc-status dim" style="font-size:11px;margin-top:10px"></p>`;
  const pre = root.querySelector(".cc-pre");
  const st = root.querySelector(".cc-status");
  const path = "/home/guest/Games/Creative Commons/Pacman/cc.txt";
  pre.textContent = "Loading " + path + "…";
  readFileAsync(path).then((r) => {
    if (r.error) {
      pre.textContent =
        "Creative Commons / open-source attribution — Pacman shelf\n" +
        "=========================================================\n" +
        "platzhersh/pacman-canvas — CC0 1.0\n" +
        "https://github.com/platzhersh/pacman-canvas\n" +
        "chatton/Pacman — MIT\n" +
        "https://github.com/chatton/Pacman\n" +
        "No commercial ROMs. Path: " +
        path;
      st.textContent = r.message || "Using bundled attribution (VFS seed may not be mounted yet)";
    } else {
      pre.textContent = String(r.content || "");
      st.textContent = path;
    }
  });
  root.querySelector(".cc-open-files").addEventListener("click", () => {
    openFiles(wm, { startPath: "/home/guest/Games/Creative Commons/Pacman" });
  });
  root.querySelector(".cc-open-txt").addEventListener("click", () => {
    openFiles(wm, { startPath: "/home/guest/Games/Creative Commons/Pacman" });
    st.textContent = path;
  });
  wm.open({ id: "games-cc-pacman", title: "Pacman · CC", w: 480, h: 440, body: root });
}

function openTicTacToe(wm) {
  openGameWindow(wm, {
    id: "tic-tac-toe",
    title: "Tic Tac Toe",
    hint: "X starts",
    w: 360,
    h: 420,
    mount: mountTicTacToe,
  });
}

function openPong(wm) {
  openGameWindow(wm, {
    id: "pong",
    title: "Ping Pong",
    hint: "W/S or arrows",
    w: 520,
    h: 400,
    mount: mountPong,
  });
}

function openBlocks(wm) {
  openGameWindow(wm, {
    id: "blocks",
    title: "Blocks",
    hint: "Arrows + Space",
    w: 220,
    h: 420,
    mount: mountBlocks,
  });
}


function openSnake(wm) {
  openGameWindow(wm, { id: "snake", title: "Snake", hint: "Arrows", w: 420, h: 380, mount: mountSnake });
}
function openBreakout(wm) {
  openGameWindow(wm, { id: "breakout", title: "Breakout", hint: "← →", w: 460, h: 400, mount: mountBreakout });
}
function openMemory(wm) {
  openGameWindow(wm, { id: "memory", title: "Memory", hint: "Match pairs", w: 400, h: 380, mount: mountMemory });
}
function openMines(wm) {
  openGameWindow(wm, { id: "mines", title: "Mines", hint: "L open · R flag", w: 360, h: 400, mount: mountMines });
}
function openPhysics(wm) {
  const loadMatter = () =>
    loadScriptChain(
      MATTER_SOURCES,
      () => (typeof Matter !== "undefined" ? Matter : null),
      { integrityByUrl: MATTER_CDN_SRI }
    );
  openGameWindow(wm, {
    id: "physics",
    title: "Physics",
    hint: "Matter.js CDN",
    w: 520,
    h: 420,
    mount: (stage, onStatus) => {
      let ctrl = { reset: () => {}, destroy: () => {} };
      mountPhysics(stage, onStatus, loadMatter).then((c) => {
        if (c) ctrl = c;
      });
      return {
        reset: () => ctrl.reset?.(),
        destroy: () => ctrl.destroy?.(),
      };
    },
  });
}

/* ── Camera / Photo Booth (webcamjs CDN) ─────────────────── */
function openCamera(wm) {
  const root = document.createElement("div");
  root.className = "app-pad camera-app";
  root.innerHTML = `
    <h2>Camera</h2>
    <p style="color:var(--muted);font-size:12px;margin-bottom:8px">
      Snap a photo (guest browser only). Download always; guest disk + account dual-save when available.
      Camera stops when you close this window.
    </p>
    <div id="asx-webcam" style="width:320px;height:240px;margin:0 auto;background:#111;border-radius:8px;overflow:hidden"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px">
      <button type="button" class="primary cam-snap">Snap</button>
      <button type="button" class="cam-dl">Download PNG</button>
      <button type="button" class="cam-disk">Save to Pictures</button>
    </div>
    <canvas class="cam-preview" width="320" height="240" style="display:none;margin:12px auto;border-radius:8px"></canvas>
    <p class="cam-status dim" style="text-align:center;font-size:12px;margin-top:8px">Loading webcamjs…</p>`;
  const status = root.querySelector(".cam-status");
  const canvas = root.querySelector(".cam-preview");
  let lastDataUrl = null;
  let live = false;

  const setSt = (m) => {
    if (status) status.textContent = m;
  };

  const stopCam = () => {
    try {
      if (typeof Webcam !== "undefined") Webcam.reset();
    } catch {
      /* ignore */
    }
    // Belt: stop any residual getUserMedia tracks in the widget
    try {
      const rootEl = document.getElementById("asx-webcam");
      rootEl?.querySelectorAll?.("video").forEach((v) => {
        const s = v.srcObject;
        if (s && s.getTracks) s.getTracks().forEach((tr) => tr.stop());
        v.srcObject = null;
      });
      if (rootEl) rootEl.innerHTML = "";
    } catch {
      /* ignore */
    }
    live = false;
  };

  const boot = async () => {
    const W = await loadScriptChain(
      WEBCAM_SOURCES,
      () => (typeof Webcam !== "undefined" ? Webcam : null),
      { integrityByUrl: WEBCAM_CDN_SRI }
    );
    if (!W) {
      setSt("webcamjs CDN failed — allow camera libraries or try again");
      return;
    }
    try {
      Webcam.set({
        width: 320,
        height: 240,
        image_format: "png",
        constraints: { facingMode: "user" },
      });
      Webcam.attach("#asx-webcam");
      live = true;
      setSt("Camera on · Snap when ready · Close window to stop stream");
    } catch (e) {
      setSt(e?.message || "Camera permission denied");
    }
  };

  root.querySelector(".cam-snap").addEventListener("click", () => {
    if (typeof Webcam === "undefined" || !live) {
      setSt("Camera not ready");
      return;
    }
    Webcam.snap((dataUri) => {
      lastDataUrl = dataUri;
      canvas.style.display = "block";
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 320, 240);
      };
      img.src = dataUri;
      setSt("Snapshot ready · Download or Save to Pictures");
    });
  });

  root.querySelector(".cam-dl").addEventListener("click", () => {
    if (!lastDataUrl) {
      setSt("Snap first");
      return;
    }
    const a = document.createElement("a");
    a.href = lastDataUrl;
    a.download = `asx-photo-${Date.now()}.png`;
    a.click();
    setSt("Downloaded PNG to your computer");
  });

  root.querySelector(".cam-disk").addEventListener("click", async () => {
    if (!lastDataUrl) {
      setSt("Snap first");
      return;
    }
    // Store data URL as text in guest Pictures (BrowserFS utf8) — openable later
    const path = `/home/guest/Pictures/asx-photo-${Date.now()}.png.txt`;
    const r = await writeFile(path, lastDataUrl);
    if (r.error) setSt(r.message || "Disk save failed");
    else setSt(`Saved guest disk ${path} · download still available`);
  });

  wm.open({
    id: "camera",
    title: "Camera",
    w: 400,
    h: 480,
    body: root,
    onMount: () => {
      boot();
    },
    onClose: () => {
      stopCam();
    },
  });
}
