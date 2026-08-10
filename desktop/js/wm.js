/**
 * ASX Desktop window manager — thin glass terminal windows.
 * Geometry is live-measured from #windows-root (no hardcoded screen sizes).
 * Side-by-side browser panes and phones both get smaller floating windows.
 */

/** Coarse pointer or narrow pane — for UX only, not geometry hardcodes */
function isMobileLayout() {
  const b = desktopBounds();
  const narrowPane = b.w > 0 && b.w / Math.max(window.innerWidth, 1) < 0.55;
  return (
    narrowPane ||
    (typeof matchMedia === "function" && matchMedia("(max-width: 768px)").matches) ||
    (typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches &&
      b.w <= 900)
  );
}

function taskbarOffset() {
  const tb = document.getElementById("taskbar");
  return tb ? tb.offsetHeight : 44;
}

/**
 * Live desktop work area only — measured, never assumed from a design resolution.
 */
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
 * Fit preferred (app design) size into *current* desktop bounds.
 * - Uses only fractions of measured bounds (no 1280/720/etc. breakpoints)
 * - Smaller pane → smaller window; leaves margin so × − □ and desktop stay usable
 */
function fitWindowGeom(prefW, prefH, prefX, prefY) {
  const b = desktopBounds();
  // Margin scales with pane (2% of shorter side, clamped)
  const margin = Math.round(
    Math.min(24, Math.max(6, Math.min(b.w, b.h) * 0.025))
  );
  const availW = Math.max(100, b.w - margin * 2);
  const availH = Math.max(80, b.h - margin * 2);

  // Design defaults only when app omits size — relative to avail, not a fixed monitor
  let w = Number(prefW);
  let h = Number(prefH);
  if (!(w > 0)) w = availW * 0.58;
  if (!(h > 0)) h = availH * 0.52;

  // Uniform scale-to-fit so aspect of preferred size is kept when possible
  const fitScale = Math.min(1, availW / w, availH / h);
  w = Math.floor(w * fitScale);
  h = Math.floor(h * fitScale);

  // Never dominate the whole guest desktop (icons + taskbar must remain)
  // Max cover tightens slightly as the pane gets relatively short/narrow (smooth, not stepped)
  const aspect = b.w / Math.max(b.h, 1);
  const tallNarrow = aspect < 0.85; // phone-ish
  const sidePane = aspect < 1.1 && b.w < window.innerWidth * 0.7; // split browser
  let maxCoverW = 0.92;
  let maxCoverH = 0.78;
  if (sidePane || tallNarrow) {
    maxCoverW = 0.9;
    maxCoverH = 0.7;
  }
  // Even tighter when window would cover almost everything
  if (w / availW > maxCoverW) w = Math.floor(availW * maxCoverW);
  if (h / availH > maxCoverH) h = Math.floor(availH * maxCoverH);

  // Readable minimums as fractions of this pane (not global pixel constants)
  const minW = Math.min(availW, Math.max(Math.floor(availW * 0.4), Math.min(180, availW)));
  const minH = Math.min(availH, Math.max(Math.floor(availH * 0.32), Math.min(140, availH)));
  w = Math.max(minW, Math.min(w, availW));
  h = Math.max(minH, Math.min(h, availH));

  let x = Number(prefX);
  let y = Number(prefY);
  if (!Number.isFinite(x)) x = margin + Math.floor(availW * 0.05);
  if (!Number.isFinite(y)) y = margin + Math.floor(availH * 0.05);

  // If the window is large relative to the pane, center it so controls stay in view
  const largeRel = w / b.w > 0.5 || h / b.h > 0.45;
  if (largeRel || sidePane || tallNarrow) {
    x = margin + Math.floor((availW - w) / 2);
    y = margin + Math.floor((availH - h) * 0.1);
  } else {
    x = Math.min(Math.max(margin, x), Math.max(margin, b.w - w - margin));
    y = Math.min(Math.max(margin, y), Math.max(margin, b.h - h - margin));
  }

  return { w, h, x, y, bounds: b };
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
      }
      if (this._resize) {
        const { el, sx, sy, sw, sh } = this._resize;
        const b = desktopBounds();
        const minW = isMobileLayout() ? Math.min(280, b.w) : 280;
        const minH = isMobileLayout() ? Math.min(180, b.h) : 180;
        el.style.width = Math.min(b.w, Math.max(minW, sw + (cx - sx))) + "px";
        el.style.height = Math.min(b.h, Math.max(minH, sh + (cy - sy))) + "px";
      }
    };
    const onUp = () => {
      this._drag = null;
      this._resize = null;
    };
    // Pointer events: mouse + touch + pen (mobile-friendly)
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  _clampAll() {
    for (const w of this.windows.values()) {
      if (w.el.classList.contains("minimized")) continue;
      // Maximized stays CSS 100%; skip
      if (w.el.classList.contains("maximized")) continue;

      const prefW = w.prefW || parseInt(w.el.style.width, 10) || 640;
      const prefH = w.prefH || parseInt(w.el.style.height, 10) || 420;
      const prefX = parseInt(w.el.style.left, 10);
      const prefY = parseInt(w.el.style.top, 10);
      const g = fitWindowGeom(
        prefW,
        prefH,
        Number.isFinite(prefX) ? prefX : undefined,
        Number.isFinite(prefY) ? prefY : undefined
      );
      w.el.style.width = g.w + "px";
      w.el.style.height = g.h + "px";
      w.el.style.left = g.x + "px";
      w.el.style.top = g.y + "px";
      // Keep prevGeom in sync if user had restored from max
      if (w.prevGeom && !w.el.classList.contains("maximized")) {
        w.prevGeom = {
          left: g.x + "px",
          top: g.y + "px",
          width: g.w + "px",
          height: g.h + "px",
        };
      }
    }
  }

  _notifyWindowsOpen() {
    const n = [...this.windows.values()].filter(
      (w) => !w.el.classList.contains("minimized")
    ).length;
    document.body.classList.toggle("asx-window-open", n > 0);
    document.body.classList.toggle("asx-narrow", isMobileLayout());
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
      this.focus(id);
      const w = this.windows.get(id);
      w.el.classList.remove("minimized");
      return w;
    }

    const el = document.createElement("div");
    el.className = "asx-window active";
    el.dataset.winId = id;
    const mobile = isMobileLayout();
    // Preferred design size (apps pass 640×420 etc.) — shrink to fit viewport
    const prefW = opts.w ?? 640;
    const prefH = opts.h ?? 420;
    const prefX = opts.x ?? 60 + (this.windows.size % 6) * 28;
    const prefY = opts.y ?? 40 + (this.windows.size % 6) * 24;
    const g = fitWindowGeom(prefW, prefH, prefX, prefY);
    // Do NOT auto-maximize on mobile — user asked windows to get smaller with screen
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
    titlebar.innerHTML = `
      <div class="btns" role="toolbar" aria-label="Window controls">
        <button type="button" class="btn btn-close" title="Close" aria-label="Close window">×</button>
        <button type="button" class="btn btn-min" title="Minimize" aria-label="Minimize">−</button>
        <button type="button" class="btn btn-max" title="Maximize / restore" aria-label="Maximize or restore">□</button>
      </div>
      <span class="title">▪ ${escapeHtml(opts.title)}</span>`;

    const body = document.createElement("div");
    body.className = "win-body";
    if (typeof opts.body === "string") body.innerHTML = opts.body;
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

    const stopBtn = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };

    titlebar.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".btn")) return;
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
    el.addEventListener("pointerdown", () => this.focus(id));

    const btnClose = titlebar.querySelector(".btn-close");
    const btnMin = titlebar.querySelector(".btn-min");
    const btnMax = titlebar.querySelector(".btn-max");
    // pointerup + click for reliable mobile hit (empty hit areas were too small)
    const bindBtn = (btn, fn) => {
      btn.addEventListener("pointerdown", stopBtn);
      btn.addEventListener("pointerup", (e) => {
        stopBtn(e);
        fn();
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
    // Auto-collapse SEO panel when a window opens on narrow viewports
    if (mobile || g.bounds.w < 720) {
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
    } else {
      w.prevGeom = {
        left: w.el.style.left,
        top: w.el.style.top,
        width: w.el.style.width,
        height: w.el.style.height,
      };
      w.el.classList.add("maximized");
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
