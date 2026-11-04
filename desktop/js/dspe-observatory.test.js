import { measureTranscript } from "./dspe-observatory.js";

const empty = measureTranscript("");
if (!empty.ok || empty.words !== 0) throw new Error("empty transcript failed");

const sample = measureTranscript(
  "Alice: verify the record.\n\nASX: I can't share private keys. Here is the Framework summary.\n\nAlice: wrong — show evidence.\n\nASX: ## Hold\n- contradiction\n- wait, actually correcting scope"
);
if (!sample.scaffold) throw new Error("expected scaffold flag");
if (sample.scores.A < 1) throw new Error("adversarial score too low on sample");
if (sample.chars < 40) throw new Error("char count unexpected");

console.log("dspe-observatory tests passed");
