# nexa-v6-sdk

Canonical Node.js/TypeScript implementation of the frozen Nexa V6 SDK contract.

```js
import { NexaV6Client } from "nexa-v6-sdk";

const client = new NexaV6Client();
const { routes } = await client.getRoutes({ sourceChainId: 8453 });
```

The package verifies every Feed before returning routes. Wallet signing remains outside the SDK: call `requestPermitMessage`, sign the exact UTF-8 message with the payer wallet, then pass the signature to `requestPermit`.

