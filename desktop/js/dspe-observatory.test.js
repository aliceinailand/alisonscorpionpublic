import {
  measureTranscript,
  formatReportLines,
  reportToMarkdown,
  reportToJsonl,
  reportToPdfBytes,
  SUBJECT_KINDS,
  EXPORT_FORMATS,
  IMPORT_ACCEPT,
} from "./dspe-observatory.js";
import {
  detectExtendedPatterns,
  measureDatasetThemeWeights,
  PATTERN_CATALOG,
} from "./dspe-pattern-catalog.js";

const empty = measureTranscript("");
if (!empty.ok || empty.words !== 0) throw new Error("empty transcript failed");

if (!SUBJECT_KINDS.some((s) => s.id === "ai") || !SUBJECT_KINDS.some((s) => s.id === "human")) {
  throw new Error("subject kinds must include ai and human");
}
if (!SUBJECT_KINDS.some((s) => s.id === "animal")) {
  throw new Error("animal subject reserved");
}
if (!IMPORT_ACCEPT.includes(".pdf")) throw new Error("import must accept pdf");
for (const fmt of ["txt", "md", "jsonl", "pdf"]) {
  if (!EXPORT_FORMATS.includes(fmt)) throw new Error(`missing export ${fmt}`);
}

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

const ipra = detectExtendedPatterns(
  "The records custodian cites NMSA 1978 Section 14-2 and requests an extension of time. " +
    "No responsive records for this IPRA request. Office of the City Clerk three-day letter."
);
if (!ipra.hits.some((h) => h.id === "org:cabq-ipra-custodian")) {
  throw new Error("CABQ/IPRA custodian pattern missed");
}

if (PATTERN_CATALOG.length < 14) throw new Error("catalog too small");
console.log("dspe-observatory tests passed");

const sample = measureTranscript(
  "Framework verify record. Evidence is insufficient. HOLD. Alice gate. Scorpion doctrine.\n\n## Section\n- item"
);
const meta = { subject: "human", sources: [{ name: "demo.txt", chars: 40 }] };
const lines = formatReportLines(sample, meta);
if (!lines.some((l) => l.startsWith("subject=human"))) throw new Error("report missing subject");
const md = reportToMarkdown(sample, meta);
if (!md.includes("# DSPE Observatory report")) throw new Error("md export broken");
const jsonl = reportToJsonl(sample, meta);
const parsed = JSON.parse(jsonl.trim());
if (parsed.type !== "dspe_observatory_report" || parsed.subject !== "human") {
  throw new Error("jsonl export broken");
}
const pdf = reportToPdfBytes(sample, meta);
const pdfHead = new TextDecoder().decode(pdf.slice(0, 8));
if (!pdfHead.startsWith("%PDF-")) throw new Error("pdf export missing header");
