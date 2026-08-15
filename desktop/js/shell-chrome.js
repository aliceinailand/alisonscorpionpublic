/**
 * Multi-AI Convergence: Alice (Matthew Gates), Grok, Claude, Gemini, ChatGPT, Copilot.
 * ASX desktop chrome: taskbar widgets, show-desktop, power actions, lock.
 * Session-only / local illusion where noted — not a real multi-user presence server.
 *
 * Network: Offline.js (cdnjs) + taskbar online/offline icon.
 * https://cdnjs.com/libraries/offline-js
 */

const PRESENCE_KEY = "asx-presence-tabs";
const SESSION_T0_KEY = "asx-session-t0";
const LOCK_KEY = "asx-screen-lock";
const VISIT_TOTAL_KEY = "asx-visit-total-local";

function now() {
  return Date.now();
}

/** Session start (persists across soft navigations in-tab via sessionStorage). */
export function getSessionStart() {
  try {
    let t = parseInt(sessionStorage.getItem(SESSION_T0_KEY), 10);
    if (!Number.isFinite(t) || t <= 0) {
      t = now();
      sessionStorage.setItem(SESSION_T0_KEY, String(t));
    }
    return t;
  } catch {
    return now();
  }
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Multi-tab local presence + small ambient floor so the desktop feels lived-in.
 * Real global concurrent users need Workers/KV later — documented in research.
 */
export function initPresence(widgetEl) {
  if (!widgetEl) return () => {};
  const tabId =
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    `t-${now()}-${Math.random().toString(36).slice(2, 8)}`;

  const writeHeartbeat = () => {
    try {
      const map = JSON.parse(localStorage.getItem(PRESENCE_KEY) || "{}");
      const cutoff = now() - 45000;
      for (const k of Object.keys(map)) {
        if (map[k] < cutoff) delete map[k];
      }
      map[tabId] = now();
      localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
      return Object.keys(map).length;
    } catch {
      return 1;
    }
  };

  // Ambient: slow-changing extra so it's not always "1" on a single tab
  const ambientFloor = () => {
    const hour = new Date().getHours();
    const daySeed = new Date().toDateString();
    let h = 0;
    for (let i = 0; i < daySeed.length; i++) h = (h + daySeed.charCodeAt(i) * (i + 1)) % 97;
    // Peak "afternoon" a bit busier
    const peak = hour >= 12 && hour <= 20 ? 2 : hour >= 8 ? 1 : 0;
    return peak + (h % 3);
  };

  // Local lifetime counter (this browser) — optional flavor
  try {
    const n = parseInt(localStorage.getItem(VISIT_TOTAL_KEY), 10) || 0;
    if (!sessionStorage.getItem("asx-visit-counted")) {
      localStorage.setItem(VISIT_TOTAL_KEY, String(n + 1));
      sessionStorage.setItem("asx-visit-counted", "1");
    }
  } catch {
    /* ignore */
  }

  const paint = () => {
    const tabs = writeHeartbeat();
    const visitors = Math.max(1, tabs + ambientFloor());
    widgetEl.textContent = `${visitors} visitor${visitors === 1 ? "" : "s"}`;
    widgetEl.title = `On this desktop now (estimate): ${visitors}\nTabs this browser: ${tabs}\nGlobal realtime needs ASX presence API later.`;
  };

  paint();
  const hb = setInterval(paint, 8000);
  const onStorage = (e) => {
    if (e.key === PRESENCE_KEY) paint();
  };
  window.addEventListener("storage", onStorage);

  // BroadcastChannel for same-browser multi-tab snappier updates
  let bc = null;
  try {
    bc = new BroadcastChannel("asx-presence");
    bc.onmessage = () => paint();
    bc.postMessage({ t: "ping", tabId });
  } catch {
    /* ignore */
  }

  const onUnload = () => {
    try {
      const map = JSON.parse(localStorage.getItem(PRESENCE_KEY) || "{}");
      delete map[tabId];
      localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
      bc?.postMessage({ t: "bye", tabId });
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("pagehide", onUnload);

  return () => {
    clearInterval(hb);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pagehide", onUnload);
    onUnload();
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
  };
}

export function initSessionTimer(el) {
  if (!el) return () => {};
  const t0 = getSessionStart();
  const tick = () => {
    el.textContent = formatDuration(now() - t0);
    el.title = "Time on Alison's desktop this session";
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

/** Pair of eyes that track the pointer (taskbar right). */
export function initTravelingEyes(host) {
  if (!host) return () => {};
  host.innerHTML = `
    <div class="asx-eyes" aria-hidden="true" title="ASX is watching the desktop">
      <div class="eye"><div class="pupil"></div></div>
      <div class="eye"><div class="pupil"></div></div>
    </div>`;
  const pupils = host.querySelectorAll(".pupil");
  const onMove = (e) => {
    pupils.forEach((p) => {
      const eye = p.parentElement;
      const r = eye.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const max = 3.2;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = (dx / dist) * Math.min(max, dist * 0.08);
      const ny = (dy / dist) * Math.min(max, dist * 0.08);
      p.style.transform = `translate(${nx}px, ${ny}px)`;
    });
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  return () => window.removeEventListener("pointermove", onMove);
}

/**
 * Windows-style "Show desktop" — minimize all, toggle restores previous state.
 * @param {import('./wm.js').WindowManager} wm
 */
export function bindShowDesktop(btn, wm) {
  if (!btn || !wm) return;
  let stacked = null; // null | array of ids that were visible

  const apply = () => {
    if (stacked) {
      // Restore
      stacked.forEach((id) => wm.restore(id));
      stacked = null;
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
      btn.title = "Show desktop (minimize all)";
      return;
    }
    stacked = [];
    for (const w of wm.windows.values()) {
      if (!w.el.classList.contains("minimized")) {
        stacked.push(w.id);
        wm.minimize(w.id);
      }
    }
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
    btn.title = "Restore windows";
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    apply();
  });
}

function simpleHash(s) {
  let h = 5381;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function isScreenLocked() {
  try {
    const raw = sessionStorage.getItem(LOCK_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw);
    return !!(o && o.hash);
  } catch {
    return false;
  }
}

/**
 * Illusion lock: any password to lock; same password to unlock.
 * Stored in sessionStorage only (refresh clears session → unlocks unless we use localStorage).
 * User asked localStorage option — use sessionStorage for lock so full refresh boots clean guest,
 * with optional persist flag.
 */
export function lockScreen(password, { persist = false } = {}) {
  const hash = simpleHash(password);
  const payload = JSON.stringify({ hash, t: now() });
  sessionStorage.setItem(LOCK_KEY, payload);
  if (persist) {
    try {
      localStorage.setItem(LOCK_KEY, payload);
    } catch {
      /* ignore */
    }
  }
  showLockOverlay();
}

export function tryUnlock(password) {
  try {
    const raw =
      sessionStorage.getItem(LOCK_KEY) || localStorage.getItem(LOCK_KEY);
    if (!raw) return true;
    const o = JSON.parse(raw);
    if (simpleHash(password) === o.hash) {
      sessionStorage.removeItem(LOCK_KEY);
      localStorage.removeItem(LOCK_KEY);
      hideLockOverlay();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function showLockOverlay() {
  let el = document.getElementById("asx-lock-screen");
  if (!el) {
    el = document.createElement("div");
    el.id = "asx-lock-screen";
    el.innerHTML = `
      <div class="lock-card">
        <div class="lock-avatar" aria-hidden="true">🦂</div>
        <div class="lock-title">Alison Scorpion Desktop</div>
        <div class="lock-sub">Screen locked</div>
        <label class="lock-label" for="asx-lock-pass">Password</label>
        <input type="password" id="asx-lock-pass" autocomplete="current-password" placeholder="Enter lock password" />
        <button type="button" id="asx-lock-unlock">Unlock</button>
        <p class="lock-hint">Illusion lock for this browser tab. Refresh may clear session lock.</p>
        <p class="lock-err" id="asx-lock-err" hidden>Wrong password</p>
      </div>`;
    document.body.appendChild(el);
    const unlock = () => {
      const pass = el.querySelector("#asx-lock-pass").value;
      const err = el.querySelector("#asx-lock-err");
      if (tryUnlock(pass)) {
        err.hidden = true;
      } else {
        err.hidden = false;
        el.querySelector("#asx-lock-pass").value = "";
        el.querySelector("#asx-lock-pass").focus();
      }
    };
    el.querySelector("#asx-lock-unlock").addEventListener("click", unlock);
    el.querySelector("#asx-lock-pass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") unlock();
    });
  }
  el.classList.add("show");
  document.body.classList.add("asx-locked");
  setTimeout(() => el.querySelector("#asx-lock-pass")?.focus(), 100);
}

export function hideLockOverlay() {
  const el = document.getElementById("asx-lock-screen");
  if (el) el.classList.remove("show");
  document.body.classList.remove("asx-locked");
}

export function showShutdownScreen() {
  let el = document.getElementById("asx-power-screen");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "asx-power-screen";
  el.className = "asx-power-screen shutdown";
  el.innerHTML = `
    <button type="button" class="power-btn" title="Power on" aria-label="Power on">⏻</button>
    <p class="power-caption">Alison Scorpion Desktop</p>`;
  document.body.appendChild(el);
  document.body.classList.add("asx-powered-off");
  el.querySelector(".power-btn").addEventListener("click", () => {
    location.reload();
  });
}

export function showRebootScreen() {
  let el = document.getElementById("asx-power-screen");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "asx-power-screen";
  el.className = "asx-power-screen reboot";
  el.innerHTML = `
    <div class="reboot-spin" aria-hidden="true"></div>
    <p class="power-caption">Restarting ASX Desktop…</p>
    <p class="power-sub">Verification core · guest session</p>`;
  document.body.appendChild(el);
  document.body.classList.add("asx-powered-off");
  setTimeout(() => location.reload(), 2200);
}

export function showLogoutScreen() {
  let el = document.getElementById("asx-power-screen");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "asx-power-screen";
  el.className = "asx-power-screen logout";
  el.innerHTML = `
    <div class="logout-card">
      <div class="lock-avatar">🦂</div>
      <h1>Sign in</h1>
      <p class="power-sub">Session ended. Sign in (when available) or continue exploring.</p>
      <p class="power-sub">Log in as guest — same as first landing (auto guest on the public site):</p>
      <button type="button" class="login-guest">Log in as guest</button>
      <p class="power-sub guest-id-hint" style="margin-top:12px;opacity:.75;font-size:12px">You will receive an <code>asxguest-####</code> id on this browser.</p>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add("asx-powered-off");
  // Clear soft session bits
  try {
    sessionStorage.removeItem(LOCK_KEY);
    sessionStorage.removeItem(SESSION_T0_KEY);
  } catch {
    /* ignore */
  }
  el.querySelector(".login-guest").addEventListener("click", () => {
    location.reload();
  });
}

/**
 * Prompt for lock password then lock.
 */
export function promptLock() {
  const pass = window.prompt(
    "Choose a temporary lock password for this screen.\n(Anyone with this password can unlock. Not your real account password.)"
  );
  if (pass == null) return; // cancel
  if (!String(pass).length) {
    window.alert("Enter a non-empty password to lock.");
    return;
  }
  const again = window.prompt("Confirm lock password:");
  if (again !== pass) {
    window.alert("Passwords did not match. Screen not locked.");
    return;
  }
  lockScreen(pass, { persist: true });
}

/** Restore lock overlay if session still locked after refresh (localStorage). */
export function restoreLockIfNeeded() {
  try {
    const raw = sessionStorage.getItem(LOCK_KEY) || localStorage.getItem(LOCK_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && o.hash) {
        // Rehydrate session from local
        sessionStorage.setItem(LOCK_KEY, raw);
        showLockOverlay();
      }
    }
  } catch {
    /* ignore */
  }
}

/* ── Offline.js network status (taskbar) ──────────────────── */
const OFFLINE_JS_VERSION = "0.7.19";
const OFFLINE_JS_SOURCES = [
  `https://cdnjs.cloudflare.com/ajax/libs/offline-js/${OFFLINE_JS_VERSION}/offline.min.js`,
  `https://cdn.jsdelivr.net/npm/offline-js@${OFFLINE_JS_VERSION}/offline.min.js`,
];

/** @type {Promise<typeof window.Offline|null>|null} */
let offlineJsPromise = null;

function loadOfflineJs() {
  if (offlineJsPromise) return offlineJsPromise;
  if (typeof window.Offline !== "undefined") {
    offlineJsPromise = Promise.resolve(window.Offline);
    return offlineJsPromise;
  }
  offlineJsPromise = (async () => {
    for (const src of OFFLINE_JS_SOURCES) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.crossOrigin = "anonymous";
          s.referrerPolicy = "no-referrer";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("load failed: " + src));
          document.head.appendChild(s);
        });
        if (typeof window.Offline !== "undefined") return window.Offline;
      } catch {
        /* next CDN */
      }
    }
    return null;
  })();
  return offlineJsPromise;
}

/** Same-origin probe URL for Offline.js XHR check. */
function offlineCheckUrl() {
  try {
    // robots.txt ships with desktop-os; bust cache each check
    return new URL("robots.txt", location.href).href + "?_=" + Date.now();
  } catch {
    return "/favicon.ico?_=" + Date.now();
  }
}

/**
 * Taskbar online / offline indicator.
 * Uses Offline.js when available; falls back to navigator.onLine.
 * @param {HTMLElement|null} el  #tb-net button
 */
export function initNetworkStatus(el) {
  if (!el) return () => {};

  // Icon markup (SVG wifi-style — online vs offline)
  el.innerHTML = `
    <span class="tb-net-glyph" aria-hidden="true">
      <svg class="tb-net-svg tb-net-online-svg" viewBox="0 0 24 24" width="16" height="16" focusable="false">
        <path fill="currentColor" d="M12 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-4.24-4.24a.75.75 0 0 1 0-1.06 5.5 5.5 0 0 1 7.78 0 .75.75 0 1 1-1.06 1.06 4 4 0 0 0-5.66 0 .75.75 0 0 1-1.06 0zm-2.83-2.83a.75.75 0 0 1 0-1.06 9.5 9.5 0 0 1 13.44 0 .75.75 0 1 1-1.06 1.06 8 8 0 0 0-11.32 0 .75.75 0 0 1-1.06 0zM3.1 8.6a.75.75 0 0 1 0-1.06A14 14 0 0 1 12 4c3.5 0 6.7 1.28 9.1 3.4a.75.75 0 1 1-1 1.12A12.5 12.5 0 0 0 12 5.5c-3.12 0-5.97 1.14-8.15 3.04a.75.75 0 0 1-.75.06z"/>
      </svg>
      <svg class="tb-net-svg tb-net-offline-svg" viewBox="0 0 24 24" width="16" height="16" focusable="false">
        <path fill="currentColor" d="M3.28 2.22a.75.75 0 1 0-1.06 1.06l2.2 2.2A14 14 0 0 0 2.9 7.54a.75.75 0 1 0 1.06 1.06c.7-.7 1.48-1.3 2.32-1.8l1.5 1.5a9.5 9.5 0 0 0-2.85 1.93.75.75 0 1 0 1.06 1.06 8 8 0 0 1 2.3-1.58l1.7 1.7a5.5 5.5 0 0 0-2.23 1.33.75.75 0 1 0 1.06 1.06 4 4 0 0 1 1.68-.97l6.96 6.96a.75.75 0 1 0 1.06-1.06L3.28 2.22zM12 15.5c.28 0 .55.04.8.12l1.48 1.48A1.5 1.5 0 1 1 12 15.5zm7.24-4.24a.75.75 0 0 0-1.06-1.06 5.48 5.48 0 0 0-2.2.95l1.1 1.1c.74-.3 1.5-.7 2.16-.99zm2.66-2.9a.75.75 0 0 0-1.06-1.06 9.4 9.4 0 0 0-3.4 1.72l1.08 1.08c1.15-.55 2.3-1.1 3.38-1.74zM21.1 5.48A.75.75 0 0 0 20 4.42 14 14 0 0 0 12 2.5c-1.48 0-2.9.23-4.22.66l1.2 1.2c.97-.23 1.98-.36 3.02-.36 3.12 0 5.97 1.14 8.15 3.04.28.24.7.2.95-.06z"/>
      </svg>
    </span>
    <span class="tb-net-label">…</span>`;

  const label = el.querySelector(".tb-net-label");
  let lastOnline = navigator.onLine !== false;

  const apply = (online, source = "") => {
    lastOnline = !!online;
    el.classList.toggle("is-online", lastOnline);
    el.classList.toggle("is-offline", !lastOnline);
    el.setAttribute("aria-pressed", lastOnline ? "false" : "true");
    el.setAttribute(
      "aria-label",
      lastOnline ? "Internet online" : "Internet offline"
    );
    const detail = source ? ` (${source})` : "";
    el.title = lastOnline
      ? `Online — network reachable${detail}. Click to recheck.`
      : `Offline — no network${detail}. Click to recheck.`;
    if (label) label.textContent = lastOnline ? "Online" : "Offline";
    document.body.classList.toggle("asx-net-offline", !lastOnline);
  };

  apply(navigator.onLine !== false, "navigator");

  const onBrowserOnline = () => apply(true, "browser");
  const onBrowserOffline = () => apply(false, "browser");
  window.addEventListener("online", onBrowserOnline);
  window.addEventListener("offline", onBrowserOffline);

  /** @type {typeof window.Offline|null} */
  let OfflineLib = null;

  const recheck = () => {
    if (OfflineLib && typeof OfflineLib.check === "function") {
      try {
        OfflineLib.check();
        return;
      } catch {
        /* fall through */
      }
    }
    apply(navigator.onLine !== false, "navigator");
  };

  el.addEventListener("click", (e) => {
    e.preventDefault();
    recheck();
  });

  // Load Offline.js (async) for stronger checks than navigator.onLine alone
  loadOfflineJs().then((Offline) => {
    if (!Offline) return;
    OfflineLib = Offline;
    try {
      Offline.options = {
        ...(Offline.options || {}),
        checkOnLoad: true,
        interceptRequests: true,
        requests: true,
        // We use the taskbar icon — suppress reconnect game noise
        game: false,
        checks: {
          xhr: {
            url: offlineCheckUrl,
            timeout: 5000,
            type: "HEAD",
          },
        },
      };
      Offline.on("up", () => apply(true, "offline-js"));
      Offline.on("down", () => apply(false, "offline-js"));
      if (typeof Offline.check === "function") Offline.check();
      // state may already be set
      if (Offline.state === "up") apply(true, "offline-js");
      else if (Offline.state === "down") apply(false, "offline-js");
    } catch (err) {
      console.warn("[asx-net] Offline.js configure failed", err);
    }
  });

  return () => {
    window.removeEventListener("online", onBrowserOnline);
    window.removeEventListener("offline", onBrowserOffline);
  };
}
