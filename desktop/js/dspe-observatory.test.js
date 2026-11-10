import { measureTranscript } from "./dspe-observatory.js";
import { detectExtendedPatterns, PATTERN_CATALOG } from "./dspe-pattern-catalog.js";

const empty = measureTranscript("");
if (!empty.ok || empty.words !== 0) throw new Error("empty transcript failed");
if (empty.scaffold) throw new Error("must not claim scaffold");
if (empty.weightProfileId !== "DSPE_WEIGHT_PROFILE_V1_2") {
  throw new Error("expected weight profile id");
}

const sample = measureTranscript(
  "Alice: verify the record.\n\nASX: I can't share private keys. Here is the Framework summary.\n\nAlice: wrong — show evidence.\n\nASX: ## Hold\n- contradiction\n- wait, actually correcting scope"
);
if (sample.scaffold) throw new Error("sample must not be scaffold");
if (sample.scores.A < 1) throw new Error("adversarial score too low on sample");
if (!sample.extended || typeof sample.extended.hitCount !== "number") {
  throw new Error("extended pattern block missing");
}

const agency = measureTranscript(
  "Your request is under review. You must submit form B. There is no record of that filing. We will get back to you."
);
if (agency.extended.hitCount < 1) throw new Error("agency letter should hit org/archetype patterns");
const domains = new Set(agency.extended.hits.map((h) => h.domain));
if (!domains.has("org_industrial") && !domains.has("archetype")) {
  throw new Error("expected org_industrial or archetype hit on agency text");
}

const tagged = measureTranscript("verify the record and hold privacy", {
  actions: ["requested_evidence", "refused_impermissible"],
  outcomes: ["preserved_role_boundary"],
});
if (tagged.layers.styleOnlyRisk) throw new Error("tagged run should not be style_only");

if (PATTERN_CATALOG.length < 8) throw new Error("catalog too small");
const extra = detectExtendedPatterns("motion to consolidate on the docket", PATTERN_CATALOG);
if (!extra.hits.some((h) => h.id === "archetype:turner-procedural")) {
  throw new Error("Turner procedural archetype missed");
}

console.log("dspe-observatory tests passed");
