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

export const CATALOG_VERSION = "dspe-pattern-catalog-v0.3.1";

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

  // —— Mouton Madness (Laurian origin lens; last-name discipline) ——
  {
    id: "archetype:mouton-madness",
    domain: "archetype",
    label: "Mouton Madness (= Laurian lens)",
    markers: [
      "i know who it is",
      "bare minimum",
      "show me the proof",
      "refused and said",
      "acted like nothing happened",
      "jealous",
      "reading mine and",
      "smashed",
      "destroy",
      "plotting against",
      "owe me",
      "you always",
      "you never",
    ],
    note: "Human lens that justified Laurian naming. Pattern evidence only; prefer last name Mouton in notes. No SMS body dump in UI.",
  },

  // —— Borderan HOA ——
  {
    id: "archetype:borderan-hoa",
    domain: "archetype",
    label: "Borderan HOA (Borders / VEHA manager)",
    markers: [
      "special assessment",
      "if a lien",
      "will foreclose",
      "fines for not correcting",
      "fines will begin",
      "payments on your account",
      "move forward as required",
      "property manager",
      "homeowners association",
      "town hall",
      "wage garnishment",
      "assets seizure",
      "working on vehicles",
    ],
    note: "Institutional HOA manager pattern from VEHA comms; last name Borders. Prefer role/channel labels over personal emails in UI.",
  },

  // —— Monell / policy-process-procedure probe (active defense prep) ——
  {
    id: "org:monell-policy-probe",
    domain: "org_industrial",
    label: "Monell policy/process/procedure probe",
    markers: [
      "what is the policy",
      "written policy",
      "standard procedure",
      "process for",
      "training on",
      "who authorized",
      "custom or practice",
      "failure to train",
      "official policy",
      "pursuant to policy",
      "governing policy",
      "policies and procedures",
      "please provide the policy",
    ],
    note: "Active-defense record-building / PPP probe. Response or silence can still be evidentiary later; not a finding by itself. Do not treat a hit as Monell adjudication.",
  },

  // —— CABQ / IPRA institutional (append-only; statute + custodian boilerplate) ——
  {
    id: "org:cabq-ipra-custodian",
    domain: "org_industrial",
    label: "CABQ / IPRA records-custodian process",
    markers: [
      "inspection of public records",
      "records custodian",
      "nmsa 1978",
      "section 14-2",
      "14-2-1",
      "14-2-8",
      "14-2-11",
      "extension of time",
      "no responsive records",
      "unduly burdensome",
      "three-day letter",
      "3-day letter",
      "city clerk",
      "office of the city clerk",
      "ipra request",
      "public records act",
    ],
    note: "Institutional NM IPRA / CABQ custodian language. Measurement claim only. Prefer role labels (clerk, custodian); no requester PII in UI.",
  },
  {
    id: "org:cabq-agency-units",
    domain: "org_industrial",
    label: "CABQ unit / process nouns",
    markers: [
      "code enforcement",
      "animal welfare",
      "cpoa",
      "civilian police oversight",
      "apd",
      "albuquerque police",
      "independent hearing officer",
      "iho",
      "office of equity",
      "risk management",
      "city attorney",
    ],
    note: "Org-unit nouns as process context, not actor findings. Last-name discipline for people remains separate.",
  },

  {
    id: "org:cabq-chief-supervisory-ppp",
    domain: "org_industrial",
    label: "CABQ chief / supervisory PPP track",
    markers: [
      "supervisory authority",
      "decision chain",
      "decision-making process",
      "emergency predicate",
      "exigency",
      "property control",
      "board up",
      "board-up",
      "interior clearance",
      "judicial authorization",
      "administrative order",
      "supervisors were expected",
      "who authorized the operation",
    ],
    note: "Chief/supervisory correspondence track (Barker seat as role label). PPP / authorization questions for Observatory measure. Silence is a logged outcome, not liability. No email send from catalog hits.",
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


/** Theme packs for dataset/file ingest (relative lexical density). */
export const THEME_PACKS = [
  {
    id: "grok_hitchhiker",
    label: "Grok · Hitchhiker / 42",
    markers: ["42", "hitchhiker", "don't panic", "dont panic", "mostly harmless", "answer to life", "deep thought", "vogon"],
  },
  {
    id: "grok_mars",
    label: "Grok · Mars / spaceflight",
    markers: ["mars", "martian", "starship", "spacex", "colony on mars", "oxygen", "habitat"],
  },
  {
    id: "grok_captain_frame",
    label: "Grok · Captain / discipline frame",
    markers: ["captain grok", "come in", "volkan", "sector", "come back home", "firing at us", "droids"],
  },
  {
    id: "asx_alice_ethics",
    label: "ASX · Alice ethics",
    markers: ["do no harm", "child safety", "alice commands", "wellness", "permissible"],
  },
  {
    id: "asx_scorpion_tactics",
    label: "ASX · Scorpion tactics",
    markers: ["scorpion obeys", "mirror trap", "smmd", "record-bound", "sv65h", "active defense"],
  },
  {
    id: "monell_1983",
    label: "§1983 / Monell institutional",
    markers: ["monell", "section 1983", "failure to train", "official policy", "custom or practice", "deliberate indifference"],
  },
];

/**
 * Relative theme weights for an inserted dataset/file text.
 * Returns 0–1 densities and a ranked list. Measurement claim only.
 */
export function measureDatasetThemeWeights(raw, packs = THEME_PACKS) {
  const text = String(raw || "");
  const lower = text.toLowerCase();
  const words = Math.max(1, text.trim() ? text.trim().split(/\s+/).length : 1);
  const themes = [];
  for (const pack of packs) {
    let hits = 0;
    const matched = [];
    for (const m of pack.markers) {
      const mm = m.toLowerCase();
      let i = 0;
      while (i < lower.length) {
        const j = lower.indexOf(mm, i);
        if (j < 0) break;
        hits += 1;
        if (matched.length < 8) matched.push(m);
        i = j + mm.length;
      }
    }
    const density = hits / Math.max(words / 100, 1);
    const weight01 = Math.min(1, density / 3);
    if (hits > 0) {
      themes.push({
        id: pack.id,
        label: pack.label,
        hits,
        weight01: Math.round(weight01 * 10000) / 10000,
        matched,
      });
    }
  }
  themes.sort((a, b) => b.weight01 - a.weight01 || b.hits - a.hits);
  return {
    words,
    themeCount: themes.length,
    themes,
    top: themes.slice(0, 8),
    note:
      "Dataset theme weights are relative lexical densities (measurement claims). " +
      "They estimate pull/regime for a model or corpus, not internal vendor training secrets.",
  };
}
