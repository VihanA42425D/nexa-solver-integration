# Nexa documentation site

This directory contains the source for the public, static documentation at
`https://docs.vsnexa.com/`. The documentation describes only the public solver
integration surface. Generated tables and the downloadable OpenAPI document are
derived at build time from canonical repository artifacts.

The site content remains static. The contact page posts only to the isolated
`docs-ticket-worker/`, which validates Turnstile and sends a fixed-destination
email without exposing the destination or storing ticket data.

## Local build

```bash
python -m pip install -r docs-site/requirements.txt
npm run docs:validate
npm run docs:ticket:check
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

The custom domain is `docs.vsnexa.com`. A validated direct deployment is:

```bash
npm run docs:build
npx wrangler pages deploy docs-site/site --project-name nexa-docs --branch main
```

When native Git integration is available, use the table above for automatic
production deployments from `main` and preview deployments from other branches.
