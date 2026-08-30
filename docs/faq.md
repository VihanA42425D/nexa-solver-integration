# FAQ

## What is Nexa V6?

Nexa V6 is a public cross-chain solver integration surface with machine-readable discovery, verified onchain identities, signed live route terms, execution permits, SDKs, and external indexing support.

## Which networks are supported?

- Base — chain ID 8453
- BNB Smart Chain — chain ID 56
- HyperEVM — chain ID 999

## Where should an integration start?

Start with the canonical discovery document:

```text
https://solver.vsnexa.com/.well-known/nexa-solver.json
```

## What is authoritative for live route terms?

The cryptographically verified **Signed Feed** is authoritative for current live route terms.

## What is the final execution authority?

A valid Nexa **Execution Permit**.

## Are Graph or Substreams authoritative?

No. They are non-authoritative discovery/indexing projections.

## How should index results be used?

Use them for discovery and analytics, then verify candidates against the signed Feed, Execution Permit, and on-chain state before execution.

## Does ERC-7683 add an extra execution transaction?

No. The resolver returns the canonical Router call and preserves the documented source execution path.

## Is OIF executable?

No. Nexa's OIF surface is discovery-description-only.

## Where is the OpenAPI document?

```text
https://solver.vsnexa.com/openapi.json
```

## Where are the SDKs?

Published SDKs exist for TypeScript/Node, Python, Rust, JVM, and .NET; Go source is maintained in this repository. See the root README and `sdks/` directory.

## Where can I verify deployments?

Use the repository's `verification/` artifacts and the explorer/Sourcify links in the root README.

## How do I report a security issue?

Follow [SECURITY.md](../SECURITY.md). Do not disclose sensitive security findings in a public issue.
