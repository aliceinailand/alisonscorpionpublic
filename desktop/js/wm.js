/**
 * ASX Desktop window manager — thin glass terminal windows.
 * Pattern: Claude extract_01 WindowManager + CSS glass purple.
 * Windows shrink with viewport (not forced full-screen on narrow).
 */

function isMobileLayout() {
  return (
    (typeof matchMedia === "function" && matchMedia("(max-width: 768px)").matches) ||
    (typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches &&
      window.innerWidth <= 900)
  );
}

function taskbarOffset() {
  const tb = document.getElementById("taskbar");
  return tb ? tb.offsetHeight : 44;
}

function desktopBounds() {
  const tb = taskbarOffset();
  const root = document.getElementById("windows-root");
  if (root) {
    const r = root.getBoundingClientRect();
    if (r.width > 40 && r.height > 40) {
      return { w: Math.floor(r.width), h: Math.floor(r.height) };
    }
  }
  return {
    w: Math.max(200, window.innerWidth),
    h: Math.max(160, window.innerHeight - tb),
  };
}

/**
 * Fit preferred window size into current viewport.
 * Smaller screens → smaller windows (with margins so chrome stays usable).
 */
function fitWindowGeom(prefW, prefH, prefX, prefY) {
  const b = desktopBounds();
  const margin = b.w < 480 ? 8 : b.w < 900 ? 12 : 16;
  const maxW = Math.max(160, b.w - margin * 2);
  const maxH = Math.max(140, b.h - margin * 2);

  let w = Number(prefW) || 640;
  let h = Number(prefH) || 420;

  // Cap to available area
  w = Math.min(w, maxW);
  h = Math.min(h, maxH);

  // Progressive shrink: window becomes a fraction of the screen as width drops
  if (b.w <= 1280) {
    const t = Math.min(1, Math.max(0, (1280 - b.w) / 960)); // 0 at 1280, 1 at 320
    const maxFracW = 0.96 - t * 0.04; // 0.96 → 0.92
    const maxFracH = 0.88 - t * 0.2; // 0.88 → 0.68 (leave desktop/taskbar visible)
    w = Math.min(w, Math.floor(b.w * maxFracW) - margin);
    h = Math.min(h, Math.floor(b.h * maxFracH));
  }

  // Hard floors that still fit
  w = Math.max(Math.min(200, maxW), Math.min(w, maxW));
  h = Math.max(Math.min(160, maxH), Math.min(h, maxH));

  let x = Number(prefX);
  let y = Number(prefY);
  if (!Number.isFinite(x)) x = margin + 40;
  if (!Number.isFinite(y)) y = margin + 28;

  // Keep fully on-screen
  x = Math.min(Math.max(margin, x), Math.max(margin, b.w - w - margin));
  y = Math.min(Math.max(margin, y), Math.max(margin, b.h - h - margin));

  // Center horizontally on narrow viewports
  if (b.w < 720) {
    x = Math.max(margin, Math.floor((b.w - w) / 2));
    y = Math.max(margin, Math.min(y, Math.floor(b.h * 0.08)));
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
    const b = desktopBounds();
    for (const w of this.windows.values()) {
      if (w.el.classList.contains("minimized")) continue;
      // Maximized: only ensure class geometry via CSS; do not re-force max on every resize
      if (w.el.classList.contains("maximized")) continue;
      const rect = w.el.getBoundingClientRect();
      let width = Math.min(Math.max(rect.width, 200), b.w);
      let height = Math.min(Math.max(rect.height, 140), b.h);
      let left = Math.min(Math.max(0, rect.left), Math.max(0, b.w - 48));
      let top = Math.min(Math.max(0, rect.top), Math.max(0, b.h - 32));
      w.el.style.width = width + "px";
      w.el.style.height = height + "px";
      w.el.style.left = left + "px";
      w.el.style.top = top + "px";
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
    const b = desktopBounds();
    const mobile = isMobileLayout();
    let w = opts.w ?? 640;
    let h = opts.h ?? 420;
    let x = opts.x ?? 60 + (this.windows.size % 6) * 28;
    let y = opts.y ?? 40 + (this.windows.size % 6) * 24;

    if (mobile) {
      w = b.w;
      h = b.h;
      x = 0;
      y = 0;
      el.classList.add("maximized");
    } else {
      w = Math.min(w, b.w - 16);
      h = Math.min(h, b.h - 16);
      x = Math.min(x, Math.max(0, b.w - w));
      y = Math.min(y, Math.max(0, b.h - h));
    }

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
    if (mobile) {
      const seo = document.getElementById("seo-main");
      if (seo && !seo.classList.contains("seo-minimized")) {
        seo.classList.add("seo-minimized");
        const b = document.getElementById("seo-minimize");
        if (b) b.textContent = "Expand about";
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
    const b = desktopBounds();
    if (w.el.classList.contains("maximized")) {
      // Always allow restore — including narrow (user was stuck before)
      w.el.classList.remove("maximized");
      if (w.prevGeom) {
        Object.assign(w.el.style, w.prevGeom);
      } else if (isMobileLayout()) {
        // Sensible nearly-full restore on narrow
        w.el.style.left = "8px";
        w.el.style.top = "8px";
        w.el.style.width = Math.max(240, b.w - 16) + "px";
        w.el.style.height = Math.max(200, b.h - 16) + "px";
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
