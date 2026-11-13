/**
 * Guest account store — localStorage only (pre-backend).
 * Deleted accounts → trash hold 30 days, then purge.
 * Passwords: SHA-256 hex (demo device-local; real backend later).
 */

const ACCOUNTS_KEY = "asx-accounts-v1";
const SESSION_KEY = "asx-session-user";
const HOLD_MS = 30 * 24 * 60 * 60 * 1000;

function readAll() {
  try {
    const a = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

/** Demo hash — not a substitute for a real auth server. */
export async function hashPassword(password) {
  const raw = String(password || "");
  if (!raw) return "";
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw)
    );
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback for rare environments without subtle
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

export function purgeExpiredAccounts() {
  const now = Date.now();
  const next = readAll().filter((u) => {
    if (!u.deletedAt) return true;
    return now - u.deletedAt < HOLD_MS;
  });
  writeAll(next);
  return next;
}

export function listActiveAccounts() {
  return purgeExpiredAccounts().filter((u) => !u.deletedAt);
}

export function listTrashedAccounts() {
  return purgeExpiredAccounts().filter((u) => u.deletedAt);
}

export function getSessionUser() {
  try {
    const id =
      sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return listActiveAccounts().find((u) => u.id === id) || null;
  } catch {
    return null;
  }
}

export function setSessionUser(id) {
  try {
    if (id) {
      sessionStorage.setItem(SESSION_KEY, id);
      localStorage.setItem(SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function signOut() {
  setSessionUser(null);
}

export async function createAccount({ username, email, password }) {
  const list = purgeExpiredAccounts();
  const un = String(username || "").trim();
  const em = String(email || "").trim().toLowerCase();
  const pw = String(password || "");
  if (!un || un.length < 2) {
    return { error: "Username must be at least 2 characters." };
  }
  if (!em || !em.includes("@")) {
    return { error: "Enter a valid email." };
  }
  if (pw.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (
    list.some(
      (u) =>
        !u.deletedAt &&
        (u.username.toLowerCase() === un.toLowerCase() || u.email === em)
    )
  ) {
    return {
      error: "That username or email is already registered on this device.",
    };
  }
  const id =
    (typeof crypto !== "undefined" &&
      crypto.randomUUID &&
      crypto.randomUUID()) ||
    `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passHash = await hashPassword(pw);
  const user = {
    id,
    username: un,
    email: em,
    passHash,
    passHint: pw.length,
    createdAt: Date.now(),
    deletedAt: null,
  };
  list.push(user);
  writeAll(list);
  setSessionUser(id);
  return { user: { id: user.id, username: user.username, email: user.email } };
}

/**
 * Log in with email or username + password.
 * Legacy rows without passHash: if password given, set hash once (upgrade).
 */
export async function loginAccount({ emailOrUser, password }) {
  const list = purgeExpiredAccounts();
  const key = String(emailOrUser || "").trim().toLowerCase();
  const pw = String(password || "");
  if (!key) return { error: "Enter email or username." };
  if (!pw) return { error: "Enter password." };
  const u = list.find(
    (x) =>
      !x.deletedAt &&
      (x.email === key || String(x.username || "").toLowerCase() === key)
  );
  if (!u) return { error: "No account on this device for that email or username." };
  const passHash = await hashPassword(pw);
  if (!u.passHash) {
    // Upgrade legacy guest rows that only stored passHint
    u.passHash = passHash;
    writeAll(list);
  } else if (u.passHash !== passHash) {
    return { error: "Wrong password." };
  }
  setSessionUser(u.id);
  return { user: { id: u.id, username: u.username, email: u.email } };
}

export function softDeleteAccount(id) {
  const list = purgeExpiredAccounts();
  const u = list.find((x) => x.id === id);
  if (!u) return { error: "Account not found." };
  u.deletedAt = Date.now();
  writeAll(list);
  if (getSessionUser()?.id === id) setSessionUser(null);
  return { user: u };
}

export function restoreAccount(id) {
  const list = purgeExpiredAccounts();
  const u = list.find((x) => x.id === id);
  if (!u) return { error: "Account not found or hold expired." };
  if (!u.deletedAt) return { error: "Account is not in the trash." };
  if (Date.now() - u.deletedAt >= HOLD_MS) {
    return { error: "30-day hold expired. Account cannot be restored." };
  }
  u.deletedAt = null;
  writeAll(list);
  return { user: u };
}

export function daysLeftInTrash(u) {
  if (!u?.deletedAt) return 0;
  const left = HOLD_MS - (Date.now() - u.deletedAt);
  return Math.max(0, Math.ceil(left / (24 * 60 * 60 * 1000)));
}

/** Decorative other “users” on Alison’s machine (permission denied). */
export function randomOtherProfiles(seed) {
  const pool = [
    "ops-bot",
    "hermes",
    "honeybee",
    "claude-parts",
    "guest-archive",
    "verify-runner",
    "construct",
  ];
  let n = 2 + ((seed || Date.now()) % 3);
  const out = [];
  const s = seed || Date.now();
  for (let i = 0; i < n; i++) {
    out.push({
      id: `sys-${pool[i % pool.length]}`,
      username: pool[(s + i) % pool.length],
      system: true,
    });
  }
  return out;
}
