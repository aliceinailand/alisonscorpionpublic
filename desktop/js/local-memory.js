/**
 * Guest memory for generic actions.
 * The record stays in localStorage on this browser.
 * A signed-in copy can later add a local database and a session cookie.
 * This file does not open a database.
 */
const KEY = "asx-actions-v1";
const MAX_ACTIONS = 40;

function bucket(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function clean(action) {
  if (!action || typeof action !== "object") return null;
  const kind = action.kind === "sandbox" ? "sandbox" : action.kind === "open" ? "open" : "";
  if (!kind) return null;
  const ref = String(action.ref || "").trim().toLowerCase().slice(0, 80);
  const name = String(action.name || ref).replace(/\s+/g, " ").trim().slice(0, 60);
  if (!name || !ref) return null;
  if (kind === "open" && !/^[a-z0-9-]{1,40}$/.test(ref)) return null;
  if (kind === "sandbox") {
    if (!/^[a-z0-9.-]{1,253}$/.test(ref) || !ref.includes(".")) return null;
    if (ref === "localhost" || ref.endsWith(".local") || ref.endsWith(".localhost")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ref)) return null;
  }
  return { t: Date.now(), kind, name, ref };
}

function read(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const row = clean(item);
        if (!row) return null;
        const t = Number(item.t);
        if (Number.isFinite(t) && t > 0) row.t = t;
        return row;
      })
      .filter(Boolean)
      .slice(0, MAX_ACTIONS);
  } catch {
    return [];
  }
}

export function rememberAction(action, storage) {
  const row = clean(action);
  const box = bucket(storage);
  if (!row || !box) return [];
  const next = [row, ...read(box).filter((item) => item.kind !== row.kind || item.ref !== row.ref)].slice(
    0,
    MAX_ACTIONS
  );
  try {
    box.setItem(KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export function recentActions(limit = 8, storage) {
  const box = bucket(storage);
  if (!box) return [];
  const n = Math.max(1, Math.min(MAX_ACTIONS, Number(limit) || 8));
  return read(box).slice(0, n);
}
