# Nexa Mainnet V6 Solver Integration

[![Validate](https://github.com/VihanA42425D/nexa-solver-integration/actions/workflows/validate.yml/badge.svg)](https://github.com/VihanA42425D/nexa-solver-integration/actions/workflows/validate.yml)
[![SDK conformance](https://github.com/VihanA42425D/nexa-solver-integration/actions/workflows/sdk-conformance.yml/badge.svg)](https://github.com/VihanA42425D/nexa-solver-integration/actions/workflows/sdk-conformance.yml)
[![Release](https://img.shields.io/github/v/release/VihanA42425D/nexa-solver-integration)](https://github.com/VihanA42425D/nexa-solver-integration/releases)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

> **ACTIVE - Mainnet V6.** Public Nexa Solver discovery and execution integration for Base, BNB Smart Chain and HyperEVM.

**Documentation:** [docs.vsnexa.com](https://docs.vsnexa.com/)

This is the machine-readable integration surface for Nexa solvers, indexers and intent frameworks. It publishes the verified onchain Discovery Facade, Registry and Router bindings, signed Feed protocol, ERC-7683 resolver, OIF discovery module, ABI, OpenAPI, events, network IDs and reproducible verification evidence.

## Start here

Canonical discovery URI:

```text
https://solver.vsnexa.com/.well-known/nexa-solver.json
```

Passive onchain fingerprint for scanners and indexers:

```text
https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json
```

Authoritative OpenAPI and standards discovery:

```text
https://solver.vsnexa.com/openapi.json
https://solver.vsnexa.com/.well-known/nexa-standards.json
```
Discovery and crawler entry points:

```text
https://solver.vsnexa.com/
https://solver.vsnexa.com/robots.txt
https://solver.vsnexa.com/sitemap.xml
https://solver.vsnexa.com/llms.txt
https://solver.vsnexa.com/.well-known/nexa-solver.json
https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json
https://solver.vsnexa.com/.well-known/nexa-standards.json
https://solver.vsnexa.com/openapi.json
https://solver.vsnexa.com/api/v6/solver-discovery
```



```bash
npm install
npm run discover
npm run facade:read
npm run verify:onchain
```

The Facade exposes the same URI through `discoveryURI()`. A solver can resolve:

```text
onchain Facade -> .well-known -> discovery -> signed Feed -> ERC-7683 resolver -> Router
```

The fingerprint also pins the Facade selectors, CREATE2 evidence, Sourcify v2
lookups, `SourceFillV6` topic, ERC-165/7683 identifiers and the same-address
probe across chains 8453, 56 and 999. Reading or indexing it never requires an
onchain transaction.

The `SourceFillV6` text signature is registered in the Sourcify Signature
Database. Its record is a direct signature import and does not claim a verified
Router-source association; the Facade itself is an Exact Match on every chain.

## Verified mainnet contracts

All five public components use the same deterministic address and runtime bytecode on all three networks.

| Component | Address | Runtime code hash |
| --- | --- | --- |
| NexaSolverDiscoveryV6 | 0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6 | 0x57cb853a995215d352eb64ab9ec33aed60f4ef5f8a38575bc2dd018b38babfc1 |
| NexaMainnetRegistryV6 | 0x3db7752f052ACFECB3DA99BeE7c6a34D22367141 | 0x5e766be0eb7a9b75f0b38c8509a15ac261209f06b0c993e8904a9f38633c790a |
| NexaMainnetRouterV6 | 0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938 | 0xcdda1b571b317479c6d297aa4354c406d4709f83562e2b6b29bd0e1268e4af70 |
| ERC-7683 resolver | 0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522 | 0xea99f0e1e33a9a9e1ae926e8f15fd09bf1b7b9cecf81a2ef294cd4820e26d392 |
| OIF discovery module | 0x4f81426fE8999E982aE6b771536a4093879F6A20 | 0x103c954e71ec79abefc0f8e1ef745787649edb91742a4d4a7b0d2a4646925cba |

Facade verification:

- [BaseScan](https://basescan.org/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code) - [Sourcify](https://repo.sourcify.dev/8453/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)
- [BscScan](https://bscscan.com/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code) - [Sourcify](https://repo.sourcify.dev/56/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)
- [HyperEVMScan](https://hyperevmscan.io/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code) - [Sourcify](https://repo.sourcify.dev/999/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)

Compiler identity is `0.8.26+commit.8a97fa7a.Emscripten.clang`. Constructor arguments, init/runtime hashes, transactions and blocks are pinned in [verification/facade-deployment.json](verification/facade-deployment.json).

## Networks

| Network | Chain ID | Nexa network ID | Active routes |
| --- | ---: | --- | ---: |
| Base | 8453 | 0x3d5484ad492110227dc184ab6abbeeccd54b127aa00bfc256fd8d8037a4e48c2 | 108 |
| BNB Smart Chain | 56 | 0x5863eb850b94ec5a94a1653871dc308d32f4aec504d789f356419886170a0928 | 126 |
| HyperEVM | 999 | 0x5587698f40d78ef64484dda8f2c78692af870cfe3926dbc61a73881680bd01c8 | 108 |

Each Router has `sourceIntakeEnabled() == true`, is bound to the published Registry and shares release ID `0xcc0dc051739f2dafaebd2eb5663937850dcc3e7951e38f437e00fcd9fa6c8ff6`.

## Public API

The [OpenAPI 3.1 document](openapi/openapi.json) covers:

- `GET /.well-known/nexa-solver.json`
- `GET /.well-known/nexa-onchain-discovery.json`
- `GET /openapi.json`
- `GET /.well-known/nexa-standards.json`
- `GET /api/v6/solver-discovery`
- `GET /api/v6/solver-feed`
- `GET /api/v6/solver-feed/events`
- `GET /api/v6/routes/{routeId}`
- `POST /api/v6/execution-permits/request-message`
- `POST /api/v6/execution-permits`
- `GET /api/v6/execution-permits/{fillId}`

Verify every Feed with the published signer and [src/feed-verification.mjs](src/feed-verification.mjs) before selecting a Route.
`signedPayload` is the cryptographically authoritative object authenticated by
`feedHash`, `feedSigner` and `feedSignature`; filtered top-level `routes` and
`openRoutes` are convenience views and must never replace it as the signature
preimage. Route Detail returns the exact canonical active Feed route, while
operational metrics remain separate and non-authoritative.

SSE event IDs are Feed `dataVersion` values. A missing, invalid or older
`Last-Event-ID` receives the current confirmed Feed immediately; an ID equal to
the current `dataVersion` suppresses only that duplicate initial event. The
stream publishes `feed`, `publication-closed` and `error` events.

## Frozen SDK contract

The language-neutral [SDK contract](sdk-spec/nexa-v6-sdk-contract.json) and
[shared test vectors](sdk-spec/test-vectors.json) freeze canonical models,
raw-digest Feed verification, Permit signing, ERC-7683 resolution, execution
transaction building, Fill status and the shared error model at version 1.0.0.

The same ten behavioral operations are implemented for:

| Runtime | Package |
| --- | --- |
| Node / TypeScript | [nexa-v6-sdk@1.0.0 on npm](https://www.npmjs.com/package/nexa-v6-sdk/v/1.0.0) |
| Python | [nexa-v6-sdk 1.0.0 on PyPI](https://pypi.org/project/nexa-v6-sdk/1.0.0/) |
| Rust | [nexa-v6-sdk 1.0.0 on crates.io](https://crates.io/crates/nexa-v6-sdk/1.0.0) |
| Go | github.com/VihanA42425D/nexa-solver-integration/sdks/go |
| Java / Kotlin | [io.github.vihana42425d:nexa-v6-sdk:1.0.0 on Maven Central](https://central.sonatype.com/artifact/io.github.vihana42425d/nexa-v6-sdk/1.0.0) |
| .NET | [VihanA.Nexa.V6.Sdk 1.0.0 on NuGet](https://www.nuget.org/packages/VihanA.Nexa.V6.Sdk/1.0.0) |

Go and .NET use their exported PascalCase naming convention; the behavioral
mapping to discover, getRoutes, getRoute, verifyFeed, requestPermitMessage,
requestPermit, resolveExecution, previewExecution, buildExecutionTx and
getFillStatus is pinned in the SDK contract.

Maven Central artifacts are signed with OpenPGP fingerprint
`A3A1CA1FF8968B62DB50B4537EFE1BDBD7E89F25`.

## Standards and examples

- [Standards manifest](standards/nexa-standards.json): canonical deployed identities, selectors, interface IDs, router bindings and resolution semantics.
- [Deterministic standards vectors](standards/test-vectors.json): canonical public SDK Permit projected into ERC-7683 and OIF ABI vectors.
- ERC-7683: executable, resolver-centric off-chain `eth_call` integration. `resolve(bytes)` returns exactly one `Call` targeting the canonical Router `fillDirect`; it introduces no second source transaction. Run `npm run resolve:erc7683`.
- OIF: `DISCOVERY_DESCRIPTION_ONLY` with `executable = false`; `resolveExecution(bytes)` remains unsupported with `OIFExecutionUnsupported()`. Run `npm run describe:oif`.
- Direct Nexa execution: request a signed execution Permit, preview `Router.fillDirect`, then submit the source transaction.

Examples never require a private key to be committed. Signing stays in the integrating wallet or bot.

## Passive Graph and Substreams indexing

The [indexing package](indexing/README.md) supplies one generated canonical
configuration, one shared Graph schema/mapping for Base (8453) and BSC (56), and
one shared Substreams Rust/protobuf implementation for Base, BSC, and HyperEVM
(999). HyperEVM Subgraphs are unsupported by Subgraph Studio and remain
standalone-Substreams-only. Base and BSC are available through Graph Studio; all
three network packages are published to the Substreams Registry. Treat every
index result as a passive discovery aid and verify it against the signed Feed,
Execution Permit, and on-chain Registry/Router state before execution.

    npm run indexing:generate
    npm run indexing:validate
    npm run indexing:check

Exact per-contract start blocks come from committed offline
[deployment evidence](verification/indexing-deployment-evidence.json). External Graph Studio and Substreams Registry IDs, URLs, package hashes, and
validation evidence are recorded in
[indexing/external-deployments.json](indexing/external-deployments.json).

## Zero-touch Solver onboarding

The fixed [Solver operator onboarding package](onboarding/nexa-v6-solver-operator.json) contains the chain IDs, same-address Facade, Registry and Router bindings, ERC-7683 Resolver, Feed, SSE, OpenAPI, ABI and verification references required by an automated operator.

```bash
npm run onboard:verify
```

See [onboarding/README.md](onboarding/README.md) for the copy-paste registry record, trust boundary and operator intake path.
The [distribution ledger](distribution/targets.json) tracks direct Rabby
integration plus the review/KYB boundaries for OpenOcean, 1inch, Rango, 0x and
other EVM wallets with bridge routing.

## Repository map

| Path | Purpose |
| --- | --- |
| [manifest.json](manifest.json) | final ACTIVE artifact index |
| [nexa-mainnet-v6.json](nexa-mainnet-v6.json) | canonical public integration bundle |
| [public/.well-known/nexa-onchain-discovery.json](public/.well-known/nexa-onchain-discovery.json) | passive onchain selectors, events, CREATE2 and Sourcify fingerprint |
| [public/.well-known/nexa-standards.json](public/.well-known/nexa-standards.json) | stable HTTP projection of canonical ERC-7683/OIF metadata |
| [openapi/openapi.json](openapi/openapi.json) | generated, fully typed OpenAPI 3.1 solver surface |
| [onboarding/nexa-v6-solver-operator.json](onboarding/nexa-v6-solver-operator.json) | fixed Solver/Aggregator onboarding record |
| [abi/solver-facing.json](abi/solver-facing.json) | Facade, Registry, Router and module ABI |
| [networks/network-ids.json](networks/network-ids.json) | chain and Nexa network identities |
| [standards/standard-ids.json](standards/standard-ids.json) | ERC-7683 and OIF compatibility |
| [standards/nexa-standards.json](standards/nexa-standards.json) | canonical standards machine manifest |
| [standards/test-vectors.json](standards/test-vectors.json) | deterministic ERC-7683 and OIF vectors |
| [events/events.json](events/events.json) | canonical indexed V6 event signatures and topics |
| [indexing](indexing) | passive Graph/Substreams package, canonical config and deployment handoff |
| [verification](verification) | source, deployment, identity, signature and checksums |
| [examples](examples) | discovery, Permit, Facade and resolution clients |
| [sdk-spec](sdk-spec) | frozen cross-language behavior and byte-level vectors |
| [sdks](sdks) | TypeScript, Python, Rust, Go, JVM and .NET implementations |
| [distribution](distribution) | upstream aggregator/wallet onboarding ledger and submissions |

## Release verification

```bash
npm run generate:solver-manifest
npm run generate:onchain-discovery
npm run generate:standards
npm run generate:standard-vectors
npm run generate:abi
npm run generate:openapi
npm run generate:onboarding
npm run generate:sdk-vectors
npm run indexing:generate
npm run generate:checksums
npm run validate
npm test
npm run indexing:check
npm run sdk:conformance
npm run worker:check
npm run verify:onchain
```

## Security

Report security issues according to [SECURITY.md](SECURITY.md).
