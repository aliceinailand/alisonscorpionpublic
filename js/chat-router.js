/**
 * Free Chat path: lightweight query → local router → answer.
 * Complex / agent-like intents → upgrade nudge (sign up).
 * Not a full LLM — demo of Alice Gates / low-router layer.
 */

const FAQ = [
  {
    re: /first president|who was the first president|1st president/i,
    a: "George Washington was the first President of the United States (1789–1797).",
  },
  {
    re: /who (are|is) you|what is asx|who is alison/i,
    a: "I'm Chat on Alison Scorpion's desktop — a free, low-router path (query → logic → answer). For actions like opening apps, use Agent ASX α. Advanced multi-step reasoning needs an account.",
  },
  {
    re: /\b(help|commands)\b/i,
    a: "Ask simple facts, definitions, or about this desktop. Examples: “first president”, “what is containers”, “what time is it”. For “open settings” or “go to github.com”, use Agent ASX.",
  },
  {
    re: /what (is|are) containers/i,
    a: "Containers is Alison's product surface on this desktop — open the Containers app from Applications → ASX Products.",
  },
  {
    re: /honey\s*bee|honeybee/i,
    a: "Honey Bee Engine is the business/government/contracts lane. Open the honeybee app from the desktop Applications folder.",
  },
  {
    re: /what time|current time|date today/i,
    a: () => `Local time on this guest session: ${new Date().toLocaleString()}.`,
  },
  {
    re: /capital of france|france capital/i,
    a: "Paris is the capital of France.",
  },
  {
    re: /2\s*\+\s*2|what is 2\+2/i,
    a: "4.",
  },
];

/** Agent-like / heavy intents — free chat refuses and points to signup or Agent */
const COMPLEX = [
  /open\s+(settings|browser|files|terminal|youtube|drive)/i,
  /navigate\s+to|go\s+to\s+https?|launch\s+/i,
  /write\s+(me\s+)?(a\s+)?(full\s+)?(essay|report|code|program|script)/i,
  /refactor|debug this|analyze this codebase|multi-?step/i,
  /plan\s+a\s+|design\s+a\s+system|architect/i,
  /delete\s+all|format\s+disk|sudo\s+/i,
];

export function routeFreeChat(raw) {
  const q = String(raw || "").trim();
  if (!q) return { type: "empty", text: "Type a question to begin." };

  for (const c of COMPLEX) {
    if (c.test(q)) {
      return {
        type: "upgrade",
        text:
          "This query requires advanced processing (or desktop actions). " +
          "Please sign up for an account for deeper reasoning — or use Agent ASX α for “open / navigate” style commands on this free demo.",
        links: [
          { label: "Open Network → Users → Add (sign up)", action: "signup" },
          { label: "Open Agent ASX α", action: "agent" },
        ],
      };
    }
  }

  for (const f of FAQ) {
    if (f.re.test(q)) {
      const text = typeof f.a === "function" ? f.a() : f.a;
      return { type: "answer", text };
    }
  }

  // Tiny arithmetic
  const math = q.replace(/\s/g, "").match(/^(\d+(?:\.\d+)?)([+\-*/])(\d+(?:\.\d+)?)$/);
  if (math) {
    const a = Number(math[1]);
    const b = Number(math[3]);
    let r;
    switch (math[2]) {
      case "+":
        r = a + b;
        break;
      case "-":
        r = a - b;
        break;
      case "*":
        r = a * b;
        break;
      case "/":
        r = b === 0 ? "undefined (divide by zero)" : a / b;
        break;
      default:
        r = null;
    }
    if (r != null) return { type: "answer", text: String(r) };
  }

  if (q.length > 160 || (q.match(/\?/g) || []).length > 2) {
    return {
      type: "upgrade",
      text:
        "This query requires advanced processing. Please sign up for an account for multi-part or long-form answers. Free Chat stays on simple Q&A + local logic.",
      links: [{ label: "Sign up (Network → Users → Add)", action: "signup" }],
    };
  }

  return {
    type: "soft",
    text:
      `Free Chat (low router) doesn't have a canned answer for that yet. ` +
      `Try a simple fact question, or sign up for advanced processing. ` +
      `For desktop actions (“open settings”), use Agent ASX α.`,
    links: [
      { label: "Sign up", action: "signup" },
      { label: "Agent ASX", action: "agent" },
    ],
  };
}
