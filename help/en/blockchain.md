---
keywords: [blockchain, Pocketnet, node, Pocketnet Core, pocketcoind, own server, staking, node operator]
---

# Blockchain and your own node

How the Pocketnet blockchain behind Bastyon works and how to run your own node: what server you need, how to install and configure it, earn block rewards and keep it in shape.

The Bastyon app works without a node of your own: it connects to the network's nodes by itself. This book is for those who want to understand what happens under the hood or to become part of the network themselves.

## How the blockchain works

- [How the blockchain works](blockchain-basics.md) — blocks, transactions, where posts are stored and how a node checks them.
- [Network rules and upgrades](blockchain-rules.md) — who changes the rules, what a PIP is and why a node has to be upgraded on time.
- [Staking and emission](staking.md) — who produces blocks, how much it pays and how many coins are in circulation.

## Your own node

- [Why run a node](node-why.md) — what it gives you and what it does not.
- [A server for the node](node-server.md) — CPU, memory, disk, network and where to get them.
- [Installing a node](node-install.md) — a package, Docker or Windows.
- [First sync and the snapshot](node-sync.md) — how to get the whole blockchain quickly.
- [Configuring pocketcoin.conf](node-config.md) — ports, access and the settings worth knowing.
- [Staking on your node](node-staking.md) — the wallet, backups, rewards.
- [A public node for Bastyon](node-public.md) — how to make the node serve users.
- [Node maintenance](node-maintenance.md) — upgrades, backups, monitoring.
- [Node troubleshooting](node-troubleshooting.md) — the node does not sync, is stuck or does not stake.
- [Tips from node operators](node-tips.md) — what you only learn in practice.

> [!NOTE]
> The figures in these articles — block height, blockchain size, stake weight — were taken at the end of October 2026. The network grows, so check them against the [blockchain explorer](explorer.md) and the [pocketnet.core releases page](https://github.com/pocketnetteam/pocketnet.core/releases).

## Official documentation

The Bastyon team has its own node guide — the [Full Node Guide](https://docs.bastyon.com/guide/full-node/) on docs.bastyon.com — and the source code and releases are in the [pocketnet.core](https://github.com/pocketnetteam/pocketnet.core) repository. The articles in this book were checked against the node's code and node operators' experience from GitHub discussions and are more precise in places: where the documentation is outdated, they say so.

## See also

- [How the network works](how-bastyon-works.md)
- [Network and nodes](network.md)
- [Blockchain explorer](explorer.md)
