# Alison Scorpion Public — Agent Instructions

Public GitHub Pages site for **alisonscorpion.com**.

## Local path (this machine)

| Repo | Path | Remote |
|------|------|--------|
| **Public site** | `/home/alice/alisonscorpionpublic` | `https://github.com/aliceinailand/alisonscorpionpublic.git` |
| **Private monorepo** | `/home/alice/alisonscorpion` | `https://github.com/aliceinailand/alisonscorpion.git` |

Portals:

- From monorepo: `portals/alisonscorpionpublic` → this tree  
- From here: `monorepo-portal` → private monorepo; `website-src-portal` → monorepo `website/`

## Product law (same as monorepo)

- Alice Commands. Scorpion Obeys.
- FACT = LAW + RECORD (SV65H). Do not invent facts.
- Always-on disclaimer: AI cannot guarantee anything; it does its best.

## Deploy notes

- GitHub Pages: branch `main`, root `/`, CNAME `alisonscorpion.com`
- UI source of truth for the React app lives in monorepo `website/`
- Publish only after explicit operator go-ahead (shared-state push)

## Access

```bash
cd /home/alice/alisonscorpionpublic
git pull --ff-only
gh repo view aliceinailand/alisonscorpionpublic
# Prefer HTTPS remotes — SSH to github.com hangs in this environment
```
