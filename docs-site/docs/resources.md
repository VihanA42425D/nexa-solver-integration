---
title: Nexa V6 public resources
description: Canonical machine endpoints, source packages, examples, verification evidence, onboarding material, and documentation discovery resources.
---

# Public resources

## Canonical machine endpoints

| Resource | URL |
| --- | --- |
| Solver discovery | [`/.well-known/nexa-solver.json`](https://solver.vsnexa.com/.well-known/nexa-solver.json) |
| Passive on-chain fingerprint | [`/.well-known/nexa-onchain-discovery.json`](https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json) |
| Standards manifest | [`/.well-known/nexa-standards.json`](https://solver.vsnexa.com/.well-known/nexa-standards.json) |
| OpenAPI | [`/openapi.json`](https://solver.vsnexa.com/openapi.json) |
| Solver discovery projection | [`/api/v6/solver-discovery`](https://solver.vsnexa.com/api/v6/solver-discovery) |
| Signed Feed | [`/api/v6/solver-feed`](https://solver.vsnexa.com/api/v6/solver-feed) |
| Feed events | [`/api/v6/solver-feed/events`](https://solver.vsnexa.com/api/v6/solver-feed/events) |

Endpoint templates for route detail and permit status are defined in discovery
and OpenAPI. Use concrete IDs from verified responses; do not copy placeholders
into requests.

## Repository and packages

- [Public README](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/README.md)
- [Public integration manifest](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/manifest.json)
- [Mainnet V6 integration bundle](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/nexa-mainnet-v6.json)
- [Public event definitions](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/events/events.json)
- [Canonical network IDs](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/networks/network-ids.json)
- [Published checksums](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/verification/checksums.sha256)
- [Public integration repository](https://github.com/VihanA42425D/nexa-solver-integration)
- [Release artifacts](https://github.com/VihanA42425D/nexa-solver-integration/releases)
- [Solver-facing ABI](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/abi)
- [SDK contract and vectors](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/sdk-spec)
- [Language SDK sources](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/sdks)
- [Indexing package](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/indexing)
- [Onboarding package](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/onboarding)
- [Verification evidence](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/verification)

## Reference examples

- [Discover open routes](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/examples/discover-open-routes.mjs)
- [Read the Discovery Facade](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/examples/read-discovery-facade.mjs)
- [Request an Execution Permit](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/examples/request-execution-permit.mjs)
- [Resolve ERC-7683](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/examples/resolve-erc7683.mjs)
- [Describe an OIF mandate](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/examples/describe-oif-mandate.mjs)

## Documentation discovery

- [`robots.txt`](https://docs.vsnexa.com/robots.txt)
- [`sitemap.xml`](https://docs.vsnexa.com/sitemap.xml)
- [`llms.txt`](https://docs.vsnexa.com/llms.txt)
- [`llms-full.txt`](https://docs.vsnexa.com/llms-full.txt)
- Local documentation search in the site header

## Which source should I use?

- Use discovery to find the current public endpoints and expected signer.
- Use the signed Feed for live published route terms.
- Use the permit envelope for one fill's authorized execution.
- Use the on-chain contracts and receipts for state and completion.
- Use SDKs and examples to implement these checks.
- Use Graph/Substreams and documentation for passive discovery only.

## Contributing and support

Read the repository [contribution guide](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/CONTRIBUTING.md),
start a public design question in
[Discussions](https://github.com/VihanA42425D/nexa-solver-integration/discussions),
or report a reproducible defect through
[Issues](https://github.com/VihanA42425D/nexa-solver-integration/issues).

For security-sensitive reports, follow the repository
[security policy](https://github.com/VihanA42425D/nexa-solver-integration/security/policy).
