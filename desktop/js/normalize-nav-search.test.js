/**
 * Honest path test: address-bar non-URL queries use Settings › Search engine.
 * Drives shipped normalizeNavUrl + search-engines registry (not a reimplementation).
 * Run: node alisonscorpionpublic/desktop/js/normalize-nav-search.test.js
 */
import assert from "node:assert/strict";

const memory = new Map();
globalThis.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
};

const {
  addCustomSearchEngine,
  getDefaultSearchEngine,
  setDefaultSearchEngine,
} = await import("./search-engines.js");
const { normalizeNavUrl } = await import("./blocklist.js");

// Fresh store → Brave is the shipped default
assert.equal(getDefaultSearchEngine().id, "brave");
const braveUrl = normalizeNavUrl("alison scorpion verification");
assert.match(
  braveUrl,
  /^https:\/\/search\.brave\.com\/search\?q=alison%20scorpion%20verification$/
);
assert.doesNotMatch(braveUrl, /duckduckgo/i);

// Custom engine selected in Settings must change omnibox searches
const custom = addCustomSearchEngine(
  "Startpage",
  "https://www.startpage.com/sp/search?query={query}"
);
assert.equal(custom.id, "startpage");
setDefaultSearchEngine("startpage");
assert.equal(getDefaultSearchEngine().id, "startpage");

const customUrl = normalizeNavUrl("privacy search test");
assert.equal(
  customUrl,
  "https://www.startpage.com/sp/search?query=privacy%20search%20test"
);

// Hostnames and full URLs still navigate directly (not searched)
assert.equal(normalizeNavUrl("example.com"), "https://example.com");
assert.equal(normalizeNavUrl("https://example.com/path"), "https://example.com/path");

console.log("normalize-nav-search.test.js: ok");
