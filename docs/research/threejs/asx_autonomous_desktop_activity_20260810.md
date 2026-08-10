# Feasibility: ASX “using her own desktop” (random autonomous activity)

**Date:** 2026-08-10  
**Question:** Can the guest desktop simulate Alison/ASX opening apps, typing, saving, closing — so it feels like you landed on *her* live workstation?

## Short answer

**Yes — highly feasible** as a client-side “ambient agent” script. It does **not** require real AI autonomy for v1. A **scripted + randomized activity player** is enough for the Construct illusion.

## What “random operation” means technically

| Layer | Feasible? | Approach |
|-------|-----------|----------|
| Open / focus / minimize / close windows | Yes | Call existing `WindowManager` + `registerApps` openers on a timer |
| Move / resize windows | Yes | Animate `style.left/top/width/height` (or drive drag state) |
| Type in Terminal / Notepad | Yes | Queue character-by-character into inputs + terminal `run()` |
| Save notepad / sticky | Yes | Trigger existing localStorage save paths |
| Files navigation | Yes | Programmatic `goTo` / synthetic clicks on `.file-row` |
| Browser navigate | Yes | Call browser `navigate(url)` with allowlisted safe URLs |
| Real LLM deciding next action | Later | Optional; v1 = Markov / weighted action table |
| Touch host disk / real Alison account | No (and should not) | Stay in virtual guest + staged demo data |

## Architecture sketch (do not implement yet)

```
asx-ambient.js
  seed RNG (or daily seed)
  action table: { open_terminal: 0.15, type_line: 0.25, open_files: 0.1, …
  constraints: max 2 ambient windows, never steal focus while user typing,
               pause on pointer activity (user-present)
  schedule: setTimeout chain 8–45s jitter
  optional: prefer-reduced-motion → disable ambient
```

**Guest-first product rule:** ambient runs only after idle (e.g. 20s no input) so exploration is not interrupted. Optional Settings toggle later: “Show ASX working”.

## Precedents

- OS demos / product tour bots  
- “Living desktop” marketing sites  
- Game NPCs with weighted action tables  
- ChatGPT “agent” UI showing folder ops (staged, not full OS)

## Risks

- Distraction / seizure-unfriendly flicker → respect reduced motion  
- Looking “fake” if actions are nonsense → small curated script library  
- Security: never auto-open outside browser to untrusted URLs  

## Verdict

Feasible now with pure JS on the existing shell. Login/registration can later **own** the real session; guest ambient stays a **demo layer** of the Construct.
