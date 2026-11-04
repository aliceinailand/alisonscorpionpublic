/**
 * DSPE Observatory — separable client (Wave B). Measures via ./dspe-axes.js.
 * Metrology only: measures pasted interaction text locally.
 * Not a consciousness claim. Not attached to Penta as a mind.
 * Can move to its own public repo later without the desktop shell.
 */

const MAX_CHARS = 200_000;

import { AXIS_DEFS as AXIS, measureAnnotations, parseAnnotations, AXES_VERSION } from "./dspe-axes.js";

function el(tag, text, className) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (className) n.className = className;
  return n;
}

/**
 * Real DSPE P/C/A/B/D (docs/dspe.md v1.4 axes; see dspe-axes.js).
 * Input: annotation events as JSON array/object or JSONL.
 * Raw prose is NOT scored (axes measure annotations, not text); it is
 * reported as one empty, unannotated observation so nothing is invented.
 */
export function measureTranscript(raw, { sourceArtifact = "" } = {}) {
  const text = String(raw || "").slice(0, MAX_CHARS);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const parsed = parseAnnotations(text);
  const isAnnotations = Array.isArray(parsed) && parsed.length > 0;
  const events = isAnnotations ? parsed : text.trim()
    ? [{ source_artifact: sourceArtifact, source_span: "", tagging_method: "unknown" }]
    : [];
  const result = measureAnnotations(events);
  return {
    ok: true,
    scaffold: false,
    version: "dspe-observatory-web-0.2",
    axesVersion: AXES_VERSION,
    inputKind: isAnnotations ? "annotations" : text.trim() ? "raw_text_unannotated" : "empty",
    chars: text.length,
    words,
    ...result,
    note: isAnnotations
      ? "P/C/A/B/D are separate axes, not one score. Provenance ≠ correctness; Tag ≠ Fact; correctness UNKNOWN."
      : "Raw text has no annotation provenance: grade 'empty'. Paste annotation events (JSON/JSONL with tagger, tagging_method, source_span, behavior_tags, confidence, counterevidence, blind_to_expected_role) to measure P/C/A/B/D.",
  };
}

const fmt = (v) => (v == null ? "n/a" : String(v));

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
  area.placeholder = "Paste DSPE annotation events (JSON array or JSONL)…";
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
    const report = measureTranscript(area.value, { sourceArtifact: (file.files && file.files[0] && file.files[0].name) || "" });
    const lines = [
      `DSPE Observatory ${report.version} · ${report.axesVersion}`,
      `input=${report.inputKind} events=${report.count} chars=${report.chars}`,
      "",
    ];
    report.events.forEach((ev, i) => {
      lines.push(`Event ${i + 1} ${ev.event.event_id || ""} grade=${ev.grade} scale=${ev.b_o_weight_scale} correctness=${ev.correctness}`);
      for (const a of AXIS) lines.push(`  ${a.id} ${a.name}: ${fmt(ev.axes[a.key])}  — ${a.question}`);
      if (ev.missing_required.length) lines.push(`  missing: ${ev.missing_required.join(", ")}`);
    });
    lines.push("", report.note,
      "Developed for Multi-AI Convergence measurement (ASX). Public product voice: Framework maturity; story on trippyalice.com.");
    out.textContent = lines.join("\n");
  });
}

if (typeof document !== "undefined" && document.currentScript?.dataset?.autoload === "1") {
  mountObservatory("#dspe-root");
}
