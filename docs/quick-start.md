# Quick Start

This guide is the shortest path from zero to verified Nexa V6 route discovery.

## Option A — SDK

Install the published TypeScript SDK:

```bash
npm install nexa-v6-sdk@1.0.0
```

```js
import { NexaV6Client } from "nexa-v6-sdk";

const client = new NexaV6Client();
const { routes } = await client.getRoutes({ sourceChainId: 8453 });

for (const route of routes) {
  console.log(route.routeId, route.sourceChainId, route.destinationChainId);
}
```

The SDK verifies the signed Feed before returning routes.

## Option B — Repository verification flow

```bash
git clone https://github.com/VihanA42425D/nexa-solver-integration.git
cd nexa-solver-integration
npm install
npm run discover
npm run facade:read
npm run verify:onchain
```

## Machine discovery flow

1. Read `/.well-known/nexa-solver.json`.
2. Verify the onchain Facade / Registry / Router identities.
3. Read and cryptographically verify the Signed Feed.
4. Select an eligible route.
5. Request the exact Permit message.
6. Sign it with the payer wallet.
7. Request the execution Permit.
8. Resolve/build the source-chain transaction.
9. Submit the single source-chain transaction.
10. Track Fill status to `PAID`.

Route Detail is optional. A client can proceed directly from a verified Feed
route to the Permit Request Message.

## Standards integrations

ERC-7683 resolution:

```bash
npm run resolve:erc7683
```

OIF discovery description:

```bash
npm run describe:oif
```

OIF is discovery-description-only and is not an executable Nexa path.

## Supported networks

| Network | Chain ID |
| --- | ---: |
| Base | 8453 |
| BNB Smart Chain | 56 |
| HyperEVM | 999 |

## Next steps

- [Architecture](architecture.md)
- [Integration guide](integration-guide.md)
- [OpenAPI](../openapi/openapi.json)
- [SDK contract](../sdk-spec/nexa-v6-sdk-contract.json)
