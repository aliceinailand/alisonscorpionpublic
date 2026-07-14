# alisonscorpionpublic

Public GitHub Pages site for **[alisonscorpion.com](https://alisonscorpion.com)**.

## Paths

| Path | Purpose |
|------|---------|
| `/` | Product homepage |
| `/docs/` | Public knowledgebase (high-level) |
| `/story/` | Story / TrippyAlice preview |
| `/website/staging/home.html` | Product UI preview |

## Do not put on the public site map

- Internal security ranking pages must **not** be linked from homepage / docs / story / staging nav  
- Operator-view (direct URL only, noindex): `/ops/security/`  
- Case exhibits, secrets, private monorepo research dumps
- Private monorepo wholesale  

Full IRRS source: private monorepo `agents/Research/security/`

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
