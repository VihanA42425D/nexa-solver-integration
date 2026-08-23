# Zero-touch Distribution Ledger

This directory records external Nexa V6 distribution and Solver/Aggregator onboarding work. The SDK-enabled immutable operator package is prepared for the v6.1.0 release.

The current ERC-7683 specification is resolver-centric and does not define a centralized protocol registry. OIF exposes extensible discovery and adapter implementations, but Nexa's public OIF module is description-only. Upstream integration therefore starts with architecture and resolver-vetting RFCs before executable adapter code is proposed.

## Status vocabulary

- `SUBMITTED_AWAITING_MAINTAINER_REVIEW`: the public upstream RFC exists; a human maintainer decision is required.
- `READY`: no external approval is required and the artifact is published.
- `NOT_CURRENTLY_ELIGIBLE`: the target's published requirements exclude this integration type.
- `NOT_APPLICABLE`: the target is a protocol-specific solver network rather than a registry for external order sources.
- `READY_FOR_PUBLIC_RFC`: the technical package is complete and a public upstream issue can be submitted.
- `HUMAN_CHANNEL_CREDENTIAL_REQUIRED`: the target accepts integrations only through an authenticated Discord, Telegram, or partner contact.
- `BUSINESS_KYB_REQUIRED`: the target requires organization onboarding and identity review.
- `PARTNERSHIP_REVIEW_REQUIRED`: source inclusion is controlled by the target's backend/partnership process.

Wallet distribution is tracked separately from same-chain DEX aggregation. Nexa is a signed cross-chain opportunity Feed with a wallet-signed Permit flow; a wallet must either add a direct Nexa provider adapter or receive Nexa indirectly through an onboarded bridge aggregator.

See [targets.json](targets.json) for machine-readable status and evidence.
