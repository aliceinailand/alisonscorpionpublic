# Publishing this repository

This file is the public half of the agent card. The private half lives in the private monorepo as `agents/publish-split.md`.

## This checkout

Write the live product site only in the clone whose remote is `github.com/aliceinailand/alisonscorpionpublic` and whose branch is `main`. On the operator machine that path is `/home/alice/alisonscorpion/alisonscorpionpublic`.

Do not commit in the other copies under `Sites/`, `repos/`, or `website/`.

## What belongs here

The guest desktop, the staging product shell, and short public instructions.

## What does not belong here

Agent lockers, training logs, eval scores, legal files, case strategy, mail, keys, datasets, or private gate math. Story and metaphor go to `github.com/aliceinailand/trippyalice` and `https://trippyalice.com/`, not into this repo.

## A product change

1. Edit `website/src` in the private monorepo, on the source tree named in the task.
2. Run the private finish script only when that tree is the one `grab-latest-website.sh` names.
3. Publish by committing the built `website/staging/` files on this repo's `main`, or let the finish script do that push.
4. Prove the live page:

```bash
curl -sI https://alisonscorpion.com/
```

A dirty private working tree is not a reason to rebuild the whole site. Commit only the files for the change you were given. Do not stage a virtualenv or an env file.

## Story site

`trippyalice` is a separate repository. Its `main` branch is GitHub Pages. The custom domain is also fronted by a worker that names `https://trippyalice.pages.dev` as its origin. After a story push, check `https://trippyalice.com/` and `https://trippyalice.pages.dev/`. If only one of them moved, say so.
