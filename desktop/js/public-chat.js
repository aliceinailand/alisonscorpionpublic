/**
 * The one public chat. The transcript stays in this browser's localStorage.
 * It is not uploaded with the page, and it is not written to the private database.
 */

export const PUBLIC_CHAT_KEY = "asx.publicChat.v1";
export const PUBLIC_CONTAINER = Object.freeze({
  id: "public",
  display: "ASX-CON-PUBLIC",
  title: "Public chat",
});

const MAX_MESSAGES = 200;
const MAX_TEXT = 100000;

function cleanMessage(entry) {
  if (!entry || (entry.role !== "you" && entry.role !== "asx")) return null;
  if (typeof entry.text !== "string") return null;
  const text = entry.text.slice(0, MAX_TEXT);
  if (!text) return null;
  return {
    role: entry.role,
    text,
    at: typeof entry.at === "string" ? entry.at : "",
  };
}

export function loadTranscript(storage) {
  try {
    const raw = storage.getItem(PUBLIC_CHAT_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    return messages.map(cleanMessage).filter(Boolean).slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export function saveTranscript(storage, messages) {
  const kept = messages.map(cleanMessage).filter(Boolean).slice(-MAX_MESSAGES);
  storage.setItem(
    PUBLIC_CHAT_KEY,
    JSON.stringify({
      container: PUBLIC_CONTAINER,
      messages: kept,
    })
  );
  return kept;
}

export function appendMessage(storage, role, text) {
  const messages = loadTranscript(storage);
  messages.push({
    role,
    text: String(text || ""),
    at: new Date().toISOString(),
  });
  return saveTranscript(storage, messages);
}

export function clearTranscript(storage) {
  storage.removeItem(PUBLIC_CHAT_KEY);
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function paint(log, messages) {
  log.replaceChildren();
  if (!messages.length) {
    log.appendChild(
      el(
        "p",
        "No messages yet. What you type next stays in this browser.",
        "dim public-chat-empty"
      )
    );
    return;
  }
  messages.forEach((message) => {
    const row = el("div", null, "public-chat-row");
    row.appendChild(
      el("span", message.role === "you" ? "You" : "ASX", "public-chat-who")
    );
    row.appendChild(document.createTextNode(" "));
    row.appendChild(el("span", message.text, "public-chat-text"));
    log.appendChild(row);
  });
  log.scrollTop = log.scrollHeight;
}

/**
 * @param {HTMLElement} root
 * @param {{ storage?: Storage, reply?: (text: string) => string, statusUrl?: string, fetchImpl?: typeof fetch }} [opts]
 */
export function mountPublicChat(root, opts = {}) {
  const storage = opts.storage || localStorage;
  const reply =
    opts.reply ||
    ((text) => `Noted on this computer: ${text}`);
  const statusUrl = opts.statusUrl || "";
  const fetchImpl = opts.fetchImpl || fetch;

  root.classList.add("public-chat");
  root.replaceChildren();

  const head = el("div", null, "public-chat-head");
  head.appendChild(el("strong", PUBLIC_CONTAINER.title));
  head.appendChild(
    el(
      "p",
      `${PUBLIC_CONTAINER.display} is the one public chat. Anyone can type. A long message is read in sections of 50,000 characters, up to 100,000. The conversation is saved in localStorage on this computer. It is not written into the database.`,
      "dim"
    )
  );
  root.appendChild(head);

  const log = el("div", null, "public-chat-log");
  log.setAttribute("data-public-chat-log", "1");
  root.appendChild(log);

  const bar = el("form", null, "public-chat-bar");
  bar.setAttribute("data-public-chat-form", "1");
  const input = document.createElement("textarea");
  input.maxLength = MAX_TEXT;
  input.rows = 3;
  input.placeholder = "Type to ASX. A long message stays on this computer.";
  input.setAttribute("data-public-chat-input", "1");
  input.autocomplete = "off";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      bar.requestSubmit();
    }
  });
  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Send";
  bar.appendChild(input);
  bar.appendChild(send);
  root.appendChild(bar);

  const tools = el("div", null, "public-chat-tools");
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Clear this chat on this computer";
  tools.appendChild(clear);
  const status = el(
    "p",
    "Checking where this chat lives…",
    "dim public-chat-status"
  );
  status.setAttribute("data-public-chat-status", "1");
  tools.appendChild(status);
  root.appendChild(tools);

  let messages = loadTranscript(storage);
  const draw = () => paint(log, messages);
  const persist = () => {
    try {
      messages = saveTranscript(storage, messages);
      return true;
    } catch {
      status.textContent =
        "This browser could not store that much text. What you see is only in this open window.";
      return false;
    }
  };
  draw();

  let busy = false;
  bar.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const text = input.value.trim();
    if (!text) return;
    busy = true;
    send.disabled = true;
    input.value = "";
    messages.push({ role: "you", text, at: new Date().toISOString() });
    persist();
    draw();
    let answer = "";
    try {
      answer = String((await reply(text)) || "").trim();
    } catch {
      answer = "";
    }
    if (!answer) answer = "Noted on this computer.";
    messages.push({ role: "asx", text: answer, at: new Date().toISOString() });
    persist();
    draw();
    busy = false;
    send.disabled = false;
    input.focus();
  });

  clear.addEventListener("click", () => {
    if (!messages.length) return;
    if (!window.confirm("Clear the public chat saved on this computer?")) return;
    clearTranscript(storage);
    messages = [];
    draw();
  });

  if (!statusUrl) {
    status.textContent =
      "This page has no private database. The chat remains in localStorage on this computer.";
    return;
  }

  fetchImpl(statusUrl, { headers: { Accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("status"))))
    .then((data) => {
      const engine = data.engine === "sqlite" ? "SQLite" : "the private database";
      const held = data.guest_transcript_stored ? "is storing this chat" : "is not storing this chat";
      status.textContent = `Private backend: ${engine} is ready and ${held}. Sign-in is not built. The transcript you see is still only in this browser.`;
    })
    .catch(() => {
      status.textContent =
        "The private backend did not answer. This chat is still only on this computer.";
    });
}
