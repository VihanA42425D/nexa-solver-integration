## Integration proposal

Register Nexa V6 as a signed Solver source through a dedicated OIF Aggregator adapter.

- Chains: `8453`, `56`, `999`
- Discovery Facade: `0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6`
- Discovery: https://solver.vsnexa.com/.well-known/nexa-solver.json
- Feed: https://solver.vsnexa.com/api/v6/solver-feed
- SSE: https://solver.vsnexa.com/api/v6/solver-feed/events
- ERC-7683 Resolver: `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522`

## Proposed adapter boundary

The adapter would:

1. verify the signed Feed and validity window;
2. expose supported route pairs from the precise route catalog;
3. map compatible quote requests to active Nexa opportunities;
4. return an explicit wallet-signature requirement for execution;
5. request a Nexa execution Permit only after the payer signs the canonical request message;
6. resolve and preview the ERC-7683 payload before source broadcast;
7. map Permit status through destination payout to `PAID`.

Discovery requires no API key. The operator's wallet/KMS remains the signing boundary for Permit requests and source transactions.

## Published integration material

- Immutable release: https://github.com/VihanA42425D/nexa-solver-integration/releases/tag/v6.0.1
- Operator package: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/onboarding/nexa-v6-solver-operator.json
- OpenAPI: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/openapi/openapi.json
- ABI and events: https://github.com/VihanA42425D/nexa-solver-integration/tree/main/abi
- Verification evidence: https://github.com/VihanA42425D/nexa-solver-integration/tree/main/verification

## Maintainer decision requested

The current built-in OIF adapter targets the OIF quote/order API, while Nexa uses a signed opportunity Feed plus wallet-authorized Permit flow. Please confirm whether a first-party `nexa-v6` custom adapter is in scope for this repository and whether the wallet-signature boundary should be represented as a new adapter capability or an explicit unsupported response in unattended mode.

Once that interface decision is approved, we can submit the Rust adapter and contract tests without changing Nexa contracts.
