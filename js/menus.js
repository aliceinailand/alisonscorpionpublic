/**
 * ASX native-style menus — File / Edit / View dropdowns and right-click
 * context menus. Options are selected in-place (no new window per click).
 *
 * Visual language: Lubuntu / PCManFM + LXQt (screenshots folder) —
 * compact dark bar, hover highlight, separators, checkmarks, submenus.
 */

let openRoot = null;
let onDocPointer = null;
let onDocKey = null;

function clearMenus() {
  document.querySelectorAll(".asx-menu").forEach((el) => el.remove());
  document.querySelectorAll(".asx-menubar [aria-expanded='true']").forEach((b) => {
    b.setAttribute("aria-expanded", "false");
  });
  openRoot = null;
  if (onDocPointer) {
    document.removeEventListener("pointerdown", onDocPointer, true);
    onDocPointer = null;
  }
  if (onDocKey) {
    document.removeEventListener("keydown", onDocKey, true);
    onDocKey = null;
  }
}

export function closeMenus() {
  clearMenus();
}

function placeMenu(el, x, y) {
  const pad = 6;
  const vw = window.innerWidth || 800;
  const vh = window.innerHeight || 600;
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  let left = x;
  let top = y;
  if (left + r.width > vw - pad) left = Math.max(pad, vw - r.width - pad);
  if (top + r.height > vh - pad) top = Math.max(pad, vh - r.height - pad);
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
}

function itemLabel(it) {
  return String(it.label || "");
}

/**
 * @typedef {{
 *   label?: string,
 *   action?: Function,
 *   checked?: boolean,
 *   disabled?: boolean,
 *   sep?: boolean,
 *   submenu?: object[],
 *   kbd?: string,
 *   icon?: string
 * }} MenuItem
 */

/**
 * Build one popup menu. Items with `submenu` open a child on hover/click.
 * @param {MenuItem[]} items
 * @returns {HTMLUListElement}
 */
function buildMenu(items) {
  const ul = document.createElement("ul");
  ul.className = "asx-menu";
  ul.setAttribute("role", "menu");

  (items || []).forEach((it) => {
    if (!it || it.sep) {
      const li = document.createElement("li");
      li.className = "asx-menu-sep";
      li.setAttribute("role", "separator");
      ul.appendChild(li);
      return;
    }
    const li = document.createElement("li");
    li.className = "asx-menu-item";
    if (it.disabled) li.classList.add("is-disabled");
    if (it.checked) li.classList.add("is-checked");
    if (it.submenu) li.classList.add("has-sub");
    li.setAttribute("role", "menuitem");
    li.tabIndex = it.disabled ? -1 : 0;

    const mark = it.checked ? "✓" : it.submenu ? "" : "";
    const sub = it.submenu ? "▸" : "";
    li.innerHTML = `<span class="asx-menu-check">${mark}</span><span class="asx-menu-ico">${
      it.icon ? it.icon : ""
    }</span><span class="asx-menu-label"></span><span class="asx-menu-kbd"></span><span class="asx-menu-caret">${sub}</span>`;
    li.querySelector(".asx-menu-label").textContent = itemLabel(it);
    if (it.kbd) li.querySelector(".asx-menu-kbd").textContent = it.kbd;

    const run = () => {
      if (it.disabled) return;
      if (it.submenu) return;
      clearMenus();
      try {
        it.action?.();
      } catch (err) {
        console.warn("ASX menu action", err);
      }
    };

    const activate = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (it.disabled) return;
      if (it.submenu) {
        openSub(li, it.submenu);
        return;
      }
      run();
    };
    li.addEventListener("pointerup", (e) => {
      if (e.button != null && e.button !== 0) return;
      activate(e);
    });
    li.addEventListener("click", (e) => {
      // Already handled on pointerup; stop the leftover click hitting the desktop.
      e.preventDefault();
      e.stopPropagation();
    });
    li.addEventListener("pointerenter", () => {
      ul.querySelectorAll(":scope > .asx-menu-item").forEach((n) => n.classList.remove("is-hot"));
      li.classList.add("is-hot");
      ul.querySelectorAll(":scope > .asx-menu-item .asx-menu").forEach((n) => n.remove());
      if (it.submenu && !it.disabled) openSub(li, it.submenu);
    });
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        run();
      }
    });

    ul.appendChild(li);
  });

  return ul;
}

function openSub(parentLi, items) {
  parentLi.querySelectorAll(":scope > .asx-menu").forEach((n) => n.remove());
  const sub = buildMenu(items);
  sub.classList.add("asx-menu-sub");
  parentLi.appendChild(sub);
  const pr = parentLi.getBoundingClientRect();
  const sr = sub.getBoundingClientRect();
  const vw = window.innerWidth || 800;
  const vh = window.innerHeight || 600;
  let left = pr.width - 4;
  let top = -4;
  if (pr.right + sr.width > vw - 6) left = -sr.width + 4;
  if (pr.top + sr.height > vh - 6) top = Math.min(-4, vh - 6 - pr.top - sr.height);
  sub.style.left = Math.round(left) + "px";
  sub.style.top = Math.round(top) + "px";
}

function eventEl(e) {
  const t = e?.target;
  if (!t) return null;
  return t.nodeType === 1 ? t : t.parentElement;
}

function isMenuEvent(e) {
  const el = eventEl(e);
  return !!el?.closest?.(".asx-menu, .asx-menubar, .asx-menubar-btn");
}

function armDismiss() {
  onDocPointer = (e) => {
    if (isMenuEvent(e)) return;
    clearMenus();
  };
  onDocKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      clearMenus();
    }
  };
  // Next frame: the opening click/right-click must not instantly dismiss.
  requestAnimationFrame(() => {
    if (!onDocPointer) return;
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onDocKey, true);
  });
}

/**
 * Show a context / popup menu at a screen point.
 * @param {{ x: number, y: number, items: MenuItem[] }} opts
 */
export function showMenu({ x, y, items }) {
  clearMenus();
  const ul = buildMenu(items);
  openRoot = ul;
  placeMenu(ul, x, y);
  armDismiss();
  return ul;
}

/**
 * Bind a Lubuntu-style menubar (File Edit View …).
 * Clicking a title opens a dropdown; selecting an item runs the action
 * in the current window / desktop — it does not open a new window.
 *
 * @param {HTMLElement} bar
 * @param {Record<string, MenuItem[] | (() => MenuItem[])>} spec
 */
export function bindMenubar(bar, spec) {
  bar.classList.add("asx-menubar", "files-menubar");
  bar.setAttribute("role", "menubar");
  bar.replaceChildren();

  Object.entries(spec || {}).forEach(([name, itemsOrFn]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "asx-menubar-btn";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = name;
    const open = () => {
      const items = typeof itemsOrFn === "function" ? itemsOrFn() : itemsOrFn;
      const r = btn.getBoundingClientRect();
      const already = btn.getAttribute("aria-expanded") === "true";
      clearMenus();
      if (already) return;
      btn.setAttribute("aria-expanded", "true");
      showMenu({ x: r.left, y: r.bottom + 2, items });
    };
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });
    btn.addEventListener("pointerup", (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      open();
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener("pointerenter", () => {
      if (bar.querySelector("[aria-expanded='true']") && btn.getAttribute("aria-expanded") !== "true") {
        open();
      }
    });
    bar.appendChild(btn);
  });
  return bar;
}

/**
 * Pick a local file with the guest's own OS file dialog.
 * @param {{ accept?: string, multiple?: boolean }} [opts]
 * @returns {Promise<File[]>}
 */
export function pickLocalFiles(opts = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.hidden = true;
    if (opts.accept) input.accept = opts.accept;
    if (opts.multiple) input.multiple = true;
    input.addEventListener("change", () => {
      const list = input.files ? Array.from(input.files) : [];
      input.remove();
      resolve(list);
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve([]);
    });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      // Safari / some UAs never fire cancel
      if (!input.files || !input.files.length) {
        /* leave it; change/cancel will clean up */
      }
    }, 0);
  });
}

/**
 * Read a File as a data URL (wallpaper / import).
 * @param {File} file
 * @param {number} [maxBytes]
 */
export function fileToDataUrl(file, maxBytes = 1_600_000) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("no file"));
    if (file.size > maxBytes) return reject(new Error("image too large (max ~1.5 MB)"));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
