/**
 * Virtual filesystem for PCManFM-Qt-style Files app.
 * /home/alisonscorpion/* appears browsable; deep/private nodes → ACCESS DENIED
 * (ASX is administrator; guest may look, not enter admin vaults).
 */

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
    children: ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"],
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
    content: "Honey Bee Engine — business/government/contracts (public shell).\n",
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

export function listDir(path) {
  const pathN = normalizePath(path);
  const node = FS[pathN];
  if (!node) return { error: "ENOENT", message: `No such file or directory: ${pathN}` };
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
 * Guest may list /home/alisonscorpion (see folder names) but may not open
 * any child path or admin file. ASX is sole administrator.
 */
export function openNode(path) {
  const pathN = normalizePath(path);
  const node = FS[pathN];
  if (!node) return { error: "ENOENT", message: `No such file or directory: ${pathN}` };

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

export function readFile(path) {
  const pathN = normalizePath(path);
  const node = FS[pathN];
  if (!node) return { error: "ENOENT", message: `No such file or directory: ${pathN}` };
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
