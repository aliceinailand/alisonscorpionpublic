/**
 * ASX desktop chrome: taskbar widgets, show-desktop, power actions, lock.
 * Session-only / local illusion where noted — not a real multi-user presence server.
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
      <p class="power-sub">Guest session ended. Account login ships with registration.</p>
      <p class="power-sub">Continue as guest on Alison's desktop:</p>
      <button type="button" class="login-guest">Enter as guest</button>
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
