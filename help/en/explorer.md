---
keywords: [explorer, block, transaction, txid, address, peers, blockchain explorer]
---

# Block explorer

How to look at the network’s blocks, transactions and addresses right in the app, and what their fields mean.

## The explorer home

Open **“Explorer”** in the left panel — or [straight from here](bastyon://explorer). The explorer runs on the same nodes as the rest of the app and does not redirect you anywhere.

The home page shows:

- the latest block height, **“Emission”** — how many PKOIN are in circulation, **“Node version”**, and Net stake weight — how many coins everyone producing blocks holds in staking: the higher, the more secure the network;
- **“Latest blocks”**. The live mark means new blocks arrive by themselves; offline means the connection is being restored;
- **“Network activity”** — how many transactions there were over 48 hours or 30 days, by kind: content, ratings, subscriptions, accounts, moderation and other;
- **“Active addresses”** — the addresses that appeared most often in recent blocks.

## Search

In the **“Block hash, txid, address or height”** field, paste a transaction number, an address or a block number and press **“Open”**. Below it is **“Recently opened”**. You can also paste a transaction number or an address into the regular [search](search.md): it offers to open them in the explorer.

A transfer in the [transaction history](wallet-history.md) or in a [chat](pkoin-in-chat.md) also opens in the explorer, with the button next to it.

## Block, transaction, address

- **A block**: height, time, number of transactions, **“Confirmations”**, **“Block reward”** and who produced it — **“Staker (PoS)”**. The **“Previous”** and **“Next”** buttons move between blocks; below is **“Transactions in block”**.
- **A transaction**: number, type, block, confirmations, **“Fee”**, inputs and outputs — where the coins came from and went. If it is an action in Bastyon — a post, comment, rating, subscription, block or boost — a card below it shows the details, with links to the author and the post. For a transfer with a message, the message is shown too.
- **An address**: **“Balance”**, **“Last activity”**, the profile if it is an account address, and all of the address’s transactions.

The question mark next to a field explains what it means. **“Show raw JSON”** shows the data as the node returned it. **“Share”** gives a link to the block, transaction or address that opens even for someone without the app.

## Nodes and peers

**“All nodes and peers →”** on the home page opens **“Network nodes and peers”**:

- **“Public Pocketnet nodes”** — which of them are available now, with their block height and version;
- **“Peers of the connected node”** — which network nodes the app’s node is connected to.

## Choosing a node

**“Settings”** → **“Block Explorer”** tab → **“Preferred node”**. By default it is **“Auto (first live node)”**: the same node as the rest of the app. You can pin a specific node — then the explorer asks only that one, for example to compare what different nodes see. The rest of the app is not affected.

If the pinned node does not answer, the explorer says **“Node unavailable”** — press **“Reset node and retry”**.

## See also

- [Confirming actions](transactions.md)
- [Transaction history](wallet-history.md)
- [Network and nodes](network.md)
