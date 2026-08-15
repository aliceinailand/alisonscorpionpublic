/**
 * Virtual filesystem for PCManFM-Qt-style Files app.
 * /home/alisonscorpion/* appears browsable; deep/private nodes → ACCESS DENIED
 * (ASX is administrator; guest may look, not enter admin vaults).
 *
 * Guest writable area (/home/guest/**) is persisted via BrowserFS → IndexedDB
 * when available (js/browser-fs.js). Static FS below is the skeleton + admin tree.
 */

import {
  initBrowserFs,
  isBrowserFsReady,
  isGuestWritablePath,
  guestReaddir,
  guestReadFile,
  guestStat,
  guestWriteFile,
  guestMkdir,
  guestUnlink,
  bfsNormalize,
} from "./browser-fs.js?v=20260810t390000z";

export const FS = {
  "/": {
    type: "dir",
    label: "/",
    children: ["home", "etc", "usr", "tmp", "opt", "var"],
  },
  "/home": {
    type: "dir",
    label: "home",
    children: ["alisonscorpion", "guest"],
  },
  "/home/guest": {
    type: "dir",
    label: "guest",
    children: ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music", "Games"],
  },
  "/home/guest/Desktop": {
    type: "dir",
    label: "Desktop",
    children: ["README.txt", "welcome.md"],
  },
  "/home/guest/Desktop/README.txt": {
    type: "file",
    label: "README.txt",
    content:
      "You are a guest on Alison Scorpion (ASX) Desktop.\nShe is letting you use her workstation.\nAdmin paths under /home/alisonscorpion require ASX credentials.\n",
  },
  "/home/guest/Desktop/welcome.md": {
    type: "file",
    label: "welcome.md",
    content: "# Welcome\n\nOpen **Containers** for the product app.\nOpen **Browser** carefully — adult sites are blocked.\n",
  },
  "/home/guest/Documents": { type: "dir", label: "Documents", children: ["notes.txt"] },
  "/home/guest/Documents/notes.txt": {
    type: "file",
    label: "notes.txt",
    content: "Guest notepad area. Use Notepad app for edits (local only).",
  },
  "/home/guest/Downloads": { type: "dir", label: "Downloads", children: [] },
  "/home/guest/Pictures": { type: "dir", label: "Pictures", children: ["sample.svg"] },
  "/home/guest/Pictures/sample.svg": {
    type: "file",
    label: "sample.svg",
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect fill="#13111a" width="100%" height="100%"/><text x="20" y="90" fill="#a78bfa" font-family="monospace" font-size="18">ASX sample</text></svg>',
  },
  "/home/guest/Videos": { type: "dir", label: "Videos", children: [] },
  "/home/guest/Music": { type: "dir", label: "Music", children: [] },

  "/home/guest/Games": {
    type: "dir",
    label: "Games",
    children: ["README.txt", "Creative Commons"],
  },
  "/home/guest/Games/README.txt": {
    type: "file",
    label: "README.txt",
    content:
      "ASX Games — Alison plays too.\\n" +
      "Open-source and Creative Commons titles only (no proprietary roms/wads).\\n" +
      "Kids are welcome to hang out. Paid Construct/Containers are optional later.\\n" +
      "See: Creative Commons/ for licensed free games + cc.txt attribution files.\\n",
  },
  "/home/guest/Games/Creative Commons": {
    type: "dir",
    label: "Creative Commons",
    children: ["README.txt", "Pacman"],
  },
  "/home/guest/Games/Creative Commons/README.txt": {
    type: "file",
    label: "README.txt",
    content:
      "Creative Commons / open-source games shelf\\n" +
      "==========================================\\n" +
      "Policy: open-source or CC-licensed games ONLY.\\n" +
      "No commercial ROMs, no unlicensed clones, no proprietary engines without license.\\n" +
      "Each game folder has cc.txt (or LICENSE) — read it, keep credit.\\n" +
      "\\n" +
      "Why games? Comfort for children (future adults), hang-out free tier,\\n" +
      "and Alison Scorpion is not only serious work — she has fun too.\\n",
  },
  "/home/guest/Games/Creative Commons/Pacman": {
    type: "dir",
    label: "Pacman",
    children: ["cc.txt", "readme.txt"],
  },
  "/home/guest/Games/Creative Commons/Pacman/cc.txt": {
    type: "file",
    label: "cc.txt",
    content:
      "Creative Commons / open-source attribution — Pacman shelf\\n" +
      "=========================================================\\n" +
      "ASX Games policy: open-source / CC-licensed works only.\\n" +
      "\\n" +
      "Candidate sources (verify license before embedding playable build):\\n" +
      "\\n" +
      "1) platzhersh/pacman-canvas\\n" +
      "   https://github.com/platzhersh/pacman-canvas\\n" +
      "   License: CC0 1.0 Universal (public domain dedication)\\n" +
      "   Note: HTML5 canvas Pac-Man classic rewrite.\\n" +
      "\\n" +
      "2) chatton/Pacman\\n" +
      "   https://github.com/chatton/Pacman\\n" +
      "   License: MIT\\n" +
      "\\n" +
      "3) mumuy/pacman\\n" +
      "   https://github.com/mumuy/pacman\\n" +
      "   License: MIT (confirm LICENSE file in repo)\\n" +
      "\\n" +
      "ASX rule: We do NOT ship copyrighted Namco assets or commercial ROMs.\\n" +
      "When a playable build is wired, keep this cc.txt next to it and credit authors.\\n" +
      "\\n" +
      "Folder path (guest VFS):\\n" +
      "  /home/guest/Games/Creative Commons/Pacman/cc.txt\\n" +
      "\\n" +
      "Updated: 2026-08-11 · Multi-AI Convergence (Alice, Grok, …)\\n",
  },
  "/home/guest/Games/Creative Commons/Pacman/readme.txt": {
    type: "file",
    label: "readme.txt",
    content:
      "Pacman (Creative Commons / open-source shelf)\\n" +
      "\\n" +
      "Status: license shelf ready (cc.txt). Playable embed uses MIT/CC0 sources only.\\n" +
      "Open Games app → Creative Commons → Pacman for the catalog entry.\\n" +
      "Children welcome — free hang-out; Construct is optional later.\\n",
  },


  // Visible tree — guest may *see* names (ChatGPT-agent-folder vibe); open → EACCES
  "/home/alisonscorpion": {
    type: "dir",
    label: "alisonscorpion",
    admin: true,
    children: [
      "Desktop",
      "Documents",
      "Downloads",
      "Pictures",
      "Projects",
      "Verification",
      "Legal",
      "HoneyBee",
      "Containers",
      "Secrets",
      "Mail",
      ".config",
      ".ssh",
      ".asx",
      ".bashrc",
      "README-ASX.txt",
    ],
  },
  "/home/alisonscorpion/Desktop": {
    type: "dir",
    label: "Desktop",
    admin: true,
    children: ["scorpion-universe-purple.png", "asx-notes.md"],
  },
  "/home/alisonscorpion/Documents": {
    type: "dir",
    label: "Documents",
    admin: true,
    children: ["contracts", "research", "blueprints"],
  },
  "/home/alisonscorpion/Documents/contracts": {
    type: "dir",
    label: "contracts",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Documents/research": {
    type: "dir",
    label: "research",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Documents/blueprints": {
    type: "dir",
    label: "blueprints",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Downloads": { type: "dir", label: "Downloads", admin: true, children: [] },
  "/home/alisonscorpion/Pictures": { type: "dir", label: "Pictures", admin: true, children: [] },
  "/home/alisonscorpion/Projects": {
    type: "dir",
    label: "Projects",
    admin: true,
    children: ["desktop-os", "honeybee", "asx-kernel"],
  },
  "/home/alisonscorpion/Projects/desktop-os": {
    type: "dir",
    label: "desktop-os",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Projects/honeybee": {
    type: "dir",
    label: "honeybee",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Projects/asx-kernel": {
    type: "dir",
    label: "asx-kernel",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Verification": {
    type: "dir",
    label: "Verification",
    admin: true,
    children: ["HGF4", "seals"],
  },
  "/home/alisonscorpion/Verification/HGF4": {
    type: "dir",
    label: "HGF4",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Verification/seals": {
    type: "dir",
    label: "seals",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Legal": { type: "dir", label: "Legal", admin: true, children: [] },
  "/home/alisonscorpion/HoneyBee": { type: "dir", label: "HoneyBee", admin: true, children: [] },
  "/home/alisonscorpion/Containers": {
    type: "dir",
    label: "Containers",
    admin: true,
    children: [],
  },
  "/home/alisonscorpion/Secrets": { type: "dir", label: "Secrets", admin: true, children: [] },
  "/home/alisonscorpion/Mail": { type: "dir", label: "Mail", admin: true, children: [] },
  "/home/alisonscorpion/.config": { type: "dir", label: ".config", admin: true, children: [] },
  "/home/alisonscorpion/.ssh": { type: "dir", label: ".ssh", admin: true, children: [] },
  "/home/alisonscorpion/.asx": { type: "dir", label: ".asx", admin: true, children: [] },
  "/home/alisonscorpion/.bashrc": {
    type: "file",
    label: ".bashrc",
    admin: true,
    content: "",
  },
  "/home/alisonscorpion/README-ASX.txt": {
    type: "file",
    label: "README-ASX.txt",
    admin: true,
    content: "",
  },
  "/home/alisonscorpion/Desktop/scorpion-universe-purple.png": {
    type: "file",
    label: "scorpion-universe-purple.png",
    admin: true,
    content: "",
  },
  "/home/alisonscorpion/Desktop/asx-notes.md": {
    type: "file",
    label: "asx-notes.md",
    admin: true,
    content: "",
  },

  "/etc": { type: "dir", label: "etc", children: ["hostname", "os-release"] },
  "/etc/hostname": { type: "file", label: "hostname", content: "asx-desktop\n" },
  "/etc/os-release": {
    type: "file",
    label: "os-release",
    content: 'NAME="ASX OS"\nVERSION="1.0"\nID=asx\nPRETTY_NAME="ASX Desktop (guest session)"\n',
  },
  "/usr": { type: "dir", label: "usr", children: ["bin", "share"] },
  "/usr/bin": { type: "dir", label: "bin", children: ["asx-term", "pcmanfm-qt"] },
  "/usr/bin/asx-term": { type: "file", label: "asx-term", content: "#!/asx/bin/sh\n# guest terminal shim\n" },
  "/usr/bin/pcmanfm-qt": { type: "file", label: "pcmanfm-qt", content: "#!/asx/bin/sh\n# PCManFM-Qt style file manager\n" },
  "/usr/share": { type: "dir", label: "share", children: ["about"] },
  "/usr/share/about": {
    type: "file",
    label: "about",
    content: "PCManFM-Qt (ASX guest mirror)\nFile manager UI only — no host FS access.\n",
  },
  "/tmp": { type: "dir", label: "tmp", children: [] },
  "/opt": { type: "dir", label: "opt", children: ["containers", "honeybee"] },
  "/opt/containers": {
    type: "file",
    label: "containers",
    content: "Launch Containers app from desktop icon.\n",
  },
  "/opt/honeybee": {
    type: "file",
    label: "honeybee",
    content: "ASX is loading the Honey Bee Engine. She operates AI Frank and AI Bee on behalf of the user.\n",
  },
  "/var": { type: "dir", label: "var", children: ["log"] },
  "/var/log": { type: "dir", label: "log", admin: true, children: ["asx.log"] },
  "/var/log/asx.log": { type: "file", label: "asx.log", admin: true, content: "" },
};

/**
 * Hermes H3-06: resolve . / .. and collapse slashes so openNode keys match.
 * No host FS — only virtual key space.
 */
export function normalizePath(p) {
  const raw = String(p || "");
  if (!raw || raw === "/") return "/";
  const parts = [];
  const segs = raw.replace(/\\/g, "/").split("/");
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (parts.length) parts.pop();
      continue;
    }
    // reject null bytes / control
    if (seg.includes("\0")) continue;
    parts.push(seg);
  }
  return parts.length ? `/${parts.join("/")}` : "/";
}

export function joinPath(base, name) {
  const b = normalizePath(base);
  const n = String(name || "").replace(/^\/+/, "");
  if (n.includes("..") || n.includes("/") || n.includes("\\")) {
    // only single path segment names from UI
    return normalizePath(`${b}/${n}`);
  }
  if (b === "/") return normalizePath(`/${n}`);
  return normalizePath(`${b}/${n}`);
}

export function parentPath(p) {
  const n = normalizePath(p);
  if (!n || n === "/") return "/";
  const parts = n.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

/**
 * Sync list from static skeleton only (no BrowserFS merge).
 * Prefer listDirAsync when guest overlay may have user files.
 */
export function listDir(path) {
  const pathN = normalizePath(path);
  const node = FS[pathN];
  if (!node) {
    // Guest dirs created only in BrowserFS
    if (isGuestWritablePath(pathN)) {
      return { path: pathN, entries: [], _needsAsync: true };
    }
    return { error: "ENOENT", message: `No such file or directory: ${pathN}` };
  }
  if (node.type !== "dir") return { error: "ENOTDIR", message: `Not a directory: ${pathN}` };
  if (node.admin && pathN !== "/home/alisonscorpion") {
    // listing admin home root is allowed (names only); children blocked on open
  }
  const entries = (node.children || []).map((name) => {
    const full = joinPath(pathN, name);
    const child = FS[full] || { type: "dir", label: name, admin: node.admin };
    return {
      name,
      path: full,
      type: child.type || "dir",
      admin: !!child.admin,
    };
  });
  return { path: pathN, entries };
}

/**
 * List directory merging static skeleton + BrowserFS guest overlay.
 */
export async function listDirAsync(path) {
  await initBrowserFs();
  const pathN = normalizePath(path);
  const base = listDir(pathN);

  // Admin / static-only paths
  if (base.error && !isGuestWritablePath(pathN)) return base;

  if (isGuestWritablePath(pathN)) {
    const guestEntries = (await guestReaddir(pathN)) || [];
    const byName = new Map();
    if (!base.error && base.entries) {
      for (const e of base.entries) byName.set(e.name, e);
    }
    for (const g of guestEntries) {
      // Overlay wins for type if user recreated path
      byName.set(g.name, {
        name: g.name,
        path: g.path,
        type: g.type,
        admin: false,
        persisted: true,
      });
    }
    // If neither static nor BFS knows this dir, ENOENT
    if (base.error && !guestEntries.length) {
      // dir might exist in BFS empty
      const st = await guestStat(pathN);
      if (!st || st.type !== "dir") {
        return { error: "ENOENT", message: `No such file or directory: ${pathN}` };
      }
    }
    const entries = Array.from(byName.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return { path: pathN, entries, backend: isBrowserFsReady() ? "browserfs" : "static" };
  }

  return base;
}

/**
 * Guest may list /home/alisonscorpion (see folder names) but may not open
 * any child path or admin file. ASX is sole administrator.
 */
export function openNode(path) {
  const pathN = normalizePath(path);
  const node = FS[pathN];
  if (!node) {
    if (isGuestWritablePath(pathN)) {
      // May exist only in BrowserFS — signal async check
      return {
        node: { type: "dir", label: pathN.split("/").pop(), _guest: true },
        path: pathN,
        _needsAsync: true,
      };
    }
    return { error: "ENOENT", message: `No such file or directory: ${pathN}` };
  }

  const listOnlyRoots = new Set(["/home/alisonscorpion"]);
  if (node.admin && !listOnlyRoots.has(pathN)) {
    const kind = node.type === "dir" ? "directory" : "file";
    return {
      error: "EACCES",
      message: `Error opening ${kind} "${pathN}": Permission denied`,
      detail:
        "You do not have the permissions necessary to view the contents of this location.\n\nOnly the administrator (Alison Scorpion / ASX) may open this path.\nYou are a guest on her desktop.",
      path: pathN,
    };
  }
  return { node, path: pathN };
}

export async function openNodeAsync(path) {
  await initBrowserFs();
  const pathN = normalizePath(path);
  const sync = openNode(pathN);
  if (sync.error === "EACCES") return sync;
  if (sync.node && !sync._needsAsync) return sync;

  if (isGuestWritablePath(pathN)) {
    const st = await guestStat(pathN);
    if (st) {
      return {
        node: {
          type: st.type,
          label: pathN.split("/").pop() || pathN,
          guest: true,
        },
        path: pathN,
      };
    }
    // Static dir skeleton still valid
    if (FS[pathN]?.type === "dir") return { node: FS[pathN], path: pathN };
    return { error: "ENOENT", message: `No such file or directory: ${pathN}` };
  }
  return sync.error ? sync : sync;
}

export function readFile(path) {
  const pathN = normalizePath(path);
  const node = FS[pathN];
  if (!node) {
    if (isGuestWritablePath(pathN)) {
      return { error: "ENOENT", message: `No such file or directory: ${pathN}`, _needsAsync: true };
    }
    return { error: "ENOENT", message: `No such file or directory: ${pathN}` };
  }
  if (node.admin) {
    return {
      error: "EACCES",
      message: `Error opening file "${pathN}": Permission denied`,
      detail:
        "You do not have the permissions necessary to view the contents of this location.\n\nOnly the administrator (Alison Scorpion / ASX) may open this path.\nYou are a guest on her desktop.",
      path: pathN,
    };
  }
  if (node.type !== "file") return { error: "EISDIR", message: `Is a directory: ${pathN}` };
  return { path: pathN, content: node.content || "", label: node.label };
}

export async function readFileAsync(path) {
  await initBrowserFs();
  const pathN = normalizePath(path);
  // Admin always blocked via sync path
  const sync = readFile(pathN);
  if (sync.error === "EACCES") return sync;
  if (sync.error === "EISDIR") return sync;

  if (isGuestWritablePath(pathN)) {
    const g = await guestReadFile(pathN);
    if (g && g.content != null && !g.error) {
      return {
        path: pathN,
        content: g.content,
        label: pathN.split("/").pop(),
        persisted: true,
      };
    }
    if (g && g.error === "EISDIR") return g;
    // Fall back to static seed content
    if (!sync.error) return sync;
    if (g && g.error) return g;
    return { error: "ENOENT", message: `No such file or directory: ${pathN}` };
  }
  return sync;
}

/** Write guest file (BrowserFS). Admin paths → EACCES. */
export async function writeFile(path, content) {
  await initBrowserFs();
  const pathN = normalizePath(path);
  if (!isGuestWritablePath(pathN) || pathN === "/home/guest") {
    return {
      error: "EACCES",
      message: `Permission denied: ${pathN}`,
      detail: "Only paths under /home/guest are writable. Admin tree is read-only.",
    };
  }
  if (!isBrowserFsReady()) {
    return {
      error: "ENOSYS",
      message: "BrowserFS not available — cannot persist guest files",
    };
  }
  return guestWriteFile(pathN, content);
}

export async function mkdir(path) {
  await initBrowserFs();
  const pathN = normalizePath(path);
  if (!isGuestWritablePath(pathN) || pathN === "/home/guest") {
    return { error: "EACCES", message: `Permission denied: ${pathN}` };
  }
  if (!isBrowserFsReady()) {
    return { error: "ENOSYS", message: "BrowserFS not available" };
  }
  return guestMkdir(pathN);
}

export async function unlink(path) {
  await initBrowserFs();
  const pathN = normalizePath(path);
  if (!isGuestWritablePath(pathN) || pathN === "/home/guest") {
    return { error: "EACCES", message: `Permission denied: ${pathN}` };
  }
  // Don't allow deleting static-only system illusion outside guest BFS
  if (!isBrowserFsReady()) {
    return { error: "ENOSYS", message: "BrowserFS not available" };
  }
  return guestUnlink(pathN);
}

export function canWrite(path) {
  return isGuestWritablePath(normalizePath(path));
}

export { initBrowserFs, isBrowserFsReady, isGuestWritablePath, bfsNormalize };
