# alisonscorpionpublic

Public GitHub Pages site for **[alisonscorpion.com](https://alisonscorpion.com)**.

## Paths

| Path | Purpose |
|------|---------|
| `/` | Product homepage |
| `/docs/` | Public knowledgebase (high-level) |
| `/story/` | Story / TrippyAlice preview |
| `/website/staging/home.html` | Product UI preview |

## Do not publish on this site

- Internal **security ranking legends** (IRRS and related private doctrine) — monorepo only  
- Case exhibits, secrets, proprietary math formulas, twin-kit dumps  
- Private monorepo wholesale  

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
