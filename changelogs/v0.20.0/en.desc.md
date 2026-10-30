# v0.20.0 — No VPN needed: directly to nodes

If your provider blocks the Bastyon proxies (as is now the case almost everywhere in Russia), the desktop and Android apps connect to the blockchain nodes directly, with no VPN. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Network connection

- **Direct to nodes.** Usually the app goes online through the Bastyon proxies. If none of them answers, it connects to the blockchain nodes by itself: the feed, profiles, comments, the wallet and notifications work as before. As soon as a proxy answers again, the app switches back to it.
- **A choice in the settings.** “Settings” → “System” → **“Network connection”**: **“Auto”** (the default), **“Proxy”** or **“Direct to nodes”**. Under the switch you can see how requests go right now and how many nodes are connected.
- **Encryption.** The connection to a node is encrypted. The app remembers a node’s certificate on first contact and stops using the node if the certificate later changes. The wallet balance is cross-checked with several nodes.
- **Keep in mind.** The node sees your IP address. Sign-up, post translation and link previews do not work without a proxy; images and videos still upload. The browser has no direct connection, and with Tor on everything goes through Tor as before.
- **One more proxy** — pre.pocketnet.app, reachable from Russia too.
