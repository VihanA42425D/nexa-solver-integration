# Frequently Asked Questions

## General

### What is Nexa V6?
Nexa V6 is a production-grade **cross-chain solver discovery and execution layer** for Web3. It enables:
- Decentralized solver discovery (via signed Feed)
- Cross-chain intent execution (ERC-7683 + native)
- Multi-language SDK support (TypeScript, Python, Rust, Go, Java, .NET)

### What problems does Nexa solve?
| Problem | Solution |
| --- | --- |
| How do I find solvers? | Fetch signed Feed from Nexa Discovery Facade |
| How do I execute across chains? | Submit intent via ERC-7683 Resolver or Nexa native |
| How do I know solvers are trustworthy? | Every route is cryptographically signed |
| How do I index solver activity? | The Graph Subgraph or Substreams |

### What chains does Nexa support?
- ✅ **Base** (Chain ID: 8453) - 108 active routes
- ✅ **BNB Smart Chain** (Chain ID: 56) - 126 active routes
- ✅ **HyperEVM** (Chain ID: 999) - 108 active routes

### Is Nexa an exchange, bridge, or aggregator?
No. Nexa is a **protocol layer** that:
- Discovers and lists solvers (does not execute trades itself)
- Standardizes intent format (does not custody assets)
- Provides cryptographic proof (does not hold keys)

---

## Integration

### How do I get started as a Developer?
1. **Choose your language:** TypeScript, Python, Rust, Go, Java, or .NET
2. **Install SDK:** `npm install nexa-v6-sdk` or equivalent
3. **Read example:** [examples/](../examples/README.md)
4. **Integrate:** Use SDK to fetch Feed and select routes

### How do I get started as a Solver Operator?
1. **Review onboarding:** [onboarding/nexa-v6-solver-operator.json](../onboarding/nexa-v6-solver-operator.json)
2. **Deploy resolver:** Implement ERC-7683 resolver pointing to Nexa Router
3. **Register route:** Add route to Nexa Registry via governance or partner channel
4. **Verify:** Monitor /api/v6/solver-feed for your route

### How do I get started as an Indexer?
1. **Use The Graph Subgraph (Base/BSC only):** Query Subgraph Studio
2. **Use Substreams (Base/BSC/HyperEVM):** Download from Substreams Registry
3. **Build indexes:** Store data in your analytics database
4. **Monitor events:** SourceFill events contain route_id, solver, output_amount

### Can I use Nexa with my wallet?
Yes! Ask your wallet provider (Rabby, MetaMask, etc.) to integrate Nexa. If they haven't:
- Export SDK and build a small client
- OR use web interface: https://solver.vsnexa.com/

---

## Technical

### What is the Discovery Facade?
A smart contract at `0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6` that:
- Exposes `discoveryURI()` → returns canonical discovery endpoint
- Can be queried on-chain or via HTTP
- Same address on Base, BNB Chain, HyperEVM

### What is the Signed Feed?
An HTTP response from `https://solver.vsnexa.com/api/v6/solver-feed` that contains:
- `routes[]` - Available solver routes
- `signedPayload` - Cryptographic commitment
- `feedSigner` - Public key for verification
- `feedSignature` - Proof of authenticity
- `dataVersion` - SSE stream ID for polling

**Never use unverified routes.** Always check signature.

### What is ERC-7683?
An Ethereum standard for **cross-chain intent execution** where:
- User broadcasts intent (what they want to trade/swap)
- Solvers compete to fulfill it
- Resolver translates intent → atomic on-chain call

Nexa provides an ERC-7683 resolver at `0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522`.

### What is OIF?
**Open Intent Framework** - a standard for intent discovery and execution. Nexa exposes:
- `DISCOVERY_DESCRIPTION_ONLY` mode (read-only listing)
- No active execution (OIFExecutionUnsupported)
- Used by intent frameworks to discover Nexa routes

### What's the difference between Nexa native and ERC-7683?
| Aspect | Nexa Native | ERC-7683 |
| --- | --- | --- |
| Flow | Permit → Signature → fillDirect() | Intent → resolve() → Call |
| Standards | Nexa-specific | ERC standard |
| Flexibility | Full route control | Standardized resolver |
| Best for | Direct integrations | Standard ecosystem |

Use both! They're complementary.

### Do I need to pay to use Nexa?
- **Discovery:** Free (public HTTP)
- **SDK:** Free (open source)
- **Execution:** Only gas fees for on-chain settlement
- **Indexing:** Free (Subgraph Studio + Substreams)

### Is there a testnet version?
Currently deployed on mainnet only (Base, BNB Chain, HyperEVM). Testnet versions may be available—check the [distribution ledger](../distribution/targets.json).

---

## Security

### How do I know routes are legitimate?
1. Fetch Feed from `https://solver.vsnexa.com/api/v6/solver-feed`
2. Verify `feedSignature` using published `feedSigner`
3. Check contract bytecode on Sourcify
4. Confirm solver address is in Registry

### What if a route fails?
- **On-chain failure:** Check transaction hash on chain explorer
- **Off-chain permit rejection:** Solver may have different parameters; try different route
- **Network partition:** Fetch fresh Feed and retry

### Can Nexa steal my funds?
**No.** Nexa cannot:
- Access user wallets (signatures stay client-side)
- Move assets without user approval
- Modify routes (cryptographically committed)

### What's in the security policy?
See [SECURITY.md](../SECURITY.md) for:
- Vulnerability disclosure process
- Bug bounty information (if applicable)
- Known limitations and trust boundaries

---

## Operations & Monitoring

### How do I monitor solver health?
```bash
# Get current Feed with active routes
curl https://solver.vsnexa.com/api/v6/solver-feed

# Check specific route details
curl https://solver.vsnexa.com/api/v6/routes/{routeId}

# Subscribe to Feed updates (SSE)
curl https://solver.vsnexa.com/api/v6/solver-feed/events
```

### How do I index historical data?
1. **The Graph Subgraph** (Base & BSC only)
   ```graphql
   query {
     fills(first: 100) { id solver route_id status }
   }
   ```

2. **Substreams** (Base, BSC, HyperEVM)
   ```bash
   substreams run https://path/to/spkg --network mainnet
   ```

### What's the SLA for Nexa?
Nexa exposes public smart contracts and HTTP endpoints. Service level terms depend on:
- Blockchain consensus (99.9%+ for Base/BSC/HyperEVM)
- HTTP service availability (monitored)
- Solver network decentralization (external)

Check status: [solver.vsnexa.com](https://solver.vsnexa.com)

### How do I report issues?
- **Bugs:** [GitHub Issues](https://github.com/VihanA42425D/nexa-solver-integration/issues)
- **Security:** [SECURITY.md](../SECURITY.md)
- **Questions:** Discussions (if enabled)

---

## Business & Distribution

### How does Nexa make money?
Nexa does not charge fees. Sustainability model includes:
- Integration with wallets, aggregators, and protocols
- Governance participation
- Potential protocol-level incentives (future)

### Can I integrate Nexa into my wallet?
**Yes!** See [distribution/targets.json](../distribution/targets.json) for:
- Integration status (READY, AWAITING_REVIEW, etc.)
- Onboarding process (RFC, KYB, partnership)
- Reference implementations

### Can I fork or modify Nexa?
Yes—license is ISC (permissive). However:
- Modified versions must disclose changes
- Contract addresses are canonical; forks won't integrate
- Consider contributing back instead of forking

### Is there a governance token?
Not in this repository. Check Nexa protocol documentation for governance details.

---

## Glossary

| Term | Definition |
| --- | --- |
| **Feed** | List of available solver routes; must be cryptographically verified |
| **Route** | Single solver's offering; specifies source chain, dest chain, liquidity, solver address |
| **Permit** | Signed instruction from user to execute a route (similar to ERC-2612 permit) |
| **Resolver** | Smart contract that translates ERC-7683 intents to Nexa Router calls |
| **Solver** | Off-chain agent that fulfills user intents across chains |
| **Intent** | User's desired outcome (e.g., "swap 1000 USDC for BUSD on another chain") |
| **Signature** | Cryptographic proof that Feed or Permit is authentic |
| **fillDirect** | Router method that executes a solver route |

---

## Need Help?

- **Documentation:** This site + [GitHub README](../README.md)
- **Code examples:** [examples/](../examples/README.md)
- **Issues:** [GitHub Issues](https://github.com/VihanA42425D/nexa-solver-integration/issues)
- **Direct questions:** (Check repository contact info or SECURITY.md)

---

**Last updated:** 2026-08-24 | **Status:** Production V6
