# asxweb fonts

**Official lock:** monorepo `docs/asx-fonts.md`

## Brand mark (shell)

```
Alison Scorpion         ← brand script wordmark only · Scriptina
```

## Production faces

| Priority | Face | Source | Role |
|----------|------|--------|------|
| 1 | **Scriptina** | `scriptina/SCRIPTIN.ttf` | Primary logo face (sidebar / shell) |
| 2 | **Allison** | Google Fonts | Wordmark fallback; floating chat **name** 30px |
| 3 | **Carattere** | Google Fonts | Formal wordmark fallback |
| 4 | **IBM Plex Sans** | Google Fonts | Default **non-cursive** UI + floating chat **body** 24px |

### Classes
- `.asx-brand-script` → Scriptina-first wordmark
- `.asx-brand-accent` → IBM Plex Sans (non-cursive)

### Floating chat only
- Name **Alison Scorpion** → Allison 30px  
- Body / typing / input → IBM Plex Sans 24px (not cursive)
