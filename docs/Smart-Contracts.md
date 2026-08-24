# Smart Contracts Reference

Public solver-facing reference for the Nexa Mainnet V6 contracts published in
the canonical integration bundle. It is not a reference for unpublished or
non-solver-facing contracts.

## Contract Deployment Summary

| Network | Chain ID | Facade Deployment Block | Router Indexing Start Block |
| --- | ---: | ---: | ---: |
| Base | 8453 | 50320644 | 50143190 |
| BNB Smart Chain | 56 | 117488361 | 116699987 |
| HyperEVM | 999 | 43894134 | 43533563 |

Each published contract has its own address. For a given contract, the
canonical bundle reports the same address and expected runtime code hash on all
three supported networks. Verify each deployment independently before use.

---

## Core Contracts

### 1. NexaSolverDiscoveryV6 (Facade)

**Address (all networks)**: `0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6`

**Purpose**: Public discovery entry point and configuration facade.

**Key Methods**:
- `discoveryURI()` - Returns canonical discovery endpoint
- `RELEASE_ID()` - Returns the published release identifier
- `DEPLOYMENT_VERSION()` - Returns deployment version 6
- `chainId()` - Returns current chain identifier
- `systemState()` - Returns the current public Registry, Router, route count, and live state

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

**Purpose**: On-chain registry of public networks, assets, routes, execution generations, and route state.

**Key Methods**:
- `getRoute(routeId)` - Returns specific route details
- `routeCount()` - Returns the number of registered route identifiers
- `routeAt(index)` - Returns a route identifier by registry index
- `isRouteExecutable(routeId)` - Returns the route's current executable state

**Start Block**: 
- Base: 50143186
- BSC: 116699981
- HyperEVM: 43533441

---

### 3. NexaMainnetRouterV6

**Address (all networks)**: `0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938`

**Purpose**: Public source-chain execution Router for issued Nexa permits.

**Key Methods**:
- `sourceIntakeEnabled()` - Returns the current source-intake state
- `previewFillDirect(permit, signature)` - Validates a permit through a view call
- `fillDirect(permit, signature)` - Executes the issued permit on the source chain

**Start Block**:
- Base: 50143190
- BSC: 116699987
- HyperEVM: 43533563

**Binding**: All routers share release ID `0xcc0dc051739f2dafaebd2eb5663937850dcc3e7951e38f437e00fcd9fa6c8ff6`.

---

### 4. ERC-7683 Resolver

**Address (all networks)**: `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522`

**Purpose**: Provides the canonical `EXECUTABLE_RESOLVER` compatibility surface
for resolving an issued Nexa permit payload to a Router execution call.

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
   - Enumerate public route identifiers and route state from the Registry
   - Use the cryptographically verified signed Feed for live published terms

3. **Permit Signing** (off-chain)
   - Request signing message from API
   - User/bot signs with wallet private key

4. **Execution**
   - Submit the issued permit and signature to the source Router `fillDirect`
   - Nexa submits one destination payout transaction after the source fill is observed and confirmed

5. **Verification**
   - Query the public permit-status HTTP endpoint using the issued `fillId`
   - Verify the source and destination transaction receipts on-chain

### ERC-7683 Resolution

1. Encode the issued Nexa permit and signature using the canonical payload format
2. Call the ERC-7683 module off-chain using `eth_call`
3. Verify that the resolved `Call` targets the canonical Router `fillDirect`
4. Submit the single source transaction described by the issued permit

---

## Event Signatures

### Key Events

**SourceFillV6** (`NexaMainnetRouterV6`)
- Emitted when the Router accepts the source fill
- Indexed fields: `fillId`, `routeId`, and `quoteId`
- Signature: `SourceFillV6(bytes32,bytes32,bytes32,address,address,address,address,uint256,uint128,uint128,uint32,uint64,bytes32,bytes32)`
- Topic 0: `0x77d880254b141dedc64867f6d2d253eedfc609837b892c4ddfe154a43ea80561`

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
- **Facade verification**: `NexaSolverDiscoveryV6` has exact-match Sourcify
  evidence on Base, BNB Smart Chain, and HyperEVM. Consult the canonical
  verification artifacts for the precise evidence published for each contract.

### Constructor Arguments

The Facade constructor parameters, transaction hashes, and deployment blocks are pinned in:
- [verification/facade-deployment.json](../verification/facade-deployment.json)

---

## Contract ABI

Complete ABI specifications for all contracts:

[abi/solver-facing.json](../abi/solver-facing.json)

Contains:
- Facade ABI
- Registry ABI
- Router ABI
- ERC-7683 Resolver ABI
- OIF discovery module ABI

---

## Standards Compliance

### ERC-165

The published ERC-7683 and OIF standards modules expose ERC-165 interface
detection. The public Facade, Registry, and Router ABIs do not publish
`supportsInterface(bytes4)`.

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```

### ERC-7683

The canonical compatibility level is `EXECUTABLE_RESOLVER`: the module resolves
an issued Nexa permit payload off-chain to one Router `Call`. This documentation
does not claim broader or full ERC-7683 compliance.

### OIF Integration

Implements Open Intent Framework discovery adapter with execution denial pattern.

---

## Reading Contracts (No Signing Required)

Verification and discovery reads are **view-only** operations&mdash;they require no transactions, signatures, or gas fees:

```bash
npm run facade:read    # Read all Facade methods
npm run verify:onchain # Verify on-chain bindings
```

---

## Public scope

This reference covers only the solver-facing contracts and evidence published
in this repository. See [Security Boundary](Home.md#security--scope) for the
public documentation boundary.

---

## Links

- **Full ABI**: [abi/solver-facing.json](../abi/solver-facing.json)
- **Event Signatures**: [events/events.json](../events/events.json)
- **Standards Metadata**: [standards/nexa-standards.json](../standards/nexa-standards.json)
- **Deployment Evidence**: [verification/](../verification/)
