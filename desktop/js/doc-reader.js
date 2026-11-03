/**
 * ASX Utilities — multi-format Reader
 * PDF (pdf.js), Markdown/TXT/LOG, DOCX (mammoth), images, audio, video.
 * Local files only — never uploaded.
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

const MAMMOTH_SOURCES = [
  "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
  "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js",
];

const ACCEPT =
  ".pdf,.md,.markdown,.txt,.log,.docx,application/pdf,text/plain,text/markdown," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "image/*,audio/*,video/*";

/** @type {Promise<object>|null} */
let pdfjsLoadPromise = null;
/** @type {Promise<object>|null} */
let mammothLoadPromise = null;

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Classify a file by name/type for the reader. Exported for unit tests. */
export function classifyReaderFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const mime = String(file?.type || "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("wordprocessingml") ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(name)) {
    return "image";
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(name)) {
    return "audio";
  }
  if (mime.startsWith("video/") || /\.(mp4|webm|ogv|mov|mkv)$/i.test(name)) {
    return "video";
  }
  if (name.endsWith(".md") || name.endsWith(".markdown") || mime.includes("markdown")) {
    return "markdown";
  }
  if (name.endsWith(".log") || name.endsWith(".txt") || mime.startsWith("text/")) {
    return "text";
  }
  if (mime.startsWith("text/") || !mime) return "text";
  return "unknown";
}

/** Very small markdown → safe HTML (headings, bold, italic, code, links, lists, breaks). */
export function lightMarkdownToHtml(src) {
  const lines = String(src ?? "").split(/\r?\n/);
  const out = [];
  let inUl = false;
  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };
  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineMd(bullet[1])}</li>`);
      continue;
    }
    closeUl();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inlineMd(h[2])}</h${level}>`);
      continue;
    }
    if (!line.trim()) {
      out.push("<br/>");
      continue;
    }
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeUl();
  return out.join("\n");
}

function inlineMd(s) {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return t;
}

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
    throw lastErr || new Error("Failed to load pdf.js");
  })();
  return pdfjsLoadPromise;
}

function loadMammoth() {
  if (mammothLoadPromise) return mammothLoadPromise;
  if (typeof window.mammoth !== "undefined") {
    mammothLoadPromise = Promise.resolve(window.mammoth);
    return mammothLoadPromise;
  }
  mammothLoadPromise = (async () => {
    let last;
    for (const src of MAMMOTH_SOURCES) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.crossOrigin = "anonymous";
          s.referrerPolicy = "no-referrer";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("mammoth load failed: " + src));
          document.head.appendChild(s);
        });
        if (typeof window.mammoth !== "undefined") return window.mammoth;
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error("Failed to load mammoth for DOCX");
  })();
  return mammothLoadPromise;
}

export function openDocReader(wm, opts = {}) {
  const root = document.createElement("div");
  root.className = "doc-reader";
  root.innerHTML = `
    <div class="doc-reader-toolbar" role="toolbar" aria-label="Document reader">
      <label class="doc-reader-open">
        <span>Open</span>
        <input type="file" class="doc-file" accept="${ACCEPT}" aria-label="Open file" />
      </label>
      <span class="doc-reader-name dim" aria-live="polite">No file</span>
      <span class="doc-reader-kind dim"></span>
      <span class="doc-reader-status dim" role="status" aria-live="polite"></span>
      <span class="doc-reader-pdf-chrome" hidden>
        <button type="button" class="doc-btn" data-pdf="prev" aria-label="Previous page">◀</button>
        <span class="doc-page"><span class="doc-page-num">1</span> / <span class="doc-page-count">0</span></span>
        <button type="button" class="doc-btn" data-pdf="next" aria-label="Next page">▶</button>
        <button type="button" class="doc-btn" data-pdf="zoom-out" aria-label="Zoom out">−</button>
        <button type="button" class="doc-btn" data-pdf="zoom-in" aria-label="Zoom in">+</button>
      </span>
    </div>
    <div class="doc-reader-stage">
      <div class="doc-reader-empty dim">Open a PDF, Markdown, TXT, LOG, DOCX, image, audio, or video file. Files stay on this computer.</div>
    </div>
    <p class="doc-reader-foot dim">Reader · local files only · PDF.js ${PDFJS_VERSION} · mammoth for DOCX</p>`;

  const stage = root.querySelector(".doc-reader-stage");
  const status = root.querySelector(".doc-reader-status");
  const nameEl = root.querySelector(".doc-reader-name");
  const kindEl = root.querySelector(".doc-reader-kind");
  const fileIn = root.querySelector(".doc-file");
  const pdfChrome = root.querySelector(".doc-reader-pdf-chrome");
  const pageNumEl = root.querySelector(".doc-page-num");
  const pageCountEl = root.querySelector(".doc-page-count");

  let objectUrl = null;
  let pdfDoc = null;
  let pageNum = 1;
  let scale = 1.1;
  let renderTask = null;

  const setStatus = (msg) => {
    status.textContent = msg || "";
  };

  const revoke = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  const clearStage = () => {
    stage.innerHTML = "";
    pdfChrome.hidden = true;
  };

  const showEmpty = (msg) => {
    clearStage();
    const empty = document.createElement("div");
    empty.className = "doc-reader-empty dim";
    empty.textContent = msg || "Nothing to show.";
    stage.appendChild(empty);
  };

  const renderPdfPage = async (num) => {
    if (!pdfDoc) return;
    pageNum = Math.max(1, Math.min(num, pdfDoc.numPages));
    const canvas = stage.querySelector("canvas.doc-pdf-canvas");
    if (!canvas) return;
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
      let viewport = page.getViewport({ scale: 1 });
      const pad = 32;
      const fit = Math.max(0.25, (stage.clientWidth - pad) / viewport.width);
      scale = Math.max(scale, fit * 0.98);
      viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      renderTask = null;
      pageNumEl.textContent = String(pageNum);
      pageCountEl.textContent = String(pdfDoc.numPages);
      setStatus(`Page ${pageNum} / ${pdfDoc.numPages}`);
    } catch (e) {
      if (e?.name === "RenderingCancelledException") return;
      setStatus(e?.message || "PDF render failed");
    }
  };

  const openPdf = async (file) => {
    setStatus("Loading PDF.js…");
    const pdfjs = await loadPdfJs();
    if (pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch {
        /* ignore */
      }
      pdfDoc = null;
    }
    const buf = await file.arrayBuffer();
    pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    clearStage();
    pdfChrome.hidden = false;
    const wrap = document.createElement("div");
    wrap.className = "doc-pdf-wrap";
    const canvas = document.createElement("canvas");
    canvas.className = "doc-pdf-canvas";
    wrap.appendChild(canvas);
    stage.appendChild(wrap);
    pageNum = 1;
    scale = 1.1;
    await renderPdfPage(1);
  };

  const openTextish = async (file, kind) => {
    setStatus("Reading…");
    const text = await file.text();
    clearStage();
    if (kind === "markdown") {
      const article = document.createElement("article");
      article.className = "doc-md";
      article.innerHTML = lightMarkdownToHtml(text);
      stage.appendChild(article);
    } else {
      const pre = document.createElement("pre");
      pre.className = "doc-text";
      pre.textContent = text;
      stage.appendChild(pre);
    }
    setStatus(`${text.length.toLocaleString()} characters`);
  };

  const openDocx = async (file) => {
    setStatus("Loading DOCX converter…");
    const mammoth = await loadMammoth();
    const buf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
    clearStage();
    const article = document.createElement("article");
    article.className = "doc-docx";
    article.innerHTML = result.value || "<p><em>Empty document</em></p>";
    stage.appendChild(article);
    if (result.messages?.length) {
      setStatus(`DOCX opened · ${result.messages.length} converter note(s)`);
    } else {
      setStatus("DOCX opened");
    }
  };

  const openMedia = (file, kind) => {
    revoke();
    objectUrl = URL.createObjectURL(file);
    clearStage();
    if (kind === "image") {
      const img = document.createElement("img");
      img.className = "doc-image";
      img.alt = file.name;
      img.src = objectUrl;
      stage.appendChild(img);
    } else if (kind === "audio") {
      const audio = document.createElement("audio");
      audio.className = "doc-audio";
      audio.controls = true;
      audio.src = objectUrl;
      stage.appendChild(audio);
    } else {
      const video = document.createElement("video");
      video.className = "doc-video";
      video.controls = true;
      video.src = objectUrl;
      stage.appendChild(video);
    }
    setStatus(kind);
  };

  const openFile = async (file) => {
    if (!file) return;
    const kind = classifyReaderFile(file);
    nameEl.textContent = file.name;
    kindEl.textContent = kind;
    revoke();
    try {
      if (kind === "pdf") await openPdf(file);
      else if (kind === "docx") await openDocx(file);
      else if (kind === "markdown" || kind === "text") await openTextish(file, kind);
      else if (kind === "image" || kind === "audio" || kind === "video") openMedia(file, kind);
      else {
        showEmpty(`Unsupported type for “${file.name}”. Try PDF, MD, TXT, LOG, DOCX, or media.`);
        setStatus("Unsupported");
      }
    } catch (e) {
      showEmpty(e?.message || "Could not open file");
      setStatus(e?.message || "Open failed");
    }
  };

  fileIn.addEventListener("change", () => {
    const f = fileIn.files?.[0];
    if (f) openFile(f);
  });

  root.querySelector('[data-pdf="prev"]').addEventListener("click", () => {
    if (pageNum > 1) renderPdfPage(pageNum - 1);
  });
  root.querySelector('[data-pdf="next"]').addEventListener("click", () => {
    if (pdfDoc && pageNum < pdfDoc.numPages) renderPdfPage(pageNum + 1);
  });
  root.querySelector('[data-pdf="zoom-out"]').addEventListener("click", () => {
    scale = Math.max(0.4, scale - 0.15);
    renderPdfPage(pageNum);
  });
  root.querySelector('[data-pdf="zoom-in"]').addEventListener("click", () => {
    scale = Math.min(3, scale + 0.15);
    renderPdfPage(pageNum);
  });

  wm.open({
    id: "reader",
    title: "Reader",
    w: 720,
    h: 560,
    body: root,
    onClose: () => {
      revoke();
      if (pdfDoc) {
        try {
          pdfDoc.destroy();
        } catch {
          /* ignore */
        }
        pdfDoc = null;
      }
    },
  });

  if (opts.file) openFile(opts.file);
}
