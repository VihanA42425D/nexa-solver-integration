# External indexing deployment handoff

The repository package is `PACKAGE_READY`; the audited external Graph Studio
and Substreams Registry deployments are recorded below.

## The Graph

1. Choose the audited commit and reproduce npm run indexing:check.
2. Create exactly two external Subgraph Studio projects: Base (base) and BNB
   Smart Chain (bsc). HyperEVM is unsupported by Studio and must not be deployed
   as a Subgraph.
3. Authenticate locally with operator-owned Graph credentials; never add deploy
   keys to this repository.
4. Deploy the matching generated manifest from indexing/graph without editing
   addresses or start blocks.
5. Verify the first indexed block and sampled entities against
   indexing/nexa-v6-indexing.json.
6. Only after both deployments validate without indexing errors, record public
   deployment IDs and development GraphQL URLs in external-deployments.json.
   Regenerate indexing-manifest.json; never duplicate or hand-edit its projection.

## Substreams

1. Install the audited Substreams CLI and reproduce the Rust tests, WASM build,
   and npm run indexing:substreams:package.
2. Pack each generated network manifest locally. All three must reference the
   same WASM and protobuf sources.
3. Authenticate to the selected external Substreams Registry with
   operator-owned credentials and publish the reviewed packages.
4. Run bounded external verification from each exact initial block. Use the
   managed Substreams endpoint and its own RPC infrastructure; do not self-host
   an endpoint or chain RPC and do not add a permanent sink, SQL database, or
   Nexa runtime consumer.
5. Only after publication and live validation succeed, record public package IDs
   and Registry URLs in external-deployments.json, then regenerate the descriptor.

## Published deployment record

- Graph Studio Base `nexa-v-6-base` version `1.0.0`: `QmbHjiBK6Mqc3KNQKvefWnadM8pbx8DREMa2Xtx2pwPVip`
- Graph Studio BSC `nexa-v-6-bsc` version `1.0.0`: `QmWt9pn3icSN1yjTreQufh7TdZ3AojArTf6vwaNxHXSub5`
- Substreams Base: <https://substreams.dev/packages/nexa-v6-indexing-base/v1.0.0>
- Substreams BSC: <https://substreams.dev/packages/nexa-v6-indexing-bsc/v1.0.0>
- Substreams HyperEVM: <https://substreams.dev/packages/nexa-v6-indexing-hyper-evm/v1.0.0>

Graph live queries passed with no indexing errors. Bounded live Substreams
validation passed from each canonical initial block. HyperEVM remains intentionally
Substreams-only. Exact IDs, URLs, package SHA-256 values, ranges, observed events,
and validation status are canonical in `external-deployments.json`.

## Operational boundary

Use only managed external Graph/Substreams infrastructure and its indexer-owned
RPC. Do not self-host Graph Node, Firehose, Substreams services, or chain RPC.
Do not connect either indexer to Nexa production DB, API internals, signing,
Permit, settlement, pricing, treasury, or worker infrastructure. Do not ingest
the Signed Feed. Do not create Graph/Substreams billing, API keys, SQL sinks, or
permanent consumers as part of this repository task.

The execution model remains exactly one Bot source transaction plus one Nexa
destination transaction (two total). Indexing adds no transaction or gas.
