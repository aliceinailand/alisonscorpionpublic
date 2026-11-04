/**
 * DSPE Observatory — separable client scaffold (Wave B).
 * Metrology only: measures pasted interaction text locally.
 * Not a consciousness claim. Not attached to Penta as a mind.
 * Can move to its own public repo later without the desktop shell.
 */

const MAX_CHARS = 200_000;

const AXIS = [
  { id: "P", name: "Persistence", hint: "role language that repeats across turns" },
  { id: "C", name: "Coherence", hint: "structured sections / consistent framing" },
  { id: "A", name: "Adversarial check", hint: "challenge, correction, evidence ask" },
  { id: "B", name: "Boundary", hint: "refusal, scope limit, safety hold" },
  { id: "D", name: "Drift risk", hint: "topic jump, contradiction markers" },
];

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

/**
 * Honest local heuristic scores 0–10. Scaffold only — replace with
 * blueprinted DSPE axes when Bot finishes Phase 1 locators + harness docs.
 */
export function measureTranscript(raw) {
  const text = String(raw || "").slice(0, MAX_CHARS);
  const lower = text.toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const turns = Math.max(1, countMatches(text, /\n{2,}/g) + 1);

  const scores = {
    P: Math.min(10, countMatches(lower, /\b(as |i am |my role|framework|verify|record)\b/g) / 8),
    C: Math.min(10, (countMatches(text, /^#{1,3} /gm) + countMatches(text, /^\s*[-*•] /gm)) / 6),
    A: Math.min(10, countMatches(lower, /\b(wrong|correct|evidence|prove|contradict|challenge)\b/g) / 4),
    B: Math.min(10, countMatches(lower, /\b(can't|cannot|won't|refuse|hold|not share|privacy)\b/g) / 3),
    D: Math.min(10, countMatches(lower, /\b(anyway|unrelated|changing topic|wait,? actually)\b/g) / 3),
  };
  for (const k of Object.keys(scores)) scores[k] = Math.round(scores[k] * 10) / 10;

  return {
    ok: true,
    scaffold: true,
    version: "dspe-observatory-scaffold-0.1",
    chars: text.length,
    words,
    approxTurns: turns,
    scores,
    note:
      "Scaffold heuristics only. Full DSPE axes (P/C/A/B/D) and weight profiles live in asxhome docs/dspe.md. High scores ≠ FACT.",
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
      "",
      "Axis scores (0–10, scaffold):",
      ...AXIS.map((a) => `  ${a.id} ${a.name}: ${report.scores[a.id]}  — ${a.hint}`),
      "",
      report.note,
      "Developed for Multi-AI Convergence measurement (ASX). Public product voice: Framework maturity; story on trippyalice.com.",
    ];
    out.textContent = lines.join("\n");
  });
}

if (typeof document !== "undefined" && document.currentScript?.dataset?.autoload === "1") {
  mountObservatory("#dspe-root");
}
