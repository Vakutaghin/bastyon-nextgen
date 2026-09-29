---
keywords: [network, node, proxy, connection, diagnostics, server]
---

# Network and nodes

Which servers the app connects to, how it picks a node, and where to see the state of the connection.

## Public nodes

Everything you see and do in Bastyon — posts, profiles, ratings, the wallet — goes through the network’s [nodes](glossary.md#node). The app connects to the public nodes 1.pocketnet.app … 6.pocketnet.app. At startup it checks them all at once, takes the first live one in the list and works with it while it answers. If it stops answering, the app switches to another one by itself.

You cannot set your own node for the whole app: a node can be chosen only for the [block explorer](explorer.md).

Besides the nodes, the app talks to the [Matrix](glossary.md#matrix) chat servers, to the PeerTube [video](video.md) servers and, in the desktop app, to GitHub for [updates](updates.md).

## What arrives instantly

The app keeps a permanent connection to the node. Through it, these arrive instantly:

- new blocks — the explorer shows a live mark;
- transactions involving your address: that is how your post or comment stops being “pending” as soon as the network confirms it, and new comments appear by themselves under your open post.

Everything else the app checks on its own: [notifications](notifications.md) every 30 seconds, new posts in the feed every minute and a half — and then a “Show new posts” button appears above the feed.

## Diagnostics

**“Settings”** → **“Diagnostics”** tab — what is going on with the app and the connection right now:

- **“Application”**: **“App version”**, **“Build”**, **“Platform”** and **“Updates”** — where you can also check for a new version;
- **“Connection”**: **“Online”** — whether the device has internet, **“Tor”** — its state, and **“Preferred node”** if you pinned a node for the explorer;
- **“Node”**: **“Handling node”**, **“Node version”**, **“Block height”** and **“Last block time”**.

A new block comes out about once a minute. If the last block time lags far behind, the node has fallen behind the network, and fresh posts and transfers will show up late. If there is no connection at all, see [No connection to the network](connection-problems.md).

## See also

- [Tor](tor.md)
- [Block explorer](explorer.md)
- [No connection to the network](connection-problems.md)
