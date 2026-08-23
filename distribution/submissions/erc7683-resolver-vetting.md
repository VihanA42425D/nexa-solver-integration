## Protocol implementation

Nexa V6 is live on Base (8453), BNB Smart Chain (56) and HyperEVM (999). It publishes the same ERC-7683 Resolver address on every chain:

- Resolver: `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522`
- Runtime hash: `0xea99f0e1e33a9a9e1ae926e8f15fd09bf1b7b9cecf81a2ef294cd4820e26d392`
- Discovery Facade: `0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6`
- Discovery URI: https://solver.vsnexa.com/.well-known/nexa-solver.json
- Signed Feed: https://solver.vsnexa.com/api/v6/solver-feed

The Resolver consumes `abi.encode(ExecutionPermitV6, bytes signature)`, requires `Router.previewFillDirect` to succeed and resolves exactly one `Call` step to `Router.fillDirect`. It emits one destination ERC-20 payment and the named assumptions `NexaPermitPayerIsStepCaller` and `NexaPermitRecipientIsPaymentRecipient`. Native-asset payloads are rejected.

## Published package and evidence

- Immutable onboarding release: https://github.com/VihanA42425D/nexa-solver-integration/releases/tag/v6.0.1
- Machine-readable package: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/onboarding/nexa-v6-solver-operator.json
- Resolver vetting dossier: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/verification/erc7683-resolver-vetting.json
- ABI: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/abi/solver-facing.json
- Onchain verifier: https://github.com/VihanA42425D/nexa-solver-integration/blob/main/scripts/verify-onboarding.mjs

Runtime identity and Router binding are verified on all three chains. The dossier deliberately marks exact Standard JSON source identity as not published for this Resolver; external source review is required before capital activation.

## Requested upstream action

1. Confirm the recommended conformance harness for the current resolver-centric draft.
2. Review the one-step output, payment and named assumptions, or point us to the appropriate Resolver-vetting process.
3. If the project maintains or recommends a protocol/Resolver registry, advise the canonical registration path.

No protocol contract deployment or privileged credential is required for discovery.
