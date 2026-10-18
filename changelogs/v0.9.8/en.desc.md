# v0.9.8 — Tor picks bridges by itself

Connecting through Tor on a computer is reworked: the app finds bridges that work in your country by itself, and on a Mac bridges finally start. The categories in the feed filter are now the same as in the previous Bastyon. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package).

## Tor

- **The “Automatic” mode.** The app asks Tor Project which bridges work in your country and tries them one by one: Snowflake, WebTunnel, obfs4, meek, and finally a connection without bridges. This request gets through even where the Tor Project site is blocked. If an attempt makes no progress for a long time, the app moves on to the next one, and it remembers the method that worked and starts with it next time. If you never picked bridges yourself, this mode turns on after the update. A mode you picked by hand stays.
- **Bridges on a Mac.** On macOS bridges didn’t start in any mode: a space in the path to the app folder broke them. Fixed.
- **Tor 15.0.25.** The app updates Tor the next time you turn it on. Before, Tor was never updated once downloaded. Tor now downloads from GitHub first, because the Tor Project site is blocked in Russia, and only then from torproject.org. Every archive is checked against a checksum built into the app.
- **Built-in bridges.** The built-in Snowflake and obfs4 are updated — the old settings were out of date. A built-in “meek (via CDN, slow)” is added: it is slow but gets through almost anywhere.
- **Custom bridges of any type.** “Custom bridges” now takes WebTunnel, obfs4, Snowflake and meek bridges, not only obfs4. The “Get bridges” button asks Tor Project for fresh bridges, with no captcha. Lines the app doesn’t recognise are skipped, and it shows how many.
- **You see what is going on.** The Tor menu shows which bridges the connection goes through, the attempt number and your country. If the connection is stuck, a hint appears, and after a failure there is a “Retry” button.
- **Chat over Tor.** The first chat connection through Tor could fail if the app hadn’t checked for updates yet. Fixed.

The help article “Tor” has the details.

## Feed

- **Categories as in the previous Bastyon.** The filter had 18 categories instead of 20: an extra “Space”, while “PKOIN/Peer-to-peer”, “COVID/Lockdowns” and “Bastyon/Pocketnet” were missing. Now the set, the order and the tags are the same as in the previous Bastyon, with tags of their own in each language. “Cryptocurrency”, “Nature/Animals” and a few more found only posts from 2021 — now they find recent ones. If you picked “Space”, it stays as a category of your own.

## Notifications

- **“Subscription with notifications”.** A regular free subscription with the bell on read “started a private subscription” and looked like a purchase. Now the notification says what it is: “subscribed to you with notifications on”. Paying for a paid subscription brings a separate “Subscription paid” notification.
- **Paid subscriptions charge nothing by themselves.** The help article “Paid subscriptions” now says it plainly: there is no auto-charge or auto-renewal. Those who followed you before you set a price stay free followers until they pay themselves.
