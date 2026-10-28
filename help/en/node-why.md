---
keywords: [own node, why a node, node operator, staking, public node, RPC, for developers]
---

# Why run a node

What your own Pocketnet node gives you, who needs one and what not to expect from it.

## What it gives you

- **Block rewards.** A node with coins in its wallet takes part in [staking](staking.md) and gets a reward for every block it produces. This is the main reason people run nodes.
- **A stronger network.** The more nodes there are and the more diverse they are — different people, providers, countries — the harder it is to stop or block the network. A public node also answers Bastyon users' requests, see [A public node for Bastyon](node-public.md).
- **Checking everything yourself.** The node verifies every block and every transaction by itself and relies on no one. Your transfers go to the network through your own node.
- **All network data at hand.** The node has an RPC — a query interface: feeds, profiles, comments, search, blocks and transactions. Handy if you build a [mini app](mini-apps-dev.md), a bot or analytics.

## What it doesn't give you

- **The Bastyon NextGen app can't be connected to your node.** The app works through the network's proxies, and its explorer pins only nodes from the built-in list, see [Network and nodes](network.md). Your node helps users only if it is public and the proxies have found it.
- **No special rights in the social network.** A node doesn't moderate, doesn't affect feeds and doesn't give an account reputation.
- **The node doesn't store videos or chats.** They are on [PeerTube](glossary.md#peertube) and [Matrix](glossary.md#matrix) servers, separate systems.
- **You can't entrust coins to someone else's node.** Pocketnet has no delegated staking: coins stake only while they sit in the wallet of the node that stakes them.

## Kinds of nodes

| Node | What for | What it takes |
|---|---|---|
| For staking | block rewards | a computer or server that runs around the clock; opening ports isn't required |
| Public | answers Bastyon users through the proxies and stakes | a server with a permanent public IP, open ports 37070, 38081, 8087 and their TLS variants, a faster disk and more memory |
| For development | your own queries to network data | usually local, next to your app |

The hardware requirements for each case are in [A server for the node](node-server.md).

## What you need to know

A node is installed and maintained from the command line. You need basic Linux (or Windows) skills, an idea of ports and firewalls, and readiness to upgrade the software every few months. If this is new to you, start with a staking node: it is the easiest to set up and the hardest to break.

## How much time it takes

- **Installation** — half an hour to an hour.
- **First sync** — from a few hours to a day with the [snapshot](node-sync.md): most of the time goes into downloading an archive of about 96 GB and the first start. From scratch, without the snapshot, several days.
- **After that** — upgrades as releases come out and an occasional look at whether blocks keep coming. A node left unattended for months is a common cause of lost rewards, see [Tips from node operators](node-tips.md).

## Where to start

1. Pick a server — [A server for the node](node-server.md).
2. Install the node — [Installing a node](node-install.md).
3. Load the blockchain from the snapshot — [First sync and the snapshot](node-sync.md).
4. Configure it — [Configuring pocketcoin.conf](node-config.md).
5. Transfer coins and turn on staking — [Staking on your node](node-staking.md).

## See also

- [Blockchain and your own node](blockchain.md)
- [Staking and emission](staking.md)
- [A public node for Bastyon](node-public.md)
