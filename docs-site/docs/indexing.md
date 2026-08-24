---
title: Passive Graph and Substreams indexing
description: External, passive, non-authoritative Nexa V6 indexing packages for The Graph and Substreams across supported networks.
---

# Passive indexing

The indexing package is an external projection of public Nexa V6 events. It is
designed for discovery, analytics, and backfill - not for route authorization or
execution decisions.

--8<-- "generated/indexing.md"

## The Graph

The Base and BNB Smart Chain subgraphs share one schema and mapping source.
Canonical mapping fixtures execute the real handlers and assert entity fields
and provenance. Use the published Studio query URLs in the generated table for
development queries.

HyperEVM is not represented as a Graph subgraph because its target is not
supported by this package. Use the standalone Substreams package instead.

## Substreams

Standalone Substreams manifests exist for Base, BNB Smart Chain, and HyperEVM.
Their published package references and validation status come from the
canonical indexing manifest. Local validation includes Rust formatting, tests,
WebAssembly build, custom package invariants, and official `substreams pack`
parsing.

No registry publication is required to consume the source package, and build
outputs (`.spkg`) are not committed.

## Event coverage

The shared projection covers public registration, status, configuration, and
source-fill events, including:

- `NetworkRegisteredV6`
- `AssetRegisteredV6`
- `RouteRegisteredV6`
- `RouteStatusChangedV6`
- `SourceIntakeConfigured`
- `SourceFillV6`
- `StandardModuleConfiguredV6`

All entity provenance originates from the canonical event log coordinates:
chain, block, transaction, log index, emitting address, and event identity.

## Non-authoritative use

Indexes may lag, reorganize, or be unavailable. Before execution, reconcile any
index candidate with the canonical signed Feed, issued Execution Permit, and
on-chain Registry/Router state. Never use a subgraph or Substreams response as a
permit substitute.

## Reproduce validation

```bash
npm ci
npm run indexing:generate
npm run indexing:validate
npm run indexing:graph:codegen
npm run indexing:graph:build
npm run indexing:graph:test
npm run indexing:substreams:fmt
npm run indexing:substreams:test
npm run indexing:substreams:build
npm run indexing:substreams:package
```

See the [indexing package source](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/indexing)
and [canonical fixtures](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/indexing/fixtures/nexa-v6-events.json).
