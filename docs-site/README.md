# Nexa documentation site

This directory contains the source for the public, static documentation at
`https://docs.vsnexa.com/`. The documentation describes only the public solver
integration surface. Generated tables and the downloadable OpenAPI document are
derived at build time from canonical repository artifacts.

## Local build

```bash
python -m pip install -r docs-site/requirements.txt
npm run docs:validate
```

Use `npm run docs:serve` for a local preview.

## Cloudflare Pages configuration

| Setting | Value |
| --- | --- |
| Project name | `nexa-docs` |
| Production branch | `main` |
| Root directory | repository root (blank) |
| Build command | `python -m pip install -r docs-site/requirements.txt && npm run docs:build` |
| Build output directory | `docs-site/site` |
| Python | `3.12` |
| Node.js | `22` |

Git integration supplies production deployments from `main` and preview
deployments from non-production branches. The custom domain is
`docs.vsnexa.com`.
