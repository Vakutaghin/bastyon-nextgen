---
keywords: [Tor, anonymity, bridges, automatic bridges, obfs4, WebTunnel, Snowflake, meek, IP address, censorship]
---

# Tor

How to hide your IP address from nodes and chat servers: turn on Tor in the app, choose bridges, and understand what bypasses Tor.

## Turning it on

Tor exists only in the desktop app. Click the Tor icon in the header and flip the switch. The first time, the app explains what goes through Tor — press **“Enable”**.

The first time, Tor is downloaded — about 20 MB. The app takes it from its own mirror on GitHub or, if it is not there, from the Tor Project site, and checks it against the checksum built into the app. When a new app version ships a newer Tor, the previous one keeps working: the new one downloads through it in the background and takes over the next time you turn Tor on. Then Tor connects to its network — the menu shows how far along it is and through which bridges, and once done, **“Connected to the Tor network”**.

While Tor is connecting, the app waits and does not go online directly. If Tor cannot connect, requests are not sent at all: the app will not quietly bypass Tor. Tor, once on, also starts the next time you launch the app.

## Bridges

If your provider blocks Tor — as in Russia — bridges help to connect. In the Tor menu, under **“Bridges”**:

- **“Automatic”** — selected from the start. The Tor Project works out your country from your IP address and suggests bridges; the app tries them one by one — first the ones suggested for your country, then the built-in ones — and remembers the one that worked. In a country without blocking, Tor connects without bridges;
- **“No bridges”** — a normal connection;
- Snowflake — disguises Tor as a video call;
- **“obfs4 (built-in)”** — well-known bridges that come with Tor. Where Tor is blocked seriously, these are blocked first;
- **“meek (via CDN, slow)”** — disguises Tor as traffic to a large content delivery network. Slow, but gets through almost everywhere;
- **“Custom bridges”** — paste bridges one per line: obfs4, WebTunnel, Snowflake, or meek. The **“Get bridges”** button asks the Tor Project for fresh bridges for your country. The @GetBridgesBot Telegram bot and bridges.torproject.org also hand out bridges. Lines that do not look like a bridge are skipped, and the app tells you how many.

Press **“Apply”** — Tor restarts with the new bridges.

If the connection makes no progress for a long time, the menu warns that the method seems blocked — choose another one. If none of the methods worked in **“Automatic”** mode, press **“Retry”** or add your own bridges.

<details>
<summary>How automatic bridges work</summary>

The app asks Moat, the Tor Project service that hands out bridges. The Tor Project site is blocked in Russia, so the request goes through meek: the provider sees traffic to a content delivery network, while the encryption runs end to end to the Tor Project. Moat works out the country from the IP address the request came from — just as when Tor Browser requests bridges — and the menu shows it.

An attempt that makes no progress for a minute and a half gives way to the next one; meek, the slowest, gets four minutes. The app remembers the method that worked and tries it first next time, without asking Moat.

</details>

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
