# alisonscorpionpublic

Public GitHub Pages site for **[alisonscorpion.com](https://alisonscorpion.com)**.

## IRRS

Only **S0** and **R0–R1** material. No case exhibits, secrets, or R+ payloads.

| Path | Purpose |
|------|---------|
| `/` | R0 product homepage |
| `/security/` | IRRS classification abstract |
| `/security/disclosure-maturity.html` | Disclosure maturity / reaction risk (R0) |
| `/website/staging/` | Product UI (from monorepo `website/` deploy) |

## Dual site

- **alisonscorpion.com** — product / verification  
- **trippyalice.com** — story / metaphor (planned)

## Deploy

```bash
cd /home/alice/alisonscorpionpublic
git pull --ff-only
# React app: build from monorepo website/ then npm run deploy:staging
```

CNAME: `alisonscorpion.com` · Pages: branch `main` · root `/` · `.nojekyll` present.
