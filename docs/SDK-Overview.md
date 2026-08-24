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
import { Nexa } from 'nexa-v6-sdk';

const solver = new Nexa();
const discovery = await solver.discover();
const routes = await solver.getRoutes();
const route = await solver.getRoute(routeId);
const verified = await solver.verifyFeed(feedData);
const message = await solver.requestPermitMessage(routeId);
const permit = await solver.requestPermit(message, signature);
const execution = await solver.resolveExecution(permit);
const preview = await solver.previewExecution(execution);
const tx = await solver.buildExecutionTx(execution);
const status = await solver.getFillStatus(fillId);
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
from nexa_v6_sdk import Nexa

solver = Nexa()
discovery = solver.discover()
routes = solver.get_routes()
route = solver.get_route(route_id)
verified = solver.verify_feed(feed_data)
message = solver.request_permit_message(route_id)
permit = solver.request_permit(message, signature)
execution = solver.resolve_execution(permit)
preview = solver.preview_execution(execution)
tx = solver.build_execution_tx(execution)
status = solver.get_fill_status(fill_id)
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
use nexa_v6_sdk::Nexa;

let solver = Nexa::new();
let discovery = solver.discover().await?;
let routes = solver.get_routes().await?;
let route = solver.get_route(&route_id).await?;
let verified = solver.verify_feed(&feed_data)?;
let message = solver.request_permit_message(&route_id).await?;
let permit = solver.request_permit(&message, &signature).await?;
let execution = solver.resolve_execution(&permit).await?;
let preview = solver.preview_execution(&execution).await?;
let tx = solver.build_execution_tx(&execution)?;
let status = solver.get_fill_status(&fill_id).await?;
```

**Location**: [sdks/rust/](../sdks/rust/)

---

### Go

**Module**: `github.com/VihanA42425D/nexa-solver-integration/sdks/go`

No external package registry; vendored directly from this repository.

```go
import "github.com/VihanA42425D/nexa-solver-integration/sdks/go"

solver := nexa.NewSolver()
discovery, _ := solver.Discover(ctx)
routes, _ := solver.GetRoutes(ctx)
route, _ := solver.GetRoute(ctx, routeID)
verified, _ := solver.VerifyFeed(feedData)
message, _ := solver.RequestPermitMessage(ctx, routeID)
permit, _ := solver.RequestPermit(ctx, message, signature)
execution, _ := solver.ResolveExecution(ctx, permit)
preview, _ := solver.PreviewExecution(ctx, execution)
tx, _ := solver.BuildExecutionTx(execution)
status, _ := solver.GetFillStatus(ctx, fillID)
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
import io.github.vihana42425d.NexaSolver;

NexaSolver solver = new NexaSolver();
Discovery discovery = solver.discover();
List<Route> routes = solver.getRoutes();
Route route = solver.getRoute(routeId);
boolean verified = solver.verifyFeed(feedData);
String message = solver.requestPermitMessage(routeId);
Permit permit = solver.requestPermit(message, signature);
Execution execution = solver.resolveExecution(permit);
ExecutionPreview preview = solver.previewExecution(execution);
Transaction tx = solver.buildExecutionTx(execution);
FillStatus status = solver.getFillStatus(fillId);
```

**Location**: [sdks/java/](../sdks/java/)

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

var solver = new NexaSolver();
var discovery = await solver.DiscoverAsync();
var routes = await solver.GetRoutesAsync();
var route = await solver.GetRouteAsync(routeId);
var verified = solver.VerifyFeed(feedData);
var message = await solver.RequestPermitMessageAsync(routeId);
var permit = await solver.RequestPermitAsync(message, signature);
var execution = await solver.ResolveExecutionAsync(permit);
var preview = await solver.PreviewExecutionAsync(execution);
var tx = solver.BuildExecutionTx(execution);
var status = await solver.GetFillStatusAsync(fillId);
```

**Naming**: Uses **PascalCase** per .NET convention (e.g., `DiscoverAsync`, `VerifyFeed`).

**Location**: [sdks/dotnet/](../sdks/dotnet/)

---

## Ten Core Operations

All SDKs implement these identical operations:

| Operation | Purpose |
| --- | --- |
| `discover()` | Retrieve solver and network metadata |
| `getRoutes()` | List all active routes |
| `getRoute(id)` | Get specific route details |
| `verifyFeed(data)` | Cryptographically verify signed Feed |
| `requestPermitMessage(routeId)` | Get message for wallet to sign |
| `requestPermit(message, sig)` | Submit signed execution Permit |
| `resolveExecution(permit)` | Convert Permit to executable transaction |
| `previewExecution(exec)` | Simulate execution without submitting |
| `buildExecutionTx(exec)` | Construct final transaction bytes |
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
