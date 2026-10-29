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

While Tor is connecting, the app does not go online — nothing loads. If the connection is stuck at the same percentage, your provider is most likely blocking Tor. Open the Tor menu in the header, choose **“Automatic”** or other bridges — see [Tor](tor.md#bridges) — and press **“Apply”**. If that does not help, turn Tor off: the app reloads and works directly.

## The chat does not connect

In the messenger header, next to **“Messages”**, a spinner turns and a note says what is going on:

- **“Connecting…”** and **“Updating…”** — all is well, wait. “Updating…” means the list is already on screen, but it is from last time, and fresh messages and counters are still coming from the server;
- **“No connection, reconnecting…”** — the connection dropped; the app reconnects by itself as soon as it is back. If your internet works and the spinner keeps turning, restart the app.
- **“Sync error”** on a red bar — the reason follows the colon: “no connection to the chat server”, “the chat server did not answer in time”, “the chat server returned error” with its code, “Tor is not ready yet”. If the server dropped the sign-in (for example, you signed out on all devices), the app signs in again by itself. Below, in small print, is a technical note: send it to support if the error does not go away. **“Retry”** tries right away instead of waiting for the next attempt.

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
