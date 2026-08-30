# Nexa V6 external indexing package

This package projects public V6 on-chain events for discovery and analytics.

Authority remains the on-chain Registry/Router plus the Signed Feed and Execution
Permit. The Graph and Substreams outputs are non-authoritative discovery aids.

## Canonical reuse architecture

nexa-v6-indexing.json is the only generated network/event configuration. It is
built offline from the public V6 bundle and committed deployment evidence. The
two supported Graph manifests and three Substreams manifests are thin generated
views of that same object. Graph uses one schema and mapping; Substreams uses one
Rust decoder and protobuf model. HyperEVM remains in the canonical config and
Substreams package, but its Graph Studio state is `UNSUPPORTED` and its indexing
mode is `STANDALONE_SUBSTREAMS`. Its downstream stores consume the mapped event
stream, so raw logs are decoded exactly once.


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
untracked. Public external IDs and endpoints, once validated, live only in
external-deployments.json; indexing-manifest.json is generated from that
canonical evidence and must not be hand-maintained.
The optional indexing:substreams:pack command requires the official Substreams
CLI and creates three local, ignored SPKG files; it never publishes them.
indexing:substreams:package:official is the explicit audit alias for that same
three-manifest parse/package operation. CI pins Substreams CLI v1.18.5 and
verifies the official Linux archive checksum before running it. The Graph test
command pins Matchstick 0.6.0 and executes src/mapping.ts against the canonical
fixture JSON; the JavaScript ABI-decoding checks remain a separate first stage.

## Networks

| Identifier | Chain ID | Graph Studio | Indexing mode | Registry start | Router start | Module Registry start |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| base | 8453 | Supported | Subgraph Studio + standalone Substreams | 50143186 | 50143190 | 50143193 |
| bsc | 56 | Supported | Subgraph Studio + standalone Substreams | 116699981 | 116699987 | 116699998 |
| hyper-evm | 999 | Unsupported | Standalone Substreams | 43533441 | 43533563 | 43533624 |

The machine-readable package state and paths are in indexing-manifest.json.
Non-secret external deployment evidence is canonical in
external-deployments.json. Base and BSC are deployed to Graph Studio, and the Base, BSC, and HyperEVM
Substreams packages are published and live-validated. Exact non-secret IDs, URLs,
package hashes, validation ranges, and statuses are recorded in
`external-deployments.json`.
