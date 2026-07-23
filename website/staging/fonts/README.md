# asxweb fonts

**Official lock (samples + ranking + signature power dynamic):** monorepo `docs/asx-fonts.md`

## Brand mark (shell)

```
Alison Scorpion         ← brand script wordmark only · 2em
```

Pre-language “Alice Commands, Scorpion Obeys” is **not** ASX product chrome — reserved for trippyalice.com.

## Brand cursive (wordmark only) — right-slant, open A

| Priority | Face | Source | Role |
|----------|------|--------|------|
| 1 | **Scriptina** | `scriptina/SCRIPTIN.ttf` | Primary logo face (Alice favorite; local and offline-safe) |
| 2 | **Allison** | Google Fonts | First network fallback — right-slant script, open A, name coincidence |
| 3 | **Carattere** | Google Fonts | Formal slanted fallback |
| 4 | **Loved by the King** | Google Fonts | Symbolic keep (King metaphor); final wordmark fallback and accent class |

### Operator rules
- Cursive must **slant right** (left-handed signing presentation)  
- Prefer **open A**, not circular/loop A  
- No upright/straight cursive  
- Never on body, gates, tables, or hashes  
- Product brand row shows **Alison Scorpion** only (2em) — no dyarchy slogan  

### Classes
- `.asx-brand-script` → `--asx-font-display-script` (Scriptina-first stack)  
- `.asx-brand-accent` → `--asx-font-display-accent` (Loved by the King stack)  

### Local Scriptina
- Primary wordmark face; bundled locally so the logo does not depend on Google Fonts  
- https://www.1001fonts.com/scriptina-font.html  
- License: Apostrophic Labs freeware (commercial OK; do not modify/repackage)  

### Samples
- `docs/assets/asx-fonts/sample_*.png` — “Alison Scorpion” + lowercase/UPPERCASE pangram  
  (`the quick brown fox jumps over the lazy dog` / `THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG`)  
