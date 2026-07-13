# Alison Scorpion Public — Agent Instructions

Public GitHub Pages site for **alisonscorpion.com**.

## Local path (this machine)

| Repo | Path | Remote |
|------|------|--------|
| **Public site** | `/home/alice/alisonscorpionpublic` | `https://github.com/aliceinailand/alisonscorpionpublic.git` |
| **Private monorepo** | `/home/alice/alisonscorpion` | `https://github.com/aliceinailand/alisonscorpion.git` |

## Product law

- Alice Commands. Scorpion Obeys.
- FACT = LAW + RECORD (SV65H). Do not invent facts.
- Always-on disclaimer: AI cannot guarantee anything; it does its best.
- **ASX Math patent hold:** No implementable Alison Scorpion Math on this public site.
- **IRRS / internal security ranking legends are not on the public site map.** Do **not** link them from homepage, docs, story, or staging nav (“public/exposed” = discoverable from main site chrome).
- **Operator-view path (unlinked, noindex):** `https://alisonscorpion.com/ops/security/` and `…/ops/security/disclosure-maturity.html` — Alice/operators may open by direct URL; do not add main-nav links.
- Full doctrine source remains in private monorepo `agents/Research/security/`.

## Deploy notes

- GitHub Pages: branch `main`, root `/`, CNAME `alisonscorpion.com`
- UI source of truth for the React app lives in monorepo `website/`
- Prefer HTTPS remotes

```bash
cd /home/alice/alisonscorpionpublic
git pull --ff-only
```
