# Nexa V6 passive indexing package

This directory is the Nexa-owned, repository-side package for passive projections
of public V6 on-chain events. It does not deploy, publish, poll, price, authorize,
execute, or settle anything.

Authority remains the on-chain Registry/Router plus the Signed Feed and Execution
Permit. The Graph and Substreams outputs are non-authoritative discovery aids.

## Canonical reuse architecture

nexa-v6-indexing.json is the only generated network/event configuration. It is
built offline from the public V6 bundle and committed deployment evidence. The
three Graph manifests and three Substreams manifests are thin generated views of
that same object. Graph uses one schema and mapping; Substreams uses one Rust
decoder and protobuf model. Its downstream stores consume the mapped event
stream, so raw logs are decoded exactly once.

Normal generation performs no RPC, HTTP, database, or environment lookup and
fails if a required exact deployment block is absent. The Facade block is
retained as evidence but is not substituted for Registry, Router, or Standard
Module Registry start blocks.

## Deterministic commands

From the repository root:

    npm run indexing:generate
    npm run indexing:validate
    npm run indexing:graph:codegen
    npm run indexing:graph:build
    npm run indexing:graph:test
    npm run indexing:substreams:codegen
    npm run indexing:substreams:test
    rustup target add wasm32-unknown-unknown
    npm run indexing:substreams:build
    npm run indexing:substreams:package
    npm run indexing:substreams:pack
    npm run indexing:substreams:package:official
    npm run indexing:check

indexing:substreams:codegen runs Cargo's vendored-protoc build step. Build
outputs (graph/build, graph/generated, and substreams/target) are intentionally
untracked. No external deployment identifiers or endpoints are claimed.
The optional indexing:substreams:pack command requires the official Substreams
CLI and creates three local, ignored SPKG files; it never publishes them.
indexing:substreams:package:official is the explicit audit alias for that same
three-manifest parse/package operation. CI pins Substreams CLI v1.18.5 and
verifies the official Linux archive checksum before running it. The Graph test
command pins Matchstick 0.6.0 and executes src/mapping.ts against the canonical
fixture JSON; the JavaScript ABI-decoding checks remain a separate first stage.

## Networks

| Graph identifier | Chain ID | Registry start | Router start | Module Registry start |
| --- | ---: | ---: | ---: | ---: |
| base | 8453 | 50143186 | 50143190 | 50143193 |
| bsc | 56 | 116699981 | 116699987 | 116699998 |
| hyper-evm | 999 | 43533441 | 43533563 | 43533624 |

The machine-readable package state and paths are in indexing-manifest.json.
External publication remains UNPUBLISHED.
