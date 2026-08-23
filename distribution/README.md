# Zero-touch Distribution Ledger

This directory records external Nexa V6 distribution and Solver/Aggregator onboarding work. The immutable operator package is published in the [v6.0.1 release](https://github.com/VihanA42425D/nexa-solver-integration/releases/tag/v6.0.1).

The current ERC-7683 specification is resolver-centric and does not define a centralized protocol registry. OIF exposes extensible discovery and adapter implementations, but Nexa's public OIF module is description-only. Upstream integration therefore starts with architecture and resolver-vetting RFCs before executable adapter code is proposed.

## Status vocabulary

- `SUBMITTED_AWAITING_MAINTAINER_REVIEW`: the public upstream RFC exists; a human maintainer decision is required.
- `READY`: no external approval is required and the artifact is published.
- `NOT_CURRENTLY_ELIGIBLE`: the target's published requirements exclude this integration type.
- `NOT_APPLICABLE`: the target is a protocol-specific solver network rather than a registry for external order sources.

See [targets.json](targets.json) for machine-readable status and evidence.
