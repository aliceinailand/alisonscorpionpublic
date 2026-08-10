/**
 * ASX Desktop window manager — thin glass terminal windows.
 * Pattern: Claude extract_01 WindowManager + CSS glass purple.
 */
export class WindowManager {
  constructor({ rootId = "windows-root", taskbarId = "taskbar-windows" } = {}) {
    this.root = document.getElementById(rootId);
    this.taskbar = document.getElementById(taskbarId);
    this.windows = new Map();
    this.z = 100;
    this._drag = null;
    this._resize = null;
    this._bindGlobal();
  }

  _bindGlobal() {
    document.addEventListener("mousemove", (e) => {
      if (this._drag) {
        const { el, ox, oy } = this._drag;
        if (el.classList.contains("maximized")) return;
        el.style.left = Math.max(0, e.clientX - ox) + "px";
        el.style.top = Math.max(0, e.clientY - oy) + "px";
      }
      if (this._resize) {
        const { el, sx, sy, sw, sh } = this._resize;
        el.style.width = Math.max(280, sw + (e.clientX - sx)) + "px";
        el.style.height = Math.max(180, sh + (e.clientY - sy)) + "px";
      }
    });
    document.addEventListener("mouseup", () => {
      this._drag = null;
      this._resize = null;
    });
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
    const w = opts.w ?? 640;
    const h = opts.h ?? 420;
    const x = opts.x ?? 60 + (this.windows.size % 6) * 28;
    const y = opts.y ?? 40 + (this.windows.size % 6) * 24;
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
    handle.style.cssText =
      "position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize;background:rgba(167,139,250,0.25);";

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

    titlebar.addEventListener("mousedown", (e) => {
      if (e.target.closest(".btn")) return;
      this.focus(id);
      this._drag = {
        el,
        ox: e.clientX - el.offsetLeft,
        oy: e.clientY - el.offsetTop,
      };
    });
    titlebar.addEventListener("dblclick", () => this.toggleMax(id));
    el.addEventListener("mousedown", () => this.focus(id));
    titlebar.querySelector(".btn-close").addEventListener("click", () => this.close(id));
    titlebar.querySelector(".btn-min").addEventListener("click", () => this.minimize(id));
    titlebar.querySelector(".btn-max").addEventListener("click", () => this.toggleMax(id));
    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      this.focus(id);
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
    // P1: skip full scan if already focused
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
