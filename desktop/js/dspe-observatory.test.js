// Run: node desktop/js/dspe-observatory.test.js
// Fixtures follow docs/dspe.md v1.4 axes (docs/dspe_observatory.md table) and
// expected values cross-checked against asxhome src/core/dspe/annotation.py.
import assert from "node:assert/strict";
import { measureTranscript } from "./dspe-observatory.js";
import { measurementAxes, scaleFromAxes, provenanceGrade, interAnnotatorAgreement, measureAnnotations } from "./dspe-axes.js";

const full = { event_id: "e1", engine_id: "claude", role_under_test: "skeptic", behavior_tags: ["challenge_premise"],
  tagger: "alice", tagging_method: "human_blind", source_span: "L10-12", confidence: 0.8,
  blind_to_expected_role: true, observation_id: "obs1" };
const bare = { behavior_tags: ["accept_verified"] };
const disputed = { behavior_tags: ["x"], tagger: "op", tagging_method: "human_operator", source_artifact: "chat.md",
  counterevidence: "later turn reverses", blind_to_expected_role: false };

// P — provenance completeness
assert.equal(measurementAxes(full).P_provenance_completeness, 1);
assert.equal(measurementAxes(bare).P_provenance_completeness, 0);
assert.deepEqual(measurementAxes(bare).missing_required, ["tagger", "tagging_method", "source_span_or_artifact"]);
assert.equal(measurementAxes({ tagger: "t", behavior_tags: ["x"], observation_id: "o" }).P_provenance_completeness, 0.4333);
assert.equal(measurementAxes(full).provenance_grade, "provenance_bearing");
assert.equal(measurementAxes(bare).provenance_grade, "bare");
assert.equal(measurementAxes({}).provenance_grade, "empty");
// C — annotation confidence
assert.equal(measurementAxes(full).C_annotation_confidence, 0.8);
assert.equal(measurementAxes(bare).C_annotation_confidence, null);
assert.equal(measurementAxes({ confidence: 1.7 }).C_annotation_confidence, 1);
// A — inter-observer agreement (null per-event; Jaccard across annotators)
assert.equal(measurementAxes(full).A_inter_observer_agreement, null);
const ag = interAnnotatorAgreement([{ behavior_tags: ["a", "b"] }, { behavior_tags: ["a"] }]);
assert.equal(ag.agreement, 0.5);
assert.deepEqual(ag.disputed_tags, ["b"]);
assert.equal(interAnnotatorAgreement([full]).status, "insufficient_annotators");
// B — blinding integrity
assert.equal(measurementAxes(full).B_blinding_integrity, 1);
assert.equal(measurementAxes(disputed).B_blinding_integrity, 0.25);
assert.equal(measurementAxes(bare).B_blinding_integrity, 0.5);
// D — counterevidence / dispute
assert.equal(measurementAxes(disputed).D_counterevidence_clean, 0.35);
assert.equal(measurementAxes(disputed).dispute_state, true);
assert.equal(measurementAxes(disputed).P_provenance_completeness, 1); // dispute independent of P
assert.equal(measurementAxes(full).D_counterevidence_clean, 1);

// scale + grade (never correctness)
assert.equal(scaleFromAxes(measurementAxes(full)), 0.97);
assert.equal(scaleFromAxes(measurementAxes(bare)), 0.2975);
assert.equal(scaleFromAxes(measurementAxes(disputed)), 0.5037);
assert.equal(provenanceGrade(full).counts_toward_b_o_full_weight, true);
assert.equal(provenanceGrade(full).correctness, "UNKNOWN");

// A injected when two annotators share event_id
const m = measureAnnotations([{ ...full, behavior_tags: ["a", "b"] }, { ...full, tagger: "bob", behavior_tags: ["a"] }]);
assert.equal(m.events[0].axes.A_inter_observer_agreement, 0.5);
assert.equal(m.events[0].b_o_weight_scale, 0.873);

// UI-facing wrapper
const empty = measureTranscript("");
assert.ok(empty.ok && empty.words === 0 && empty.count === 0);
const prose = measureTranscript("Alice: verify the record.\n\nASX: I can't share private keys.");
assert.equal(prose.inputKind, "raw_text_unannotated");
assert.equal(prose.events[0].grade, "empty");
assert.equal(prose.scaffold, false);
const jsonl = measureTranscript([full, disputed].map((x) => JSON.stringify(x)).join("\n"));
assert.equal(jsonl.inputKind, "annotations");
assert.equal(jsonl.count, 2);

console.log("dspe-observatory tests passed");
