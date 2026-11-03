/**
 * ASX Utilities — Notepad with two save targets:
 * 1) ASX desktop guest VFS (choose folder under /home/guest)
 * 2) Host Downloads (File System Access API, else browser download)
 */
import {
  initBrowserFs,
  isBrowserFsReady,
  writeFile,
  joinPath,
} from "./fs.js?v=20261103reader2";

const DRAFT_KEY = "asx-notepad";
const LAST_ASX_PATH_KEY = "asx-notepad-last-asx-path";

const ASX_FOLDERS = [
  { id: "Desktop", path: "/home/guest/Desktop", label: "ASX Desktop" },
  { id: "Documents", path: "/home/guest/Documents", label: "ASX Documents" },
  { id: "Downloads", path: "/home/guest/Downloads", label: "ASX Downloads" },
];

const TEXT_PICKER_TYPES = [
  {
    description: "Text document",
    accept: {
      "text/plain": [".txt", ".md", ".log"],
    },
  },
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function saveBlobToHostDownloads(blob, suggestedName) {
  const picker = window.showSaveFilePicker;
  if (typeof picker === "function") {
    try {
      let handle;
      try {
        handle = await picker({
          suggestedName,
          startIn: "downloads",
          types: TEXT_PICKER_TYPES,
        });
      } catch (e) {
        if (e && e.name === "AbortError") return { ok: false, cancelled: true };
        handle = await picker({ suggestedName, types: TEXT_PICKER_TYPES });
      }
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, method: "picker", name: handle.name };
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, cancelled: true };
    }
  }
  downloadBlob(blob, suggestedName);
  return { ok: true, method: "download", name: suggestedName };
}

function safeFileName(name) {
  const raw = String(name || "note.txt").trim() || "note.txt";
  const cleaned = raw.replace(/[\\/:*?"<>|\0]/g, "_").replace(/^\.+/, "");
  if (!cleaned) return "note.txt";
  if (!/\.[a-z0-9]{1,8}$/i.test(cleaned)) return `${cleaned}.txt`;
  return cleaned;
}

/** Pure helper for tests: build guest VFS path from folder + filename. */
export function asxSavePath(folderPath, fileName) {
  const folder = String(folderPath || "/home/guest/Desktop").replace(/\/+$/, "");
  return joinPath(folder, safeFileName(fileName));
}

export function openNotepad(wm) {
  const root = document.createElement("div");
  root.className = "app-pad notepad-app";
  root.innerHTML = `
    <h2>Notepad</h2>
    <p class="notepad-hint">Draft stays in this browser. Save to the ASX guest desktop (choose a folder) or to Downloads on your own computer. Nothing is uploaded to ASX servers.</p>
    <label class="notepad-title-row">File name
      <input type="text" class="np-name" value="note.txt" spellcheck="false" aria-label="File name" />
    </label>
    <textarea class="np" aria-label="Notepad text"></textarea>
    <div class="notepad-actions" role="group" aria-label="Save options">
      <label class="notepad-folder">ASX folder
        <select class="np-folder" aria-label="ASX save folder">
          ${ASX_FOLDERS.map((f) => `<option value="${f.path}">${f.label}</option>`).join("")}
        </select>
      </label>
      <button type="button" class="primary save-asx">Save to ASX desktop</button>
      <button type="button" class="primary save-host">Save to Downloads</button>
      <button type="button" class="save-draft">Save draft only</button>
    </div>
    <span class="status" role="status" aria-live="polite"></span>`;

  const ta = root.querySelector(".np");
  const nameIn = root.querySelector(".np-name");
  const folderSel = root.querySelector(".np-folder");
  const status = root.querySelector(".status");
  const setStatus = (msg) => {
    status.textContent = msg || "";
  };

  ta.value = localStorage.getItem(DRAFT_KEY) || "";
  try {
    const last = localStorage.getItem(LAST_ASX_PATH_KEY) || "";
    const match = ASX_FOLDERS.find((f) => last.startsWith(f.path + "/") || last === f.path);
    if (match) folderSel.value = match.path;
    if (last.includes("/")) {
      const base = last.split("/").pop();
      if (base) nameIn.value = base;
    }
  } catch {
    /* ignore */
  }

  root.querySelector(".save-draft").addEventListener("click", () => {
    localStorage.setItem(DRAFT_KEY, ta.value);
    setStatus("Draft saved in this browser · " + new Date().toLocaleTimeString());
  });

  root.querySelector(".save-asx").addEventListener("click", async () => {
    setStatus("Saving to ASX…");
    await initBrowserFs();
    if (!isBrowserFsReady()) {
      setStatus("ASX guest disk is not ready in this browser (BrowserFS). Try Save to Downloads.");
      return;
    }
    const path = asxSavePath(folderSel.value, nameIn.value);
    const result = await writeFile(path, ta.value);
    if (result?.error) {
      setStatus(result.message || result.error || "Could not save on ASX desktop");
      return;
    }
    localStorage.setItem(DRAFT_KEY, ta.value);
    localStorage.setItem(LAST_ASX_PATH_KEY, path);
    setStatus(`Saved on ASX desktop: ${path}`);
  });

  root.querySelector(".save-host").addEventListener("click", async () => {
    setStatus("Opening save dialog…");
    const name = safeFileName(nameIn.value);
    const blob = new Blob([ta.value], { type: "text/plain;charset=utf-8" });
    const result = await saveBlobToHostDownloads(blob, name);
    if (result.cancelled) {
      setStatus("Save cancelled");
      return;
    }
    localStorage.setItem(DRAFT_KEY, ta.value);
    if (result.method === "picker") {
      setStatus(`Saved ${result.name} to your computer (Downloads dialog when available).`);
    } else {
      setStatus(`Downloaded ${result.name}. Check your Downloads folder.`);
    }
  });

  wm.open({ id: "notepad", title: "Notepad", w: 560, h: 480, body: root });
}
