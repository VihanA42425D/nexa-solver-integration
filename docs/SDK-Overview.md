# SDK Overview & Implementation Guide

Canonical SDK implementations for Nexa V6 across six programming languages.

---

## SDK Contract (v1.0.0 - Frozen)

The **language-neutral SDK contract** defines ten behavioral operations that are identically implemented across all platforms.

📄 [sdk-spec/nexa-v6-sdk-contract.json](../sdk-spec/nexa-v6-sdk-contract.json)

Covers:
- Canonical data models
- Raw-digest Feed verification
- Permit signing and validation
- ERC-7683 resolution
- Execution transaction building
- Fill status querying
- Unified error model

### Shared Test Vectors

📄 [sdk-spec/test-vectors.json](../sdk-spec/test-vectors.json)

Deterministic test cases for:
- Feed signature verification
- Permit construction
- ERC-7683 encoding/decoding
- Transaction building
- Edge cases and error conditions

---

## Language Implementations

### TypeScript / Node.js

**Package**: `nexa-v6-sdk@1.0.0`  
**Registry**: [npm](https://www.npmjs.com/package/nexa-v6-sdk/v/1.0.0)

```bash
npm install nexa-v6-sdk@1.0.0
```

**API**:
```typescript
import { NexaV6Client } from "nexa-v6-sdk";

const client = new NexaV6Client();
const routes = await client.getRoutes(); // verifies the Signed Feed
const permitRequest = { quoteId, requestedAmountInRaw, standard, payer, recipient, idempotencyKey };
const message = client.requestPermitMessage(permitRequest);
const requestSignature = await wallet.signMessage(message);
const permit = await client.requestPermit(permitRequest, requestSignature);
const execution = await client.resolveExecution(rpcUrl, permit.permit.execution.payload);
const preview = await client.previewExecution(rpcUrl, permit);
const tx = client.buildExecutionTx(permit);
const status = await client.getFillStatus(permit.permit.fillId);
```

**Location**: [sdks/typescript/](../sdks/typescript/)

---

### Python

**Package**: `nexa-v6-sdk 1.0.0`  
**Registry**: [PyPI](https://pypi.org/project/nexa-v6-sdk/1.0.0/)

```bash
pip install nexa-v6-sdk==1.0.0
```

**API**:
```python
from nexa_v6_sdk import NexaV6Client

client = NexaV6Client()
routes = client.getRoutes()  # verifies the Signed Feed
message = client.requestPermitMessage(permit_request)
permit = client.requestPermit(permit_request, request_signature)
execution = client.resolveExecution(rpc_url, permit["permit"]["execution"]["payload"])
preview = client.previewExecution(rpc_url, permit)
tx = client.buildExecutionTx(permit)
status = client.getFillStatus(permit["permit"]["fillId"])
```

**Location**: [sdks/python/](../sdks/python/)

---

### Rust

**Package**: `nexa-v6-sdk 1.0.0`  
**Registry**: [crates.io](https://crates.io/crates/nexa-v6-sdk/1.0.0)

```toml
[dependencies]
nexa-v6-sdk = "1.0.0"
```

**API**:
```rust
use nexa_v6_sdk::NexaV6Client;

let client = NexaV6Client::default();
let routes = client.getRoutes(None)?; // verifies the Signed Feed
let message = client.requestPermitMessage(&permit_request)?;
let permit = client.requestPermit(&permit_request, &request_signature)?;
let execution = client.resolveExecution(&rpc_url, permit["permit"]["execution"]["payload"].as_str().unwrap())?;
let preview = client.previewExecution(&rpc_url, &permit)?;
let tx = client.buildExecutionTx(&permit)?;
let status = client.getFillStatus(permit["permit"]["fillId"].as_str().unwrap())?;
```

**Location**: [sdks/rust/](../sdks/rust/)

---

### Go

**Module**: `github.com/VihanA42425D/nexa-solver-integration/sdks/go`

No external package registry; vendored directly from this repository.

```go
import "github.com/VihanA42425D/nexa-solver-integration/sdks/go"

client := nexav6.NewClient()
routes, _ := client.GetRoutes(ctx, nil) // verifies the Signed Feed
message, _ := client.RequestPermitMessage(permitRequest)
permit, _ := client.RequestPermit(ctx, permitRequest, requestSignature)
permitEnvelope := permit["permit"].(map[string]any)
executionData := permitEnvelope["execution"].(map[string]any)
execution, _ := client.ResolveExecution(ctx, rpcURL, executionData["payload"].(string))
preview, _ := client.PreviewExecution(ctx, rpcURL, permit)
tx, _ := client.BuildExecutionTx(permit)
status, _ := client.GetFillStatus(ctx, permitEnvelope["fillId"].(string))
```

**Naming**: Uses **PascalCase** per Go convention (e.g., `GetRoutes`, `VerifyFeed`).

**Location**: [sdks/go/](../sdks/go/)

---

### Java / Kotlin

**Package**: `io.github.vihana42425d:nexa-v6-sdk:1.0.0`  
**Registry**: [Maven Central](https://central.sonatype.com/artifact/io.github.vihana42425d/nexa-v6-sdk/1.0.0)

```xml
<dependency>
  <groupId>io.github.vihana42425d</groupId>
  <artifactId>nexa-v6-sdk</artifactId>
  <version>1.0.0</version>
</dependency>
```

**API**:
```java
import com.fasterxml.jackson.databind.JsonNode;
import io.github.vihana42425d.nexa.v6.NexaV6Client;
import java.util.Map;

var client = new NexaV6Client();
var routes = client.getRoutes(Map.of()); // verifies the Signed Feed
String message = client.requestPermitMessage(permitRequest);
JsonNode permit = client.requestPermit(permitRequest, requestSignature);
JsonNode execution = client.resolveExecution(rpcUrl,
    permit.path("permit").path("execution").path("payload").asText());
JsonNode preview = client.previewExecution(rpcUrl, permit);
JsonNode tx = client.buildExecutionTx(permit);
JsonNode status = client.getFillStatus(permit.path("permit").path("fillId").asText());
```

**Location**: [sdks/jvm/](../sdks/jvm/)

**Maven Signing**: Artifacts signed with OpenPGP fingerprint `A3A1CA1FF8968B62DB50B4537EFE1BDBD7E89F25`.

---

### .NET / C#

**Package**: `VihanA.Nexa.V6.Sdk 1.0.0`  
**Registry**: [NuGet](https://www.nuget.org/packages/VihanA.Nexa.V6.Sdk/1.0.0)

```bash
dotnet add package VihanA.Nexa.V6.Sdk --version 1.0.0
```

**API**:
```csharp
using VihanA.Nexa.V6.Sdk;

var client = new NexaV6Client();
var routes = await client.GetRoutes(); // verifies the Signed Feed
var message = client.RequestPermitMessage(permitRequest);
var permit = await client.RequestPermit(permitRequest, requestSignature);
var execution = await client.ResolveExecution(rpcUrl,
    permit.GetProperty("permit").GetProperty("execution").GetProperty("payload").GetString()!);
var preview = await client.PreviewExecution(rpcUrl, permit);
var tx = client.BuildExecutionTx(permit);
var status = await client.GetFillStatus(permit.GetProperty("permit").GetProperty("fillId").GetString()!);
```

**Naming**: Uses **PascalCase** per .NET convention (e.g., `DiscoverAsync`, `VerifyFeed`).

**Location**: [sdks/dotnet/](../sdks/dotnet/)

---

## Ten Core Operations

All SDKs implement these identical operations. Route Detail is optional; a
client can proceed from a verified Feed route directly to the Permit Request.

| Operation | Purpose |
| --- | --- |
| `discover()` | Retrieve solver and network metadata |
| `getRoutes()` | List all active routes |
| `getRoute(id)` | Get specific route details |
| `verifyFeed(data)` | Cryptographically verify signed Feed |
| `requestPermitMessage(request)` | Build the exact local message for the payer wallet to sign |
| `requestPermit(request, signature)` | Submit the complete request and wallet signature |
| `resolveExecution(rpcUrl, payload)` | Resolve an ERC-7683 execution payload with `eth_call` |
| `previewExecution(rpcUrl, permit)` | Simulate direct execution without submitting |
| `buildExecutionTx(permit)` | Construct the single source transaction |
| `getFillStatus(fillId)` | Query settlement confirmation |

---

## Behavioral Consistency

**All SDKs guarantee**:
1. Identical data model serialization
2. Bit-for-bit matching signatures on same inputs
3. Identical error codes and messages
4. Same validation sequence
5. Cross-platform deterministic crypto

### Verification

```bash
npm run sdk:conformance
```

Runs all language implementations against shared test vectors to verify behavioral consistency.

---

## Examples

Full working examples for each language:

📁 [examples/](../examples/)

- Discovery client
- Permit signing client
- Facade read-only client
- Route resolution flow
- Error handling patterns

---

## Error Handling

Unified error model across all SDKs:

```javascript
{
  "code": "ERROR_CODE",
  "message": "Human-readable description",
  "details": {...}
}
```

Common errors:
- `INVALID_FEED_SIGNATURE` - Feed verification failed
- `INVALID_ROUTE` - Route not found or expired
- `INVALID_PERMIT` - Permit signature/format invalid
- `NETWORK_ERROR` - HTTP/RPC connection failed

---

## Best Practices

1. **Always verify Feed signatures** before selecting routes
   - Use `verifyFeed()` before processing `signedPayload`
   - Maintain published signer key

2. **Handle SSE streams gracefully**
   - Reconnect on `publication-closed` events
   - Resume with last `dataVersion` as `Last-Event-ID`

3. **Validate permit expiry** before submission
   - Permits have time-bounded validity
   - Refresh if timeout approaching

4. **Implement retry logic** for network failures
   - Use exponential backoff
   - Preserve idempotency keys

5. **Test with shared vectors** first
   - Before mainnet, run against [sdk-spec/test-vectors.json](../sdk-spec/test-vectors.json)
   - Verify signature matching byte-for-byte

---

## Documentation

- **Specification**: [sdk-spec/nexa-v6-sdk-contract.json](../sdk-spec/nexa-v6-sdk-contract.json)
- **Test Vectors**: [sdk-spec/test-vectors.json](../sdk-spec/test-vectors.json)
- **Examples**: [examples/](../examples/)
- **OpenAPI**: [openapi/openapi.json](../openapi/openapi.json)
