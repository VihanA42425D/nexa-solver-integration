# Nexa documentation site

Source and deployment configuration for `https://docs.vsnexa.com/`. Generated
tables and the downloadable OpenAPI document are derived at build time from
canonical repository artifacts.

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
