/**
 * Guest session identity — asxguest-####
 *
 * Auto guest on first land (no login wall). Local lifetime counter until a
 * real presence API exists. Honest UI: local/estimate, not fake global certainty.
 *
 * Multi-AI Convergence: Alice (Matthew Gates), Grok, Claude, Gemini, ChatGPT, Copilot.
 */

const VISIT_TOTAL_KEY = "asx-visit-total-local";
const GUEST_ID_KEY = "asx-guest-id";
const VISIT_COUNTED_KEY = "asx-visit-counted";

function padGuestNum(n) {
  const x = Math.max(1, Math.floor(Number(n) || 1));
  return String(x).padStart(4, "0");
}

/**
 * Bump lifetime visit once per browser tab session; assign stable guest id for this browser.
 * @returns {{ id: string, number: number, display: string }}
 */
export function ensureGuestSession() {
  let num = 1;
  try {
    num = parseInt(localStorage.getItem(VISIT_TOTAL_KEY), 10) || 0;
    if (!sessionStorage.getItem(VISIT_COUNTED_KEY)) {
      num = num + 1;
      localStorage.setItem(VISIT_TOTAL_KEY, String(num));
      sessionStorage.setItem(VISIT_COUNTED_KEY, "1");
    }
    if (num < 1) num = 1;
  } catch {
    num = 1;
  }

  let id = "";
  try {
    id = localStorage.getItem(GUEST_ID_KEY) || "";
  } catch {
    id = "";
  }
  if (!/^asxguest-\d+$/i.test(id)) {
    id = `asxguest-${padGuestNum(num)}`;
    try {
      localStorage.setItem(GUEST_ID_KEY, id);
    } catch {
      /* ignore */
    }
  }

  const number = parseInt(String(id).replace(/^asxguest-/i, ""), 10) || num;
  return { id, number, display: id };
}

/** Current guest id string (ensures session first). */
export function getGuestId() {
  return ensureGuestSession().id;
}

/**
 * Whoami for terminal / taskbar: registered username or asxguest-####.
 * @param {{ username?: string }|null} sessionUser
 */
export function resolveWhoami(sessionUser) {
  if (sessionUser && sessionUser.username) {
    return String(sessionUser.username);
  }
  return getGuestId();
}

/**
 * Paint taskbar guest label.
 * @param {HTMLElement|null} el
 * @param {string} label
 */
export function paintGuestStatus(el, label) {
  if (!el) return;
  const text = label || getGuestId();
  el.textContent = `${text}@asx`;
  el.title = `Session: ${text}\nGuests explore freely. Sign up later to save Construct/Containers to an account.`;
  el.dataset.guestId = text;
}
