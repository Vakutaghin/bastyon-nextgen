---
keywords: [network, node, proxy, connection, diagnostics, server, request path, direct to nodes, network connection, blocking]
---

# Network and nodes

Which servers the app connects to, how it picks a node, and where to see the state of the connection.

## Public nodes

Everything you see and do in Bastyon — posts, profiles, ratings, the wallet — goes through the network’s [nodes](glossary.md#node). Usually the app connects not to nodes but to the Bastyon proxies 1.pocketnet.app … 6.pocketnet.app and pre.pocketnet.app, and a proxy passes each request to one of the nodes in its pool. At startup the app checks all proxies at once, takes the first live one in the list and works with it while it answers. If it stops answering, the app switches to another one by itself. If none answers, the desktop and Android apps connect to nodes directly, see [below](#proxy-or-direct-to-nodes).

You cannot set your own node for the whole app: a node can be chosen only for the [blockchain explorer](explorer.md). You can, however, help the network with a node of your own — see [A public node for Bastyon](node-public.md).

Besides the nodes, the app talks to the [Matrix](glossary.md#matrix) chat servers, to the PeerTube [video](video.md) servers and, in the desktop app, to GitHub for [updates](updates.md).

## Proxy or direct to nodes

In the desktop and Android apps, **“Settings”** → **“System”** → **“Network connection”** lets you choose how the app goes online:

- **“Auto”** (the default) — through a proxy, and if none answers, for example because they are blocked, directly to nodes. While the app works directly, it checks the proxies every three minutes, when the network changes and when you come back to the app, and switches back as soon as a proxy answers;
- **“Proxy”** — only through proxies;
- **“Direct to nodes”** — always to nodes.

Under the switch you can see how requests go right now and how many nodes are connected.

Directly, the app connects to nodes on their secure ports: 38881 for requests and 8887 for live updates. The connection is encrypted: your provider sees that you connected to a node but not what you read. Every node has its own certificate. The app remembers it on first contact, and if a different certificate later shows up at the same address, it stops using that node. The wallet balance and coins are cross-checked with two or three nodes.

Keep in mind:

- the node sees your IP address, while through a proxy only the proxy saw it;
- signing up a new account, post translation and link previews exist only on the proxy and do not work without it. Images and videos still upload: the app remembers the video servers;
- the browser has no direct connection, only the apps do;
- with [Tor](tor.md) on, the choice does not apply: everything goes through Tor to the proxies.

<details>
<summary>How the app picks nodes</summary>

The app ships with a list of nodes that have a secure port. It learns new nodes from the proxy while the proxy is reachable, and from the nodes themselves. Nodes are asked several at a time, and the choice ends when three agree. The app does not trust the block height of a single node: a node fits if it is no more than two blocks behind a height confirmed by at least two nodes and has the same block hash. Requests go to the fastest node, the rest are spares. Nodes are picked again every 10 minutes or when the working ones stop answering.

</details>

## What arrives instantly

The app keeps a permanent connection to the node. Through it, these arrive instantly:

- new blocks — the explorer shows a live mark;
- transactions involving your address: that is how your post or comment stops being “pending” as soon as the network confirms it, and new comments appear by themselves under your open post.

Everything else the app checks on its own: [notifications](notifications.md) every 30 seconds, new posts in the feed every minute and a half — and then a “Show new posts” button appears above the feed.

## Connection state

**“Blockchain explorer”** → the **“Network”** tab → **“Connection and proxies”** — what is going on with the connection right now:

- the request path: **“Device”** — whether there is internet and whether the connection goes through [Tor](tor.md), the **“Proxy”** the app works through, the **“Node”** that prepared the last answer, and how long it took. The path updates with every answer: the proxy picks a node for each request, so the node changes;
- which Bastyon proxies respond, how many apps are connected to them and how many nodes each has in its pool.

The map of the whole node network is there too, see [Blockchain explorer](explorer.md#network-the-node-map). The app version and the update check are in **“Settings”** → **“What's new”**.

A new block comes out about once a minute. If the last block in the explorer header is old, the node has fallen behind the network, and fresh posts and transfers will show up late. If there is no connection at all, see [No connection to the network](connection-problems.md).

## See also

- [Tor](tor.md)
- [Blockchain explorer](explorer.md)
- [No connection to the network](connection-problems.md)
- [Blockchain and your own node](blockchain.md)
