/**
 * DSPE Observatory — separable client measure (public desktop).
 * Docs: asxhome docs/dspe.md · docs/DSPE_OBSERVATORY.md · src/core/dspe/observatory.py
 *
 * Metrology only. Not a consciousness claim. Not under Penta.
 * Paste-only runs are lexical (α); B/O layers need tagged acts/outcomes.
 * High scores ≠ FACT. Observer may not silently cause what it measures.
 */

const MAX_CHARS = 200_000;
const WEIGHT_PROFILE_ID = "DSPE_WEIGHT_PROFILE_V1_2";
const WEIGHT_LEXICAL = 0.15; // α
const WEIGHT_BEHAVIORAL = 0.35; // β
const WEIGHT_OUTCOME = 0.5; // γ
const VERSION = "dspe-observatory-v0.2-docs-aligned";

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
    note:
      "Documented local measure (docs/dspe.md · DSPE_WEIGHT_PROFILE_V1_2). " +
      "Paste-only = lexical layer; B/O need tagged acts/outcomes. " +
      "High scores ≠ FACT. Observer may not silently cause what it measures. " +
      "Public product voice: Framework maturity; story on trippyalice.com.",
  };
}

export function mountObservatory(root) {
  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) return;

  host.replaceChildren();
  host.appendChild(el("h1", "DSPE Observatory"));
  host.appendChild(
    el(
      "p",
      "Paste a chat transcript (or drop a .txt / .md / .jsonl). Measurement runs in this browser. Nothing is uploaded. Separable module — not required for Alison Scorpion core.",
      "lede"
    )
  );

  const area = document.createElement("textarea");
  area.rows = 14;
  area.placeholder = "Paste Alice ↔ AI turns here…";
  area.setAttribute("aria-label", "Transcript paste");
  host.appendChild(area);

  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".txt,.md,.jsonl,.json,.csv";
  host.appendChild(file);

  const run = el("button", "Measure locally");
  run.type = "button";
  host.appendChild(run);

  const out = el("pre", "", "report");
  out.setAttribute("aria-live", "polite");
  host.appendChild(out);

  file.addEventListener("change", async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    area.value = (await f.text()).slice(0, MAX_CHARS);
  });

  run.addEventListener("click", () => {
    const report = measureTranscript(area.value);
    const lines = [
      `DSPE Observatory ${report.version}`,
      `chars=${report.chars} words=${report.words} approxTurns=${report.approxTurns}`,
      `weight=${report.weightProfileId} provisional=${report.weightProfileProvisional}`,
      `layers L=${report.layers.lexical} B=${report.layers.behavioral} O=${report.layers.outcome} composite=${report.layers.composite}`,
      `style_only_risk=${report.layers.styleOnlyRisk}`,
      "",
      "Axis scores (0–10):",
      ...AXIS.map((a) => `  ${a.id} ${a.name}: ${report.scores[a.id]}  — ${a.hint}`),
      "",
      report.note,
      `reproducibility=${report.reproducibilityStatus} causal_attribution=${report.causalAttributionStatus}`,
    ];
    out.textContent = lines.join("\n");
  });
}

if (typeof document !== "undefined" && document.currentScript?.dataset?.autoload === "1") {
  mountObservatory("#dspe-root");
}
