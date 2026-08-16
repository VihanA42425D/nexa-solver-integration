# Nexa Solver Integration

Public integration surface for independent solvers consuming Nexa's on-chain
Route discovery, reservation, ERC-7683 resolution, and OIF MandateOutput adapter.

This repository is intentionally narrow. It contains deployed contract
addresses, minimal ABIs, event topics, standard IDs, read-only discovery
examples, OIF calldata helpers, and sample configuration. It does **not**
contain Nexa's private application code, operational policies, clearing,
inventory accounting, Vault management, key management, privileged RPCs, or
business logic.

## Mainnet deployments

The V5 R2 core and V5 R3 solver-completion contracts use deterministic addresses
on all three supported source networks. The standard catalog below is verified
against the live coordinator on each chain.

| Network | Chain ID | Registry | Reservation coordinator | OIF adapter |
| --- | ---: | --- | --- | --- |
| Base | 8453 | `0x9128032cbc5918258a643DD58AB101c63b891CE0` | `0x1739c5122206E50510D42Df96E84CB635afFB12c` | `0x4a98D8898f834AF5bEcA9Edf43b46eD08fDb58c7` |
| BNB Smart Chain | 56 | `0x9128032cbc5918258a643DD58AB101c63b891CE0` | `0x1739c5122206E50510D42Df96E84CB635afFB12c` | `0x4a98D8898f834AF5bEcA9Edf43b46eD08fDb58c7` |
| HyperEVM | 999 | `0x9128032cbc5918258a643DD58AB101c63b891CE0` | `0x1739c5122206E50510D42Df96E84CB635afFB12c` | `0x4a98D8898f834AF5bEcA9Edf43b46eD08fDb58c7` |

The current ERC-7683 resolver is `0x09EB79539E736132B45f2e1B80d28279B6051170`
and the parallel solver-lane factory is `0xF0fA4f8D6C517A18BC00B7777698d805afdE003f`.
See [`addresses/mainnet.json`](./addresses/mainnet.json) for the complete public
surface, including the Router, ResolverHub delegate, and legacy ERC-7683 adapter.

## Install and validate

```bash
npm install
npm run validate
npm test
npm run verify:onchain
```

The examples use `ethers` v6 and Node.js 20 or newer.

## Discover every published Route

Copy the example environment file and provide an RPC endpoint:

```bash
cp .env.example .env
export NEXA_RPC_URL=https://mainnet.base.org
npm run discover
```

The discovery example:

1. verifies the RPC chain ID;
2. reads the active epoch and fully-discoverable count;
3. paginates the complete static Route catalog;
4. paginates every active semantic Route witness;
5. joins terms and proofs to the public Route definition;
6. reports `NO_ACTIVE_EPOCH` when publication has not started and otherwise
   fails closed if the active set is not fully discoverable.

There is no Top-N or Route-count truncation in the example. Contract pages are
bounded to 100 records per call, and pagination continues until the on-chain set
is exhausted.

## Observe reservation demand

```bash
npm run watch:requests
```

This reads `ReservationRequestedV5` logs over the configured lookback. A
production solver should persist a finalized block cursor, handle reorgs, and
use its own rate-limited RPC provider. The example uses adaptive polling:

- idle: 30 seconds;
- recent activity: 3 seconds;
- block backlog: 1 second.

`maxBlockRange` only bounds each RPC log query. The cursor continues until the
complete backlog is consumed; there is no per-session reservation-request cap.

## OIF adapter

[`src/oif-adapter.mjs`](./src/oif-adapter.mjs) exposes four public helpers:

- `connectOifAdapter(network, runner)`
- `readOifMandate(network, provider, orderId)`
- `encodeOifReservation(network, request)`
- `encodeOifFill(network, fill)`

The encoding helpers return calldata only. They do not select Routes, price a
fill, manage funds, sign transactions, or hide any operational policy.

The OIF standard ID is:

```text
keccak256("NEXA_OIF_MANDATE_OUTPUT_ADAPTER_V5")
= 0xddfe778263f830a021ad4c2a7f78b9a4944d08482df2b2c80b675d22274c66fd
```

All four live identifiers (current ERC-7683, legacy ERC-7683, OIF MandateOutput,
and parallel solver lanes) are in
[`standards/standard-ids.json`](./standards/standard-ids.json). A solver can
verify each resolver on-chain through `resolverForStandard(bytes32)`.

## Repository map

```text
manifest.json                  machine-readable entrypoint
addresses/mainnet.json         deployed public addresses
abis/                          allowlisted solver-facing ABIs
events/events.json             canonical signatures and topic0 values
standards/standard-ids.json    standard names and keccak256 IDs
config/example.config.json     read-only example configuration
examples/                      on-chain discovery and event reads
src/oif-adapter.mjs            OIF calldata/read helpers
scripts/validate.mjs           public-surface integrity checks
```

The validator recursively secret-scans the complete repository, excluding only
`.git` metadata and installed `node_modules`. A detected credential or a
symbolic link fails validation before publication.

## Trust and safety

Treat this repository as a convenience index, not as a substitute for on-chain
verification. Confirm the chain ID, contract bytecode, release ID, standard
resolver, active epoch, witness, quote, token addresses, recipient, deadline,
and transaction value before acting.

Public RPC examples are rate-limited. Use a provider appropriate for production
traffic and keep authenticated endpoint URLs outside source control.

The optional on-chain verifier defaults to the official public RPC endpoints
documented by [Base](https://docs.base.org/base-chain/api-reference/rpc-overview),
[BNB Smart Chain](https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/),
and [HyperEVM](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm).
