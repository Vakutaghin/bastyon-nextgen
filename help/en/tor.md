---
keywords: [Tor, anonymity, bridges, obfs4, Snowflake, IP address, censorship]
---

# Tor

How to hide your IP address from nodes and chat servers: turn on Tor in the app, choose bridges, and understand what bypasses Tor.

## Turning it on

Tor exists only in the desktop app. Click the Tor icon in the header and flip the switch. The first time, the app explains what goes through Tor — press **“Enable”**.

The first time, Tor is downloaded — about 30 MB, from the official Tor Project site; the app checks its checksum. Then Tor connects to its network — the menu shows how far along it is, and once done, **“Connected to the Tor network”**.

While Tor is connecting, the app waits and does not go online directly. If Tor cannot connect, requests are not sent at all: the app will not quietly bypass Tor. Tor, once on, also starts the next time you launch the app.

## Bridges

If your provider blocks Tor, bridges help to connect. In the Tor menu, under **“Bridges”**:

- **“No bridges”** — a normal connection;
- Snowflake — disguises Tor as a video call and usually works where Tor is blocked;
- **“OBFS4 (built-in)”** — a built-in list of obfs4 bridges;
- **“Custom OBFS4”** — paste bridges you got, for example, at bridges.torproject.org, one per line.

Press **“Apply”** — Tor restarts with the new bridges.

## What goes through Tor

- requests to nodes — everything you read and publish, and the wallet;
- the chat;
- downloading the [voice input](voice-input.md) model.

## What bypasses Tor

The app’s windows themselves cannot be routed entirely through Tor on every system, so whatever they would load directly is blocked while Tor is on:

- **images** do not show by themselves: press **“Load through Tor”** on an image, and it loads through Tor;
- **videos** can be watched only directly: the app warns **“Video will bypass Tor”** — the PeerTube server will see your IP address — and plays the video after **“Watch bypassing Tor”**. Node requests and the chat stay in Tor;
- **YouTube and other embeds** and **mini apps** are turned off;
- **IPFS** does not work at all — see [Files and IPFS](ipfs.md).

## Turning it off

Flip the switch in the Tor menu off. The app reloads and goes online directly from then on.

## See also

- [Privacy: what others can see](privacy.md)
- [Images or videos do not show](media-problems.md)
- [Network and nodes](network.md)
