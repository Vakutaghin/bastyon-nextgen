---
keywords: [network, node, proxy, connection, diagnostics, server, request path]
---

# Network and nodes

Which servers the app connects to, how it picks a node, and where to see the state of the connection.

## Public nodes

Everything you see and do in Bastyon — posts, profiles, ratings, the wallet — goes through the network’s [nodes](glossary.md#node). The app itself doesn't connect to nodes: it connects to the Bastyon proxies 1.pocketnet.app … 6.pocketnet.app, and a proxy passes each request to one of the nodes in its pool. At startup the app checks all proxies at once, takes the first live one in the list and works with it while it answers. If it stops answering, the app switches to another one by itself.

You cannot set your own node for the whole app: a node can be chosen only for the [blockchain explorer](explorer.md). You can, however, help the network with a node of your own — see [A public node for Bastyon](node-public.md).

Besides the nodes, the app talks to the [Matrix](glossary.md#matrix) chat servers, to the PeerTube [video](video.md) servers and, in the desktop app, to GitHub for [updates](updates.md).

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
