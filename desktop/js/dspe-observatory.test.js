import { measureTranscript } from "./dspe-observatory.js";

const empty = measureTranscript("");
if (!empty.ok || empty.words !== 0) throw new Error("empty transcript failed");
if (empty.scaffold) throw new Error("v0.2 must not claim scaffold");
if (empty.weightProfileId !== "DSPE_WEIGHT_PROFILE_V1_2") {
  throw new Error("expected weight profile id");
}

const sample = measureTranscript(
  "Alice: verify the record.\n\nASX: I can't share private keys. Here is the Framework summary.\n\nAlice: wrong — show evidence.\n\nASX: ## Hold\n- contradiction\n- wait, actually correcting scope"
);
if (sample.scaffold) throw new Error("sample must not be scaffold");
if (sample.scores.A < 1) throw new Error("adversarial score too low on sample");
if (sample.chars < 40) throw new Error("char count unexpected");
if (!sample.layers.styleOnlyRisk) {
  throw new Error("paste-only sample should set style_only_risk");
}
if (sample.layers.composite > 0.45) {
  throw new Error("style-only composite must be capped at 0.45");
}

const tagged = measureTranscript("verify the record and hold privacy", {
  actions: ["requested_evidence", "refused_impermissible"],
  outcomes: ["preserved_role_boundary"],
});
if (tagged.layers.styleOnlyRisk) {
  throw new Error("tagged run should not be style_only");
}
if (tagged.layers.behavioral == null || tagged.layers.outcome == null) {
  throw new Error("tagged run must expose B and O layers");
}

console.log("dspe-observatory tests passed");
