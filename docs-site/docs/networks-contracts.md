---
title: Nexa V6 networks and contracts
description: Canonically generated Mainnet V6 chain IDs, network IDs, solver-facing contract addresses, runtime code hashes, and verification links.
---

# Networks and contracts

The tables below are generated during the documentation build from
`networks/network-ids.json` and `nexa-mainnet-v6.json`. They are a readable
projection, not a separate deployment registry.

--8<-- "generated/networks-contracts.md"

## How to verify a deployment

For every chain you intend to use:

1. Fetch the canonical passive on-chain fingerprint from the discovery
   manifest.
2. Require the expected chain ID, release ID, addresses, runtime code hashes,
   selectors, and same-address evidence.
3. Read the Discovery Facade and compare its Registry, Router, release,
   deployment version, chain ID, live state, and discovery URI.
4. Compare deployed runtime bytecode hashes with the canonical fingerprint.
5. Check the linked explorer and Sourcify evidence where supported.

These are read-only checks. They submit no transaction.

## Contract roles

### Discovery Facade

The solver-facing Facade exposes the release and deployment identity, canonical
discovery URI, Registry and Router bindings, route enumeration, and live system
state. It is the smallest on-chain discovery entry point.

### Registry

The Registry is authoritative for registered networks, assets, routes,
execution generations, and executable route state. External index data must be
reconciled against it before execution.

### Router

The Router verifies and consumes the issued permit through `fillDirect` and
emits the source-fill event. A successful integration calls it once on the
source chain.

### Standards modules

The ERC-7683 module resolves an issued Nexa payload to the Router call through
off-chain `eth_call`. The OIF module exposes discovery and deterministic mandate
description only; it is not an alternate execution route.

## Canonical sources

- [Passive on-chain fingerprint](https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json)
- [Solver discovery manifest](https://solver.vsnexa.com/.well-known/nexa-solver.json)
- [Solver-facing ABI](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/abi/solver-facing.json)
- [Verification evidence](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/verification)
