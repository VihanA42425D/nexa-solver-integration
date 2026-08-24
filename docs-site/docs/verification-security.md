---
title: Verification and security
description: Trust boundaries, cryptographic checks, deployment verification, transaction safety, and operational checklist for Nexa V6 solver clients.
---

# Verification and security

Treat every public response as untrusted input until it passes the checks for
its authority layer. HTTPS protects transport; it does not replace Feed,
deployment, permit, or on-chain verification.

## Authority matrix

| Question | Authoritative source |
| --- | --- |
| Which V6 deployment and contracts are live? | On-chain Discovery Facade, Registry, Router, and canonical fingerprint |
| Which route terms are currently published? | Cryptographically verified signed Feed |
| Is this exact fill authorized? | Issued Execution Permit |
| Has source execution and payout completed? | Canonical on-chain events and transaction receipts |
| Can an index or this site authorize execution? | No |

## Discovery and deployment checks

- Start at the canonical well-known URI over HTTPS.
- Pin the expected schema, deployment version, active status, and release ID.
- Compare the Facade, Registry, Router, and standards module addresses and
  runtime code hashes with the passive fingerprint.
- Read the Facade system state on each intended chain using your own RPC.
- Require live state and the canonical discovery URI.
- Review explorer and Sourcify verification evidence, but verify runtime code
  directly rather than trusting a label alone.

## Feed checks

- Canonicalize recursively sorted JSON object keys exactly as specified.
- Hash the domain-separated UTF-8 preimage with Keccak-256.
- Recover the raw secp256k1 signer without an EIP-191 prefix.
- Require computed hash, declared hash, recovered signer, declared signer, and
  expected discovery signer to agree.
- Reject expired, future-invalid, wrong-release, or structurally invalid data.
- Keep route and quote fields together; never combine fields from two versions.

Use the maintained SDKs or repository verifier instead of recreating
canonicalization ad hoc.

## Permit and transaction checks

- Normalize the request once, display the exact message, and have the payer sign
  those exact UTF-8 bytes.
- Bind retries to one idempotency key and one unchanged intent.
- Validate permit digest, signature, release, fill, route, quote, identities,
  amount, execution generation, chains, assets, validity, and execution target.
- Preview with an off-chain view call through your RPC.
- Reject any unexpected target, selector, calldata, value, or transaction
  count.
- Submit only the single source Router transaction encoded by the permit.

Never expose private keys to the Feed service, documentation site, external
indexer, CI build, or generated client.

## Exact execution model

Successful execution is exactly:

```text
Bot:  1 source-chain Router transaction
Nexa: 1 destination-chain payout transaction
Total: 2
```

Discovery, Feed, status, SSE, index queries, `eth_call` preview, ERC-7683
resolution, and OIF description add zero transactions.

## Public verification evidence

- [Passive on-chain fingerprint](https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json)
- [Facade deployment evidence](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/verification/facade-deployment.json)
- [Deterministic on-chain identity](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/verification/onchain-identity.json)
- [Exact-match Sourcify and explorer references](networks-contracts.md#how-to-verify-a-deployment)
- [Standard JSON compiler input](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/verification/NexaSolverDiscoveryV6.standard-input.json)
- [Published checksums](https://github.com/VihanA42425D/nexa-solver-integration/blob/main/verification/checksums.sha256)

The expected Feed signer is published by canonical discovery and must be
checked cryptographically on every Feed. Do not copy an identity from prose.

## Reproducible checks

```bash
npm ci
npm run validate
npm test
npm run sdk:conformance
npm run package:verify
npm run onboard:verify
```

Report public integration issues through the repository's
[security policy](https://github.com/VihanA42425D/nexa-solver-integration/security/policy)
or [issue tracker](https://github.com/VihanA42425D/nexa-solver-integration/issues).
Use the [documentation contact form](contact.md) to send a private ticket.
