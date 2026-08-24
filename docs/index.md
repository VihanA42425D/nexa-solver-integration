# Nexa V6 Solver Integration

**Production-grade cross-chain solver discovery and execution framework for Web3 developers.**

Nexa V6 is a verified, signed Feed-based solver discovery and execution layer supporting:
- ✅ **ERC-7683** - Cross-chain intent execution standard
- ✅ **Open Intent Framework (OIF)** - Extensible intent protocol
- ✅ **Multiple chains** - Base, BNB Smart Chain, HyperEVM
- ✅ **Multi-language SDKs** - TypeScript, Python, Rust, Go, Java/.NET

---

## Quick Integration

### For DeFi Developers
Want to discover solvers or execute cross-chain intents?

```bash
npm install nexa-v6-sdk
```

```typescript
import { NexaDiscovery } from 'nexa-v6-sdk';

const discovery = new NexaDiscovery();
const solvers = await discovery.getSolvers();
const feed = await discovery.getFeed();
```

**Start here:** [SDK Documentation](../sdks)

### For Solver Operators
Want to register your solver on Nexa?

**Discovery endpoint:** `https://solver.vsnexa.com/.well-known/nexa-solver.json`

**Setup guide:** [Solver Onboarding](../onboarding/README.md)

### For Indexers & Analytics
Want to index Nexa events with The Graph or Substreams?

- **Subgraphs:** Deployed on Graph Studio for Base & BNB Chain
- **Substreams:** Published to official registry (Base, BSC, HyperEVM)

**Learn more:** [Indexing Package](../indexing/README.md)

---

## Key Features

### 🔐 Cryptographically Signed
Every solver Feed is signed and verifiable on-chain. No trust assumptions required.

### 📦 Deterministic Deployment
Same contract addresses and bytecode across Base (8453), BNB Smart Chain (56), and HyperEVM (999).

### 🚀 Zero-Touch Integration
Copy-paste onboarding package. Full spec frozen in JSON and code.

### 📊 Production Metrics
- **108-126 active routes** across networks
- **6 language SDKs** all at v1.0.0
- **Verified contracts** on Sourcify across 3 chains

---

## Verified Contracts

| Component | Address | Verification |
| --- | --- | --- |
| NexaSolverDiscoveryV6 | 0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6 | [BaseScan](https://basescan.org/address/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6#code) \| [Sourcify](https://repo.sourcify.dev/8453/0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6) |

**All five mainnet components:** [Full verification table](verified-mainnet-contracts.md)

---

## Common Use Cases

### Use Case 1: DeFi Protocol wants cross-chain swaps
- Deploy ERC-7683 resolver pointing to Nexa Router
- Users broadcast intents, solvers compete to fulfill
- Result: Decentralized, multichain liquidity

### Use Case 2: Wallet needs solver discovery
- Fetch signed Feed from Nexa
- Present available routes to user
- No backend dependency

### Use Case 3: Indexing solver activity
- Subscribe to The Graph subgraph or Substreams
- Build analytics dashboard
- Monitor solver performance

**More examples:** [Examples Directory](../examples)

---

## Getting Started by Role

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 2rem 0;">

<div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
  <h3>🧑‍💻 Developer</h3>
  <p>Integrate Nexa into your dApp</p>
  <a href="../examples">View Examples</a>
</div>

<div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
  <h3>⚡ Solver Operator</h3>
  <p>Register and discover routes</p>
  <a href="../onboarding/README.md">Onboarding Guide</a>
</div>

<div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
  <h3>📈 Indexer</h3>
  <p>Query historical data</p>
  <a href="../indexing/README.md">Indexing Setup</a>
</div>

</div>

---

## Standards & Specifications

- **ERC-7683** - Cross-chain intent execution (resolver-centric)
- **Open Intent Framework (OIF)** - Intent discovery and adaptation
- **SDK Contract** - Frozen behavioral spec for all 6 language implementations
- **Test Vectors** - Deterministic end-to-end integration tests

**Specifications:** [standards/](../standards/nexa-standards.json)

---

## Documentation

| Resource | Purpose |
| --- | --- |
| [Public API](../openapi/openapi.json) | OpenAPI 3.1 specification |
| [SDK Documentation](../sdks/README.md) | Language-specific guides |
| [Architecture](architecture.md) | System design & data flow |
| [FAQ](faq.md) | Common questions & troubleshooting |
| [Glossary](glossary.md) | Solver, Feed, Permit terminology |

---

## Statistics

- **Languages:** 58.7% JavaScript, 12% Rust, 6.6% Go, 6.2% C#, 5.8% TypeScript, 5.8% Java, 4.9% Other
- **Networks:** 3 (Base, BNB Chain, HyperEVM)
- **Active routes:** 108-126 per network
- **SDK versions:** All at v1.0.0 (stable)
- **License:** ISC

---

## Development

```bash
# Install dependencies
npm install

# Run discovery
npm run discover

# Read on-chain Facade
npm run facade:read

# Verify contracts on-chain
npm run verify:onchain

# Generate all artifacts
npm run generate:*

# Run full test suite
npm test
npm run sdk:conformance
```

**Contributing:** See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## Support & Community

- **Issues:** [GitHub Issues](https://github.com/VihanA42425D/nexa-solver-integration/issues)
- **Repository:** [github.com/VihanA42425D/nexa-solver-integration](https://github.com/VihanA42425D/nexa-solver-integration)
- **Discovery endpoint:** https://solver.vsnexa.com/.well-known/nexa-solver.json

---

## Security

Only solver-facing contracts and public cryptographic identities are exposed. No private keys, custody, or authorization logic are included.

**Report vulnerabilities:** [Security Policy](../SECURITY.md)

---

**Status:** ✅ ACTIVE - Production V6 on mainnet
