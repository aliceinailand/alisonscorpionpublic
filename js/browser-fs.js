/**
 * BrowserFS guest persistence layer (cdnjs → jsDelivr).
 * https://cdnjs.com/libraries/BrowserFS
 *
 * Stores *guest-writable* paths under /home/guest in IndexedDB.
 * Admin tree (/home/alisonscorpion, …) stays in static fs.js only (EACCES).
 * Never touches the real host disk.
 */

const BROWSERFS_VERSION = "2.0.0";
const BROWSERFS_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/BrowserFS/${BROWSERFS_VERSION}/browserfs.min.js`,
  `https://cdn.jsdelivr.net/npm/browserfs@${BROWSERFS_VERSION}/dist/browserfs.min.js`,
];

const IDB_STORE = "asx-guest-fs";

/** @type {import("fs")|null} Node-style fs from BrowserFS */
let bfs = null;
/** @type {Promise<boolean>|null} */
let initPromise = null;
let ready = false;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window.BrowserFS !== "undefined") {
      resolve(window.BrowserFS);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => {
      if (typeof window.BrowserFS !== "undefined") resolve(window.BrowserFS);
      else reject(new Error("BrowserFS global missing"));
    };
    s.onerror = () => reject(new Error("BrowserFS script failed: " + src));
    document.head.appendChild(s);
  });
}

function loadBrowserFsLib() {
  if (typeof window.BrowserFS !== "undefined") {
    return Promise.resolve(window.BrowserFS);
  }
  return (async () => {
    let last;
    for (const src of BROWSERFS_SOURCES) {
      try {
        return await loadScript(src);
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error("BrowserFS CDN failed");
  })();
}

function configureBrowserFs(BrowserFS) {
  return new Promise((resolve, reject) => {
    try {
      BrowserFS.configure(
        {
          fs: "IndexedDB",
          options: { storeName: IDB_STORE },
        },
        (err) => {
          if (err) reject(err);
          else resolve(BrowserFS.BFSRequire("fs"));
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

function promisify(fn, ctx) {
  return (...args) =>
    new Promise((resolve, reject) => {
      fn.call(ctx, ...args, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
}

/** Normalize to absolute POSIX path. */
export function bfsNormalize(p) {
  const raw = String(p || "");
  if (!raw || raw === "/") return "/";
  const parts = [];
  for (const seg of raw.replace(/\\/g, "/").split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (parts.length) parts.pop();
      continue;
    }
    if (seg.includes("\0")) continue;
    parts.push(seg);
  }
  return parts.length ? `/${parts.join("/")}` : "/";
}

export function isGuestWritablePath(p) {
  const n = bfsNormalize(p);
  return n === "/home/guest" || n.startsWith("/home/guest/");
}

/**
 * Boot BrowserFS + seed guest home once. Safe to call repeatedly.
 * @returns {Promise<boolean>} true if BFS is usable
 */
export function initBrowserFs() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const BrowserFS = await loadBrowserFsLib();
      bfs = await configureBrowserFs(BrowserFS);
      await seedGuestHome();
      ready = true;
      console.info("[asx-bfs] BrowserFS IndexedDB ready · store:", IDB_STORE);
      return true;
    } catch (e) {
      console.warn("[asx-bfs] BrowserFS unavailable — static VFS only", e);
      bfs = null;
      ready = false;
      return false;
    }
  })();
  return initPromise;
}

export function isBrowserFsReady() {
  return ready && !!bfs;
}

export function browserFsVersion() {
  return BROWSERFS_VERSION;
}

async function exists(path) {
  if (!bfs) return false;
  try {
    await promisify(bfs.stat, bfs)(path);
    return true;
  } catch {
    return false;
  }
}

async function mkdirp(path) {
  if (!bfs) return;
  const n = bfsNormalize(path);
  if (n === "/") return;
  const parts = n.split("/").filter(Boolean);
  let cur = "";
  for (const part of parts) {
    cur += "/" + part;
    if (await exists(cur)) continue;
    try {
      await promisify(bfs.mkdir, bfs)(cur);
    } catch (e) {
      // EEXIST race
      if (e?.code !== "EEXIST") throw e;
    }
  }
}

const SEED_DIRS = [
  "/home/guest",
  "/home/guest/Desktop",
  "/home/guest/Documents",
  "/home/guest/Downloads",
  "/home/guest/Pictures",
  "/home/guest/Videos",
  "/home/guest/Music",
  "/home/guest/Games",
  "/home/guest/Games/Creative Commons",
  "/home/guest/Games/Creative Commons/Pacman",
];

const SEED_FILES = {
  "/home/guest/Desktop/README.txt":
    "You are a guest on Alison Scorpion (ASX) Desktop.\n" +
    "This folder is backed by BrowserFS (IndexedDB) in your browser — not the host disk.\n" +
    "Admin paths under /home/alisonscorpion require ASX credentials.\n",
  "/home/guest/Desktop/welcome.md":
    "# Welcome\n\nOpen **Containers** for the product app.\n" +
    "Open **Browser** carefully — adult sites are blocked.\n" +
    "Your guest files persist in this browser via BrowserFS.\n",
  "/home/guest/Documents/notes.txt":
    "Guest notepad area. Create files here from Files or Terminal (touch / echo).\n",
  "/home/guest/Pictures/sample.svg":
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160">' +
    '<rect fill="#13111a" width="100%" height="100%"/>' +
    '<text x="20" y="90" fill="#a78bfa" font-family="monospace" font-size="18">ASX sample</text></svg>',
  "/home/guest/Games/README.txt":
    "ASX Games — Alison plays too.\nOpen-source and Creative Commons only.\nKids welcome. See Creative Commons/.\n",
  "/home/guest/Games/Creative Commons/README.txt":
    "Creative Commons / open-source games only.\nEach title has cc.txt attribution.\n",
  "/home/guest/Games/Creative Commons/Pacman/cc.txt":
    "Pacman shelf — open-source/CC only.\n" +
    "platzhersh/pacman-canvas: CC0 1.0 — https://github.com/platzhersh/pacman-canvas\n" +
    "chatton/Pacman: MIT — https://github.com/chatton/Pacman\n" +
    "No commercial ROMs. Keep this cc.txt with any playable build.\n" +
    "Path: /home/guest/Games/Creative Commons/Pacman/cc.txt\n",
  "/home/guest/Games/Creative Commons/Pacman/readme.txt":
    "Pacman CC shelf. Read cc.txt. Playable embed uses MIT/CC0 sources only.\n",
};

async function seedGuestHome() {
  if (!bfs) return;
  // Marker so we don't overwrite user edits on every boot
  const marker = "/home/guest/.asx-bfs-seeded-v2-games-cc";
  if (await exists(marker)) return;
  for (const d of SEED_DIRS) {
    await mkdirp(d);
  }
  for (const [path, content] of Object.entries(SEED_FILES)) {
    if (!(await exists(path))) {
      await mkdirp(path.replace(/\/[^/]+$/, "") || "/");
      await promisify(bfs.writeFile, bfs)(path, content, "utf8");
    }
  }
  await promisify(bfs.writeFile, bfs)(
    marker,
    `seeded ${new Date().toISOString()}\nBrowserFS ${BROWSERFS_VERSION}\n`,
    "utf8"
  );
}

/**
 * List directory entries from BrowserFS (guest overlay only).
 * @returns {Promise<{name:string,type:'file'|'dir'}[]|null>}
 */
export async function guestReaddir(path) {
  if (!bfs || !isGuestWritablePath(path)) return null;
  const n = bfsNormalize(path);
  try {
    const names = await promisify(bfs.readdir, bfs)(n);
    const out = [];
    for (const name of names) {
      if (name === ".asx-bfs-seeded") continue; // hide seed marker
      const full = n === "/" ? `/${name}` : `${n}/${name}`;
      let type = "file";
      try {
        const st = await promisify(bfs.stat, bfs)(full);
        type = st.isDirectory() ? "dir" : "file";
      } catch {
        type = "file";
      }
      out.push({ name, type, path: full });
    }
    return out;
  } catch (e) {
    if (e?.code === "ENOENT") return null;
    console.warn("[asx-bfs] readdir", n, e);
    return null;
  }
}

/**
 * @returns {Promise<{content:string}|{error:string,message:string}|null>}
 * null = not in BFS (fall through to static)
 */
export async function guestReadFile(path) {
  if (!bfs || !isGuestWritablePath(path)) return null;
  const n = bfsNormalize(path);
  try {
    const st = await promisify(bfs.stat, bfs)(n);
    if (st.isDirectory()) {
      return { error: "EISDIR", message: `Is a directory: ${n}` };
    }
    const content = await promisify(bfs.readFile, bfs)(n, "utf8");
    return { content: String(content ?? ""), path: n };
  } catch (e) {
    if (e?.code === "ENOENT") return null;
    return { error: e?.code || "EIO", message: e?.message || String(e) };
  }
}

/**
 * Stat guest path in BFS.
 * @returns {Promise<{type:'file'|'dir'}|null>}
 */
export async function guestStat(path) {
  if (!bfs || !isGuestWritablePath(path)) return null;
  const n = bfsNormalize(path);
  try {
    const st = await promisify(bfs.stat, bfs)(n);
    return { type: st.isDirectory() ? "dir" : "file", path: n };
  } catch {
    return null;
  }
}

export async function guestWriteFile(path, content) {
  if (!bfs) return { error: "ENOSYS", message: "BrowserFS not available" };
  const n = bfsNormalize(path);
  if (!isGuestWritablePath(n) || n === "/home/guest") {
    return { error: "EACCES", message: `Permission denied: ${n}` };
  }
  try {
    await mkdirp(n.replace(/\/[^/]+$/, "") || "/home/guest");
    await promisify(bfs.writeFile, bfs)(n, String(content ?? ""), "utf8");
    return { path: n, ok: true };
  } catch (e) {
    return { error: e?.code || "EIO", message: e?.message || String(e) };
  }
}

export async function guestMkdir(path) {
  if (!bfs) return { error: "ENOSYS", message: "BrowserFS not available" };
  const n = bfsNormalize(path);
  if (!isGuestWritablePath(n) || n === "/home/guest") {
    return { error: "EACCES", message: `Permission denied: ${n}` };
  }
  try {
    await mkdirp(n);
    return { path: n, ok: true };
  } catch (e) {
    return { error: e?.code || "EIO", message: e?.message || String(e) };
  }
}

export async function guestUnlink(path) {
  if (!bfs) return { error: "ENOSYS", message: "BrowserFS not available" };
  const n = bfsNormalize(path);
  if (!isGuestWritablePath(n) || n === "/home/guest") {
    return { error: "EACCES", message: `Permission denied: ${n}` };
  }
  // Don't delete seed marker via public API path that includes it — already hidden
  try {
    const st = await promisify(bfs.stat, bfs)(n);
    if (st.isDirectory()) {
      await promisify(bfs.rmdir, bfs)(n);
    } else {
      await promisify(bfs.unlink, bfs)(n);
    }
    return { path: n, ok: true };
  } catch (e) {
    return { error: e?.code || "EIO", message: e?.message || String(e) };
  }
}

export { BROWSERFS_VERSION, IDB_STORE };
