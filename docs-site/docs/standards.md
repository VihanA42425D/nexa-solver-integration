---
title: ERC-7683 and OIF compatibility
description: Nexa Mainnet V6 standards discovery, executable ERC-7683 resolver behavior, OIF description-only behavior, and deterministic vectors.
---

# Standards compatibility

The canonical standards manifest is available at
[`/.well-known/nexa-standards.json`](https://solver.vsnexa.com/.well-known/nexa-standards.json).
The build-generated summary below comes from the same repository artifact.

--8<-- "generated/standards.md"

## ERC-7683

Nexa exposes an executable compatibility resolver. Given the canonical ABI
encoding of an issued Execution Permit and its signature, a solver can call the
resolver off-chain to obtain the single Router execution step.

```text
issued permit payload
  -> resolver eth_call
  -> Router target + value + fillDirect calldata
  -> one source transaction
```

Resolution itself has `transactionCount: 0`. It does not poll, mutate state, or
submit a transaction. The returned call must match the issued permit and
canonical Router binding before submission.

The repository includes deterministic successful and failure vectors for
resolution, selector identities, ERC-165 interfaces, payload encoding, and
expected calldata.

## OIF

OIF is deliberately `DISCOVERY_DESCRIPTION_ONLY`. Its module can report the
compatibility level and deterministically describe a mandate via an off-chain
call. It cannot resolve an executable transaction.

!!! warning "Description is not execution support"
    `describeMandate` being available does not make OIF executable. The
    execution-resolution path is unsupported and its failure behavior is part
    of the deterministic vectors.

## Payload and authority

Both modules describe the public standards projection around Nexa's issued
permit format. Neither module creates authority. The Execution Permit remains
the fill-specific authorization, the Router remains the source execution
target, and on-chain Registry/Router state remains authoritative.

## Verify compatibility locally

```bash
npm ci
npm test
npm run sdk:conformance
npm run package:verify
```

Inspect the canonical material directly:

- [Standards manifest](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/standards/nexa-standards.json)
- [Standard IDs](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/standards/standard-ids.json)
- [Deterministic vectors](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/standards/test-vectors.json)
- [ERC-7683 example](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/examples/resolve-erc7683.mjs)
- [OIF example](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/examples/describe-oif-mandate.mjs)

No standards discovery or resolution step changes the exact one-Bot-source plus
one-Nexa-destination execution invariant.
