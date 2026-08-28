# Nexa V6 Dune decoding diagnostic

Status: `DUNE_DECODER_BACKFILL_FAILURE`

Diagnostic time: `2026-08-28T07:56:36.201Z`

Successful unsaved Dune execution: `01M13NX4JGKJEZTHB7EJBHB802`
(`query_id = 0`, 27 rows, completed at `2026-08-28T07:56:30.997466Z`).

## Scope and method

The diagnostic derived chain IDs, contract addresses, deployment boundaries,
event signatures, topics, and decoded bindings from the committed Nexa V6
indexing configuration, deployment evidence, event catalog, and canonical ABIs.
All 27 event topics matched `keccak256(event signature)`.

The Dune catalog identified these canonical raw tables:

- Base: `base.logs`
- BNB Smart Chain: `bnb.logs`
- HyperEVM: `hyperevm.logs`

Their `contract_address`, `topic0`, topics, data, and transaction hashes are
`varbinary`. All 27 decoded event tables are catalog-visible under the
`nexa_v6` project and are bound by Dune's contract-address catalog search to
the canonical contracts. Decoded `contract_address`, `evt_tx_hash`, indexed
bytes32 fields, and indexed address fields are also `varbinary`.

One bounded UNION-based unsaved query read the three raw tables, all 27 decoded
tables, and the existing canonical materialized view. Raw logs were filtered by
canonical contract address, canonical topic0, and the exact per-contract start
block. They were used for diagnosis only.

## Deployment boundaries

| Network | Registry | Router | StandardModuleRegistry |
| --- | ---: | ---: | ---: |
| Base | 50143186 | 50143190 | 50143193 |
| BNB Smart Chain | 116699981 | 116699987 | 116699998 |
| HyperEVM | 43533441 | 43533563 | 43533624 |

## Raw versus decoded matrix

`Decoded` is shown as `total / address-filtered / canonical-filtered`.

| Network | Event | Raw table | Raw | Raw min-max block | Decoded table | Decoded | MV | Classification |
| --- | --- | --- | ---: | --- | --- | --- | ---: | --- |
| Base | NetworkRegisteredV6 | `base.logs` | 3 | 50143988-50144188 | `nexa_v6_base.nexamainnetregistryv6_evt_networkregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| Base | NetworkStatusChangedV6 | `base.logs` | 6 | 50143988-50144191 | `nexa_v6_base.nexamainnetregistryv6_evt_networkstatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| Base | AssetRegisteredV6 | `base.logs` | 19 | 50144193-50145750 | `nexa_v6_base.nexamainnetregistryv6_evt_assetregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| Base | AssetStatusChangedV6 | `base.logs` | 39 | 50144193-50528183 | `nexa_v6_base.nexamainnetregistryv6_evt_assetstatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| Base | RouteRegisteredV6 | `base.logs` | 108 | 50145765-50146324 | `nexa_v6_base.nexamainnetregistryv6_evt_routeregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| Base | RouteStatusChangedV6 | `base.logs` | 222 | 50145765-50528203 | `nexa_v6_base.nexamainnetregistryv6_evt_routestatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| Base | SourceIntakeConfigured | `base.logs` | 1 | 50234979-50234979 | `nexa_v6_base.nexamainnetrouterv6_evt_sourceintakeconfigured` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| Base | SourceFillV6 | `base.logs` | 9 | 50305554-50325239 | `nexa_v6_base.nexamainnetrouterv6_evt_sourcefillv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| Base | StandardModuleConfiguredV6 | `base.logs` | 2 | 50146327-50146329 | `nexa_v6_base.nexastandardmoduleregistryv6_evt_standardmoduleconfiguredv6` | 2 / 2 / 2 | 2 | MATCH |
| BNB Smart Chain | NetworkRegisteredV6 | `bnb.logs` | 3 | 116714362-116714404 | `nexa_v6_bnb.nexamainnetregistryv6_evt_networkregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| BNB Smart Chain | NetworkStatusChangedV6 | `bnb.logs` | 6 | 116714362-116714415 | `nexa_v6_bnb.nexamainnetregistryv6_evt_networkstatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| BNB Smart Chain | AssetRegisteredV6 | `bnb.logs` | 19 | 116714425-116714806 | `nexa_v6_bnb.nexamainnetregistryv6_evt_assetregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| BNB Smart Chain | AssetStatusChangedV6 | `bnb.logs` | 39 | 116714425-118410323 | `nexa_v6_bnb.nexamainnetregistryv6_evt_assetstatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| BNB Smart Chain | RouteRegisteredV6 | `bnb.logs` | 126 | 116714900-116717524 | `nexa_v6_bnb.nexamainnetregistryv6_evt_routeregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| BNB Smart Chain | RouteStatusChangedV6 | `bnb.logs` | 276 | 116714900-118410691 | `nexa_v6_bnb.nexamainnetregistryv6_evt_routestatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| BNB Smart Chain | SourceIntakeConfigured | `bnb.logs` | 1 | 117107770-117107770 | `nexa_v6_bnb.nexamainnetrouterv6_evt_sourceintakeconfigured` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| BNB Smart Chain | SourceFillV6 | `bnb.logs` | 0 | - | `nexa_v6_bnb.nexamainnetrouterv6_evt_sourcefillv6` | 0 / 0 / 0 | 0 | RAW_AND_DECODED_MISSING |
| BNB Smart Chain | StandardModuleConfiguredV6 | `bnb.logs` | 2 | 116717545-116717555 | `nexa_v6_bnb.nexastandardmoduleregistryv6_evt_standardmoduleconfiguredv6` | 2 / 2 / 2 | 0 | MATCH |
| HyperEVM | NetworkRegisteredV6 | `hyperevm.logs` | 3 | 43541592-43541614 | `nexa_v6_hyperevm.nexamainnetregistryv6_evt_networkregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| HyperEVM | NetworkStatusChangedV6 | `hyperevm.logs` | 6 | 43541592-43541621 | `nexa_v6_hyperevm.nexamainnetregistryv6_evt_networkstatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| HyperEVM | AssetRegisteredV6 | `hyperevm.logs` | 19 | 43541626-43541829 | `nexa_v6_hyperevm.nexamainnetregistryv6_evt_assetregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| HyperEVM | AssetStatusChangedV6 | `hyperevm.logs` | 39 | 43541626-44316047 | `nexa_v6_hyperevm.nexamainnetregistryv6_evt_assetstatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| HyperEVM | RouteRegisteredV6 | `hyperevm.logs` | 108 | 43541886-43543155 | `nexa_v6_hyperevm.nexamainnetregistryv6_evt_routeregisteredv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| HyperEVM | RouteStatusChangedV6 | `hyperevm.logs` | 222 | 43541886-44316239 | `nexa_v6_hyperevm.nexamainnetregistryv6_evt_routestatuschangedv6` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| HyperEVM | SourceIntakeConfigured | `hyperevm.logs` | 1 | 43719939-43719939 | `nexa_v6_hyperevm.nexamainnetrouterv6_evt_sourceintakeconfigured` | 0 / 0 / 0 | 0 | RAW_PRESENT_DECODED_MISSING |
| HyperEVM | SourceFillV6 | `hyperevm.logs` | 0 | - | `nexa_v6_hyperevm.nexamainnetrouterv6_evt_sourcefillv6` | 0 / 0 / 0 | 0 | RAW_AND_DECODED_MISSING |
| HyperEVM | StandardModuleConfiguredV6 | `hyperevm.logs` | 2 | 43543166-43543172 | `nexa_v6_hyperevm.nexastandardmoduleregistryv6_evt_standardmoduleconfiguredv6` | 2 / 2 / 2 | 2 | MATCH |

All decoded pre-start counts and noncanonical-address counts are zero. The
three populated StandardModule tables preserve the canonical address and exact
start boundary, demonstrating that Dune's `varbinary` address comparison and
the Nexa per-contract filter representation are valid.

## Layer C result

Public query `8437473` remains the sole decoded-table reader. It contains the
expected 18 Base and HyperEVM decoded branches and intentionally contains no
BNB branches while BNB is gated. The existing materialized view
`dune.nexav6.result_nexa_v6_events_canonical` remains bound to query `8437473`.
Its Base and HyperEVM StandardModule counts match the direct decoded counts.
Registry and Router rows cannot reach the query or view because the decoded
source tables themselves contain zero rows.

No Nexa SQL, address-type, topic, start-block, canonical-query, or MV defect was
found. BNB activation remains blocked. No Dune resource was mutated.

## Support message

> Project `nexa_v6` has 27 accepted/catalog-visible decoded event tables for
> the canonical Nexa V6 contracts on Base, BNB Smart Chain, and HyperEVM.
> Unsaved diagnostic execution `01M13NX4JGKJEZTHB7EJBHB802` proves that the
> canonical raw log tables contain the expected Registry and Router history,
> while the corresponding decoded event tables return zero total rows. For
> example, raw counts are Base 3/19/108/222 and BNB 3/19/126/276 for
> NetworkRegisteredV6/AssetRegisteredV6/RouteRegisteredV6/RouteStatusChangedV6,
> but every corresponding decoded total is zero. HyperEVM shows the same issue.
> StandardModuleConfiguredV6 is correctly backfilled 2/2 on every chain, which
> confirms the project namespace, contract binding, ABI types, and address
> representation work. Please backfill the accepted NexaMainnetRegistryV6 and
> NexaMainnetRouterV6 event tables from the deployment boundaries documented
> above. No raw-log production fallback is requested.
