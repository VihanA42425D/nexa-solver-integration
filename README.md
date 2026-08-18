# Nexa Mainnet V6 Solver Integration

> **Deployed, awaiting Cutover.** Nexa V6 contract deployment, configuration, Route registration, and pre-Cutover verification are complete. Source intake on the V6 Routers remains disabled on Base, BSC, and HyperEVM, so this repository must still be treated as non-executable Mainnet configuration. Do not use it for execution until Cutover enables V6 source intake and `nexa-mainnet-v6.json` is replaced by the activation-gated export containing the real contract addresses and ABIs.

Nexa V6 is a direct inventory settlement protocol. A successful Route Fill has exactly **two onchain transactions** in the normal path:

1. **TX #1 — Solver/Bot on Source:** the Solver submits the exact signed Fill to `RouterV6.fillDirect` on EVM, or one native Source Connector call on another VM.
2. **TX #2 — Nexa on Destination:** after Source finality, Nexa pays the exact destination amount from the Destination Vault through `VaultV6.payoutAuthorized` on EVM, or one native Destination Connector payout on another VM.

There is no Reservation, Receipt, Coordinator, Solver Lane, `markFilled`, or periodic Route-publication transaction in V6.

## Route and Permit model

A Route is a variable-size opportunity. The signed Feed exposes a minimum input and `maxAvailableInRaw`; the Solver chooses `requestedAmountInRaw` inside that range. The Feed price is indicative only. Nexa reprices the exact requested amount using fresh amount-bound market evidence and issues a short-lived Permit containing the exact `amountInRaw` and `amountOutRaw`.

The Solver remains responsible for its own gas, acquisition, capital, hedging, and other private costs. Nexa does not guarantee Solver profitability.

## Public endpoints

Base URL: `https://solver.vsnexa.com`

- `GET /.well-known/nexa-solver.json`
- `GET /api/v6/solver-discovery`
- `GET /api/v6/solver-feed`
- `GET /api/v6/solver-feed/events`
- `GET /api/v6/routes/{routeId}`
- `POST /api/v6/execution-permits/request-message`
- `POST /api/v6/execution-permits`
- `GET /api/v6/execution-permits/{fillId}`

Discovery and Feed reads require no account, Login, Session, or Cookie. Permit requests use Source-wallet/native-account proof plus an `Idempotency-Key`.

## Solver flow

1. Fetch `/.well-known/nexa-solver.json` and require an active V6 deployment.
2. Fetch `/api/v6/solver-feed` and cryptographically verify its hash, signature, signer, and expiry.
3. Select a `DISCOVERABLE` Route with `executionStatus=OPEN` and `permitAvailable=true`.
4. Choose `requestedAmountInRaw <= maxAvailableInRaw`.
5. POST the request fields to `/api/v6/execution-permits/request-message`.
6. Sign the returned message with the Source account and POST the same request plus proof to `/api/v6/execution-permits`.
7. Verify the exact Permit fields, nonce, generation, expiry, canonical Network/Asset/Account IDs, and execution target.
8. Submit exactly one Source transaction.
9. Track `/api/v6/execution-permits/{fillId}` until the single Nexa Destination transaction is `PAID`.

## Standards

**ERC-7683:** executable resolver compatibility. `resolve(bytes) -> ResolvedOrder` is intended for offchain `eth_call` and resolves to exactly one execution step targeting the same `RouterV6.fillDirect` Source transaction.

**OIF:** discovery/description compatibility only in the current V6 release. Nexa does not claim an executable OIF oracle/output-settler flow. `resolveExecution` is intentionally unsupported rather than adding a third transaction or publishing fake OIF semantics.

## Network model

Route identity uses canonical `bytes32` Network, Asset, and Account identifiers. EVM chain IDs/addresses and non-EVM native identifiers are local execution bindings, not the global Route identity. New EVM or non-EVM networks can be added through the Network Directory/Connector model without redeploying existing V6 Core contracts. Every supported direction must preserve exactly one Source transaction and one Destination transaction.

## Cloudflare Worker

The public Worker proxies only the allowlisted V6 API surface to the private Origin. It supports GET/POST/OPTIONS as required, authenticates Worker-to-Origin traffic with Cloudflare Access service credentials, and attaches a rotating HMAC-authenticated Solver fingerprint for best-effort telemetry. Solvers do not need Cloudflare Login.

Configure secrets outside source control:

```bash
npx wrangler secret put SOLVER_ORIGIN_URL
npx wrangler secret put CF_ACCESS_CLIENT_ID
npx wrangler secret put CF_ACCESS_CLIENT_SECRET
npx wrangler secret put NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET
```

## Install and validate

```bash
npm install
npm run generate:solver-manifest
npm run validate
npm test
npm run worker:check
```

`npm run verify:onchain` remains intentionally fail-closed while the bundle reports `DEPLOYED_AWAITING_CUTOVER`. After Cutover, the activation-gated export publishes the real activated Mainnet addresses and ABIs and this check becomes executable.

## Repository map

```text
manifest.json                         public integration policy
nexa-mainnet-v6.json                  canonical deployment bundle; fail-closed until Cutover
standards/standard-ids.json           V6 standard IDs and compatibility level
events/events.json                    V6 execution event signatures/topic0
src/public-endpoints.mjs              allowlisted public V6 endpoint catalog
src/feed-verification.mjs             signed Feed verification helper
src/load-public-surface.mjs           public bundle loader
src/worker.mjs                        Cloudflare public edge proxy
examples/discover-open-routes.mjs     signed Feed discovery example
examples/request-execution-permit.mjs Permit request example without private-key custody
public/.well-known/                   generated discovery document
scripts/validate.mjs                  public-surface integrity checks
```

## Deprecated V5 execution surface

Reservation-first V5 integration artifacts are intentionally removed from the V6 branch. Do not use Reservation Coordinator, ReservationReceipt, Solver Lane, legacy ERC-7683 adapter, V5 OIF fill adapter, or `markFilled` for new V6 execution.
