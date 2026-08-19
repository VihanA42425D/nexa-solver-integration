# Nexa Mainnet V6 Solver Integration

> **Active.** Nexa V6 is available on Base, BSC, and HyperEVM.

This repository exposes only the minimum public surface required for Solver discovery, verification, and execution.

## Solver capabilities

- Intra-chain and cross-chain opportunities
- Machine-readable discovery
- Variable-size execution
- Machine-verifiable state
- Accountless discovery

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

## Solver-facing addresses

The V6 Solver-facing contracts are deterministically deployed at the same addresses on Base (`8453`), BSC (`56`), and HyperEVM (`999`).

| Surface | Address |
| --- | --- |
| `NexaMainnetRegistryV6` | `0x3db7752f052ACFECB3DA99BeE7c6a34D22367141` |
| `NexaMainnetRouterV6` | `0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938` |

Standard-specific discovery modules:

| Standard | Module |
| --- | --- |
| ERC-7683 | `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522` |
| OIF | `0x4f81426fE8999E982aE6b771536a4093879F6A20` |

No internal deployment map is published here.

## Solver flow

1. Fetch `/.well-known/nexa-solver.json`.
2. Fetch the V6 Solver Feed and verify the returned signed data.
3. Select an available Route and requested size.
4. Request and sign the execution authorization message.
5. Request the execution Permit.
6. Preview and submit the authorized call to `NexaMainnetRouterV6`.
7. Track the Fill through the public status endpoint.

The returned Permit is the execution authority. Do not infer private Nexa policy from public Route data.

## Standards

ERC-7683 executable compatibility and OIF discovery compatibility are described in `standards/standard-ids.json`.

## Install and validate

```bash
npm install
npm run generate:solver-manifest
npm run validate
npm test
npm run worker:check
npm run verify:onchain
```

`verify:onchain` independently checks the published Registry, Router, route catalog, active Router state, Router-to-Registry binding, standard module identity, and deterministic cross-network runtime bytecode equality. The observed runtime code hashes are printed in its verification report.

## Repository map

```text
manifest.json                         public Solver capability profile
nexa-mainnet-v6.json                  canonical minimal V6 public bundle
standards/standard-ids.json           public standard compatibility
events/events.json                    Solver-facing source execution event
src/public-endpoints.mjs              public V6 endpoint catalog
src/feed-verification.mjs             signed Feed verification helper
src/load-public-surface.mjs           public bundle loader
examples/discover-open-routes.mjs     discovery example
examples/request-execution-permit.mjs execution authorization example
public/.well-known/                   generated Solver discovery document
scripts/validate.mjs                  public-surface integrity checks
```

## Public/private boundary

Internal custody, authorization, clearing, operator, pricing, risk, capital, and business infrastructure are intentionally excluded from this repository.
