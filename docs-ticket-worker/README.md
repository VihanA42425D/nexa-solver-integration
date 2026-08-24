# Nexa documentation ticket mailer

Deployment source for the documentation contact endpoint at `POST /api/tickets`.

Required Worker secrets are named
`TICKET_RECIPIENT` and `TURNSTILE_SECRET`. They must never be committed.
The public Turnstile sitekey belongs in `docs-site/docs/contact.md`.

Deploy after setting both secrets:

```bash
npx wrangler secret put TICKET_RECIPIENT --config docs-ticket-worker/wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET --config docs-ticket-worker/wrangler.jsonc
npx wrangler deploy --config docs-ticket-worker/wrangler.jsonc
```
