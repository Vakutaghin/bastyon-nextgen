---
keywords: [blockchain, block, transaction, UTXO, OP_RETURN, mempool, confirmation, fork, reorganization, Proof of Stake, Pocketnet Core, Bitcoin Core, pocketdb, SQLite]
---

# How the blockchain works

What the Pocketnet blockchain is made of, how posts and transfers end up in it and why what is recorded can't be quietly changed.

## In short

- Pocketnet is Bastyon's own [blockchain](glossary.md#blockchain). The first block was produced on 10 February 2019; the genesis block is dated 21 January 2019.
- The node software is Pocketnet Core (`pocketcoind`). It is built on Bitcoin Core, so money works the same way as in Bitcoin.
- Blocks are produced not by mining but by [staking](glossary.md#staking) (Proof of Stake): coin holders get the right to produce a block, and the more coins, the more often. There is no mining with GPUs and farms.
- A new [block](glossary.md#block) comes out about once a minute, around 1,440–1,500 blocks a day. At the end of October 2026 the height passed 4,080,000.
- The network's coin is [PKOIN](glossary.md#pkoin). At the end of October 2026 about 18.8 million had been issued.
- The blockchain holds not only money but the whole social network: profiles, posts, comments, ratings, subscriptions, reports.

## Blocks

A block is a batch of [transactions](glossary.md#transaction) with a header. The header contains the [hash](glossary.md#hash) of the previous block, so blocks are chained together. An old block can't be changed unnoticed: its hash would change, the following blocks would no longer point to it, and other nodes would not accept such a chain.

Each block starts with a coinstake transaction: with it, whoever produced the block proves their right to do so with their coins and collects the reward. How it works — see [Staking and emission](staking.md).

## Money: inputs and outputs

A Pocketnet balance is not stored as one number on an account but as a set of unspent “outputs” of past transactions — just like in Bitcoin (the UTXO model). Every transfer to you is a new output to your address.

When you send coins, the transaction takes your outputs whole as inputs and creates new ones: the amount for the recipient and the change back to you. The difference between inputs and outputs is the [fee](glossary.md#fee); it goes to whoever produces the block.

This matters for staking: the network looks at every output separately — how old it is and how many coins it holds. More in [Staking on your node](node-staking.md).

## How a post gets into the blockchain

A post, a comment, a rating, a subscription or a profile change is a transaction too. It works like this:

1. One of the transaction's outputs is a service record, `OP_RETURN`: the type of action (post, rating, subscription…) and a fingerprint of the content. This output holds no coins, only data.
2. The content itself — the text of the post, links, settings — travels next to the transaction as a separate “message”. Nodes pass it to each other along with the transaction.
3. Every node checks that the fingerprint of the content matches the `OP_RETURN` record and saves the content to its database.

That's why a post can't be swapped: a changed text won't match the fingerprint already in the block. Editing a post is a new transaction referring to the previous one, and all versions stay in the history.

| What | What exactly is recorded |
|---|---|
| Money | PKOIN transfers, block rewards |
| Account | profile: name, avatar, description, language, chat encryption keys, donation addresses; account deletion |
| Publications | posts, articles, video and audio (as a link to a PeerTube server), collections, deletions |
| Reactions | comments, post ratings from 1 to 5 stars, comment ratings |
| Relations | subscriptions, unsubscriptions, blocks |
| Moderation | reports and jury votes |
| Promotion | post [boosts](glossary.md#boost) |
| Other | the [mini app](glossary.md#mini-app) catalog, Barteron offers |

The blockchain doesn't hold chats (they are on [Matrix](glossary.md#matrix) servers), the videos and pictures themselves (on [PeerTube](glossary.md#peertube) servers) or your account keys — those are only on your device.

<details>
<summary>Where a node keeps its data</summary>

The node's data folder (on Linux, `~/.pocketcoin`) contains:

- `blocks/` — the blocks themselves;
- `chainstate/` — unspent outputs, that is, balances;
- `indexes/` — indexes the node uses to find transactions quickly;
- `pocketdb/` — the social network's SQLite database: `main.sqlite3` with posts, profiles, ratings and reputation and `web.sqlite3` with tags, the search index and statistics;
- `wallet.dat` or `wallets/` — the node's wallet, if there is one;
- `pocketcoin.conf` — settings, `debug.log` — the log.

Feeds, search, profiles, reputation and badge counting are built into the node itself: the network has no separate indexer. That's why a Pocketnet node is heavier than a plain Bitcoin node — it needs a fast disk, see [A server for the node](node-server.md).

</details>

## How a node checks an action

Every node checks every transaction by itself, trusting no one. The checks come in two layers.

**Money checks**, as in Bitcoin: the signature is valid, the coins belong to the sender and aren't spent twice, the fee is paid.

**Social network rules** — the so-called social consensus:

- only a registered account can act;
- every action has a daily limit that depends on the account status and [reputation](glossary.md#reputation) — see [Account status and limits](limits.md);
- a post can be edited for 43,200 blocks, about a month;
- if one account has blocked another, they can't comment on or rate each other;
- only experienced accounts can file reports, and a jury decides — see [Moderation and rules](moderation.md).

A node won't accept or relay a transaction that breaks a rule. The app then shows the reason right away — see [The network rejected an action](action-rejected.md).

## Mempool and confirmations

An accepted transaction first waits in the mempool — the node's queue for inclusion in a block. Nodes relay it to each other, and whoever produces the next block takes it from their mempool.

Once in a block, the transaction has its first [confirmation](glossary.md#confirmation), usually within a minute or two. Every following block adds another one. A block reward can be spent only after 100 confirmations, about an hour and a half.

## The network of nodes

Nodes connect to each other directly, with no central server, over port 37070. Each has a full copy of the blockchain. A new node finds its first peers through 22 addresses built into the program, and from then on nodes tell each other about others.

At the end of October 2026 about 135 nodes are visible from outside, roughly half of them in Russia. Nodes behind home routers can't be seen from outside, so there are actually more.

The Bastyon apps don't talk to nodes directly but to proxy servers (1.pocketnet.app, 2.pocketnet.app and others). The proxies spread requests over the community's public nodes, picking the ones that are faster and up to date. How to make the proxies use your node too — see [A public node for Bastyon](node-public.md).

## Forks and reorganizations

Sometimes two participants produce a block almost at the same time, and the chain splits for a minute. Nodes choose the branch with more stake behind it and drop the block from the other one. Its transactions return to the mempool and get into one of the next blocks. This is called a reorganization and happens by itself.

That's why for a large transfer it's worth waiting for several confirmations, not just one.

There is another kind of fork — when the network rules change and some nodes haven't upgraded. See [Network rules and upgrades](blockchain-rules.md).

<details>
<summary>How Pocketnet differs from Bitcoin</summary>

- **Blocks** are produced by staking, not mining; the first 1,020 blocks in February 2019 were mined.
- **The interval** is one minute, not ten.
- **The block reward** is 2.5 PKOIN since February 2023 and 1.25 PKOIN from block 4,200,000; it halves every 2,100,000 blocks, roughly every four years.
- **A transaction has its own time**, as in Peercoin and BlackCoin, on which Pocketnet staking is based.
- **Social network content** travels with transactions and is stored in every node's database.
- **Addresses** start with the letter P.

</details>

## See also

- [How the network works](how-bastyon-works.md)
- [Confirming actions](transactions.md)
- [Staking and emission](staking.md)
- [Network rules and upgrades](blockchain-rules.md)
