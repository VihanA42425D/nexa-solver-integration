# Nexa documentation ticket mailer

This isolated Cloudflare Worker handles only `POST /api/tickets` for the
static documentation contact page. It performs strict same-origin, content,
size, field, honeypot, rate-limit, and server-side Turnstile checks before
sending one plain-text email through a sender-restricted Email Service binding.

The receiving address and Turnstile secret are Worker secrets named
`TICKET_RECIPIENT` and `TURNSTILE_SECRET`. They must never be committed.
The public Turnstile sitekey belongs in `docs-site/docs/contact.md`.

The Worker stores no ticket data, exposes no recipient address, accepts no
attachments, has no RPC or Nexa runtime binding, and has no database or
background trigger.

Deploy after setting both secrets:

```bash
npx wrangler secret put TICKET_RECIPIENT --config docs-ticket-worker/wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET --config docs-ticket-worker/wrangler.jsonc
npx wrangler deploy --config docs-ticket-worker/wrangler.jsonc
```
