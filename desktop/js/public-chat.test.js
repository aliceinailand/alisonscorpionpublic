import assert from "node:assert/strict";
import {
  PUBLIC_CHAT_KEY,
  appendMessage,
  clearTranscript,
  loadTranscript,
  saveTranscript,
} from "./public-chat.js";

function memory() {
  const box = new Map();
  return {
    getItem(key) {
      return box.has(key) ? box.get(key) : null;
    },
    setItem(key, value) {
      box.set(key, String(value));
    },
    removeItem(key) {
      box.delete(key);
    },
  };
}

const storage = memory();
appendMessage(storage, "you", "hello from this computer");
appendMessage(storage, "asx", "Noted on this computer.");
const saved = loadTranscript(storage);
assert.equal(saved.length, 2);
assert.equal(saved[0].role, "you");
assert.equal(saved[0].text, "hello from this computer");
assert.equal(JSON.parse(storage.getItem(PUBLIC_CHAT_KEY)).container.id, "public");

saveTranscript(storage, [{ role: "stranger", text: "nope" }, { role: "you", text: "kept" }]);
assert.deepEqual(
  loadTranscript(storage).map((message) => message.text),
  ["kept"]
);

clearTranscript(storage);
assert.deepEqual(loadTranscript(storage), []);
assert.equal(storage.getItem(PUBLIC_CHAT_KEY), null);

console.log("public-chat storage ok");
