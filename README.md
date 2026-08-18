# Nexa Mainnet V6 Solver Integration

> **Deployed, awaiting Cutover.** Nexa V6 deployment, configuration, Route registration, and pre-Cutover verification are complete across Base, BSC, and HyperEVM. Public execution remains disabled until Cutover. The machine-readable deployment status in this repository remains fail-closed until activation.

Nexa V6 is a solver-oriented execution layer for **intra-chain and cross-chain opportunities**. It is designed to make discovery and execution integration low-friction, predictable, and machine-verifiable while keeping Nexa's private pricing, risk, capital, and settlement policies outside the public integration surface.

## Why Solvers may care

- Intra-chain and cross-chain opportunity coverage
- Automated, machine-readable discovery
- Variable-size executable opportunities
- Signed amount-bound execution terms
- Explicit executable capacity and availability
- Machine-verifiable state, freshness, and expiry
- Low protocol-side execution overhead
- No mandatory periodic onchain publication
- No account, Login, Session, or Cookie requirement for discovery
- Solver-controlled opportunity selection, capital allocation, and profitability assessment

The public surface describes **what a Solver can verify and execute**, not Nexa's internal decision, inventory, pricing, risk, or clearing logic.

## Machine-readable capability profile

The same advantages are exposed for automated Solver infrastructure:

```json
{
  "executionScopes": ["INTRA_CHAIN", "CROSS_CHAIN"],
  "automatedDiscovery": true,
  "variableSizeExecution": true,
  "amountBoundSignedTerms": true,
  "executableCapacityPublished": true,
  "machineVerifiableState": true,
  "lowProtocolOverhead": true,
  "periodicOnchainPublicationRequired": false,
  "loginRequired": false,
  "sessionRequired": false,
  "cookieRequired": false,
  "solverControlsCapital": true,
  "solverControlsOpportunitySelection": true,
  "solverControlsProfitabilityAssessment": true
}
```

The authoritative machine-readable profile is published in `manifest.json` and `/.well-known/nexa-solver.json`.

## Route and Permit model

A Route is a variable-size executable opportunity. The public Feed exposes machine-readable availability, minimum size, executable capacity, freshness, and signed terms. The Solver chooses an amount inside the published executable range and receives amount-bound execution instructions.

Solvers remain responsible for their own gas, acquisition, capital, hedging, and other private costs. Nexa does not make a profitability guarantee; each Solver independently evaluates whether an opportunity fits its own strategy and cost structure.

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

Discovery and Feed reads require no account, Login, Session, or Cookie. Execution authorization uses wallet or native-account proof plus an `Idempotency-Key`.

## Solver flow

1. Fetch `/.well-known/nexa-solver.json` and require an active deployment before execution.
2. Fetch `/api/v6/solver-feed` and verify its signature, signer, freshness, and expiry.
3. Select a `DISCOVERABLE` Route with `executionStatus=OPEN` and `permitAvailable=true`.
4. Choose `requestedAmountInRaw` inside the published executable range.
5. Request the deterministic execution-authorization message.
6. Sign it with the Source account and request the execution Permit.
7. Verify the returned exact amounts, identities, generation, expiry, and execution instructions.
8. Submit the returned execution instruction exactly as authorized.
9. Track the Fill status until it reaches a terminal state.

Do not infer private Nexa policy or settlement behavior from public Route data. Treat the signed response as the execution authority.

## Standards

**ERC-7683:** executable compatibility is exposed for compatible Solver infrastructure.

**OIF:** discovery and description compatibility is exposed where applicable. Capability levels are machine-readable in `standards/standard-ids.json`.

## Execution scopes

Nexa V6 supports both:

- **INTRA_CHAIN** — Source and Destination are on the same network.
- **CROSS_CHAIN** — Source and Destination are on different networks.

Route identity and execution state are machine-verifiable independently of the Solver's strategy. Public integration data intentionally excludes Nexa's private business logic and internal policy.

## Install and validate

```bash
npm install
npm run generate:solver-manifest
npm run validate
npm test
npm run worker:check
```

`npm run verify:onchain` remains fail-closed while the bundle reports `DEPLOYED_AWAITING_CUTOVER`. Activation data is published only after Cutover.

## Repository map

```text
manifest.json                         machine-readable Solver capability profile
nexa-mainnet-v6.json                  canonical deployment bundle; fail-closed until Cutover
standards/standard-ids.json           supported standards and compatibility levels
events/events.json                    public execution event signatures/topic0
src/public-endpoints.mjs              public V6 endpoint catalog
src/feed-verification.mjs             signed Feed verification helper
src/load-public-surface.mjs           public bundle loader
examples/discover-open-routes.mjs     discovery example
examples/request-execution-permit.mjs execution authorization example
public/.well-known/                   generated Solver discovery document
scripts/validate.mjs                  public-surface integrity checks
```

## Public/private boundary

This repository intentionally exposes only the information required for independent Solver discovery, verification, and execution integration. Private pricing policy, risk policy, capital policy, clearing internals, operator infrastructure, and business logic are not part of the public interface.
