# Nexa V6 Documentation

Nexa V6 is a public cross-chain solver integration surface for **Base**, **BNB Smart Chain**, and **HyperEVM**. It exposes machine-readable discovery, verified onchain identities, a signed live route feed, execution permits, ERC-7683 compatibility, OIF discovery metadata, SDKs, and external indexing packages.

## Start in 60 seconds

For Node.js / TypeScript:

```bash
npm install nexa-v6-sdk@1.0.0
```

```js
import { NexaV6Client } from "nexa-v6-sdk";

const client = new NexaV6Client();
const { routes } = await client.getRoutes({ sourceChainId: 8453 });
console.log(routes);
```

The SDK verifies the signed Feed before returning routes. Wallet signing remains outside the SDK.

## Canonical machine endpoints

- Solver discovery: https://solver.vsnexa.com/.well-known/nexa-solver.json
- Onchain discovery: https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json
- Standards: https://solver.vsnexa.com/.well-known/nexa-standards.json
- OpenAPI: https://solver.vsnexa.com/openapi.json
- Signed Feed: https://solver.vsnexa.com/api/v6/solver-feed

## Guides

- [Quick start](quick-start.md)
- [Architecture](architecture.md)
- [Integration guide](integration-guide.md)
- [FAQ](faq.md)

## Public indexing

Nexa publishes non-authoritative external indexing packages for The Graph and Substreams.

See the repository [indexing package](../indexing/README.md) for manifests, package IDs, deployment evidence, and validation results.

## Authority model

The public integration follows one strict trust chain:

**Onchain Registry / Router identity and state → Signed Feed for live route terms → Execution Permit for final execution authority.**

Graph, Substreams, analytics systems, explorers, and other discovery surfaces are projections only.
