/**
 * ASX Satellite search-engine registry for the guest desktop Settings app.
 * Mirrors config/browsers.json search_engines shape in localStorage so
 * Brave + custom engines work without a live Python write path.
 */
export const SEARCH_ENGINES_KEY = "asx-search-engines-v1";
export const SEARCH_ENGINE_SECTION_ID = "search-engine";
export const SEARCH_ENGINE_SECTION_LABEL = "Search engine";
export const ADD_CUSTOM_SEARCH_LABEL = "Add Custom Search";

/** Defaults aligned with config/browsers.json */
export const DEFAULT_SEARCH_ENGINES = [
  {
    id: "brave",
    label: "Brave Search",
    url_template: "https://search.brave.com/search?q={query}",
    enabled: true,
    default: true,
    category: "web",
    notes: "Default privacy-first search engine for ASX Satellite.",
  },
  {
    id: "google",
    label: "Google",
    url_template: "https://www.google.com/search?q={query}",
    enabled: true,
    default: false,
    category: "web",
  },
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    url_template: "https://duckduckgo.com/?q={query}",
    enabled: true,
    default: false,
    category: "web",
  },
];

function storage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function cloneDefaults() {
  return DEFAULT_SEARCH_ENGINES.map((e) => ({ ...e }));
}

/**
 * @returns {{ default_search_engine: string, search_engines: object[] }}
 */
export function loadSearchEngineConfig() {
  const store = storage();
  if (!store) {
    return { default_search_engine: "brave", search_engines: cloneDefaults() };
  }
  try {
    const raw = store.getItem(SEARCH_ENGINES_KEY);
    if (!raw) {
      return { default_search_engine: "brave", search_engines: cloneDefaults() };
    }
    const parsed = JSON.parse(raw);
    const engines = Array.isArray(parsed.search_engines) ? parsed.search_engines : cloneDefaults();
    const hasBrave = engines.some((e) => e && e.id === "brave");
    if (!hasBrave) {
      engines.unshift({ ...DEFAULT_SEARCH_ENGINES[0] });
    }
    const preferred =
      typeof parsed.default_search_engine === "string" && parsed.default_search_engine
        ? parsed.default_search_engine
        : "brave";
    return { default_search_engine: preferred, search_engines: engines };
  } catch {
    return { default_search_engine: "brave", search_engines: cloneDefaults() };
  }
}

export function saveSearchEngineConfig(cfg) {
  const store = storage();
  if (!store) return cfg;
  const payload = {
    default_search_engine: cfg.default_search_engine || "brave",
    search_engines: Array.isArray(cfg.search_engines) ? cfg.search_engines : cloneDefaults(),
  };
  store.setItem(SEARCH_ENGINES_KEY, JSON.stringify(payload));
  return payload;
}

export function listSearchEngines({ enabledOnly = true } = {}) {
  const cfg = loadSearchEngineConfig();
  let engines = cfg.search_engines.filter((e) => e && e.id);
  if (enabledOnly) engines = engines.filter((e) => e.enabled !== false);
  return engines.sort((a, b) => {
    const ad = a.id === cfg.default_search_engine || a.default ? 0 : 1;
    const bd = b.id === cfg.default_search_engine || b.default ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return String(a.label || a.id).localeCompare(String(b.label || b.id));
  });
}

export function getDefaultSearchEngine() {
  const cfg = loadSearchEngineConfig();
  const all = listSearchEngines({ enabledOnly: false });
  const hit = all.find((e) => e.id === cfg.default_search_engine && e.enabled !== false);
  if (hit) return hit;
  const brave = all.find((e) => e.id === "brave");
  if (brave) return brave;
  return all[0] || DEFAULT_SEARCH_ENGINES[0];
}

export function setDefaultSearchEngine(engineId) {
  const cfg = loadSearchEngineConfig();
  const id = String(engineId || "").trim();
  if (!cfg.search_engines.some((e) => e.id === id)) {
    throw new Error(`search engine not found: ${id}`);
  }
  cfg.default_search_engine = id;
  cfg.search_engines = cfg.search_engines.map((e) => ({
    ...e,
    default: e.id === id,
  }));
  saveSearchEngineConfig(cfg);
  return getDefaultSearchEngine();
}

function slugifyEngineId(label) {
  const base = String(label || "custom")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "custom";
}

/**
 * Add or update a custom search engine. urlTemplate must include `{query}`.
 * @returns {object} the engine record
 */
export function addCustomSearchEngine(label, urlTemplate, { id, enabled = true, makeDefault = false } = {}) {
  const name = String(label || "").trim();
  const template = String(urlTemplate || "").trim();
  if (!name) throw new Error("search engine name is required");
  if (!template.includes("{query}")) {
    throw new Error("url template must include {query}");
  }
  const engineId = String(id || slugifyEngineId(name));
  const cfg = loadSearchEngineConfig();
  const next = {
    id: engineId,
    label: name,
    url_template: template,
    enabled: Boolean(enabled),
    default: Boolean(makeDefault),
    category: "custom",
    notes: "Added via Settings › Search engine › Add Custom Search",
  };
  const idx = cfg.search_engines.findIndex((e) => e.id === engineId);
  if (idx >= 0) cfg.search_engines[idx] = { ...cfg.search_engines[idx], ...next };
  else cfg.search_engines.push(next);
  if (makeDefault) {
    cfg.default_search_engine = engineId;
    cfg.search_engines = cfg.search_engines.map((e) => ({
      ...e,
      default: e.id === engineId,
    }));
  }
  saveSearchEngineConfig(cfg);
  return listSearchEngines({ enabledOnly: false }).find((e) => e.id === engineId);
}

export function buildSearchUrl(query, engine) {
  const eng = engine || getDefaultSearchEngine();
  const q = encodeURIComponent(String(query || "").trim());
  return String(eng.url_template || "").replaceAll("{query}", q);
}

/**
 * Markup for Settings › Search engine (escaped labels only for static parts).
 * Callers wire events after inserting into the DOM.
 */
export function renderSearchEngineSettingsHtml(escapeHtmlFn) {
  const esc = typeof escapeHtmlFn === "function" ? escapeHtmlFn : (s) => String(s);
  const cfg = loadSearchEngineConfig();
  const engines = listSearchEngines({ enabledOnly: false });
  const rows = engines
    .map((e) => {
      const selected = e.id === cfg.default_search_engine;
      return `<label class="settings-check settings-search-engine-row">
        <input type="radio" name="asx-search-engine" value="${esc(e.id)}" ${selected ? "checked" : ""}/>
        <span><strong>${esc(e.label || e.id)}</strong>
        <span class="dim"> · ${esc(e.url_template || "")}</span></span>
      </label>`;
    })
    .join("");
  return `
    <h2 id="settings-search-engine-heading">${esc(SEARCH_ENGINE_SECTION_LABEL)}</h2>
    <p class="dim settings-lead">Choose the default engine for address-bar searches in ASX Satellite. Brave Search ships enabled by default.</p>
    <div class="settings-search-engine-list" role="radiogroup" aria-label="${esc(SEARCH_ENGINE_SECTION_LABEL)}">
      ${rows}
    </div>
    <h3 class="settings-label">${esc(ADD_CUSTOM_SEARCH_LABEL)}</h3>
    <p class="dim settings-hint">Provide a display name and a URL template that includes <code>{query}</code>.</p>
    <label class="settings-label">Name
      <input id="asx-custom-search-name" class="settings-input" type="text" autocomplete="off" placeholder="e.g. Perplexity" />
    </label>
    <label class="settings-label">URL template
      <input id="asx-custom-search-url" class="settings-input" type="url" autocomplete="off" spellcheck="false"
        placeholder="https://example.com/search?q={query}" />
    </label>
    <p id="asx-custom-search-error" class="dim settings-hint" role="status"></p>
    <div class="settings-actions">
      <button type="button" class="sheet-btn" id="asx-add-custom-search">${esc(ADD_CUSTOM_SEARCH_LABEL)}</button>
    </div>`;
}
