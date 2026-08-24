# Nexa V6 Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DeFi Application Layer                   │
│  (Wallets, Aggregators, Intent Frameworks)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ (HTTP + On-chain)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           Nexa Discovery & Execution Layer (V6)             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  1. Discovery Facade (On-chain)                    │  │
│  │     - Endpoint: https://solver.vsnexa.com/...well  │  │
│  │     - Returns Discovery URI                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                           │                                 │
│  ┌─────────────────────────▼─────────────────────────────┐  │
│  │  2. Signed Feed (HTTP + On-chain events)            │  │
│  │     - Endpoint: /api/v6/solver-feed                 │  │
│  │     - Signer: Published cryptographic key           │  │
│  │     - Routes: 108-126 per network                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                           │                                 │
│  ┌─────────────────────────▼─────────────────────────────┐  │
│  │  3. Route Selection & Solver Discovery              │  │
│  │     - Filter by: Intent, Cost, Speed, Liquidity     │  │
│  │     - Endpoint: /api/v6/routes/{routeId}            │  │
│  └─────────────────────────────────────────────────────┘  │
│                           │                                 │
│  ┌─────────────────────────▼─────────────────────────────┐  │
│  │  4. Execution Permit (Signed Instruction)           │  │
│  │     - Endpoint: POST /api/v6/execution-permits      │  │
│  │     - Format: ERC-7683 or Nexa native               │  │
│  └─────────────────────────────────────────────────────┘  │
│                           │                                 │
│  ┌─────────────────────────▼─────────────────────────────┐  │
│  │  5. Router Execution (On-chain)                     │  │
│  │     - Address: 0x9eA675a496b6a2D13B3091F...        │  │
│  │     - Method: fillDirect(permit, signature)         │  │
│  └─────────────────────────────────────────────────────┘  │
│                           │                                 │
│  ┌─────────────────────────▼─────────────────────────────┐  │
│  │  6. Fill Verification (On-chain + Off-chain)        │  │
│  │     - Endpoint: GET /api/v6/execution-permits/{id}  │  │
│  │     - Status: Pending, Confirmed, Failed            │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              On-chain Settlement Layer                      │
│  (ERC-7683 Resolver, Router, Registry, Events)             │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Discovery Facade
- **Type:** Smart Contract (EVM)
- **Addresses (same on all 3 chains):** `0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6`
- **Chain Support:** Base (8453), BNB Smart Chain (56), HyperEVM (999)
- **Role:** Entry point for discovery; exposes `discoveryURI()` method

### 2. Registry
- **Type:** Smart Contract (EVM)
- **Address:** `0x3db7752f052ACFECB3DA99BeE7c6a34D22367141`
- **Role:** Tracks solver registrations, route configurations, and protocol updates

### 3. Router
- **Type:** Smart Contract (EVM)
- **Address:** `0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938`
- **Role:** Executes solver routes via `fillDirect()` method
- **Properties:**
  - `sourceIntakeEnabled() == true` (accepts external order sources)
  - Bound to published Registry
  - Shares release ID: `0xcc0dc051739f2dafaebd2eb5663937850dcc3e7951e38f437e00fcd9fa6c8ff6`

### 4. ERC-7683 Resolver
- **Type:** Smart Contract (EVM)
- **Address:** `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522`
- **Role:** Bridges ERC-7683 intents to Nexa Router execution
- **Method:** `resolve(bytes) → Call` (single call to Router)

### 5. OIF Discovery Module
- **Type:** Smart Contract (EVM)
- **Address:** `0x4f81426fE8999E982aE6b771536a4093879F6A20`
- **Role:** Exposes Nexa as Open Intent Framework adapter
- **Configuration:** `DISCOVERY_DESCRIPTION_ONLY` (read-only)

## Data Flow: Intent → Execution

### Step 1: User initiates intent
```typescript
const userIntent = {
  source_chain: 8453,      // Base
  dest_chain: 56,          // BNB Smart Chain
  token_in: "USDC",
  amount_in: 1000,
  token_out: "BUSD"
}
```

### Step 2: Fetch Nexa Feed
```bash
curl https://solver.vsnexa.com/api/v6/solver-feed
```

Response contains:
- `routes[]` - Available solver routes
- `signedPayload` - Cryptographic proof
- `feedSigner` - Public key for verification
- `feedSignature` - Signature of payload

### Step 3: Select solver route
```typescript
const route = feed.routes.find(r => 
  r.source_chain === 8453 &&
  r.dest_chain === 56 &&
  r.solver_address === "0x..."
);

// Verify signature
const isValid = verifyFeedSignature(feed);
```

### Step 4: Request execution permit
```bash
POST /api/v6/execution-permits/request-message

{
  "route_id": "...",
  "user_intent": {...},
  "quote": {...}
}
```

Response: `messageToSign` (EIP-712 message)

### Step 5: Sign permit
```typescript
const signature = await wallet.signMessage(messageToSign);
```

### Step 6: Submit permit
```bash
POST /api/v6/execution-permits

{
  "permit": {...},
  "signature": "0x..."
}
```

Response: `fillId` (tracking ID)

### Step 7: Execute on-chain
```typescript
const tx = await router.fillDirect(permit, signature);
await tx.wait();
```

### Step 8: Track status
```bash
GET /api/v6/execution-permits/{fillId}
```

---

## Network-Specific Configuration

### Base (Chain ID: 8453)
- **Nexa Network ID:** `0x3d5484ad...`
- **Active Routes:** 108
- **Contract Addresses:** (same as above)
- **Graph Studio:** ✅ Supported
- **Substreams:** ✅ Published

### BNB Smart Chain (Chain ID: 56)
- **Nexa Network ID:** `0x5863eb85...`
- **Active Routes:** 126
- **Contract Addresses:** (same as above)
- **Graph Studio:** ✅ Supported
- **Substreams:** ✅ Published

### HyperEVM (Chain ID: 999)
- **Nexa Network ID:** `0x5587698f...`
- **Active Routes:** 108
- **Contract Addresses:** (same as above)
- **Graph Studio:** ❌ Unsupported
- **Substreams:** ✅ Standalone

---

## Security Model

### Cryptographic Guarantees
1. **Feed Signing:** Every route Feed is signed by a published signer key
2. **Signature Verification:** Must verify `feedSignature` before using routes
3. **No Trust:** On-chain addresses are deterministic and verified via Sourcify

### Verification Checklist
```typescript
// Before executing ANY route:
1. Verify feedSignature matches feedSigner
2. Check contract bytecode on Sourcify
3. Validate route parameters in signed payload
4. Confirm Router.sourceIntakeEnabled() == true
```

### What's NOT Included
❌ Private keys or custody infrastructure
❌ Authorization logic or access control
❌ Pricing or risk management
❌ Capital deployment mechanisms

---

## Integration Patterns

### Pattern A: Direct SDK Usage
```typescript
import { NexaDiscovery, NexaSolver } from 'nexa-v6-sdk';

const discovery = new NexaDiscovery();
const feed = await discovery.getFeed();
const solver = new NexaSolver(feed.routes[0]);
const result = await solver.execute(userIntent);
```

### Pattern B: ERC-7683 Resolver
```solidity
// User broadcasts intent to ERC-7683 ResolveIntent(intent)
// Nexa Resolver intercepts and resolves to Router.fillDirect()
```

### Pattern C: Subgraph Query
```graphql
query {
  fills(where: { status: "confirmed" }) {
    id
    solver
    route_id
    output_amount
  }
}
```

---

## Performance Characteristics

| Operation | Time | Cost | Authority |
| --- | --- | --- | --- |
| Fetch Feed | 100-500ms | Free (HTTP) | Nexa (signed) |
| Verify Feed | 10-50ms | Free (local) | User (cryptographic) |
| Request Permit | 200-1000ms | Free (HTTP) | Solver (off-chain) |
| Sign Permit | 100-500ms | Free (client-side) | User (wallet) |
| Execute on-chain | 12-30s | Gas cost | Blockchain (consensus) |
| Track status | 50-100ms | Free (HTTP) | Nexa + Blockchain |

---

## Debugging & Monitoring

### Common Issues

**Issue:** Feed signature verification fails
- **Cause:** Stale Feed or network partition
- **Solution:** Fetch fresh Feed, verify timestamp

**Issue:** Route not available on destination chain
- **Cause:** Insufficient liquidity or solver offline
- **Solution:** Filter by destination chain, check solver status

**Issue:** Permit request rejected
- **Cause:** Intent parameters invalid or outside solver's parameters
- **Solution:** Validate intent against route specs, try different route

### Monitoring URLs

```
Feed status:     https://solver.vsnexa.com/api/v6/solver-feed/events (SSE)
Solver discovery: https://solver.vsnexa.com/api/v6/solver-discovery
OpenAPI spec:    https://solver.vsnexa.com/openapi.json
On-chain events: Graph Studio or Substreams
```

---

## Next Steps

1. **Integrate SDK:** [SDK Documentation](../sdks/README.md)
2. **Deploy Resolver:** [ERC-7683 Setup](../onboarding/README.md)
3. **Index Data:** [Subgraph/Substreams](../indexing/README.md)
4. **Monitor:** [Example monitoring script](../examples/)
