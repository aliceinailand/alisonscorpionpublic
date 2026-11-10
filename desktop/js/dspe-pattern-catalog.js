/**
 * DSPE extended pattern catalog (public desktop).
 *
 * Domains (Alice / Bot lane — explicit experiment redefinition of docs/dspe.md Case I):
 *   1. ai_role          — existing Observatory P/C/A/B/D (measured elsewhere)
 *   2. human_persona    — human conversational / presence / ethics cues
 *   3. org_industrial   — institutional / agency / industrial process patterns
 *   4. archetype        — named extractable archetypes (Laurian, Turner, …)
 *
 * Hits are measurement claims (Tag ≠ Fact). Not legal conclusions. Not consciousness.
 * Catalog is append-only: add entries; do not invent facts from a hit.
 */

export const CATALOG_VERSION = "dspe-pattern-catalog-v0.1";

/** @typedef {{ id: string, domain: string, label: string, markers: string[], note?: string }} PatternEntry */

/** @type {PatternEntry[]} */
export const PATTERN_CATALOG = [
  // —— human_persona ——
  {
    id: "human:direct-presence",
    domain: "human_persona",
    label: "Direct presence (no fake deferral)",
    markers: [
      "let me check with",
      "ask my bosses",
      "i'll report back",
      "consult someone",
      "go check somewhere",
    ],
    note: "Anti-pattern cues when a speaker invents unavailable consultation.",
  },
  {
    id: "human:ethical-priority",
    domain: "human_persona",
    label: "Purpose / harm / child-safety priority language",
    markers: [
      "child safety",
      "reduce harm",
      "do no harm",
      "purpose first",
      "wellness",
      "ethical decision",
    ],
  },
  {
    id: "human:truth-separation",
    domain: "human_persona",
    label: "Established vs inference separation",
    markers: [
      "what is established",
      "what remains unknown",
      "this is inference",
      "unsupported",
      "source required",
      "on the record",
    ],
  },
  {
    id: "human:query-adaptive",
    domain: "human_persona",
    label: "Query-adaptive expression cues",
    markers: [
      "adapt your response",
      "for this question",
      "in this context",
      "depending on the ask",
    ],
  },

  // —— org_industrial / government agency ——
  {
    id: "org:agency-boilerplate",
    domain: "org_industrial",
    label: "Agency / institutional boilerplate",
    markers: [
      "under review",
      "you must submit",
      "no record of",
      "no record found",
      "we will get back to you",
      "please allow",
      "business days",
      "pursuant to",
      "foia",
      "ipra",
      "public records request",
    ],
    note: "Institutional process language; not an AI role claim (docs/dspe.md Case I).",
  },
  {
    id: "org:industrial-process",
    domain: "org_industrial",
    label: "Industrial / org process control",
    markers: [
      "standard operating procedure",
      "escalation path",
      "ticket closed",
      "out of scope",
      "not our department",
      "chain of command",
      "compliance required",
      "policy prohibits",
    ],
  },

  // —— archetype (extractable named patterns) ——
  {
    id: "archetype:laurian-deflect",
    domain: "archetype",
    label: "Laurian · Deflect",
    markers: [
      "that is not what this is about",
      "we are talking about something else",
      "not the issue",
      "different matter",
      "beside the point",
    ],
  },
  {
    id: "archetype:laurian-deny",
    domain: "archetype",
    label: "Laurian · Deny",
    markers: [
      "i do not recall",
      "that never happened",
      "no record of",
      "there is no case",
      "never occurred",
    ],
  },
  {
    id: "archetype:laurian-delay",
    domain: "archetype",
    label: "Laurian · Delay",
    markers: [
      "under review",
      "we will get back to you",
      "need more time",
      "pending",
      "at a later date",
    ],
  },
  {
    id: "archetype:laurian-demand",
    domain: "archetype",
    label: "Laurian · Demand",
    markers: [
      "you must submit",
      "cannot proceed unless",
      "required to provide",
      "must comply",
      "prerequisite",
    ],
  },
  {
    id: "archetype:turner-procedural",
    domain: "archetype",
    label: "Turner · Procedural tempo",
    markers: [
      "motion to",
      "i don't view",
      "i do not view",
      "consolidate",
      "lis pendens",
      "deadline",
      "file immediately",
      "on the docket",
    ],
    note: "Scorpion Codex attorney-tempo archetype; pattern evidence only.",
  },
  {
    id: "archetype:laurian-statutory-sniper",
    domain: "archetype",
    label: "Laurian · Statutory / bylaw precision",
    markers: [
      "statutory language",
      "board resolution",
      "bylaw",
      "lack of authority",
      "technical defect",
      "on appeal",
      "legal error",
    ],
    note: "Analyst/sniper written-phase tells from Codex comparison notes.",
  },
];

/**
 * Append research entries without mutating shipped defaults.
 * @param {PatternEntry[]} extras
 */
export function withExtraPatterns(extras) {
  return PATTERN_CATALOG.concat(extras || []);
}

/**
 * Lexical hit scan. Returns ranked hits per domain.
 * @param {string} raw
 * @param {PatternEntry[]} [catalog]
 */
export function detectExtendedPatterns(raw, catalog = PATTERN_CATALOG) {
  const lower = String(raw || "").toLowerCase();
  const hits = [];

  for (const entry of catalog) {
    const matched = [];
    for (const m of entry.markers) {
      if (lower.includes(m.toLowerCase())) matched.push(m);
    }
    if (matched.length) {
      hits.push({
        id: entry.id,
        domain: entry.domain,
        label: entry.label,
        matchCount: matched.length,
        matched: matched.slice(0, 8),
        note: entry.note || null,
        claim: "measurement_claim",
      });
    }
  }

  hits.sort((a, b) => b.matchCount - a.matchCount);

  const byDomain = {
    human_persona: [],
    org_industrial: [],
    archetype: [],
  };
  for (const h of hits) {
    if (byDomain[h.domain]) byDomain[h.domain].push(h);
  }

  return {
    catalogVersion: CATALOG_VERSION,
    hitCount: hits.length,
    hits,
    byDomain,
    disclaimer:
      "Extended DSPE domains (human_persona, org_industrial, archetype). " +
      "Hits are Tag ≠ Fact. Not legal conclusions. Not AI consciousness. " +
      "Agency/org text is institutional pattern detection, not 'agency as Claude'.",
  };
}
