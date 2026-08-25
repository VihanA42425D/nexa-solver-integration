# Nexa V6 Dune analytics

This package defines the public, passive Dune projection of canonical Nexa V6
onchain events. One normalized query feeds one hourly public materialized view,
and every derived query reads only that view. Decoded datasets remain outside
the active projection until their historical backfill passes the activation
gate.

Dune is an analytics and discovery surface. Onchain Registry/Router state,
signed Feed terms, and Execution Permits retain their respective authority.
No Feed, Permit API, Nexa database, private state, or Nexa-side RPC is ingested.

## Coverage

| Network | Dune analytics coverage |
| --- | --- |
| Base | BACKFILLING |
| HyperEVM | BACKFILLING |
| BNB Smart Chain | BACKFILLING |

`BACKFILLING` describes Dune coverage only; it does not describe protocol or
network availability. A network is excluded from active analytics until all
canonical `nexa_v6` decoded datasets pass the historical activation gate.

## Synchronization

The script consumes `DUNE_API_KEY` only from the process environment and sends
it only in the `X-Dune-Api-Key` header.

```bash
node scripts/sync-dune-v6.mjs --audit
node scripts/sync-dune-v6.mjs --apply
node scripts/sync-dune-v6.mjs --activate-bnb
```

`--audit` is read-only. `--apply` creates or updates only changed canonical
resources. `--activate-bnb` fails closed until the complete BNB decoded event
set exists, its history meets the committed baselines, and collision boundaries
validate. Contract identities, events, chain IDs, and start blocks are read from
the existing canonical indexing artifacts; this directory does not maintain a
second copy.

Resource IDs and public URLs are recorded in
[`dune-manifest.json`](./dune-manifest.json). Exact Dune dataset bindings are in
[`source-bindings.json`](./source-bindings.json).
