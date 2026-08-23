## Integration proposal

Add Nexa V6 as a signed offchain discovery source for OIF Solver operators.

- Chains: `8453`, `56`, `999`
- Same-address Discovery Facade: `0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6`
- Discovery URI: https://solver.vsnexa.com/.well-known/nexa-solver.json
- Signed HTTP Feed: https://solver.vsnexa.com/api/v6/solver-feed
- SSE: https://solver.vsnexa.com/api/v6/solver-feed/events
- ERC-7683 Resolver: `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522`

The Feed is public, EIP-191 signed, short-lived and recoverable after SSE disconnect. A source plugin must verify the pinned signer, feed hash, validity window, Facade runtime/bindings and Resolver runtime before exposing opportunities to the Solver.

## Compatibility boundary

Nexa's OIF module is currently `DISCOVERY_DESCRIPTION_ONLY`, not an executable OIF settler. Execution uses a wallet-signed Nexa Permit, resolver-centric `eth_call`, Router preview and one source transaction. This should not be registered as the existing generic OIF order API implementation.

## Published integration material

- Release: https://github.com/VihanA42425D/nexa-solver-integration/releases/tag/v6.0.1
- Operator package: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/onboarding/nexa-v6-solver-operator.json
- OpenAPI: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/openapi/openapi.json
- Feed verification module: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/src/feed-verification.mjs
- Resolver dossier: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/verification/erc7683-resolver-vetting.json

## Maintainer decision requested

Please confirm whether this belongs as:

1. a dedicated offchain discovery implementation in `solver-discovery`, or
2. an external plugin maintained by Nexa and referenced from OIF documentation.

After that architecture decision, we can submit the implementation and tests against the selected plugin boundary.
