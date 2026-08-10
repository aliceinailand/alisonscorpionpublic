/**
 * ASX Desktop window manager — thin glass terminal windows.
 * Pattern: Claude extract_01 WindowManager + CSS glass purple.
 * Mobile: pointer events, default maximize, viewport clamp (2026-08-10).
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
  return {
    w: Math.max(280, window.innerWidth),
    h: Math.max(180, window.innerHeight - tb),
  };
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

    const titlebar = document.createElement("div");
    titlebar.className = "titlebar";
    titlebar.innerHTML = `
      <span class="title">▪ ${escapeHtml(opts.title)}</span>
      <div class="btns">
        <button type="button" class="btn btn-min" title="Minimize" aria-label="Minimize"></button>
        <button type="button" class="btn btn-max" title="Maximize" aria-label="Maximize"></button>
        <button type="button" class="btn btn-close" title="Close" aria-label="Close"></button>
      </div>`;

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
    titlebar.addEventListener("dblclick", () => this.toggleMax(id));
    el.addEventListener("pointerdown", () => this.focus(id));
    titlebar.querySelector(".btn-close").addEventListener("click", () => this.close(id));
    titlebar.querySelector(".btn-min").addEventListener("click", () => this.minimize(id));
    titlebar.querySelector(".btn-max").addEventListener("click", () => this.toggleMax(id));
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
  }

  minimize(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.classList.add("minimized");
    this._syncTaskbar(null);
  }

  restore(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.classList.remove("minimized");
    this.focus(id);
  }

  toggleMax(id) {
    const w = this.windows.get(id);
    if (!w) return;
    if (w.el.classList.contains("maximized")) {
      if (isMobileLayout()) {
        // On phones, stay maximized — restore to tiny float is poor UX
        return;
      }
      w.el.classList.remove("maximized");
      if (w.prevGeom) {
        Object.assign(w.el.style, w.prevGeom);
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
  }

  _addTaskbar(id, title) {
    if (!this.taskbar) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tb-item active";
    btn.dataset.tb = id;
    btn.textContent = title;
    btn.addEventListener("click", () => {
      const w = this.windows.get(id);
      if (!w) return;
      if (w.el.classList.contains("minimized")) this.restore(id);
      else if (w.el.classList.contains("active")) this.minimize(id);
      else this.focus(id);
    });
    this.taskbar.appendChild(btn);
  }

  _syncTaskbar(activeId) {
    if (!this.taskbar) return;
    this.taskbar.querySelectorAll(".tb-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.tb === activeId);
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
