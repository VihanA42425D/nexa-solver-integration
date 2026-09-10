---
title: Aggregator API
description: Integrate Nexa swaps and bridges with public quote, build, status and asset endpoints, exact payouts and canonical wallet execution.
---

# Aggregator API

Add Nexa swaps and bridges to a wallet, router or application through public
quote, build, status and asset endpoints.

[DEX user guide](dex.md){ .md-button }
[API gateway](https://api.vsnexa.com/){ .md-button }
[OpenAPI reference](https://api.vsnexa.com/openapi.json){ .md-button }

## Access and limits

**Base URL:** `https://api.vsnexa.com`. No API key is required. Execution requires the payer's canonical wallet signature. Never request private keys.

Clients may send up to 120 total requests per minute, including at most 20
quote/build POSTs. A two-stage build counts twice. Maximum body: 32 KiB.
Respect HTTP 429 and `Retry-After`; back off on availability errors. Browser
integrations require an approved Origin; requests use no credentialed CORS.
Server-to-server clients need no Origin header.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/quote` | Exact quote from one current OPEN public L1 route |
| POST | `/v1/build` | Signing request, then permit and executable transaction |
| GET | `/v1/status` | Quote usability, fill status or wallet history |
| GET | `/v1/chains` | Networks and open directional pairs |
| GET | `/v1/tokens` | Token metadata; optional `chainId` filter |
| GET | `/v1/health` | Availability, public data version and timestamp |
| GET | `/.well-known/nexa-aggregator.json` | Discovery manifest |
| GET | `/openapi.json` | Machine-readable field definitions |
| GET | `/v1/docs` | Redirect to this readable guide |

## Chains and tokens

Chains returns `{ chains, pairs, routes, dataVersion, validUntil }`; tokens returns `{ tokens, dataVersion, validUntil }`. Match publication versions before combining responses. Token metadata includes address, chain ID, symbol and decimals; assets come from public V6 metadata. A listed token does not prove liquidity: choose a current `pairs` entry, then quote.

Each `routes` entry includes the pair, `routeId`, `quoteId`, `dataVersion`,
`validUntil`, `minimumFillInRaw` and `maxAvailableInRaw`. Bounds come from that
public OPEN route in raw **source-token** units and must never be combined
across routes. They are published input limits, not a guarantee that a later
quote will be admitted. Display each range using source decimals; invalidate
it on closure, expiry or publication changes. Current quote and permit checks
remain authoritative.

## Quote and raw amounts

POST the following fields: `fromChainId`, `toChainId`, `fromToken`, `toToken`, `amountIn`, and, before build, `userAddress` and `recipient`.

Amounts are **base-10 integer strings in raw token units**, positive uint128 values. For a six-decimal token, `"10000000"` means 10 tokens. Never use floating-point conversion or assume all tokens have the same decimals.

The response includes `provider`, `routeId`, `quoteId`, `quoteToken`, `dataVersion`, pair fields, `amountIn`, `amountOut`, explicit raw fields, decimals, `sourceRouter`, `expiresAt`, `permitRequired`, `executionType` and status. `quoteToken` identifies this exact request; it does not replace the canonical quote ID. Optional execution-time estimates may be unavailable and are not guarantees.

## Build and wallet execution

The following outline deliberately stops before spending funds. Supply `selectedPair` from the chains response and convert the user's amount using token decimals.

```javascript
import { hexlify, toUtf8Bytes } from 'ethers';
const BASE = 'https://api.vsnexa.com';
async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST', credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}
const [account] = await ethereum.request({ method: 'eth_requestAccounts' });
const quote = await post('/v1/quote', {
  ...selectedPair, amountIn: rawAmountString,
  userAddress: account, recipient: account
});
// Display the exact input/output and obtain consent.
const request = {
  quoteToken: quote.quoteToken, quoteId: quote.quoteId, routeId: quote.routeId,
  userAddress: account, recipient: account, idempotencyKey: crypto.randomUUID()
};
const stage = await post('/v1/build', request);
const requestSignature = await ethereum.request({ method: 'personal_sign',
  params: [hexlify(toUtf8Bytes(stage.signingPayload.message)), account] });
const built = await post('/v1/build', { ...request, requestSignature });
```

First-stage response: `signatureRequired: true`, `signingPayload`, exact `quote`, expiry. Sign the returned canonical UTF-8/EIP-191 message, not a replacement message.

Second-stage response: `signatureRequired: false`, `chainId`, `from`, `target`, `data`, `value`, `approval`, `fillId`, quote identifiers, `expiresAt`, `quote` and signed `permit`. Verify these match the displayed quote and canonical router. The transaction is the existing V6 `fillDirect` payload.

Switch to the source chain; recheck account, balance and expiry. For ERC20 input, check allowance and approve only `approval.amount` to `approval.spender` if insufficient. Native input needs no ERC20 approval. Estimate gas from the exact transaction, show its cost, then obtain explicit wallet confirmation. After submission, retain `fillId` and the source hash; track receipts and public status rather than resubmitting.

Reuse the same idempotency key for retries of the same build. Changed payer,
recipient or economics require a new request. Quote handles are ephemeral;
obtain a fresh quote when a handle is unavailable or expired.

## Publication and expiry

`expiresAt` is Unix seconds: the earliest route, feed or exact-pricing deadline, without a separate 45-second cap. A quote does not reserve liquidity. Closure, a changed publication cycle or insufficient current capacity can prevent execution sooner.

Use `dataVersion` and `validUntil` to keep catalog data aligned, and recheck
quote status before execution. Feed notifications never authorize a payout
independently.

Check `/v1/status?quoteToken=...` before approvals and submission, including after permit creation. `quoteValid: false` blocks new execution; `quoteError` gives a safe reason when available. A refreshed payout needs renewed user consent. Submitted transfers remain trackable independently of publication.

## Status and history

Prefer `fillId`; `sourceTxHash` also identifies one fill. `quoteId` or `userAddress` returns `{ transactions, lookup, limit }` with up to 20 matching fills. Quote-only history cannot identify an unsigned exact-amount request; use its `quoteToken`.

States: `QUOTED` → `AWAITING_SIGNATURE` → `PERMITTED` → `SOURCE_SUBMITTED` → `SOURCE_CONFIRMED` → `PAYOUT_PENDING` → `COMPLETED`, or `EXPIRED` / `FAILED` when supported by evidence. Source inclusion does not prove destination payout. Only settlement evidence proves completion; expiry does not cancel a submitted obligation.

## Fees and slippage

No separate pool fee or DEX fee is added. There is no slippage against an accepted valid quote: signed input/output are exact. This does not imply a 1:1 exchange rate, free network gas or guaranteed execution after expiry. Nexa economics are already embedded in the payout.

Aggregator fees must remain external: before Nexa input, after output where supported, or through a compatible wrapper. Never modify Nexa's signed `amountIn`, `amountOut`, `routeId`, `quoteId`, permit or calldata. Show external fees separately; arbitrary fee overrides are rejected.

## Errors

Errors return `{ "ok": false, "error": "QUOTE_EXPIRED", "retryable": true }`; OpenAPI defines the complete enum. Invalid fields/assets return 400; no route/handle/status returns 404; changed quote/capacity conflicts return 409; expired/closed quotes return 410; rate limits return 429; unavailable publication/pricing returns 503. Refresh and review expired/changed quotes; back off on technical outages. Failed publication verification is not an economic rejection.

[Swap & Bridge guide](dex.md) · [Existing V6 solver API](api.md) · [Contact](contact.md)
