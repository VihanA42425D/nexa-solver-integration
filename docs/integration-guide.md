# Integration Guide

This guide covers common public Nexa V6 integration patterns.

## 1. Solver integration

Use the SDK when possible. The SDK contract is frozen and shared across TypeScript, Python, Rust, Go, JVM, and .NET implementations.

TypeScript example:

```js
import { NexaV6Client } from "nexa-v6-sdk";

const client = new NexaV6Client();
const { routes } = await client.getRoutes({ sourceChainId: 8453 });
```

For execution:

1. Read Discovery and the Signed Feed.
2. Verify `signedPayload`, then select a Route.
3. Request the Permit message and sign it with the payer wallet.
4. Request the Permit.
5. Resolve, preview, or build the execution transaction.
6. Submit the source transaction and track Fill status.

Route Detail is an optional canonical confirmation read, not a prerequisite for
the Permit path.

Never substitute an unverified convenience projection for the signed Feed payload.

## 2. Wallet / aggregator integration

A wallet, bridge aggregator, or intent framework can bootstrap from the canonical discovery document:

```text
https://solver.vsnexa.com/.well-known/nexa-solver.json
```

Recommended sequence:

```text
Discovery document
  -> verify onchain identities
  -> verify Signed Feed
  -> select route
  -> request/sign Permit message
  -> obtain Permit
  -> resolve/preview/build transaction
  -> execute
  -> Fill status
```

The machine-readable onboarding record is available at [onboarding/nexa-v6-solver-operator.json](../onboarding/nexa-v6-solver-operator.json).

## 3. ERC-7683 integration

Nexa exposes an executable ERC-7683 resolver surface. Resolution returns the canonical Router call and does not introduce an extra source-chain transaction.

Repository validation:

```bash
npm run resolve:erc7683
```

See:

- [Standards manifest](../standards/nexa-standards.json)
- [Deterministic vectors](../standards/test-vectors.json)

## 4. OIF discovery

OIF support is discovery-description-only. Do not treat it as an executable Nexa path.

```bash
npm run describe:oif
```

## 5. Scanner / explorer integration

Use the on-chain fingerprint:

```text
https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json
```

It provides stable selectors, event metadata, deployment evidence, runtime hashes, CREATE2 evidence, and cross-chain identity data for external scanners.

## 6. Indexer integration

For external indexing, use the published Graph/Substreams artifacts.

- [Indexing package](../indexing/README.md)
- [External deployment evidence](../indexing/external-deployments.json)

Indexing surfaces are non-authoritative and must not be used as a replacement for the Signed Feed or execution Permit.

## 7. OpenAPI integration

The canonical OpenAPI 3.1 document is available at:

```text
https://solver.vsnexa.com/openapi.json
```

It describes discovery, Feed, route detail, Permit, and Fill-status endpoints.

## Integration checklist

- [ ] Read the canonical discovery document.
- [ ] Verify published contract identities.
- [ ] Verify the Signed Feed cryptographically.
- [ ] Keep payer wallet signing outside the SDK/runtime.
- [ ] Request a Permit before execution.
- [ ] Preserve the documented transaction path.
- [ ] Treat Graph/Substreams/analytics as discovery only.
