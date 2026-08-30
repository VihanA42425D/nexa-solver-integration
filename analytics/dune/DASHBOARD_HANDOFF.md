# Nexa V6 — Cross-Chain Protocol Analytics

Native dashboard and visualization mutation is not exposed by the documented
Dune API. Use the public query IDs recorded in `dune-manifest.json` to assemble
the dashboard in Dune.

## Header text

Nexa V6 onchain analytics

Registry and Router events describe onchain identity and state. Signed Feed
data supplies live route terms. Execution Permits supply final execution
authority. Dune is non-authoritative.

## Coverage

- Base — BACKFILLING
- HyperEVM — BACKFILLING
- BNB Smart Chain — BACKFILLING

## Widget order

1. Protocol Overview — summary table and counters by chain
2. Current Routes — route table grouped/filterable by chain and status
3. Current Assets — registered asset count/table by chain
4. Route Status History — time series and activity table
5. Source Fills — count/time series and raw onchain event table
6. Router Source Intake — current state table
7. Standard Modules — current module table
8. Recent Protocol Activity — chronological event table

Do not publish a final dashboard while a required network remains BACKFILLING.
Do not add USD volume, TVL, inferred liquidity, live route terms, or execution
authority claims. Query IDs are recorded in the manifest.
