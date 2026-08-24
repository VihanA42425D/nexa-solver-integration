---
title: Solver integration lifecycle
description: End-to-end Nexa V6 solver lifecycle from canonical discovery and signed Feed verification to permit-gated exact 1+1 settlement.
---

# Solver integration lifecycle

The integration is deliberately layered: discovery supplies public identity,
the signed Feed supplies live terms, and an Execution Permit supplies
route-specific authorization. Preserve those boundaries in your client.

## 1. Discover the public surface

Begin only at the canonical well-known URI:

```text
https://solver.vsnexa.com/.well-known/nexa-solver.json
```

Validate schema, deployment version and status, release ID, Feed signer, and
endpoint URLs. The passive on-chain fingerprint and solver-facing Discovery
Facade let scanners independently correlate the public document with deployed
code and state without submitting a transaction.

Discovery is accountless. It is not proof that a route is currently open and
does not authorize execution.

## 2. Consume the signed Feed

Two transports expose the same confirmed active route set:

- HTTP is the recovery and snapshot path.
- SSE is the incremental path and supports reconnect with `Last-Event-ID`.

On every Feed object:

1. Recreate the canonical signed payload bytes.
2. Compute the specified Keccak-256 hash.
3. Recover the signer from the raw secp256k1 signature.
4. Require the recovered, declared, and discovery-expected signer to match.
5. Check `generatedAt`, `validUntil`, release ID, and data version.
6. Apply route filters only after verification succeeds.

Use a fresh HTTP snapshot if an SSE gap cannot be reconciled. Do not merge
unverified partial events into the active set.

## 3. Select a route and quote

Require the route to be discoverable and open, with permit availability and a
valid quote window. Treat all integer execution amounts as base-10 strings and
keep route ID, quote ID, source/destination network and asset IDs, amount
bounds, and execution generation together.

A route-detail read can provide the latest per-route view. It does not replace
Feed verification or permit issuance.

## 4. Request an Execution Permit

Construct the frozen permit request model with:

- quote ID and requested raw amount;
- selected standard;
- payer and recipient identity fields;
- a stable, unique idempotency key.

Use the SDK's local canonicalizer and `requestPermitMessage` operation whenever
possible. Sign the exact UTF-8 message using the payer's required signing
scheme. The request-message HTTP endpoint is a compatibility aid, not a
requirement for canonical construction.

Submit the original normalized fields, the same idempotency key, and the
signature. Validate the returned permit digest, signer, fill ID, state,
execution object, validity interval, and transaction count before proceeding.

## 5. Resolve or preview off-chain

The Router preview and ERC-7683 resolver are view calls made through the
solver's own RPC provider. They create no Nexa HTTP-side RPC work and no
transaction. Resolution must yield the expected Router target and `fillDirect`
calldata for the issued permit.

OIF support is description-only. `describeMandate` may describe a mandate, but
OIF execution resolution is intentionally unsupported and reverts
deterministically.

## 6. Execute and observe settlement

Submit the single source transaction to the permit's Router, with the exact
calldata, value, chain, payer, and validity constraints. After the source fill
is observed and confirmed, Nexa submits the destination payout transaction.

Track state using the returned fill ID. Terminal success is `PAID`; confirm the
source and payout transaction hashes and transaction count.

## The exact 1+1 invariant

```text
1 Bot source transaction
+
1 Nexa destination transaction
=
exactly 2 execution transactions
```

The following do not change that count:

- discovery and Feed HTTP reads;
- SSE subscriptions;
- on-chain view reads;
- Router preview calls;
- ERC-7683 resolver `eth_call`;
- OIF mandate description.

The documentation and external indexing packages submit no transaction.

## Failure handling

- Reject invalid, mismatched, expired, or unexpectedly signed Feed data.
- Refresh discovery when the release identity does not match.
- Refresh the Feed when quote or route validity expires.
- Reuse the idempotency key for retries of the same permit intent; do not reuse
  it for a different intent.
- Never mutate normalized fields after the payer signs the request message.
- Stop if preview target, calldata, chain, amount, or value differs from the
  permit envelope.
- Treat OIF execution attempts as unsupported, not as transient failures.

## Production readiness

Before enabling submission, run the repository conformance suite, pin the
public integration release, exercise deterministic vectors, validate the
on-chain fingerprint on every supported chain, and monitor Feed freshness and
fill status. See [Verification and security](verification-security.md).
