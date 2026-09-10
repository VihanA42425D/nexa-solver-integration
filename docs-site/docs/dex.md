---
title: Swap & Bridge
description: A practical guide to swapping and bridging with Nexa, exact payouts, wallet approvals, route availability, fees and transfer tracking.
---

# Swap & Bridge with Nexa

Move supported assets on the same network or between networks, directly from
your wallet. Nexa shows the exact amount you pay and receive before you sign.

[Open Swap & Bridge](https://dex.vsnexa.com/){ .md-button .md-button--primary }
[Building an integration?](aggregator-api.md){ .md-button }

<div class="grid cards" markdown>

-   :material-swap-horizontal: **Swap**

    Exchange supported tokens on the same network when a matching route is open.

-   :material-bridge: **Bridge**

    Transfer supported assets between networks. Review both the source and destination network before signing.

-   :material-shield-check: **Exact payout**

    No pool fees. No DEX fees. No slippage on a valid Nexa quote: the signed input and output amounts cannot be silently changed.

</div>

!!! info "Network gas still applies"

    You pay your wallet's source-network gas for approvals and execution. The absence of a separate pool or DEX fee does not mean a free transfer or a 1:1 exchange rate. Nexa's economics are already reflected in the quoted payout. External aggregators may charge their own fees outside Nexa's signed amounts.

## Make your first transfer

1. **Connect your wallet.** Nexa never asks for your private key or seed phrase.
2. **Choose what to send.** Select the source network, token and amount. Your source balance appears when your wallet is on that network.
3. **Choose what to receive.** Select the destination network and token. Only currently open public route combinations can be used. The reverse-direction button is available only when that reverse route is open.
4. **Get a quote.** Review the exact input, output, networks, expiry and available completion estimate. The destination is your connected wallet address.
5. **Switch network if prompted.** Transactions are submitted on the source network.
6. **Sign the permit request.** This message binds the displayed quote to your wallet and recipient. It is not a request for custody of your funds.
7. **Approve the token if needed.** An ERC20 approval authorizes only the canonical router and required amount. Some tokens require a separate allowance reset. Native assets do not require ERC20 approval.
8. **Review and execute.** Check the wallet's network-cost estimate and the quoted payout, then confirm the source transaction.
9. **Track completion.** The source transaction being mined is not the same as a completed destination payout. Follow the execution progress and Recent transactions until the transfer is marked completed.

## Networks and assets

Availability comes from Nexa's current public route publication, not a fixed list in this guide. Selectors show supported metadata; unavailable assets are disabled. A supported network does not mean every token pair or amount is executable at this moment.

Use the selectors in [Swap & Bridge](https://dex.vsnexa.com/) for current user-facing availability. Developers can read the [chains and tokens API](aggregator-api.md#chains-and-tokens). Historical contract references remain in [Networks & contracts](networks-contracts.md).

## How much can I send?

The **Published quote limit** beneath your input shows the current route's maximum source-token amount and publication cycle. **Use limit** fills that amount for review; it does not submit a transfer. The minimum input is shown too.

If several routes serve the same pair, the headline is the largest **single-route** limit. Expand the route list for each route's input range; capacities are never added together. The quoted result identifies the route actually selected.

Limits refresh with publication. A lower limit or closed route blocks an
out-of-range quote without silently changing your amount. This is a published
input limit, not reserved liquidity or your wallet balance; current quote
validation may still decline the requested amount.

## Quote validity and live publication

A closed route or changed publication cycle invalidates the old quote. When a
route becomes available again, obtain and review a new quote before signing.

The countdown uses the returned `expiresAt`: the earliest applicable route,
Feed or exact-pricing deadline. It is not an independent fixed 45-second quote
timer. If current availability cannot be confirmed, execution remains disabled
until fresh data is available.

!!! warning "A quote is not a reservation"

    Capacity, expiry and route state are rechecked before execution. No slippage means an accepted valid quote executes its signed payout, not that an expired quote is guaranteed to execute. A refreshed quote may have a different payout. Review it and sign again; Nexa does not silently replace signed terms.

## If something changes

| What you see | What to do |
| --- | --- |
| Route unavailable | Choose another open pair or wait for the next publication. |
| Publication temporarily unavailable | Wait for reconnection; this is an availability problem, not proof of an economic rejection. |
| Quote expired or changed | Obtain a fresh quote and review its payout. |
| Wrong wallet network | Switch to the selected source network. |
| Insufficient balance | Check both token balance and native gas balance. |
| Source transaction pending | Track the existing transfer; do not resubmit it. |
| Failed or attention required | Inspect the source/payout transaction details and [contact support](contact.md). Never share a seed phrase. |

## Recent transactions

The table shows transfers for the connected wallet, their states and transaction hashes. Closing new route publication does not stop tracking an already submitted transfer. Locally remembered submissions can appear before the backend observes them; only settlement evidence marks a payout completed.

[Aggregator API guide](aggregator-api.md) · [Verification & security](verification-security.md)
