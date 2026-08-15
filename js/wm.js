/**
 * ASX Desktop window manager — thin glass terminal windows.
 * Geometry is live-measured from #windows-root (no hardcoded screen sizes).
 * Positions/sizes persist in localStorage (guest session layout memory).
 *
 * Two modes (not a bug — product split):
 * - Phone / small pane: single-focus; large fitted windows OK (stack)
 * - Desktop: multi-window — cascade + smaller footprint so several work at once
 *
 * HTML string bodies are run through DOMPurify (js/sanitize.js) before insert.
 */

import { sanitizeHtml, escapeHtml } from "./sanitize.js?v=20260810t360000z";
import { showMenu } from "./menus.js?v=20260815t220000z";

const GEOM_STORAGE_KEY = "asx-wm-geom-v1";

function loadGeomStore() {
  try {
    const raw = localStorage.getItem(GEOM_STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function saveGeomStore(store) {
  try {
    localStorage.setItem(GEOM_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

/** @returns {{ x?: number, y?: number, w?: number, h?: number, max?: boolean } | null} */
function readSavedGeom(id) {
  const s = loadGeomStore()[id];
  if (!s || typeof s !== "object") return null;
  const out = {};
  if (Number.isFinite(s.w) && s.w > 40) out.w = Math.floor(s.w);
  if (Number.isFinite(s.h) && s.h > 40) out.h = Math.floor(s.h);
  if (Number.isFinite(s.x)) out.x = Math.floor(s.x);
  if (Number.isFinite(s.y)) out.y = Math.floor(s.y);
  if (s.max) out.max = true;
  return out.w || out.h || Number.isFinite(out.x) ? out : null;
}

function persistGeom(id, el, extras = {}) {
  if (!id || !el || el.classList.contains("maximized")) {
    if (id && el?.classList.contains("maximized")) {
      const store = loadGeomStore();
      const prev = store[id] || {};
      store[id] = { ...prev, max: true };
      saveGeomStore(store);
    }
    return;
  }
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const x = parseInt(el.style.left, 10);
  const y = parseInt(el.style.top, 10);
  if (!(w > 40 && h > 40)) return;
  const store = loadGeomStore();
  store[id] = {
    w,
    h,
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    max: false,
    ...extras,
    t: Date.now(),
  };
  saveGeomStore(store);
}

/** Live work area — measured, never assumed from a design resolution. */
function desktopBounds() {
  const tb = taskbarOffset();
  const root = document.getElementById("windows-root");
  if (root) {
    const r = root.getBoundingClientRect();
    if (r.width > 40 && r.height > 40) {
      return { w: Math.floor(r.width), h: Math.floor(r.height) };
    }
  }
  const vw = window.visualViewport?.width || window.innerWidth || 0;
  const vh = window.visualViewport?.height || window.innerHeight || 0;
  return {
    w: Math.max(120, Math.floor(vw || document.documentElement.clientWidth || 320)),
    h: Math.max(100, Math.floor((vh || document.documentElement.clientHeight || 480) - tb)),
  };
}

/**
 * Phone-like / crowded single-focus pane.
 * (Side-by-side browser strip or true mobile — not a defect.)
 */
function isPhoneLayout() {
  const b = desktopBounds();
  const shareOfBrowser = b.w / Math.max(window.innerWidth, 1);
  const aspect = b.w / Math.max(b.h, 1);
  return (
    shareOfBrowser < 0.55 ||
    aspect < 0.9 ||
    (typeof matchMedia === "function" && matchMedia("(max-width: 768px)").matches) ||
    (typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches &&
      shareOfBrowser < 0.85)
  );
}

/** Alias used elsewhere */
function isMobileLayout() {
  return isPhoneLayout();
}

/** True multi-window desktop: enough room to see two windows at once */
function isDesktopMultiLayout() {
  const b = desktopBounds();
  return !isPhoneLayout() && b.w >= 640 && b.h >= 420;
}

function taskbarOffset() {
  const tb = document.getElementById("taskbar");
  return tb ? tb.offsetHeight : 44;
}

/**
 * Fit preferred (app design) size into *current* desktop bounds.
 * @param {number} [stackIndex] — open-window index for desktop cascade (multi-window)
 */
function fitWindowGeom(prefW, prefH, prefX, prefY, stackIndex = 0) {
  const b = desktopBounds();
  const phone = isPhoneLayout();
  const multi = isDesktopMultiLayout();
  const margin = Math.round(
    Math.min(24, Math.max(6, Math.min(b.w, b.h) * 0.025))
  );
  const availW = Math.max(100, b.w - margin * 2);
  const availH = Math.max(80, b.h - margin * 2);

  let w = Number(prefW);
  let h = Number(prefH);
  if (!(w > 0)) w = availW * (multi ? 0.48 : 0.58);
  if (!(h > 0)) h = availH * (multi ? 0.48 : 0.52);

  const fitScale = Math.min(1, availW / w, availH / h);
  w = Math.floor(w * fitScale);
  h = Math.floor(h * fitScale);

  // Phone / small pane: large single-focus float is OK (stacked = expected)
  // Desktop multi: leave room so two windows can both be visible
  let maxCoverW = multi ? 0.58 : phone ? 0.9 : 0.85;
  let maxCoverH = multi ? 0.58 : phone ? 0.72 : 0.75;
  // Second+ window on desktop: slightly smaller so cascade peeks through
  if (multi && stackIndex > 0) {
    maxCoverW = Math.min(maxCoverW, 0.52);
    maxCoverH = Math.min(maxCoverH, 0.52);
  }
  if (w / availW > maxCoverW) w = Math.floor(availW * maxCoverW);
  if (h / availH > maxCoverH) h = Math.floor(availH * maxCoverH);

  const minW = Math.min(availW, Math.max(Math.floor(availW * (multi ? 0.28 : 0.4)), Math.min(180, availW)));
  const minH = Math.min(availH, Math.max(Math.floor(availH * (multi ? 0.25 : 0.32)), Math.min(140, availH)));
  w = Math.max(minW, Math.min(w, availW));
  h = Math.max(minH, Math.min(h, availH));

  // Cascade step (desktop multi-window) — fractions of pane, not fixed pixels
  const step = multi
    ? Math.max(18, Math.floor(Math.min(b.w, b.h) * 0.028))
    : 0;
  const cascade = (Number(stackIndex) || 0) * step;

  let x = Number(prefX);
  let y = Number(prefY);
  if (!Number.isFinite(x)) x = margin + Math.floor(availW * 0.05) + cascade;
  else x = x + cascade;
  if (!Number.isFinite(y)) y = margin + Math.floor(availH * 0.05) + cascade;
  else y = y + cascade;

  if (phone) {
    // Single-focus: center large float
    x = margin + Math.floor((availW - w) / 2);
    y = margin + Math.floor((availH - h) * 0.1);
  } else if (multi) {
    // Keep cascade on-screen; wrap cascade if it would overflow
    const maxX = Math.max(margin, b.w - w - margin);
    const maxY = Math.max(margin, b.h - h - margin);
    if (x > maxX || y > maxY) {
      const wrap = (stackIndex % 5) * step;
      x = margin + wrap;
      y = margin + wrap;
    }
    x = Math.min(Math.max(margin, x), maxX);
    y = Math.min(Math.max(margin, y), maxY);
  } else {
    x = Math.min(Math.max(margin, x), Math.max(margin, b.w - w - margin));
    y = Math.min(Math.max(margin, y), Math.max(margin, b.h - h - margin));
  }

  return { w, h, x, y, bounds: b, phone, multi };
}

export class WindowManager {
  constructor({ rootId = "windows-root", taskbarId = "taskbar-windows" } = {}) {
    this.root = document.getElementById(rootId);
    this.taskbar = document.getElementById(taskbarId);
    this.windows = new Map();
    this.z = 100;
    this._drag = null;
    this._resize = null;
    this._bindGlobal();
    window.addEventListener("resize", () => this._clampAll());
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this._clampAll(), 100);
    });
  }

  _bindGlobal() {
    const onMove = (e) => {
      const cx = e.clientX;
      const cy = e.clientY;
      if (this._drag) {
        const { el, ox, oy } = this._drag;
        if (el.classList.contains("maximized")) return;
        const b = desktopBounds();
        const left = Math.min(Math.max(0, cx - ox), Math.max(0, b.w - 48));
        const top = Math.min(Math.max(0, cy - oy), Math.max(0, b.h - 32));
        el.style.left = left + "px";
        el.style.top = top + "px";
        this._drag.moved = true;
      }
      if (this._resize) {
        const { el, sx, sy, sw, sh } = this._resize;
        const b = desktopBounds();
        const minW = Math.min(b.w, Math.max(140, Math.floor(b.w * 0.28)));
        const minH = Math.min(b.h, Math.max(120, Math.floor(b.h * 0.22)));
        el.style.width = Math.min(b.w - 8, Math.max(minW, sw + (cx - sx))) + "px";
        el.style.height = Math.min(b.h - 8, Math.max(minH, sh + (cy - sy))) + "px";
        this._resize.moved = true;
      }
    };
    const onUp = () => {
      // Persist layout after drag / resize (guest remembers window placement)
      if (this._drag?.moved && this._drag.el) {
        const id = this._drag.el.dataset.winId;
        if (id) {
          persistGeom(id, this._drag.el);
          const w = this.windows.get(id);
          if (w) {
            w.prefW = this._drag.el.offsetWidth;
            w.prefH = this._drag.el.offsetHeight;
          }
        }
      }
      if (this._resize?.moved && this._resize.el) {
        const id = this._resize.el.dataset.winId;
        if (id) {
          persistGeom(id, this._resize.el);
          const w = this.windows.get(id);
          if (w) {
            w.prefW = this._resize.el.offsetWidth;
            w.prefH = this._resize.el.offsetHeight;
          }
        }
      }
      this._drag = null;
      this._resize = null;
    };
    // Pointer events: mouse + touch + pen (mobile-friendly)
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  _openStackIndex() {
    return [...this.windows.values()].filter(
      (w) => !w.el.classList.contains("minimized")
    ).length;
  }

  _clampAll() {
    let i = 0;
    for (const w of this.windows.values()) {
      if (w.el.classList.contains("minimized")) continue;
      if (w.el.classList.contains("maximized")) continue;

      const prefW = w.prefW || parseInt(w.el.style.width, 10) || 640;
      const prefH = w.prefH || parseInt(w.el.style.height, 10) || 420;
      // Keep user's drag position; only re-fit size (stackIndex 0 to avoid re-cascade jumps)
      const prefX = parseInt(w.el.style.left, 10);
      const prefY = parseInt(w.el.style.top, 10);
      const g = fitWindowGeom(
        prefW,
        prefH,
        Number.isFinite(prefX) ? prefX : undefined,
        Number.isFinite(prefY) ? prefY : undefined,
        0
      );
      w.el.style.width = g.w + "px";
      w.el.style.height = g.h + "px";
      // Clamp position into bounds without recentering cascade
      const b = g.bounds;
      const margin = 6;
      let x = Number.isFinite(prefX) ? prefX : g.x;
      let y = Number.isFinite(prefY) ? prefY : g.y;
      x = Math.min(Math.max(margin, x), Math.max(margin, b.w - g.w - margin));
      y = Math.min(Math.max(margin, y), Math.max(margin, b.h - g.h - margin));
      w.el.style.left = x + "px";
      w.el.style.top = y + "px";
      if (w.prevGeom && !w.el.classList.contains("maximized")) {
        w.prevGeom = {
          left: x + "px",
          top: y + "px",
          width: g.w + "px",
          height: g.h + "px",
        };
      }
      i += 1;
    }
  }

  _notifyWindowsOpen() {
    const n = this._openStackIndex();
    document.body.classList.toggle("asx-window-open", n > 0);
    document.body.classList.toggle("asx-narrow", isPhoneLayout());
    document.body.classList.toggle("asx-desktop-multi", isDesktopMultiLayout());
  }

  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.title
   * @param {HTMLElement|string} opts.body
   * @param {number} [opts.w]
   * @param {number} [opts.h]
   * @param {number} [opts.x]
   * @param {number} [opts.y]
   * @param {Function} [opts.onMount]
   * @param {Function} [opts.onClose]
   */
  open(opts) {
    const id = opts.id;
    if (this.windows.has(id)) {
      const w = this.windows.get(id);
      // Same-window place navigation: swap body/title instead of stacking windows
      if (opts.replace) {
        w.body.replaceChildren();
        if (typeof opts.body === "string") w.body.innerHTML = sanitizeHtml(opts.body);
        else if (opts.body instanceof HTMLElement) w.body.appendChild(opts.body);
        if (opts.title) {
          w.title = opts.title;
          const tEl = w.el.querySelector(".title");
          if (tEl) tEl.textContent = "▪ " + opts.title;
          const tbBtn = this.taskbar?.querySelector(
            `[data-tb="${CSS.escape(id)}"] .tb-item`
          );
          if (tbBtn) {
            tbBtn.textContent = opts.title;
            tbBtn.title = opts.title;
          }
          const tbClose = this.taskbar?.querySelector(
            `[data-tb="${CSS.escape(id)}"] .tb-close`
          );
          if (tbClose) {
            tbClose.setAttribute("aria-label", `Close ${opts.title}`);
          }
        }
        if (typeof opts.onClose === "function") w.onClose = opts.onClose;
        w.el.classList.remove("minimized");
        this.focus(id);
        if (typeof opts.onMount === "function") opts.onMount(w.body, w);
        return w;
      }
      this.focus(id);
      w.el.classList.remove("minimized");
      return w;
    }

    const el = document.createElement("div");
    el.className = "asx-window active";
    el.dataset.winId = id;
    const mobile = isPhoneLayout();
    const stackIndex = this._openStackIndex();
    // Restore last position/size from localStorage when present
    const saved = readSavedGeom(id);
    // Preferred design size (apps pass 640×420 etc.) — shrink to fit + cascade on desktop
    // Saved geom skips cascade so layout memory is stable across sessions
    const prefW = saved?.w ?? opts.w ?? 640;
    const prefH = saved?.h ?? opts.h ?? 420;
    const prefX = saved && Number.isFinite(saved.x) ? saved.x : opts.x;
    const prefY = saved && Number.isFinite(saved.y) ? saved.y : opts.y;
    const stackForFit =
      saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? 0 : stackIndex;
    const g = fitWindowGeom(prefW, prefH, prefX, prefY, stackForFit);
    // Phone: large single-focus float OK. Desktop: multi-window cascade (not a bug).
    const w = g.w;
    const h = g.h;
    const x = g.x;
    const y = g.y;

    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.zIndex = String(++this.z);

    // Controls first (left) so extreme-narrow never clips them off the right edge
    const titlebar = document.createElement("div");
    titlebar.className = "titlebar";
    titlebar.innerHTML = sanitizeHtml(`
      <div class="btns win-controls" role="toolbar" aria-label="Window controls">
        <button type="button" class="btn btn-close" title="Close" aria-label="Close window">×</button>
        <button type="button" class="btn btn-min" title="Minimize" aria-label="Minimize">−</button>
        <button type="button" class="btn btn-max" title="Maximize / restore" aria-label="Maximize or restore">□</button>
      </div>
      <span class="title">▪ ${escapeHtml(opts.title)}</span>`);

    const body = document.createElement("div");
    body.className = "win-body";
    if (typeof opts.body === "string") body.innerHTML = sanitizeHtml(opts.body);
    else if (opts.body instanceof HTMLElement) body.appendChild(opts.body);

    const handle = document.createElement("div");
    handle.className = "resize-handle";
    handle.setAttribute("aria-hidden", "true");

    el.appendChild(titlebar);
    el.appendChild(body);
    el.appendChild(handle);
    this.root.appendChild(el);

    const rec = {
      id,
      title: opts.title,
      el,
      body,
      onClose: opts.onClose,
      prevGeom: null,
      prefW,
      prefH,
    };
    this.windows.set(id, rec);

    titlebar.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".btn, .win-controls, .asx-menubar, .asx-menu")) return;
      if (e.button != null && e.button !== 0) return;
      this.focus(id);
      if (el.classList.contains("maximized")) return;
      try {
        titlebar.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this._drag = {
        el,
        ox: e.clientX - el.offsetLeft,
        oy: e.clientY - el.offsetTop,
      };
    });
    titlebar.addEventListener("dblclick", (e) => {
      if (e.target.closest(".btn")) return;
      this.toggleMax(id);
    });
    titlebar.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const maxed = el.classList.contains("maximized");
      showMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: maxed ? "Restore" : "Maximize", action: () => this.toggleMax(id) },
          { label: "Minimize", action: () => this.minimize(id) },
          { sep: true },
          { label: "Close", kbd: "Alt+F4", action: () => this.close(id) },
        ],
      });
    });
    el.addEventListener("pointerdown", () => this.focus(id));

    const btnClose = titlebar.querySelector(".btn-close");
    const btnMin = titlebar.querySelector(".btn-min");
    const btnMax = titlebar.querySelector(".btn-max");
    // One action per tap. preventDefault on pointerdown was killing click;
    // pointerup+click together made maximize toggle twice (looked broken).
    const bindBtn = (btn, fn) => {
      if (!btn) return;
      btn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
      });
    };
    bindBtn(btnClose, () => this.close(id));
    bindBtn(btnMin, () => this.minimize(id));
    bindBtn(btnMax, () => this.toggleMax(id));

    handle.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (el.classList.contains("maximized")) return;
      this.focus(id);
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this._resize = {
        el,
        sx: e.clientX,
        sy: e.clientY,
        sw: el.offsetWidth,
        sh: el.offsetHeight,
      };
    });

    this._addTaskbar(id, opts.title);
    this.focus(id);
    this._notifyWindowsOpen();
    // Restore maximized state from last session
    if (saved?.max && !mobile) {
      rec.prevGeom = {
        left: x + "px",
        top: y + "px",
        width: w + "px",
        height: h + "px",
      };
      el.classList.add("maximized");
      this._syncMaxButton(id);
    } else {
      // Remember fitted open geometry so next visit starts here
      persistGeom(id, el);
    }
    // Auto-collapse SEO when window is large relative to *this* pane (side-by-side or phone)
    const paneCrowded = g.w / g.bounds.w > 0.45 || g.bounds.w / Math.max(window.innerWidth, 1) < 0.6;
    if (mobile || paneCrowded) {
      const seo = document.getElementById("seo-main");
      if (seo && !seo.classList.contains("seo-minimized")) {
        seo.classList.add("seo-minimized");
        const btn = document.getElementById("seo-minimize");
        if (btn) btn.textContent = "Expand about";
      }
    }
    if (typeof opts.onMount === "function") opts.onMount(body, rec);
    return rec;
  }

  focus(id) {
    const w = this.windows.get(id);
    if (!w) return;
    if (w.el.classList.contains("active") && !w.el.classList.contains("minimized")) {
      w.el.style.zIndex = String(++this.z);
      this._syncTaskbar(id);
      return;
    }
    for (const other of this.windows.values()) other.el.classList.remove("active");
    w.el.classList.add("active");
    w.el.style.zIndex = String(++this.z);
    this._syncTaskbar(id);
  }

  close(id) {
    const w = this.windows.get(id);
    if (!w) return;
    // Save last geometry before destroy (incl. maximized flag)
    if (w.el.classList.contains("maximized") && w.prevGeom) {
      const store = loadGeomStore();
      store[id] = {
        w: parseInt(w.prevGeom.width, 10) || w.prefW || 640,
        h: parseInt(w.prevGeom.height, 10) || w.prefH || 420,
        x: parseInt(w.prevGeom.left, 10) || 0,
        y: parseInt(w.prevGeom.top, 10) || 0,
        max: true,
        t: Date.now(),
      };
      saveGeomStore(store);
    } else {
      persistGeom(id, w.el);
    }
    if (typeof w.onClose === "function") w.onClose();
    w.el.remove();
    this.windows.delete(id);
    const tb = this.taskbar?.querySelector(`[data-tb="${CSS.escape(id)}"]`);
    if (tb) tb.remove();
    this._notifyWindowsOpen();
  }

  minimize(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.classList.add("minimized");
    this._syncTaskbar(null);
    this._notifyWindowsOpen();
  }

  restore(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.classList.remove("minimized");
    this.focus(id);
    this._notifyWindowsOpen();
  }

  toggleMax(id) {
    const w = this.windows.get(id);
    if (!w) return;
    if (w.el.classList.contains("maximized")) {
      w.el.classList.remove("maximized");
      if (w.prevGeom) {
        // Re-fit stored geometry to current viewport
        const g = fitWindowGeom(
          parseInt(w.prevGeom.width, 10) || w.prefW || 640,
          parseInt(w.prevGeom.height, 10) || w.prefH || 420,
          parseInt(w.prevGeom.left, 10),
          parseInt(w.prevGeom.top, 10)
        );
        w.el.style.left = g.x + "px";
        w.el.style.top = g.y + "px";
        w.el.style.width = g.w + "px";
        w.el.style.height = g.h + "px";
      } else {
        const g = fitWindowGeom(w.prefW || 640, w.prefH || 420);
        w.el.style.left = g.x + "px";
        w.el.style.top = g.y + "px";
        w.el.style.width = g.w + "px";
        w.el.style.height = g.h + "px";
      }
      persistGeom(id, w.el);
    } else {
      w.prevGeom = {
        left: w.el.style.left,
        top: w.el.style.top,
        width: w.el.style.width,
        height: w.el.style.height,
      };
      w.el.classList.add("maximized");
      const store = loadGeomStore();
      store[id] = {
        ...(store[id] || {}),
        w: parseInt(w.prevGeom.width, 10) || w.prefW || 640,
        h: parseInt(w.prevGeom.height, 10) || w.prefH || 420,
        x: parseInt(w.prevGeom.left, 10) || 0,
        y: parseInt(w.prevGeom.top, 10) || 0,
        max: true,
        t: Date.now(),
      };
      saveGeomStore(store);
    }
    this._syncMaxButton(id);
  }

  _syncMaxButton(id) {
    const w = this.windows.get(id);
    if (!w) return;
    const maxBtn = w.el.querySelector(".btn-max");
    if (!maxBtn) return;
    const maxed = w.el.classList.contains("maximized");
    maxBtn.textContent = maxed ? "❐" : "□";
    maxBtn.setAttribute("aria-label", maxed ? "Restore window" : "Maximize window");
    maxBtn.title = maxed ? "Restore" : "Maximize";
  }

  _addTaskbar(id, title) {
    if (!this.taskbar) return;
    const wrap = document.createElement("div");
    wrap.className = "tb-win";
    wrap.dataset.tb = id;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tb-item active";
    btn.textContent = title;
    btn.title = title;
    btn.addEventListener("click", () => {
      const w = this.windows.get(id);
      if (!w) return;
      if (w.el.classList.contains("minimized")) this.restore(id);
      else if (w.el.classList.contains("active")) this.minimize(id);
      else this.focus(id);
    });

    // Always-visible close on taskbar (extreme narrow escape hatch)
    const x = document.createElement("button");
    x.type = "button";
    x.className = "tb-close";
    x.setAttribute("aria-label", `Close ${title}`);
    x.title = "Close";
    x.textContent = "×";
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close(id);
    });

    wrap.appendChild(btn);
    wrap.appendChild(x);
    this.taskbar.appendChild(wrap);
  }

  _syncTaskbar(activeId) {
    if (!this.taskbar) return;
    this.taskbar.querySelectorAll(".tb-win").forEach((wrap) => {
      const active = wrap.dataset.tb === activeId;
      wrap.classList.toggle("active", active);
      wrap.querySelector(".tb-item")?.classList.toggle("active", active);
    });
  }
}
