# Nexa Mainnet V6 Solver Integration

[![Validate](https://github.com/VihanA42425D/nexa-solver-integration/actions/workflows/validate.yml/badge.svg)](https://github.com/VihanA42425D/nexa-solver-integration/actions/workflows/validate.yml)
[![Release](https://img.shields.io/github/v/release/VihanA42425D/nexa-solver-integration)](https://github.com/VihanA42425D/nexa-solver-integration/releases)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

> **ACTIVE   Mainnet V6.** Public Nexa Solver discovery and execution integration for Base, BNB Smart Chain and HyperEVM.

This is the machine-readable integration surface for Nexa solvers, indexers and intent frameworks. It publishes the verified onchain Discovery Facade, Registry and Router bindings, signed Feed protocol, ERC-7683 resolver, OIF discovery module, ABI, OpenAPI, events, network IDs and reproducible verification evidence.

## Start here

Canonical discovery URI:

~~~text
https://solver.vsnexa.com/.well-known/nexa-solver.json
~~~

~~~bash
npm install
npm run discover
npm run facade:read
npm run verify:onchain
~~~

The Facade exposes the same URI through discoveryURI(). A solver can resolve:

~~~text
onchain Facade !� .well-known !� discovery !� signed Feed !� ERC-7683 resolver !� Router
~~~

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

- [BaseScan](https://basescan.org/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code) � [Sourcify](https://repo.sourcify.dev/8453/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)
- [BscScan](https://bscscan.com/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code) � [Sourcify](https://repo.sourcify.dev/56/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)
- [HyperEVMScan](https://hyperevmscan.io/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code) � [Sourcify](https://repo.sourcify.dev/999/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)

Compiler identity is 0.8.26+commit.8a97fa7a.Emscripten.clang. Constructor arguments, init/runtime hashes, transactions and blocks are pinned in [verification/facade-deployment.json](verification/facade-deployment.json).

## Networks

| Network | Chain ID | Nexa network ID | Active routes |
| --- | ---: | --- | ---: |
| Base | 8453 | 0x3d5484ad492110227dc184ab6abbeeccd54b127aa00bfc256fd8d8037a4e48c2 | 108 |
| BNB Smart Chain | 56 | 0x5863eb850b94ec5a94a1653871dc308d32f4aec504d789f356419886170a0928 | 126 |
| HyperEVM | 999 | 0x5587698f40d78ef64484dda8f2c78692af870cfe3926dbc61a73881680bd01c8 | 108 |

Each Router has sourceIntakeEnabled() == true, is bound to the published Registry and shares release ID 0xcc0dc051739f2dafaebd2eb5663937850dcc3e7951e38f437e00fcd9fa6c8ff6.

## Public API

The [OpenAPI 3.1 document](openapi/openapi.json) covers:

- GET /.well-known/nexa-solver.json
- GET /api/v6/solver-discovery
- GET /api/v6/solver-feed
- GET /api/v6/solver-feed/events
- GET /api/v6/routes/{routeId}
- POST /api/v6/execution-permits/request-message
- POST /api/v6/execution-permits
- GET /api/v6/execution-permits/{fillId}

Verify every Feed with the published signer and [src/feed-verification.mjs](src/feed-verification.mjs) before selecting a Route.

## Standards and examples

- ERC-7683: executable, resolver-centric eth_call integration. Run npm run resolve:erc7683.
- OIF: discovery/description compatibility only; it deliberately exposes no execution resolver. Run npm run describe:oif.
- Direct Nexa execution: request a signed execution Permit, preview Router.fillDirect, then submit the source transaction.

Examples never require a private key to be committed. Signing stays in the integrating wallet or bot.

## Repository map

| Path | Purpose |
| --- | --- |
| [manifest.json](manifest.json) | final ACTIVE artifact index |
| [nexa-mainnet-v6.json](nexa-mainnet-v6.json) | canonical public integration bundle |
| [abi/solver-facing.json](abi/solver-facing.json) | Facade, Registry, Router and module ABI |
| [networks/network-ids.json](networks/network-ids.json) | chain and Nexa network identities |
| [standards/standard-ids.json](standards/standard-ids.json) | ERC-7683 and OIF compatibility |
| [events/events.json](events/events.json) | onchain Fill event signature and topic |
| [verification](verification) | source, deployment, identity, signature and checksums |
| [examples](examples) | discovery, Permit, Facade and resolution clients |

## Release verification

~~~bash
npm run generate:solver-manifest
npm run generate:abi
npm run generate:openapi
npm run generate:checksums
npm run validate
npm test
npm run worker:check
npm run verify:onchain
~~~

The production Edge remains owned by the private Nexa operations repository. This public package exposes no deploy command or production secret.

## Security boundary

Only solver-facing contracts and public cryptographic identities are included. Custody, authorization, clearing, operator, pricing, risk, capital and business infrastructure are excluded. Report security issues according to [SECURITY.md](SECURITY.md).
