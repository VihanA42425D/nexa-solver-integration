# Rabby Bridge provider integration RFC: Nexa V6

## Request

Add Nexa V6 as a bridge quote provider in Rabby's bridge backend/provider registry and allow the verified Nexa Router as an execution target.

## Fixed integration surface

- Chains: Base (8453), BNB Smart Chain (56), HyperEVM (999)
- Discovery Facade: 0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6
- Discovery URI: https://solver.vsnexa.com/.well-known/nexa-solver.json
- Signed Feed: https://solver.vsnexa.com/api/v6/solver-feed
- ERC-7683 Resolver: 0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522
- Router: 0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938
- Integration bundle: https://github.com/VihanA42425D/nexa-solver-integration
- SDK contract: sdk-spec/nexa-v6-sdk-contract.json

## Adapter boundary

The adapter discovers active routes, verifies the raw-digest ECDSA Feed signature, requests the deterministic Permit message, obtains the user's EIP-191 signature, requests a Permit, previews fillDirect, and returns the source-chain transaction. It must not sign on behalf of the user.

The source Router is the spender/execution target. Route and Permit expiry, expected output, source/destination chain, source transaction hash, payout transaction hash, Fill ID, and final PAID state are returned by the public APIs.

## Verification

All six SDKs use shared byte-for-byte vectors for Feed verification and execution calldata. Facade identity, runtime hashes, immutable Registry/Router bindings, explorer links, ABI, OpenAPI and resolver-vetting evidence are in the public repository.

## Requested maintainer decision

Please confirm:

1. the backend provider adapter boundary and quote schema mapping;
2. the Router/spender allowlist review;
3. whether the integration should be implemented in this repository or Rabby's private bridge backend.
