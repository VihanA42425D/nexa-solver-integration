# External indexing deployment handoff

The repository package is PACKAGE_READY; external deployment is deliberately
UNPUBLISHED. Complete these actions only after code audit.

## The Graph

1. Choose the audited commit and reproduce npm run indexing:check.
2. Create one external Subgraph project for each network: Base (base), BNB Smart
   Chain (bsc), and HyperEVM (hyper-evm).
3. Authenticate locally with operator-owned Graph credentials; never add deploy
   keys to this repository.
4. Deploy the matching generated manifest from indexing/graph without editing
   addresses or start blocks.
5. Verify the first indexed block and sampled entities against
   indexing/nexa-v6-indexing.json.
6. Only after all deployments exist, record deployment IDs and GraphQL URLs in a
   separately audited public-artifact update.

## Substreams

1. Install the audited Substreams CLI and reproduce the Rust tests, WASM build,
   and npm run indexing:substreams:package.
2. Pack each generated network manifest locally. All three must reference the
   same WASM and protobuf sources.
3. Authenticate to the selected external Substreams Registry with
   operator-owned credentials and publish the reviewed packages.
4. Run bounded external verification from each exact initial block. Do not add a
   permanent sink, SQL database, or Nexa runtime consumer in this repository.
5. Only after publication exists, record registry package IDs in a separately
   audited public-artifact update.

## Operational boundary

Do not connect either indexer to Nexa production DB, API internals, signing,
Permit, settlement, pricing, treasury, or worker infrastructure. Do not ingest
the Signed Feed. Do not create Graph/Substreams billing, API keys, SQL sinks, or
permanent consumers as part of this repository task.

The execution model remains exactly one Bot source transaction plus one Nexa
destination transaction (two total). Indexing adds no transaction or gas.
