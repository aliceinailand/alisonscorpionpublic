/**
 * Containers platform — view switches + device-local signup/login
 * (shares desktop/js/accounts.js with the ASX desktop Users app).
 */
import {
  createAccount,
  loginAccount,
  getSessionUser,
} from "../js/accounts.js?v=20261103auth1";

const known = {
  account: 1,
  dashboard: 1,
  new: 1,
  containers: 1,
  highlight: 1,
  plans: 1,
  billing: 1,
  settings: 1,
  signup: 1,
  login: 1,
};

function current() {
  const id = (location.hash || "#dashboard").replace(/^#/, "");
  return known[id] ? id : "dashboard";
}

function mark() {
  const id = current();
  const links = document.querySelectorAll("a[href^='#']");
  for (let i = 0; i < links.length; i++) {
    if (links[i].getAttribute("href") === "#" + id) {
      links[i].setAttribute("aria-current", "page");
    } else {
      links[i].removeAttribute("aria-current");
    }
  }
  paintSession();
}

function paintSession() {
  const u = getSessionUser();
  const text = u
    ? `Signed in as ${u.username} (${u.email}) on this device.`
    : "Guest on this device — Sign up or Log in.";
  const el = document.getElementById("session-who");
  if (el) el.textContent = text;
  const acc = document.getElementById("account-who");
  if (acc) {
    acc.textContent = u
      ? `Signed in as ${u.username} (${u.email}).`
      : "Guest until you Sign up or Log in on this device.";
  }
}

function showNote(noteId, text, ok) {
  const note = document.getElementById(noteId);
  if (!note) return;
  note.hidden = false;
  note.textContent = text;
  note.classList.toggle("err", !ok);
  note.classList.toggle("confirm", !!ok);
}

async function onSignup() {
  const r = await createAccount({
    username: document.getElementById("signup-user")?.value,
    email: document.getElementById("signup-email")?.value,
    password: document.getElementById("signup-pass")?.value,
  });
  if (r.error) {
    showNote("signup-result", r.error, false);
    return;
  }
  showNote(
    "signup-result",
    `Welcome, ${r.user.username}. Signed in on this device.`,
    true
  );
  paintSession();
}

async function onLogin() {
  const r = await loginAccount({
    emailOrUser: document.getElementById("login-email")?.value,
    password: document.getElementById("login-pass")?.value,
  });
  if (r.error) {
    showNote("login-result", r.error, false);
    return;
  }
  showNote("login-result", `Signed in as ${r.user.username}.`, true);
  paintSession();
}

function bindNew() {
  const button = document.getElementById("new-continue");
  if (!button) return;
  button.addEventListener("click", () => {
    const input = document.getElementById("new-name");
    if (input) input.value = "";
    const note = document.getElementById("new-result");
    if (!note) return;
    const u = getSessionUser();
    note.hidden = false;
    if (!u) {
      note.textContent =
        "Sign in first. Containers for guests stay empty until an account exists on this device.";
      return;
    }
    note.textContent =
      "Name cleared. Server-side containers still ship next; this device account is ready.";
  });
}

document.getElementById("signup-continue")?.addEventListener("click", () => {
  onSignup().catch((e) => showNote("signup-result", String(e), false));
});
document.getElementById("login-continue")?.addEventListener("click", () => {
  onLogin().catch((e) => showNote("login-result", String(e), false));
});
bindNew();
window.addEventListener("hashchange", mark);
mark();
