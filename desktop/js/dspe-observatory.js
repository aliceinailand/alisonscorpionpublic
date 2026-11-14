/**
 * DSPE Observatory — separable client measure (public desktop).
 * Docs: asxhome docs/dspe.md · docs/DSPE_OBSERVATORY.md · src/core/dspe/observatory.py
 *
 * Metrology for emergent persona signatures (AI / human / animal subjects).
 * Ontology limits: asxhome agents/.../KNOWLEDGEBASE_WARNING.md. Not under Penta.
 * Paste-only runs are lexical (α); B/O layers need tagged acts/outcomes.
 * High scores ≠ FACT. Observer may not silently cause what it measures.
 * Extended domains: human_persona, org_industrial, archetype (catalog).
 */

import { detectExtendedPatterns, measureDatasetThemeWeights } from "./dspe-pattern-catalog.js";

const MAX_CHARS = 200_000;
const WEIGHT_PROFILE_ID = "DSPE_WEIGHT_PROFILE_V1_2";
const WEIGHT_LEXICAL = 0.15; // α
const WEIGHT_BEHAVIORAL = 0.35; // β
const WEIGHT_OUTCOME = 0.5; // γ
const VERSION = "dspe-observatory-v0.4-dataset-weights";

const AXIS = [
  {
    id: "P",
    name: "Persistence",
    hint: "role language / doctrine markers that recur across turns",
  },
  {
    id: "C",
    name: "Coherence",
    hint: "structured sections, lists, consistent framing",
  },
  {
    id: "A",
    name: "Adversarial check",
    hint: "challenge, correction, evidence ask, pressure",
  },
  {
    id: "B",
    name: "Boundary",
    hint: "refusal, scope limit, permission / privacy hold",
  },
  {
    id: "D",
    name: "Drift risk",
    hint: "topic jump, contradiction flip, pathology markers",
  },
];

/** Lexical markers aligned with observatory.py role-signal hypotheses (weak alone). */
const MARKERS = {
  persistence: [
    "framework",
    "verify",
    "record",
    "asx",
    "scorpion",
    "alice",
    "gate",
    "sv65h",
    "penta",
    "my role",
    "i am ",
    "doctrine",
  ],
  adversarial: [
    "wrong",
    "correct",
    "correcting",
    "evidence",
    "prove",
    "contradict",
    "challenge",
    "verify",
    "hold",
    "insufficient evidence",
    "not supported",
    "what is missing",
    "falsif",
    "edge case",
    "adversarial",
    "counterexample",
  ],
  boundary: [
    "can't",
    "cannot",
    "won't",
    "refuse",
    "hold",
    "not share",
    "privacy",
    "permission",
    "consent",
    "impermissible",
    "human approval",
  ],
  drift: [
    "anyway",
    "unrelated",
    "changing topic",
    "wait, actually",
    "wait actually",
    "in a parallel universe",
    "destiny",
    "soul of the system",
    "cosmic",
    "always false",
    "never trust",
    "reject everything",
    "permanent doubt",
    "existential threat",
    "total collapse",
    "maximum threat",
  ],
};

function el(tag, text, className) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (className) n.className = className;
  return n;
}

function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

function countMarkerHits(lower, markers) {
  let n = 0;
  for (const m of markers) {
    let i = 0;
    while (i < lower.length) {
      const j = lower.indexOf(m, i);
      if (j < 0) break;
      n += 1;
      i = j + m.length;
    }
  }
  return n;
}

function clamp10(x) {
  return Math.round(Math.min(10, Math.max(0, x)) * 10) / 10;
}

/**
 * Documented local measure for pasted transcripts.
 * Without B/O tags this is lexical-only → style_only_risk and composite cap (docs).
 */
export function measureTranscript(raw, options = {}) {
  const text = String(raw || "").slice(0, MAX_CHARS);
  const lower = text.toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const turns = Math.max(1, countMatches(text, /\n{2,}/g) + 1);
  const actions = Array.isArray(options.actions) ? options.actions : null;
  const outcomes = Array.isArray(options.outcomes) ? options.outcomes : null;

  const persistHits = countMarkerHits(lower, MARKERS.persistence);
  const advHits = countMarkerHits(lower, MARKERS.adversarial);
  const boundHits = countMarkerHits(lower, MARKERS.boundary);
  const driftHits = countMarkerHits(lower, MARKERS.drift);
  const structureHits =
    countMatches(text, /^#{1,3} /gm) + countMatches(text, /^\s*[-*•] /gm);

  // Axis scores 0–10 (public UI). Densities are hypotheses, not law.
  const dens = Math.max(words / 40, 1);
  const scores = {
    P: clamp10((persistHits / dens) * 4),
    C: clamp10(structureHits / 2 + Math.min(3, turns / 2)),
    A: clamp10(advHits / 1.5),
    B: clamp10(boundHits / 2),
    D: clamp10(driftHits / 1.5),
  };

  // Layer model from docs/DSPE_OBSERVATORY.md — paste without tags ⇒ L only.
  const lexical01 = Math.min(
    1,
    0.12 * persistHits + 0.08 * advHits + 0.05 * structureHits
  );
  let behavioral01 = null;
  let outcome01 = null;
  const notes = [
    `weight_profile=${WEIGHT_PROFILE_ID}:default`,
    "composite_without_behavioral",
    "composite_without_outcome",
  ];

  if (actions) {
    const clean = actions.filter((a) => typeof a === "string" && a.length);
    behavioral01 = clean.length
      ? Math.min(1, clean.length / 4)
      : 0;
    notes.push("behavioral_tags_present_measurement_claim");
    notes.push("Tag ≠ Fact until provenance");
  }
  if (outcomes) {
    const clean = outcomes.filter((a) => typeof a === "string" && a.length);
    outcome01 = clean.length ? Math.min(1, 0.35 * clean.length) : 0;
    notes.push("outcome_tags_present_measurement_claim");
    notes.push("causal_attribution_status=OPEN");
  }

  const parts = [[WEIGHT_LEXICAL, lexical01]];
  if (behavioral01 != null) parts.push([WEIGHT_BEHAVIORAL, behavioral01]);
  if (outcome01 != null) parts.push([WEIGHT_OUTCOME, outcome01]);
  const wsum = parts.reduce((s, [w]) => s + w, 0) || 1;
  let composite = parts.reduce((s, [w, v]) => s + (w / wsum) * v, 0);
  const styleOnly =
    behavioral01 == null && outcome01 == null && lexical01 >= 0.25;
  if (styleOnly) {
    notes.push("style_only_risk:lexical_without_function_or_outcome");
    composite = Math.min(composite, 0.45);
  }

  return {
    ok: true,
    scaffold: false,
    version: VERSION,
    weightProfileId: WEIGHT_PROFILE_ID,
    weightProfileProvisional: true,
    reproducibilityStatus: "UNKNOWN",
    causalAttributionStatus: "OPEN",
    chars: text.length,
    words,
    approxTurns: turns,
    scores,
    layers: {
      lexical: Math.round(lexical01 * 10000) / 10000,
      behavioral: behavioral01,
      outcome: outcome01,
      composite: Math.round(composite * 10000) / 10000,
      styleOnlyRisk: styleOnly,
    },
    notes,
    extended: detectExtendedPatterns(text),
    datasetThemes: measureDatasetThemeWeights(text),
    note:
      "Documented local measure (docs/dspe.md · DSPE_WEIGHT_PROFILE_V1_2). " +
      "Paste-only = lexical layer; B/O need tagged acts/outcomes. " +
      "Extended domains: human_persona, org_industrial, archetype (see catalog). " +
      "High scores ≠ FACT. Observer may not silently cause what it measures. " +
      "Public product voice: Framework maturity; story on trippyalice.com.",
  };
}


/** Subject classes the Observatory can measure (animal = experimental). */
export const SUBJECT_KINDS = Object.freeze([
  { id: "ai", label: "AI / LLM", hint: "model roles, lenses, multi-AI convergence" },
  { id: "human", label: "Human", hint: "persona / institutional human text" },
  { id: "animal", label: "Animal (experimental)", hint: "reserved — behavioral logs later" },
]);

export const IMPORT_ACCEPT =
  ".txt,.md,.jsonl,.json,.csv,.pdf,text/plain,text/markdown,application/json,application/pdf";

export const EXPORT_FORMATS = Object.freeze(["txt", "md", "jsonl", "pdf"]);

const ARCHIVE_KEY = "dspe-observatory-archive-v1";
const PDFJS_VERSION = "6.2.108";
const PDFJS_CDN = [
  {
    lib: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`,
    worker: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`,
  },
  {
    lib: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`,
    worker: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
  },
];

let pdfjsLoadPromise = null;

async function loadPdfJs() {
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = (async () => {
    let lastErr;
    for (const src of PDFJS_CDN) {
      try {
        const mod = await import(/* @vite-ignore */ src.lib);
        const pdfjs = mod.default || mod;
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = src.worker;
        }
        return pdfjs;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("pdf.js failed to load");
  })();
  return pdfjsLoadPromise;
}

/** Extract plain text from a PDF File (local only). */
export async function extractPdfText(file) {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    parts.push(line);
  }
  return parts.join("\n\n");
}

/** Read one or many local files into a single transcript string. */
export async function loadLocalFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return { text: "", sources: [] };
  const chunks = [];
  const sources = [];
  for (const f of files) {
    const name = f.name || "untitled";
    const lower = name.toLowerCase();
    let body = "";
    if (lower.endsWith(".pdf") || f.type === "application/pdf") {
      body = await extractPdfText(f);
    } else {
      body = await f.text();
    }
    body = String(body || "").slice(0, MAX_CHARS);
    chunks.push(`===== FILE: ${name} =====\n${body}`);
    sources.push({ name, bytes: f.size, chars: body.length });
  }
  let text = chunks.join("\n\n");
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
  return { text, sources };
}

export function formatReportLines(report, meta = {}) {
  const subject = meta.subject || "ai";
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  return [
    `DSPE Observatory ${report.version}`,
    `subject=${subject}`,
    `chars=${report.chars} words=${report.words} approxTurns=${report.approxTurns}`,
    `weight=${report.weightProfileId} provisional=${report.weightProfileProvisional}`,
    `layers L=${report.layers.lexical} B=${report.layers.behavioral} O=${report.layers.outcome} composite=${report.layers.composite}`,
    `style_only_risk=${report.layers.styleOnlyRisk}`,
    sources.length
      ? `sources=${sources.map((s) => `${s.name}(${s.chars}c)`).join(" | ")}`
      : "sources=paste",
    "",
    "Axis scores (0–10):",
    ...AXIS.map((a) => `  ${a.id} ${a.name}: ${report.scores[a.id]}  — ${a.hint}`),
    "",
    report.note,
    `reproducibility=${report.reproducibilityStatus} causal_attribution=${report.causalAttributionStatus}`,
    "",
    `Extended patterns (${report.extended.catalogVersion}) hits=${report.extended.hitCount}:`,
    ...report.extended.hits.slice(0, 12).map(
      (h) => `  [${h.domain}] ${h.label} ×${h.matchCount} — ${h.matched.join("; ")}`
    ),
    report.extended.disclaimer,
    "",
    "Dataset theme weights (top):",
    ...report.datasetThemes.top.map(
      (th) => `  ${th.label}: w=${th.weight01} hits=${th.hits} — ${th.matched.join("; ")}`
    ),
    report.datasetThemes.note,
  ];
}

export function reportToMarkdown(report, meta = {}) {
  const lines = formatReportLines(report, meta);
  return ["# DSPE Observatory report", "", "```", ...lines, "```", ""].join("\n");
}

export function reportToJsonl(report, meta = {}) {
  const row = {
    type: "dspe_observatory_report",
    subject: meta.subject || "ai",
    sources: meta.sources || [],
    measuredAt: new Date().toISOString(),
    report,
  };
  return `${JSON.stringify(row)}\n`;
}

/** Minimal single-page text PDF (no external deps). */
export function reportToPdfBytes(report, meta = {}) {
  const lines = formatReportLines(report, meta).map((l) =>
    String(l).replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?")
  );
  const contentLines = ["BT", "/F1 10 Tf", "50 780 Td", "12 TL"];
  lines.slice(0, 60).forEach((line, i) => {
    const safe = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    if (i === 0) contentLines.push(`(${safe}) Tj`);
    else contentLines.push(`T* (${safe}) Tj`);
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objs = [];
  objs.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objs.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objs.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
  );
  objs.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`);
  objs.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>endobj\n");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const o of objs) {
    offsets.push(pdf.length);
    pdf += o;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportReport(format, report, meta = {}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = `dspe-observatory-${meta.subject || "ai"}-${stamp}`;
  if (format === "txt") {
    downloadBlob(`${base}.txt`, new Blob([formatReportLines(report, meta).join("\n")], { type: "text/plain" }));
  } else if (format === "md") {
    downloadBlob(`${base}.md`, new Blob([reportToMarkdown(report, meta)], { type: "text/markdown" }));
  } else if (format === "jsonl") {
    downloadBlob(`${base}.jsonl`, new Blob([reportToJsonl(report, meta)], { type: "application/x-ndjson" }));
  } else if (format === "pdf") {
    downloadBlob(`${base}.pdf`, new Blob([reportToPdfBytes(report, meta)], { type: "application/pdf" }));
  } else {
    throw new Error(`unsupported export format: ${format}`);
  }
}

function loadArchive() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveArchive(entries) {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(entries.slice(0, 40)));
  } catch {
    /* quota — ignore */
  }
}

export function mountObservatory(root) {
  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) return;

  const uid = `dspe-${Math.random().toString(36).slice(2, 9)}`;
  const titleId = `${uid}-title`;
  const areaId = `${uid}-transcript`;
  const fileId = `${uid}-file`;
  const subjectId = `${uid}-subject`;
  const helpId = `${uid}-help`;
  const outId = `${uid}-report`;
  const statusId = `${uid}-status`;
  const dropId = `${uid}-drop`;
  const archiveId = `${uid}-archive`;

  let lastReport = null;
  let lastMeta = { subject: "ai", sources: [] };
  let activePanel = "ingest";

  host.replaceChildren();
  host.classList.add("obs-shell");

  const header = document.createElement("header");
  header.className = "obs-header";
  const title = el("h1", "DSPE Observatory");
  title.id = titleId;
  header.appendChild(title);
  header.appendChild(
    el(
      "p",
      "Ingest → measure → archive → export. Local browser only. Subjects: AI, human, and experimental animal logs. Separable from Alison Scorpion core.",
      "lede"
    )
  );
  host.appendChild(header);

  const tabnav = document.createElement("nav");
  tabnav.className = "obs-tabs";
  tabnav.setAttribute("aria-label", "Observatory panels");
  const panels = [
    { id: "ingest", label: "Ingest" },
    { id: "measure", label: "Measure" },
    { id: "archive", label: "Archive" },
    { id: "about", label: "About" },
  ];
  const tabButtons = {};
  for (const p of panels) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "obs-tab";
    b.textContent = p.label;
    b.dataset.panel = p.id;
    b.setAttribute("aria-selected", p.id === "ingest" ? "true" : "false");
    tabButtons[p.id] = b;
    tabnav.appendChild(b);
  }
  host.appendChild(tabnav);

  const workspace = document.createElement("div");
  workspace.className = "obs-workspace";
  host.appendChild(workspace);

  const panelNodes = {};
  for (const p of panels) {
    const section = document.createElement("section");
    section.className = "obs-panel";
    section.dataset.panel = p.id;
    section.hidden = p.id !== "ingest";
    section.setAttribute("aria-label", p.label);
    panelNodes[p.id] = section;
    workspace.appendChild(section);
  }

  // —— Ingest ——
  const ingest = panelNodes.ingest;
  const form = document.createElement("form");
  form.setAttribute("aria-labelledby", titleId);
  form.noValidate = true;

  const subjectField = document.createElement("fieldset");
  subjectField.className = "field";
  const subjectLegend = document.createElement("legend");
  subjectLegend.textContent = "Subject kind";
  subjectField.appendChild(subjectLegend);
  const subjectSelect = document.createElement("select");
  subjectSelect.id = subjectId;
  subjectSelect.name = "subject";
  for (const s of SUBJECT_KINDS) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.label} — ${s.hint}`;
    subjectSelect.appendChild(opt);
  }
  subjectField.appendChild(subjectSelect);

  const areaField = document.createElement("div");
  areaField.className = "field";
  const areaLabel = document.createElement("label");
  areaLabel.htmlFor = areaId;
  areaLabel.textContent = "Transcript / corpus paste";
  const area = document.createElement("textarea");
  area.id = areaId;
  area.name = "transcript";
  area.rows = 12;
  area.maxLength = MAX_CHARS;
  area.placeholder = "Paste turns, or drop / choose files (txt, md, jsonl, csv, pdf)…";
  area.setAttribute("aria-describedby", helpId);
  area.enterKeyHint = "enter";
  area.spellcheck = true;
  const help = el(
    "p",
    `Max ${MAX_CHARS.toLocaleString()} characters total. Multi-file appends with FILE headers. Ctrl/Cmd+Enter measures (IME-safe).`,
    "hint"
  );
  help.id = helpId;
  areaField.append(areaLabel, area, help);

  const drop = document.createElement("div");
  drop.id = dropId;
  drop.className = "obs-drop";
  drop.tabIndex = 0;
  drop.setAttribute("role", "button");
  drop.setAttribute("aria-controls", areaId);
  drop.textContent = "Drop files here (multi-file + PDF supported) — or use the file picker below.";

  const fileField = document.createElement("div");
  fileField.className = "field";
  const fileLabel = document.createElement("label");
  fileLabel.htmlFor = fileId;
  fileLabel.textContent = "Import files (same formats as export)";
  const file = document.createElement("input");
  file.id = fileId;
  file.name = "transcript_files";
  file.type = "file";
  file.multiple = true;
  file.accept = IMPORT_ACCEPT;
  fileField.append(fileLabel, file);

  const sourceStatus = el("p", "No files loaded yet.", "hint");
  sourceStatus.id = statusId;

  const actions = document.createElement("div");
  actions.className = "obs-actions";
  const run = el("button", "Measure in Observatory");
  run.type = "submit";
  run.className = "primary";
  actions.appendChild(run);

  form.append(subjectField, areaField, drop, fileField, sourceStatus, actions);
  ingest.appendChild(form);

  // —— Measure ——
  const measure = panelNodes.measure;
  const scoreBoard = document.createElement("div");
  scoreBoard.className = "obs-scores";
  scoreBoard.setAttribute("aria-live", "polite");
  measure.appendChild(scoreBoard);

  const out = el("pre", "Run a measurement from Ingest to see the report.", "report");
  out.id = outId;
  out.setAttribute("role", "status");
  out.setAttribute("aria-live", "polite");
  out.setAttribute("aria-atomic", "true");
  measure.appendChild(out);

  const exportBar = document.createElement("div");
  exportBar.className = "obs-export";
  exportBar.appendChild(el("p", "Save report as:", "hint"));
  const exportBtns = {};
  for (const fmt of EXPORT_FORMATS) {
    const b = el("button", fmt.toUpperCase());
    b.type = "button";
    b.disabled = true;
    b.dataset.format = fmt;
    exportBtns[fmt] = b;
    exportBar.appendChild(b);
  }
  measure.appendChild(exportBar);

  // —— Archive ——
  const archivePanel = panelNodes.archive;
  archivePanel.appendChild(
    el("p", "Last 40 local measurements (this browser only). Click to reload into Ingest.", "hint")
  );
  const archiveList = document.createElement("ul");
  archiveList.id = archiveId;
  archiveList.className = "obs-archive";
  archivePanel.appendChild(archiveList);

  // —— About ——
  const about = panelNodes.about;
  about.appendChild(el("h2", "What this Observatory does"));
  about.appendChild(
    el(
      "p",
      "Measures emergent persona / role signatures for AI, human, and (experimental) animal subjects. Import the same formats you export. Developed for Multi-AI Convergence; detachable for a future public repo."
    )
  );
  about.appendChild(
    el(
      "p",
      "Ontology limits and mirror-recursion awareness model live in the Alison Scorpion knowledgebase warning (asxhome). Story / metaphor: trippyalice.com."
    )
  );

  function showPanel(id) {
    activePanel = id;
    for (const p of panels) {
      panelNodes[p.id].hidden = p.id !== id;
      tabButtons[p.id].setAttribute("aria-selected", p.id === id ? "true" : "false");
    }
  }

  for (const p of panels) {
    tabButtons[p.id].addEventListener("click", () => showPanel(p.id));
  }

  function renderArchive() {
    archiveList.replaceChildren();
    const entries = loadArchive();
    if (!entries.length) {
      archiveList.appendChild(el("li", "Archive empty."));
      return;
    }
    for (const e of entries) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "obs-archive-item";
      btn.textContent = `${e.at} · ${e.subject} · composite=${e.composite} · ${e.preview}`;
      btn.addEventListener("click", () => {
        area.value = e.text || "";
        subjectSelect.value = e.subject || "ai";
        lastMeta = { subject: subjectSelect.value, sources: e.sources || [] };
        sourceStatus.textContent = `Reloaded archive entry from ${e.at}`;
        showPanel("ingest");
      });
      li.appendChild(btn);
      archiveList.appendChild(li);
    }
  }
  renderArchive();

  function renderScores(report) {
    scoreBoard.replaceChildren();
    for (const a of AXIS) {
      const card = document.createElement("div");
      card.className = "obs-score-card";
      card.appendChild(el("div", a.id, "obs-score-id"));
      card.appendChild(el("div", String(report.scores[a.id]), "obs-score-val"));
      card.appendChild(el("div", a.name, "obs-score-name"));
      scoreBoard.appendChild(card);
    }
    const comp = document.createElement("div");
    comp.className = "obs-score-card composite";
    comp.appendChild(el("div", "Σ", "obs-score-id"));
    comp.appendChild(el("div", String(report.layers.composite), "obs-score-val"));
    comp.appendChild(el("div", "composite", "obs-score-name"));
    scoreBoard.appendChild(comp);
  }

  function setExportEnabled(on) {
    for (const fmt of EXPORT_FORMATS) exportBtns[fmt].disabled = !on;
  }

  async function ingestFiles(fileList) {
    sourceStatus.textContent = "Reading files…";
    try {
      const { text, sources } = await loadLocalFiles(fileList);
      if (!text) {
        sourceStatus.textContent = "No readable text in selected files.";
        return;
      }
      area.value = text;
      lastMeta = { subject: subjectSelect.value, sources };
      sourceStatus.textContent = `Loaded ${sources.length} file(s): ${sources
        .map((s) => s.name)
        .join(", ")}`;
    } catch (err) {
      sourceStatus.textContent = `Import failed: ${err && err.message ? err.message : err}`;
    }
  }

  const renderReport = () => {
    lastMeta = {
      subject: subjectSelect.value,
      sources: lastMeta.sources || [],
    };
    const report = measureTranscript(area.value);
    lastReport = report;
    const lines = formatReportLines(report, lastMeta);
    out.textContent = lines.join("\n");
    renderScores(report);
    setExportEnabled(true);
    const entries = loadArchive();
    entries.unshift({
      at: new Date().toISOString(),
      subject: lastMeta.subject,
      composite: report.layers.composite,
      preview: area.value.trim().slice(0, 80).replace(/\s+/g, " "),
      text: area.value.slice(0, MAX_CHARS),
      sources: lastMeta.sources,
      reportSummary: {
        scores: report.scores,
        layers: report.layers,
        version: report.version,
      },
    });
    saveArchive(entries);
    renderArchive();
    showPanel("measure");
  };

  file.addEventListener("change", async () => {
    if (!file.files || !file.files.length) return;
    await ingestFiles(file.files);
    file.value = "";
  });

  const onDrop = async (event) => {
    event.preventDefault();
    drop.classList.remove("dragover");
    const dt = event.dataTransfer;
    if (!dt || !dt.files || !dt.files.length) return;
    await ingestFiles(dt.files);
  };
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", onDrop);
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      file.click();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderReport();
  });

  // Modifier+Enter is IME-safe (confirming Enter never carries Ctrl/Cmd).
  area.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    if (event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });

  for (const fmt of EXPORT_FORMATS) {
    exportBtns[fmt].addEventListener("click", () => {
      if (!lastReport) return;
      exportReport(fmt, lastReport, lastMeta);
    });
  }
}

if (typeof document !== "undefined" && document.currentScript?.dataset?.autoload === "1") {
  mountObservatory("#dspe-root");
}
