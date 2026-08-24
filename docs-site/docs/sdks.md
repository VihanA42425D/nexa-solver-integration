---
title: Nexa V6 SDKs
description: Supported TypeScript, Python, Rust, Go, JVM, and .NET bindings for the frozen Nexa V6 solver SDK contract.
---

# SDKs

The repository provides six language bindings against one frozen operation and
model contract. Each binding is checked against shared deterministic vectors.

## Supported bindings

| Binding | Source | Package registry | Typical use |
| --- | --- | --- | --- |
| TypeScript / Node.js | [README](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/sdks/typescript) | [npm search](https://www.npmjs.com/search?q=nexa-v6-sdk) | Services, bots, and tooling |
| Python | [README](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/sdks/python) | [PyPI search](https://pypi.org/search/?q=nexa-v6-sdk) | Solvers, research, and operations tooling |
| Rust | [README](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/sdks/rust) | [crates.io search](https://crates.io/search?q=nexa-v6-sdk) | High-throughput and strongly typed services |
| Go | [README](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/sdks/go) | [pkg.go.dev search](https://pkg.go.dev/search?q=github.com%2FVihanA42425D%2Fnexa-solver-integration%2Fsdks%2Fgo) | Network services and bots |
| JVM | [README](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/sdks/jvm) | [Maven Central search](https://central.sonatype.com/search?q=io.github.vihana42425d%20nexa-v6-sdk) | Java/Kotlin systems |
| .NET | [README](https://github.com/VihanA42425D/nexa-solver-integration/tree/main/sdks/dotnet) | [NuGet search](https://www.nuget.org/packages?q=VihanA.Nexa.V6.Sdk) | C# services and tooling |

Registry links are searches, not publication claims. The repository source and SDK contract remain canonical when no published package is listed.

## Frozen operation contract

The following table is generated from
`sdk-spec/nexa-v6-sdk-contract.json`:

--8<-- "generated/sdk-operations.md"

## TypeScript example

```js
import { NexaV6Client } from "nexa-v6-sdk";

const client = new NexaV6Client();
const { routes } = await client.getRoutes({ sourceChainId: 8453 });

const request = {
  quoteId: routes[0].quoteId,
  requestedAmountInRaw: routes[0].minimumFillInRaw,
  standard: "DIRECT",
  payer: "0xYOUR_SOURCE_ADDRESS",
  recipient: "0xYOUR_DESTINATION_ADDRESS",
  idempotencyKey: "solver-order-0001"
};

const message = await client.requestPermitMessage(request);
// Sign `message` exactly with the payer wallet, outside the SDK.
```

Wallet ownership and transaction submission remain application concerns. Do
not inject private keys into a documentation build, indexer, or discovery
client.

## Conformance

From the repository root:

```bash
npm ci
npm run sdk:conformance
```

Conformance covers canonicalization, Feed hashes and signatures, permit-request
messages, ABI encoding, standard resolution, models, and error mapping across
the supported bindings.

## Safe client behavior

- Resolve endpoints and expected signer from canonical discovery.
- Verify the Feed before returning routes.
- Preserve base-10 integer strings and canonical identity formatting.
- Keep signing external and sign the exact returned message.
- Validate the permit envelope before building a transaction.
- Use the solver's own RPC for preview and submission.
- Expect one source Router call and a final total transaction count of two.
