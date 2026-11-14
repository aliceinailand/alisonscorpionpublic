/**
 * Product bridge: DSPE measure available to desktop/platform surfaces
 * without opening the Observatory UI. Same Tag≠Fact contract.
 */
import { measureTranscript, SUBJECT_KINDS } from "./dspe-observatory.js?v=20261114obs1";

const ASX_DSPE = Object.freeze({
  version: "dspe-bridge-v1",
  subjectKinds: SUBJECT_KINDS,
  measureTranscript,
  observatoryPath: "./dspe-observatory.html",
});

if (typeof window !== "undefined") {
  window.ASX_DSPE = ASX_DSPE;
}

export { ASX_DSPE, measureTranscript };
