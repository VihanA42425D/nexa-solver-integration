# Nexa Mainnet V6 Solver Integration

**ACTIVE - Mainnet V6**

Public Nexa Solver discovery and execution integration for **Base**, **BNB Smart Chain**, and **HyperEVM**.

This is the machine-readable integration surface for Nexa solvers, indexers, and intent frameworks. It publishes verified on-chain Discovery Facade, Registry, and Router bindings, alongside signed Feed and complete OpenAPI surface.

## Quick Start

### Discovery URIs

- **Canonical Discovery**: `https://solver.vsnexa.com/.well-known/nexa-solver.json`
- **On-chain Fingerprint**: `https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json`
- **OpenAPI Document**: `https://solver.vsnexa.com/openapi.json`
- **Standards Manifest**: `https://solver.vsnexa.com/.well-known/nexa-standards.json`

### Getting Started

```bash
npm install
npm run discover
npm run facade:read
npm run verify:onchain
```

## Network Coverage

| Network | Chain ID | Active Routes |
| --- | ---: | ---: |
| Base | 8453 | 108 |
| BNB Smart Chain | 56 | 126 |
| HyperEVM | 999 | 108 |

All three networks deploy identical Facade, Registry, and Router smart contracts at the same deterministic addresses, enabling cross-chain consistency.

## Core Components

### Verified Mainnet Contracts

| Component | Address | 
| --- | --- |
| NexaSolverDiscoveryV6 | `0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6` |
| NexaMainnetRegistryV6 | `0x3db7752f052ACFECB3DA99BeE7c6a34D22367141` |
| NexaMainnetRouterV6 | `0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938` |
| ERC-7683 Resolver | `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522` |
| OIF Discovery Module | `0x4f81426fE8999E982aE6b771536a4093879F6A20` |

### Public API Endpoints

- `GET /.well-known/nexa-solver.json` - Solver metadata
- `GET /.well-known/nexa-onchain-discovery.json` - On-chain fingerprint
- `GET /openapi.json` - Full OpenAPI 3.1 specification
- `GET /.well-known/nexa-standards.json` - Standards manifest
- `GET /api/v6/solver-discovery` - Solver discovery
- `GET /api/v6/solver-feed` - Signed solver feed
- `GET /api/v6/solver-feed/events` - Feed events (SSE stream)
- `GET /api/v6/routes/{routeId}` - Route details
- `POST /api/v6/execution-permits/request-message` - Permit message request
- `POST /api/v6/execution-permits` - Submit permit
- `GET /api/v6/execution-permits/{fillId}` - Fill status

## Language Support & SDKs

The frozen V1.0.0 SDK contract defines canonical behavior across all platforms:

| Platform | Package | Reference |
| --- | --- | --- |
| TypeScript/Node | `nexa-v6-sdk@1.0.0` | [npm](https://www.npmjs.com/package/nexa-v6-sdk/v/1.0.0) |
| Python | `nexa-v6-sdk 1.0.0` | [PyPI](https://pypi.org/project/nexa-v6-sdk/1.0.0/) |
| Rust | `nexa-v6-sdk 1.0.0` | [crates.io](https://crates.io/crates/nexa-v6-sdk/1.0.0) |
| Go | — | `/sdks/go` in this repo |
| Java/Kotlin | `io.github.vihana42425d:nexa-v6-sdk:1.0.0` | [Maven Central](https://central.sonatype.com/artifact/io.github.vihana42425d/nexa-v6-sdk/1.0.0) |
| .NET | `VihanA.Nexa.V6.Sdk 1.0.0` | [NuGet](https://www.nuget.org/packages/VihanA.Nexa.V6.Sdk/1.0.0) |

## Repository Structure

| Path | Purpose |
| --- | --- |
| `manifest.json` | Final ACTIVE artifact index |
| `nexa-mainnet-v6.json` | Canonical public integration bundle |
| `public/` | Static discovery documents (.well-known endpoints) |
| `openapi/` | Generated OpenAPI 3.1 specification |
| `onboarding/` | Solver/Aggregator onboarding package |
| `abi/` | Contract ABIs (Facade, Registry, Router, modules) |
| `standards/` | ERC-7683 and OIF compatibility metadata |
| `verification/` | Source code, deployment evidence, signatures |
| `examples/` | Integration examples (discovery, permits, resolution) |
| `sdk-spec/` | Cross-language behavior contract and test vectors |
| `sdks/` | Implementations for all supported languages |
| `distribution/` | External wallet/aggregator onboarding ledger |
| `indexing/` | Passive Graph/Substreams packages |

## Standards & Integration

### ERC-7683 Support

Fully executable, resolver-centric off-chain `eth_call` integration. Canonical Router `fillDirect` resolution with no secondary sources.

### Open Intent Framework (OIF)

Discovery only (`DISCOVERY_DESCRIPTION_ONLY`); execution remains unsupported via OIF with `OIFExecutionUnsupported()`.

### Indexing

- **Graph**: Deployed to Graph Studio for Base (8453) and BSC (56)
- **Substreams**: Published and live-validated for Base, BSC, and HyperEVM
- **Schema**: Shared configuration across all networks, non-authoritative, purely informational

## Integration Checklist

1. ✅ Resolve on-chain Facade for your chain
2. ✅ Fetch signed Discovery Feed and verify with published signer
3. ✅ Query Router for available routes
4. ✅ Request execution Permit for desired route
5. ✅ Build and submit execution transaction
6. ✅ Monitor Fill status via API

## Security reports

[Report security issues responsibly](SECURITY.md)

## License

[ISC License](LICENSE)

## Homepage

[solver.vsnexa.com](https://solver.vsnexa.com)
