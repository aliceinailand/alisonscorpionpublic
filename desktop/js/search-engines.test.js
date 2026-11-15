/**
 * Unit tests for Settings › Search engine registry (Brave + Add Custom Search).
 * Run: node alisonscorpionpublic/desktop/js/search-engines.test.js
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
  ADD_CUSTOM_SEARCH_LABEL,
  SEARCH_ENGINE_SECTION_ID,
  SEARCH_ENGINE_SECTION_LABEL,
  addCustomSearchEngine,
  getDefaultSearchEngine,
  listSearchEngines,
  loadSearchEngineConfig,
  renderSearchEngineSettingsHtml,
  setDefaultSearchEngine,
} = await import("./search-engines.js");

assert.equal(SEARCH_ENGINE_SECTION_ID, "search-engine");
assert.equal(SEARCH_ENGINE_SECTION_LABEL, "Search engine");
assert.equal(ADD_CUSTOM_SEARCH_LABEL, "Add Custom Search");

const cfg = loadSearchEngineConfig();
assert.equal(cfg.default_search_engine, "brave");
assert.ok(listSearchEngines().some((e) => e.id === "brave" && e.label.includes("Brave")));

const custom = addCustomSearchEngine(
  "Perplexity",
  "https://www.perplexity.ai/search?query={query}"
);
assert.equal(custom.id, "perplexity");
assert.ok(custom.url_template.includes("{query}"));
assert.ok(listSearchEngines({ enabledOnly: false }).some((e) => e.id === "perplexity"));
assert.equal(getDefaultSearchEngine().id, "brave");

setDefaultSearchEngine("perplexity");
assert.equal(getDefaultSearchEngine().id, "perplexity");
assert.equal(loadSearchEngineConfig().default_search_engine, "perplexity");

assert.throws(
  () => addCustomSearchEngine("Bad", "https://example.com/search?q=x"),
  /\{query\}/
);

const html = renderSearchEngineSettingsHtml((s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
);
assert.match(html, /Search engine/);
assert.match(html, /Add Custom Search/);
assert.match(html, /Brave Search/);
assert.match(html, /id="asx-add-custom-search"/);
assert.match(html, /settings-search-engine-heading/);

// buildSearchUrl must produce the selected engine template (omnibox path helper)
const { buildSearchUrl } = await import("./search-engines.js");
assert.equal(
  buildSearchUrl("hello world", getDefaultSearchEngine()),
  "https://www.perplexity.ai/search?query=hello%20world"
);

console.log("search-engines.test.js: ok");
