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
- **IRRS / internal security ranking legends are PRIVATE.** Do **not** publish IRRS tables, R0–R5 scales, S0–S4 storage class legends, or “R+ speak” playbooks on this public site. That material stays in the private monorepo (`agents/Research/security/`). Publishing it is a security failure.

## Deploy notes

- GitHub Pages: branch `main`, root `/`, CNAME `alisonscorpion.com`
- UI source of truth for the React app lives in monorepo `website/`
- Prefer HTTPS remotes

```bash
cd /home/alice/alisonscorpionpublic
git pull --ff-only
```
