/**
 * Guest account store — localStorage only (pre-backend).
 * Deleted accounts → trash hold 30 days, then purge.
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
    const id = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
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

export function createAccount({ username, email, password }) {
  const list = purgeExpiredAccounts();
  const un = String(username || "").trim();
  const em = String(email || "").trim().toLowerCase();
  if (!un || un.length < 2) return { error: "Username must be at least 2 characters." };
  if (!em || !em.includes("@")) return { error: "Enter a valid email." };
  if (list.some((u) => !u.deletedAt && (u.username.toLowerCase() === un.toLowerCase() || u.email === em))) {
    return { error: "That username or email is already registered on this device." };
  }
  const id =
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = {
    id,
    username: un,
    email: em,
    // demo only — not a secure hash; real backend later
    passHint: String(password || "").length,
    createdAt: Date.now(),
    deletedAt: null,
  };
  list.push(user);
  writeAll(list);
  setSessionUser(id);
  return { user };
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
    out.push({ id: `sys-${pool[i % pool.length]}`, username: pool[(s + i) % pool.length], system: true });
  }
  return out;
}
