---
title: Use Nexa
description: Swap with Nexa, integrate the public Aggregator API, or build directly on the solver interface.
---

# Use Nexa

Choose the public surface that matches what you are building.

<div class="grid cards" markdown>

-   :material-swap-horizontal: **Nexa DEX**

    Connect a wallet, request a current quote, review the exact terms, and
    complete a supported transfer from a responsive web interface.

    [Open Nexa DEX](https://dex.vsnexa.com){ .md-button .md-button--primary }

-   :material-api: **Aggregator API**

    Add Nexa quotes and execution flows to a wallet, router, or application
    through a concise public API.

    [Open the API](https://api.vsnexa.com){ .md-button }
    [Read its OpenAPI](https://api.vsnexa.com/openapi.json){ .md-button }

-   :material-transit-connection-variant: **Solver API**

    Discover signed routes, verify published terms, request an execution
    permit, and track fill status through the V6 solver interface.

    [Integrate a solver](solver-integration.md){ .md-button }

</div>

## Aggregator API entry points

| Resource | URL |
| --- | --- |
| Discovery | [`/.well-known/nexa-aggregator.json`](https://api.vsnexa.com/.well-known/nexa-aggregator.json) |
| OpenAPI | [`/openapi.json`](https://api.vsnexa.com/openapi.json) |
| Quote | `POST https://api.vsnexa.com/v1/quote` |
| Build | `POST https://api.vsnexa.com/v1/build` |
| Status | `GET https://api.vsnexa.com/v1/status` |
| Chains | `GET https://api.vsnexa.com/v1/chains` |
| Tokens | `GET https://api.vsnexa.com/v1/tokens` |
| Health | `GET https://api.vsnexa.com/v1/health` |

Use the published OpenAPI document as the field-level contract. Quotes expire;
applications should display the returned terms and obtain a fresh quote when
the validity window has passed.

## Direct web flow

The DEX guides a connected wallet through network selection, quote review,
token approval when required, execution, and status tracking. The wallet
remains in the user's control throughout the flow.

