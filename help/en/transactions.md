---
keywords: [transaction, confirmation, hourglass, pending, rejected, fee, block]
---

# Confirming actions

Why a post, a comment or a rating does not appear right away, what the hourglass in the header means, and why the network may refuse an action.

## Every action is a transaction

A post, a comment, a rating, a subscription, a block, a report, a profile change and a transfer are all [transactions](glossary.md#transaction). The app signs them with your account's key and sends them to a node. The node checks the transaction against the network rules and passes it on to the others, and within a minute or two it lands in a [block](glossary.md#block) — the network produces a new block about once a minute.

Until the transaction is in a block, other people do not see it yet: the post does not appear in their feeds, and the rating is not added to the score.

## The hourglass in the header

The hourglass icon in the header opens the **“Awaiting confirmation”** list: posts, comments and ratings that are not on the blockchain yet. Each is marked **“Not on-chain yet”**. When there is nothing to wait for, the list says **“No active events”**.

- **A post** is visible to you at once in your profile feed, marked **“Not yet published to the blockchain”**. It cannot be rated or commented on yet. The **“Open post”** button in the list shows how it will look.
- **A comment** appears under the post marked **“Pending”**.
- **A rating** shows up as stars under the post straight away.

When the network confirms the action, the mark goes away by itself. If there is no confirmation within 10 minutes, the app stops waiting and removes it from the list. If the post never showed up in your profile, the network did not accept it: publish it again.

## If the network refused

A node checks every action against the network rules and may reject it. The app then shows the reason right away, for example:

- the daily limit of posts, ratings or comments is used up;
- too many actions in a row;
- you have already rated this post;
- you have blocked the author or they have blocked you;
- the text is too long.

What each reason means and what to do about it is covered in [The network rejected an action](action-rejected.md).

## If the node did not answer in time

If the connection dropped or the node did not answer, the app does not know whether the transaction got through. It may have reached the network. Before you retry — especially a transfer — wait a couple of minutes and check the history in your [wallet](wallet-history.md) or in the [block explorer](explorer.md). Otherwise the action may happen twice.

## Fees and balance

Social actions are almost free: the fee for a post, a comment or a rating is 0.00000001 PKOIN. But any transaction needs coins on the address: it spends them and immediately returns the change to your own address. New accounts get their first coins from the network when they sign up.

- **“No funds available for the transaction”** — there are no free coins on the address. Top up your [wallet](wallet.md).
- **“Wait until the network confirms your previous transaction, then try again.”** — the coins from your last action are still on their way. Wait a minute and try again.

Transfers have the same fee; you just choose who pays it when you send — see [Transfers and fees](send-pkoin.md).

## See also

- [The network rejected an action](action-rejected.md)
- [Account status and limits](limits.md)
- [Block explorer](explorer.md)
