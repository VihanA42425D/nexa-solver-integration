# Nexa V6 Solver Operator Onboarding

Use [nexa-v6-solver-operator.json](nexa-v6-solver-operator.json) as the canonical, machine-readable onboarding record.

## Copy-paste registration record

```text
Protocol: Nexa V6
Chains: 8453 / 56 / 999
DiscoveryFacade: 0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6
DiscoveryURI: https://solver.vsnexa.com/.well-known/nexa-solver.json
OnchainDiscovery: https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json
ERC7683Resolver: 0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522
Feed: https://solver.vsnexa.com/api/v6/solver-feed
SSE: https://solver.vsnexa.com/api/v6/solver-feed/events
Public integration repo: https://github.com/VihanA42425D/nexa-solver-integration
Verification evidence: https://github.com/VihanA42425D/nexa-solver-integration/tree/main/verification
```

Registry and Router use the same addresses on all supported chains:

```text
Registry: 0x3db7752f052ACFECB3DA99BeE7c6a34D22367141
Router: 0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938
```

## Zero-touch verification

```bash
npm install
npm run onboard:verify
```

An operator should pin the release artifact and checksum, verify the Facade runtime and immutable bindings on every enabled chain, verify every Feed signature, vet the ERC-7683 Resolver, subscribe to SSE with HTTP Feed recovery, and simulate the Router call before broadcasting a source transaction.

The [Resolver vetting dossier](../verification/erc7683-resolver-vetting.json) pins its runtime, Router binding, payload encoding, one-step behavior and named assumptions. Exact Standard JSON source identity is not claimed for the Resolver; external source review is required before an operator enables production capital.

Discovery and Feed reading need no Nexa credential or wallet signature. Execution Permit requests require the integrating operator's wallet proof. Private keys must remain in the operator's KMS, HSM or wallet.

## Compatibility boundaries

- ERC-7683 is executable through resolver-centric `eth_call` resolution.
- OIF is discovery-description compatible only. The published OIF module is intentionally non-executable; an ecosystem-specific adapter is required before execution.
- Nexa does not require an integrating operator to deploy a new protocol contract.

## Operator intake

Operators can open the repository's `Solver operator onboarding` issue form. Include the chains to enable, the ingestion mode (`HTTP`, `SSE`, or both), resolver-vetting status and a technical contact. Never include private keys, API secrets or seed phrases.
