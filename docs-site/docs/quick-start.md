---
title: Quick start - integrate a Nexa V6 solver
description: Minimal safe workflow to discover Nexa Mainnet V6 routes, verify the signed Feed, request a permit, preview, and execute.
---

# Quick start

This path gets a solver from public discovery to an executable permit without
assuming that a discovered route is authorized to execute.

## Prerequisites

- Node.js 20 or later for the reference examples.
- A source-chain RPC endpoint controlled by you for optional `eth_call` previews
  and transaction submission.
- A source wallet or native-account signer.
- The public integration repository.

```bash
git clone https://github.com/VihanA42425D/nexa-solver-integration.git
cd nexa-solver-integration
npm ci
```

## 1. Discover the active release

```bash
curl --fail --silent --show-error \
  https://solver.vsnexa.com/.well-known/nexa-solver.json
```

Require the expected schema, `deploymentVersion: 6`, `deploymentStatus:
ACTIVE`, and a non-empty Feed signer. Follow the endpoints in the response;
do not substitute addresses from this prose.

## 2. Read and verify routes

The repository example fetches the signed Feed and verifies it before exposing
discoverable, open, permit-enabled routes:

```bash
npm run discover
```

To filter by source chain:

```bash
NEXA_SOURCE_CHAIN_ID=8453 npm run discover
```

The TypeScript SDK follows the same verification rule:

```js
import { NexaV6Client } from "nexa-v6-sdk";

const client = new NexaV6Client();
const { routes } = await client.getRoutes({ sourceChainId: 8453 });
```

Before selection, check route and quote identifiers, raw input bounds,
`executionStatus`, `permitAvailable`, Feed validity, and destination terms.

## 3. Create the permit-request signature

Set the route-specific values and run the reference command once without a
signature:

```bash
NEXA_QUOTE_ID=0xYOUR_QUOTE_ID \
NEXA_REQUESTED_AMOUNT_IN_RAW=1000000 \
NEXA_PAYER=0xYOUR_SOURCE_ADDRESS \
NEXA_RECIPIENT=0xYOUR_DESTINATION_ADDRESS \
NEXA_IDEMPOTENCY_KEY=solver-order-0001 \
npm run permit:request
```

Sign the exact returned UTF-8 message with the source payer. Do not reconstruct
or reformat the message in the wallet layer. Then rerun with the signature:

```bash
NEXA_REQUEST_SIGNATURE=0xYOUR_SIGNATURE npm run permit:request
```

The idempotency key and all other request fields must be identical between the
message request and permit request.

## 4. Preview and submit

Validate the issued permit envelope, including its release, route, quote,
amount, validity window, execution target, and `totalTransactionCount`. Preview
with the Router's view method or supported ERC-7683 resolver through your RPC.
Both are off-chain calls.

Submit exactly the transaction described by the permit to the source Router.
For native assets, use the permit's raw input amount as `value`; otherwise use
zero unless the canonical transaction builder says otherwise.

!!! warning "Never send an extra transaction"
    The success model is exactly one Bot source transaction plus one Nexa
    destination transaction. Preview and resolution are `eth_call`; approvals
    or other token preparation are outside the Nexa execution invariant and
    must not be confused with the fill itself.

## 5. Track the fill

Use the permit-status endpoint with the issued `fillId`. A successful `PAID`
state has both source and payout transaction hashes and
`totalTransactionCount: 2`.

Continue with the [full solver lifecycle](solver-integration.md), review the
[API reference](api.md), and apply the
[verification checklist](verification-security.md) before production use.
