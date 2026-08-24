# Smart Contracts Reference

Comprehensive reference for all Nexa V6 smart contracts deployed on Base, BNB Smart Chain, and HyperEVM.

## Contract Deployment Summary

| Network | Chain ID | Facade Deploy Block | Router Start Block |
| --- | ---: | ---: | ---: |
| Base | 8453 | N/A | 50143190 |
| BNB Smart Chain | 56 | N/A | 116699987 |
| HyperEVM | 999 | N/A | 43533563 |

**Key Property**: All five core contracts use the **same deterministic address** and **identical runtime bytecode** across all three networks, enabling seamless cross-chain operations.

---

## Core Contracts

### 1. NexaSolverDiscoveryV6 (Facade)

**Address (all networks)**: `0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6`

**Purpose**: Public discovery entry point and configuration facade.

**Key Methods**:
- `discoveryURI()` - Returns canonical discovery endpoint
- `interfaceVersion()` - Returns canonical interface version
- `chainId()` - Returns current chain identifier

**Verification**:
- [BaseScan](https://basescan.org/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code)
- [BscScan](https://bscscan.com/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code)
- [HyperEVMScan](https://hyperevmscan.io/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code)
- [Sourcify (Base)](https://repo.sourcify.dev/8453/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)
- [Sourcify (BSC)](https://repo.sourcify.dev/56/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)
- [Sourcify (HyperEVM)](https://repo.sourcify.dev/999/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6)

---

### 2. NexaMainnetRegistryV6

**Address (all networks)**: `0x3db7752f052ACFECB3DA99BeE7c6a34D22367141`

**Purpose**: On-chain registry of available routes, solvers, and integration metadata.

**Key Methods**:
- `getRoutes()` - Returns all available routes
- `getRoute(routeId)` - Returns specific route details
- `getRouteCount()` - Returns total active routes

**Start Block**: 
- Base: 50143186
- BSC: 116699981
- HyperEVM: 43533441

---

### 3. NexaMainnetRouterV6

**Address (all networks)**: `0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938`

**Purpose**: Primary execution router. Handles settlement and execution transaction routing.

**Key Methods**:
- `sourceIntakeEnabled()` - Returns `true` (always accepting source execution)
- `fillDirect(bytes permit, bytes order)` - Execute order via direct Router path
- `getFillStatus(bytes32 fillId)` - Query execution status

**Start Block**:
- Base: 50143190
- BSC: 116699987
- HyperEVM: 43533563

**Binding**: All routers share release ID `0xcc0dc051739f2dafaebd2eb5663937850dcc3e7951e38f437e00fcd9fa6c8ff6`.

---

### 4. ERC-7683 Resolver

**Address (all networks)**: `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522`

**Purpose**: Converts ERC-7683 intent format to Router execution calls.

**Key Methods**:
- `resolve(bytes intentData)` - Returns single `Call` targeting Router `fillDirect`

**Behavior**: 
- Returns exactly one executable `Call` targeting the canonical Router
- No secondary sources or fallback mechanisms
- Resolver-centric design per ERC-7683 specification

---

### 5. OIF Discovery Module

**Address (all networks)**: `0x4f81426fE8999E982aE6b771536a4093879F6A20`

**Purpose**: Open Intent Framework (OIF) adapter for Nexa solver discovery.

**Integration Mode**: `DISCOVERY_DESCRIPTION_ONLY`

**Execution**: 
- Not supported via OIF
- Raises `OIFExecutionUnsupported()` when execution is attempted
- Only discovery metadata is provided

---

## Contract Interactions

### Resolution Flow

1. **Facade Discovery**
   - Call `discoveryURI()` on Facade
   - Retrieve signed Feed from returned endpoint

2. **Route Lookup**
   - Query Registry for current routes
   - Receive list of available opportunities

3. **Permit Signing** (off-chain)
   - Request signing message from API
   - User/bot signs with wallet private key

4. **Execution**
   - Submit signed Permit to Router `fillDirect(bytes permit, bytes order)`
   - Router executes settlement transaction

5. **Verification**
   - Query `getFillStatus(fillId)` for confirmation
   - Verify on-chain transaction

### ERC-7683 Resolution

1. Intent creator publishes order in ERC-7683 format
2. Resolver (address above) converts to Router call
3. Router `fillDirect` settles the cross-chain operation
4. No additional protocol work required

---

## Event Signatures

### Key Events

**SourceFillV6** (Facade)
- Emitted on successful route execution
- Indexed by block, transaction, route ID
- Signature: `event SourceFillV6(bytes32 indexed orderId, address indexed solver, ...)`

Registered in Sourcify Signature Database (direct import, no verified association claim).

For complete event list, see [events/events.json](../events/events.json)

---

## Verification & Bytecode

### Bytecode Hashes

| Contract | Runtime Hash |
| --- | --- |
| NexaSolverDiscoveryV6 | `0x57cb853a995215d352eb64ab9ec33aed60f4ef5f8a38575bc2dd018b38babfc1` |
| NexaMainnetRegistryV6 | `0x5e766be0eb7a9b75f0b38c8509a15ac261209f06b0c993e8904a9f38633c790a` |
| NexaMainnetRouterV6 | `0xcdda1b571b317479c6d297aa4354c406d4709f83562e2b6b29bd0e1268e4af70` |
| ERC-7683 Resolver | `0xea99f0e1e33a9a9e1ae926e8f15fd09bf1b7b9cecf81a2ef294cd4820e26d392` |
| OIF Discovery Module | `0x103c954e71ec79abefc0f8e1ef745787649edb91742a4d4a7b0d2a4646925cba` |

### Compiler

- **Solidity Version**: `0.8.26+commit.8a97fa7a.Emscripten.clang`
- **Verification**: All contracts verified on Sourcify v2

### Constructor Arguments

Exact constructor parameters, transaction hashes, and deployment blocks are pinned in:
- [verification/facade-deployment.json](../verification/facade-deployment.json)

---

## Contract ABI

Complete ABI specifications for all contracts:

📄 [abi/solver-facing.json](../abi/solver-facing.json)

Contains:
- Facade ABI
- Registry ABI
- Router ABI
- Module Registry ABI
- ERC-7683 Resolver ABI

---

## Standards Compliance

### ERC-165

All contracts implement ERC-165 interface detection:

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```

### ERC-7683

Resolver fully compliant with ERC-7683 cross-chain intent settlement standard.

### OIF Integration

Implements Open Intent Framework discovery adapter with execution denial pattern.

---

## Reading Contracts (No Signing Required)

All verification and discovery reads are **view-only** operations—no transactions, signatures, or gas fees required:

```bash
npm run facade:read    # Read all Facade methods
npm run verify:onchain # Verify on-chain bindings
```

---

## Custody & Authorization

This reference covers **solver-facing contracts only**. 

**Not included**:
- Custody and capital management
- Authorization and access control infrastructure
- Clearing and settlement logic beyond Router
- Operator and business infrastructure

See [Security Boundary](Home.md#security--scope) for scope details.

---

## Links

- **Full ABI**: [abi/solver-facing.json](../abi/solver-facing.json)
- **Event Signatures**: [events/events.json](../events/events.json)
- **Standards Metadata**: [standards/nexa-standards.json](../standards/nexa-standards.json)
- **Deployment Evidence**: [verification/](../verification/)
