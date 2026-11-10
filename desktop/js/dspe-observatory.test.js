import { measureTranscript } from "./dspe-observatory.js";
import {
  detectExtendedPatterns,
  measureDatasetThemeWeights,
  PATTERN_CATALOG,
} from "./dspe-pattern-catalog.js";

const empty = measureTranscript("");
if (!empty.ok || empty.words !== 0) throw new Error("empty transcript failed");

const agency = measureTranscript(
  "Your request is under review. You must submit form B. There is no record of that filing. We will get back to you. Motion to consolidate is on the docket."
);
if (agency.extended.hitCount < 1) throw new Error("agency letter should hit patterns");

const hoa = measureTranscript(
  "If a lien is filed on your home, the HOA will foreclose. Fines will begin next week. Special assessment town hall. Property manager statement."
);
if (!hoa.extended.hits.some((h) => h.id === "archetype:borderan-hoa")) {
  throw new Error("Borderan HOA archetype missed");
}

const mouton = measureTranscript(
  "She said I know who it is then refused to show me the proof and acted like nothing happened. Bare minimum help. Smashed the device."
);
if (!mouton.extended.hits.some((h) => h.id === "archetype:mouton-madness")) {
  throw new Error("Mouton Madness archetype missed");
}

const grokish = measureTranscript(
  "Don't Panic. The answer is 42. Captain Grok, come in from that Mars sector. Check the Starship habitat. Then focus on the real IPRA record."
);
if (!grokish.datasetThemes.top.some((t) => t.id.startsWith("grok_"))) {
  throw new Error("expected Grok theme weights");
}

const w = measureDatasetThemeWeights("Monell failure to train official policy custom or practice");
if (!w.themes.some((t) => t.id === "monell_1983")) throw new Error("Monell theme missed");

if (PATTERN_CATALOG.length < 12) throw new Error("catalog too small");
console.log("dspe-observatory tests passed");
