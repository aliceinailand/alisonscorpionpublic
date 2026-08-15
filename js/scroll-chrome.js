/**
 * Trackpad-style scroll chrome for Agent / Chat (ChatGPT-like stream).
 *
 * CDN assets (css from trackpad-scroll-emulator; JS rewritten vanilla):
 * https://cdnjs.com/libraries/trackpad-scroll-emulator
 *
 * The original plugin is jQuery-only. Free apps use JSLite policy (no jQuery),
 * so we implement the same structure + feel in vanilla JS and load the CSS
 * from cdnjs for the overlay scrollbar look.
 */

const TSE_VERSION = "1.0.8";
const TSE_CSS_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/trackpad-scroll-emulator/${TSE_VERSION}/trackpad-scroll-emulator.min.css`,
  `https://cdn.jsdelivr.net/npm/trackpad-scroll-emulator@${TSE_VERSION}/trackpad-scroll-emulator.min.css`,
];

/** @type {Promise<void>|null} */
let cssPromise = null;

export function ensureTrackpadScrollCss() {
  if (cssPromise) return cssPromise;
  const id = "asx-tse-css";
  if (document.getElementById(id)) {
    cssPromise = Promise.resolve();
    return cssPromise;
  }
  cssPromise = (async () => {
    for (const href of TSE_CSS_SOURCES) {
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
    // Local fallback styles live in asx-desktop.css (.tse-*)
  })();
  return cssPromise;
}

/**
 * Wrap an element for trackpad-style scrolling.
 * Expects: outer.tse-scrollable > (optional) .tse-content
 * Returns API: { content, scrollEl, recalculate, scrollToBottom, destroy }
 *
 * @param {HTMLElement} host  Empty or contains content to wrap
 * @param {{ autoHide?: boolean, className?: string }} [opts]
 */
export function attachTrackpadScroll(host, opts = {}) {
  if (!host) return null;
  const autoHide = opts.autoHide !== false;

  host.classList.add("tse-scrollable", "asx-tse");
  if (opts.className) host.classList.add(opts.className);

  // Build structure if missing
  let content = host.querySelector(":scope > .tse-content");
  let scrollEl = host.querySelector(":scope > .tse-scroll-content");

  if (!scrollEl) {
    scrollEl = document.createElement("div");
    scrollEl.className = "tse-scroll-content";
    if (content) {
      host.insertBefore(scrollEl, content);
      scrollEl.appendChild(content);
    } else {
      // Move existing children into content
      content = document.createElement("div");
      content.className = "tse-content";
      while (host.firstChild) content.appendChild(host.firstChild);
      scrollEl.appendChild(content);
      host.appendChild(scrollEl);
    }
  } else if (!content) {
    content = scrollEl.querySelector(".tse-content") || scrollEl;
    if (!content.classList.contains("tse-content")) {
      content.classList.add("tse-content");
    }
  }

  let scrollbar = host.querySelector(":scope > .tse-scrollbar");
  let handle;
  if (!scrollbar) {
    scrollbar = document.createElement("div");
    scrollbar.className = "tse-scrollbar";
    handle = document.createElement("div");
    handle.className = "drag-handle";
    scrollbar.appendChild(handle);
    host.insertBefore(scrollbar, host.firstChild);
  } else {
    handle = scrollbar.querySelector(".drag-handle");
  }

  let flashTimer = 0;
  let drag = null;

  const showHandle = () => {
    handle.classList.add("visible");
    if (autoHide) {
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => handle.classList.remove("visible"), 1000);
    }
  };

  const recalculate = () => {
    const ch = scrollEl.clientHeight;
    const sh = scrollEl.scrollHeight;
    if (sh <= ch + 2) {
      scrollbar.style.display = "none";
      return;
    }
    scrollbar.style.display = "";
    const ratio = ch / sh;
    const h = Math.max(24, Math.floor(ch * ratio));
    handle.style.height = h + "px";
    const maxTop = ch - h;
    const maxScroll = sh - ch;
    const top = maxScroll > 0 ? (scrollEl.scrollTop / maxScroll) * maxTop : 0;
    handle.style.top = Math.max(0, Math.min(maxTop, top)) + "px";
  };

  const onScroll = () => {
    recalculate();
    showHandle();
  };

  const onStartDrag = (e) => {
    e.preventDefault();
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    drag = {
      startY: y,
      startTop: parseFloat(handle.style.top) || 0,
    };
    handle.classList.add("visible");
    clearTimeout(flashTimer);
  };

  const onMove = (e) => {
    if (!drag) return;
    e.preventDefault();
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    const ch = scrollEl.clientHeight;
    const sh = scrollEl.scrollHeight;
    const h = handle.offsetHeight;
    const maxTop = Math.max(0, ch - h);
    const maxScroll = Math.max(0, sh - ch);
    let top = drag.startTop + (y - drag.startY);
    top = Math.max(0, Math.min(maxTop, top));
    handle.style.top = top + "px";
    if (maxTop > 0) scrollEl.scrollTop = (top / maxTop) * maxScroll;
  };

  const onEndDrag = () => {
    drag = null;
    if (autoHide) showHandle();
  };

  const onJump = (e) => {
    if (e.target === handle || handle.contains(e.target)) return;
    const rect = scrollbar.getBoundingClientRect();
    const y = (e.clientY ?? 0) - rect.top;
    const ch = scrollEl.clientHeight;
    const sh = scrollEl.scrollHeight;
    const h = handle.offsetHeight;
    const maxScroll = Math.max(0, sh - ch);
    const maxTop = Math.max(0, ch - h);
    const top = Math.max(0, Math.min(maxTop, y - h / 2));
    if (maxTop > 0) scrollEl.scrollTop = (top / maxTop) * maxScroll;
    recalculate();
    showHandle();
  };

  scrollEl.addEventListener("scroll", onScroll, { passive: true });
  handle.addEventListener("mousedown", onStartDrag);
  handle.addEventListener("touchstart", onStartDrag, { passive: false });
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEndDrag);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEndDrag);
  scrollbar.addEventListener("mousedown", onJump);
  if (autoHide) {
    host.addEventListener("mouseenter", showHandle);
  } else {
    handle.classList.add("visible");
  }

  // Resize observer when available
  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => recalculate());
    ro.observe(scrollEl);
    ro.observe(content);
  }

  recalculate();
  ensureTrackpadScrollCss();

  return {
    content,
    scrollEl,
    host,
    recalculate,
    scrollToBottom(smooth = true) {
      const top = scrollEl.scrollHeight;
      if (smooth && typeof scrollEl.scrollTo === "function") {
        scrollEl.scrollTo({ top, behavior: "smooth" });
      } else {
        scrollEl.scrollTop = top;
      }
      requestAnimationFrame(() => {
        recalculate();
        showHandle();
      });
    },
    destroy() {
      scrollEl.removeEventListener("scroll", onScroll);
      handle.removeEventListener("mousedown", onStartDrag);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEndDrag);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEndDrag);
      ro?.disconnect();
      clearTimeout(flashTimer);
    },
  };
}

/**
 * ChatGPT-like: stream text into a node while auto-scrolling (ASX “reading”).
 * @param {ReturnType<typeof attachTrackpadScroll>} tse
 * @param {HTMLElement} lineEl  element already in the stream
 * @param {string} fullText
 * @param {{ cps?: number, onDone?: () => void }} [opts]  chars per frame-ish
 */
export function streamTextInto(tse, lineEl, fullText, opts = {}) {
  const text = String(fullText ?? "");
  const cps = opts.cps ?? 3; // chars per tick
  let i = 0;
  lineEl.textContent = "";
  lineEl.classList.add("asx-streaming");

  return new Promise((resolve) => {
    const tick = () => {
      i = Math.min(text.length, i + cps);
      lineEl.textContent = text.slice(0, i);
      tse?.scrollToBottom(false);
      tse?.recalculate();
      if (i < text.length) {
        requestAnimationFrame(tick);
      } else {
        lineEl.classList.remove("asx-streaming");
        tse?.scrollToBottom(true);
        opts.onDone?.();
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Stream multiple status lines (Agent “scrolling through” tools/context).
 * @param {ReturnType<typeof attachTrackpadScroll>} tse
 * @param {HTMLElement} parent
 * @param {string[]} steps
 * @param {{ delayMs?: number }} [opts]
 */
export async function streamAgentSteps(tse, parent, steps, opts = {}) {
  const delay = opts.delayMs ?? 280;
  for (const step of steps) {
    const el = document.createElement("div");
    el.className = "agent-step dim";
    parent.appendChild(el);
    await streamTextInto(tse, el, step, { cps: 2 });
    await new Promise((r) => setTimeout(r, delay));
  }
}

export { TSE_VERSION };
