/**
 * DSPE measurement axes P/C/A/B/D — pure, separable module (no DOM).
 *
 * Literal JS port of asxhome `src/core/dspe/annotation.py`
 * (measurement_axes, scale_from_axes, provenance_grade,
 * inter_annotator_agreement, apply_agreement_to_events), which implements
 * the axes table in docs/dspe_observatory.md §"Provenance ≠ correctness (v1.4+)"
 * referenced by docs/dspe.md ("Axes: P/C/A/B/D (not one collapsed score)").
 *
 *   P — provenance completeness   (can we reconstruct who/how/where/when?)
 *   C — annotation confidence     (how certain is the tagger?)
 *   A — inter-observer agreement  (do independent observers agree? majority ≠ truth)
 *   B — blinding integrity        (was the annotator blind to expected role?)
 *   D — counterevidence / dispute (1 = clean, lower = disputed)
 *
 * Axes measure ANNOTATIONS (tags = measurement claims), not raw prose.
 * Tag ≠ Fact. Provenance ≠ correctness. correctness is always "UNKNOWN".
 * No consciousness claims.
 */

export const AXES_VERSION = "dspe-axes-js-0.2 (port of annotation.py, dspe-observatory-v1.6.0)";
export const WEIGHT_PROFILE_ID = "DSPE_WEIGHT_PROFILE_V1_2";

export const TAG_NEQ_FACT = "A behavioral or outcome tag is a measurement claim, not ground truth.";
export const PROVENANCE_NEQ_CORRECTNESS =
  "Provenance establishes auditability, not correctness. Complete provenance ≠ correct measurement.";
export const SOURCE_CLAIM_SEPARATION =
  "Source status and claim status must remain separate: can we audit the measurement? vs do we agree with the measurement?";

export const TAGGING_METHODS = [
  "human_operator", "human_blind", "second_annotator",
  "harness_instrumented", "automated_rule", "unknown",
];

export const AXIS_DEFS = [
  { id: "P", key: "P_provenance_completeness", name: "Provenance completeness", question: "Can we reconstruct who/how/where/when? (auditability)" },
  { id: "C", key: "C_annotation_confidence", name: "Annotation confidence", question: "How certain is the tagger?" },
  { id: "A", key: "A_inter_observer_agreement", name: "Inter-observer agreement", question: "Do independent observers agree? (majority ≠ truth)" },
  { id: "B", key: "B_blinding_integrity", name: "Blinding integrity", question: "Was the annotator blind to expected role?" },
  { id: "D", key: "D_counterevidence_clean", name: "Counterevidence / dispute", question: "Is there counterevidence? (dispute separate from P)" },
];

// Python round(x, 4) equivalent for display purposes (ties may differ from banker's rounding at the 5th decimal).
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const str = (v) => (v == null ? "" : String(v));
// Python truthiness for `x or default` on numbers: 0, null, undefined, NaN fall through.
const orDefault = (v, dflt) => (v == null || v === 0 || v === "" || v === false || Number.isNaN(Number(v)) ? dflt : Number(v));

/** Normalize a raw dict to an annotation event (mirrors _as_event). */
export function asEvent(e) {
  const ev = e || {};
  return {
    event_id: str(ev.event_id),
    engine_id: str(ev.engine_id),
    role_under_test: str(ev.role_under_test || ev.role),
    behavior_tags: [...(ev.behavior_tags || ev.actions || [])],
    outcome_tags: [...(ev.outcome_tags || ev.outcomes || [])],
    tagger: str(ev.tagger),
    tagging_method: str(ev.tagging_method || "unknown"),
    timestamp: str(ev.timestamp),
    model_version: str(ev.model_version),
    baseline_condition: str(ev.baseline_condition),
    source_artifact: str(ev.source_artifact),
    source_span: str(ev.source_span),
    confidence: ev.confidence == null ? null : ev.confidence,
    counterevidence: str(ev.counterevidence),
    blind_to_expected_role: ev.blind_to_expected_role === true ? true : ev.blind_to_expected_role === false ? false : null,
    observation_id: str(ev.observation_id),
    observation_lock: ev.observation_lock && typeof ev.observation_lock === "object" ? { ...ev.observation_lock } : {},
  };
}

/** Separate P, C, A, B, D — never collapsed into one truth-like score. */
export function measurementAxes(event) {
  const e = asEvent(event);
  const missing = [];
  if (!e.tagger.trim()) missing.push("tagger");
  if (!e.tagging_method || e.tagging_method === "unknown") missing.push("tagging_method");
  if (!e.source_span.trim() && !e.source_artifact.trim()) missing.push("source_span_or_artifact");

  // P: present required / 3, +0.1 lock bonus, +0.05 human_blind, capped at 1.
  let p = clamp01((3 - missing.length) / 3);
  if (Object.keys(e.observation_lock).length || e.observation_id) p = Math.min(1, p + 0.1);
  if (e.tagging_method === "human_blind") p = Math.min(1, p + 0.05);

  // C: tagger's own confidence, clamped; null when not supplied.
  const c = e.confidence == null ? null : clamp01(Number(e.confidence));

  // A: only filled by inter-annotator analysis (applyAgreementToEvents).
  const a = null;

  // B: true → 1.0, false → 0.25, unknown → 0.5.
  const b = e.blind_to_expected_role === true ? 1.0 : e.blind_to_expected_role === false ? 0.25 : 0.5;

  // D: any counterevidence text → 0.35 + dispute_state; else 1.0.
  const disputed = Boolean(e.counterevidence.trim());
  const d = disputed ? 0.35 : 1.0;

  const hasTags = e.behavior_tags.length > 0 || e.outcome_tags.length > 0;
  const grade = !hasTags ? "empty" : missing.length >= 2 ? "bare" : missing.length ? "partial" : "provenance_bearing";

  return {
    P_provenance_completeness: r4(p),
    C_annotation_confidence: c,
    A_inter_observer_agreement: a,
    B_blinding_integrity: r4(b),
    D_counterevidence_clean: r4(d),
    dispute_state: disputed,
    provenance_grade: grade,
    missing_required: missing,
    provenance_neq_correctness: PROVENANCE_NEQ_CORRECTNESS,
    source_claim_separation: SOURCE_CLAIM_SEPARATION,
    note: "P=1.0 means full provenance weight (auditability), not truth probability = 100%.",
  };
}

/**
 * Map axes → B/O evidence weight scale (not correctness).
 * NOTE (literal port): Python uses `float(x or default)`, so D=0 reads as 1.0
 * and B=0 reads as 0.5. Reproduced exactly; D only reaches 0.35 in practice.
 */
export function scaleFromAxes(axes) {
  const ax = axes || {};
  const p = orDefault(ax.P_provenance_completeness, 0);
  const b = orDefault(ax.B_blinding_integrity, 0.5);
  const c = ax.C_annotation_confidence;
  const a = ax.A_inter_observer_agreement;
  let base = p >= 0.95 ? 1.0 : p >= 0.66 ? 0.75 : p >= 0.33 ? 0.5 : 0.35;
  if (ax.dispute_state) base *= 0.65;
  base *= 0.7 + 0.3 * b;
  if (c != null) base *= 0.85 + 0.15 * Number(c);
  if (a != null) base *= 0.8 + 0.2 * Number(a);
  return r4(Math.max(0.15, Math.min(1, base)));
}

/** Grade one annotation event (mirrors provenance_grade). correctness is always UNKNOWN. */
export function provenanceGrade(event) {
  const e = asEvent(event);
  const axes = measurementAxes(e);
  const weakMethod = e.tagging_method === "automated_rule" || e.tagging_method === "unknown";
  const scale = scaleFromAxes(axes);
  return {
    grade: axes.provenance_grade,
    dispute_state: axes.dispute_state,
    axes,
    b_o_weight_scale: scale,
    truth_class: "MEASUREMENT_CLAIM",
    tag_neq_fact: TAG_NEQ_FACT,
    missing_required: axes.missing_required,
    blind_to_expected_role: e.blind_to_expected_role === true,
    weak_method: weakMethod,
    counts_toward_b_o_full_weight:
      axes.provenance_grade === "provenance_bearing" && !axes.dispute_state && !weakMethod && scale >= 0.9,
    correctness: "UNKNOWN",
    event: e,
  };
}

/** A axis: mean pairwise Jaccard of tag sets; needs ≥2 annotators. Majority ≠ truth. */
export function interAnnotatorAgreement(annotations, field = "behavior_tags") {
  const list = annotations || [];
  if (list.length < 2) {
    return { annotator_count: list.length, agreement: null, status: "insufficient_annotators",
      note: "Need ≥2 independent annotations for A axis.", disagreement_preserved: [] };
  }
  const sets = list.map((raw) => {
    const e = asEvent(raw);
    return new Set(field === "behavior_tags" ? e.behavior_tags : e.outcome_tags);
  });
  const sims = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const A = sets[i], B = sets[j];
      if (!A.size && !B.size) { sims.push(1); continue; }
      const inter = [...A].filter((t) => B.has(t)).length;
      const union = new Set([...A, ...B]).size;
      sims.push(inter / Math.max(union, 1));
    }
  }
  const agreement = sims.reduce((s, x) => s + x, 0) / sims.length;
  const counts = new Map();
  for (const s of sets) for (const t of s) counts.set(t, (counts.get(t) || 0) + 1);
  const disputed = [...counts].filter(([, n]) => n > 0 && n < sets.length).map(([t]) => t);
  return { annotator_count: list.length, agreement: r4(agreement), status: "computed",
    pairwise_jaccard_mean: r4(agreement), disputed_tags: disputed, disagreement_preserved: disputed,
    note: "Majority vote does not define truth. Disagreement is research data — do not erase after adjudication.",
    majority_neq_truth: true };
}

/** Inject A into graded events and recompute scale. */
export function applyAgreementToEvents(graded, agreement) {
  const aVal = agreement ? agreement.agreement : null;
  return (graded || []).map((ev) => {
    const axes = { ...(ev.axes || {}), A_inter_observer_agreement: aVal };
    return { ...ev, axes, b_o_weight_scale: scaleFromAxes(axes),
      inter_annotator: { agreement: aVal, disputed_tags: agreement && agreement.disputed_tags, majority_neq_truth: true } };
  });
}

/**
 * Parse pasted input into annotation events: JSON array/object, or JSONL.
 * Returns null when the input is not annotation JSON (e.g. raw prose).
 */
export function parseAnnotations(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object");
    if (v && typeof v === "object") return Array.isArray(v.annotations) ? v.annotations : [v];
  } catch { /* try JSONL */ }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out = [];
  for (const l of lines) {
    try { const o = JSON.parse(l); if (o && typeof o === "object") out.push(o); else return null; }
    catch { return null; }
  }
  return out;
}

/**
 * Measure a set of annotation events: per-event axes + grades; A from
 * inter-annotator agreement when ≥2 events share an event_id (independent
 * annotations of the same event), else A stays null.
 */
export function measureAnnotations(events) {
  const graded = (events || []).map(provenanceGrade);
  const groups = new Map();
  (events || []).forEach((e, i) => {
    const id = e && e.event_id ? String(e.event_id) : null;
    if (!id) return;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(i);
  });
  const agreements = {};
  for (const [id, idxs] of groups) {
    if (idxs.length < 2) continue;
    const ag = interAnnotatorAgreement(idxs.map((i) => events[i]));
    agreements[id] = ag;
    const updated = applyAgreementToEvents(idxs.map((i) => graded[i]), ag);
    idxs.forEach((gi, k) => { graded[gi] = updated[k]; });
  }
  return { version: AXES_VERSION, weight_profile_id: WEIGHT_PROFILE_ID, count: graded.length,
    events: graded, agreements, correctness: "UNKNOWN", tag_neq_fact: TAG_NEQ_FACT };
}
