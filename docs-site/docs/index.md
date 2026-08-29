---
title: Nexa Mainnet V6 solver documentation
description: Public integration map for Nexa Mainnet V6 discovery, signed routes, execution permits, standards, indexing, and verification.
---

# Nexa Mainnet V6 solver documentation

<div class="hero" markdown>

Integrate a solver with Nexa's public discovery surface, cryptographically
verified route Feed, and permit-gated execution path across Base, BNB Smart
Chain, and HyperEVM.

[Start the integration](quick-start.md){ .md-button .md-button--primary }
[Inspect the API](api.md){ .md-button }

</div>

!!! important "Know which layer is authoritative"
    The on-chain Registry and Router are authoritative for deployment identity
    and executable state. The signed Feed is authoritative for live published
    terms. An issued Execution Permit is authoritative for one fill. This site,
    search results, and external indexes are non-authoritative projections.

<div class="grid cards" markdown>

-   :material-radar: **Discover**

    Start from the stable well-known manifest, confirm Mainnet V6 is active,
    and follow its canonical endpoints.

    [Discovery workflow](solver-integration.md#1-discover-the-public-surface)

-   :material-shield-check: **Verify**

    Verify the Feed hash, signature, expected signer, validity window, release,
    and route state before using any terms.

    [Verification boundary](verification-security.md)

-   :material-key-chain: **Authorize**

    Build and sign the exact canonical permit-request message locally. Never
    treat route discovery as execution authorization.

    [Permit workflow](solver-integration.md#4-request-an-execution-permit)

-   :material-transit-connection-variant: **Execute**

    Submit one source-chain Router call. Nexa performs one destination-chain
    payout transaction after observing and confirming the source fill.

    [Exact 1+1 model](solver-integration.md#the-exact-11-invariant)

</div>

## Reference entry points

- [Solver discovery manifest](https://solver.vsnexa.com/.well-known/nexa-solver.json)
- [Passive on-chain fingerprint](https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json)
- [Standards manifest](https://solver.vsnexa.com/.well-known/nexa-standards.json)
- [OpenAPI 3.1 document](https://solver.vsnexa.com/openapi.json)
- [Solver discovery API](https://solver.vsnexa.com/api/v6/solver-discovery)
- [API reference](api.md)
- [SDKs](sdks.md)
- [Networks and contracts](networks-contracts.md)
- [ERC-7683 and OIF standards](standards.md)
- [Verification and security](verification-security.md)
- [Passive indexing](indexing.md)
- [Canonical GitHub repository](https://github.com/VihanA42425D/nexa-solver-integration)
- [Contact documentation support](contact.md)

**Discovery** &rarr; **Signed Feed** &rarr; **Route** &rarr; **Permit** &rarr; **Resolution** &rarr; **Execution**

## Integration sequence

```text
well-known discovery
  -> signed Feed (HTTP recovery or confirmed-set SSE)
  -> local Feed verification
  -> route and quote selection
  -> canonical permit-request signature
  -> issued Execution Permit
  -> optional off-chain preview / ERC-7683 resolution
  -> one Bot source transaction
  -> one Nexa destination transaction
```

Resolver and preview calls use `eth_call`. They do not add transactions. A
successful fill retains the exact total of two transactions.
