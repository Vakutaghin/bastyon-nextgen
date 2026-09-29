---
keywords: [no connection, server unavailable, not loading, node unavailable, offline, chat does not connect]
---

# No connection to the network

The feed does not load, the server is unavailable, the chat does not connect: what to check.

## The feed does not load

If no node answered, instead of the feed you see **“Server temporarily unavailable”** and a **“Refresh”** button. The app looks for a live node among the six public ones and switches to it by itself, so usually it is enough to wait and press **“Refresh”**. See [Network and nodes](network.md).

If nothing loads on any screen:

- check your internet — open any website;
- if [Tor](tor.md) is on, it may be the cause, see below;
- if you are on a VPN or a corporate network, it may block the nodes: they use port 8899, and live updates use 8099.

## Tor does not connect

While Tor is connecting, the app does not go online — nothing loads. If the connection is stuck at the same percentage, your provider is most likely blocking Tor. Open the Tor menu in the header, choose bridges — Snowflake or **“OBFS4 (built-in)”** — and press **“Apply”**. If that does not help, turn Tor off: the app reloads and works directly.

## The chat does not connect

A line above the chat list says what is going on:

- **“Connecting to the chat…”** and **“Catching up on messages…”** — all is well, wait;
- **“No connection to the chat server. Reconnecting…”** — the connection dropped; the app reconnects by itself as soon as it is back;
- **“No connection to the chat server.”** — the app cannot connect yet but keeps trying. Check your internet; if it works and the chat still does not connect, restart the app.

The chat list and the messages loaded before are visible even without a connection: they are kept on the device.

## The explorer

If a node is pinned in the [block explorer](explorer.md) and it does not answer, you see **“Node unavailable”**. Press **“Reset node and retry”** — the explorer goes back to the same node as the rest of the app.

## What to check in Diagnostics

**“Settings”** → **“Diagnostics”**:

- **“Online”** — “No” means the device has no internet at all;
- **“Handling node”** — which node the app is connected to; a dash means none;
- **“Last block time”** — if it lags far behind, the node has fallen behind the network, and fresh posts and transfers will show up late.

These lines come in handy if you write to the developers — see [Reporting a bug](report-bug.md).

## See also

- [Network and nodes](network.md)
- [Tor](tor.md)
- [Reporting a bug](report-bug.md)
