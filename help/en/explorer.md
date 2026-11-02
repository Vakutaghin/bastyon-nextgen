---
keywords: [explorer, blockchain explorer, block, transaction, txid, address, statistics, charts, period, wallets, balances, large wallets, staking, emission, difficulty, new accounts, peers, node network, network map, nodes by country, proxy, thin client, thick client, full node, pruned node, diagnostics, on blockchain]
---

# Blockchain explorer

How to look at the network’s blocks, transactions, addresses and the whole node network right in the app, and what their fields mean.

## Overview

Open **“Blockchain explorer”** in the left panel — or [straight from here](bastyon://explorer). The explorer runs on the same nodes as the rest of the app and does not redirect you anywhere. It has four tabs:

- **“Overview”** — blocks and transactions;
- **“Statistics”** — network charts for the period you choose;
- **“Wallets”** — large wallets with their balances, and active addresses;
- **“Network”** — nodes, proxies and the network map.

The **“Overview”** tab shows:

- the latest block height, **“Emission”** — how many PKOIN are in circulation, **“Node version”**, and Net stake weight — how many coins everyone producing blocks holds in staking: the higher, the more secure the network;
- **“Network activity”** — how many transactions there were in the chosen period, by kind. The period is the same as on the [“Statistics”](#statistics) tab;
- **“Latest blocks”**. The live mark means new blocks arrive by themselves; offline means the connection is being restored.

## Statistics

Above the charts is the period: **“48 h”**, **“7 d”**, **“30 d”**, **“6 mo”**, **“1 year”**, **“2 years”**, **“3 years”**, **“All time”** or **“Custom”** — “from” and “to” dates. Next to it is the chart step: hours, days, weeks or months, only those that suit the period. Weeks and months show the daily average, so an incomplete week does not dip. The app remembers the period you chose.

- **“Network activity”** — transactions by kind: publications, comments, ratings, subscriptions, profiles, transfers and other (Barteron and post boosts).
- **“Publications by kind”** — posts, videos, articles, audio, streams and collections.
- **“Engagement”** — how many comments, post ratings and subscriptions there are per publication.
- **“PKOIN transfers”** — coin transfers between wallets, without staking rewards.
- **“New accounts”** — sign-ups by day and how many accounts the network has in total.
- **“When the network is active”** — how many transactions there were in each hour of the week, in your local time.
- **“PKOIN issued”** and **“Staking difficulty”** — from blocks picked evenly across the period. The higher the difficulty, the more coins are staking.

The legend items under a chart are toggles: a click hides a kind or brings it back, a double-click leaves only that kind. Hover over a chart to see the values of every kind at that point; on the keyboard, use the left and right arrows. **“Table”** shows the same numbers without the chart.

The node does not compute long periods in one go, so the app gathers them 10 days at a time — above the chart you can see how many parts have arrived, and the chart fills in as they come. A year takes about half a minute, **“All time”** a couple of minutes. Past days never change, and the app keeps them on the device: the second time, the same period opens at once. If a part did not arrive, **“Retry”** appears above the chart.

<details>
<summary>What the statistics do not include</summary>

The nodes do not count every kind of transaction: unsubscribes, blocks and moderation are not in their statistics. The node returns the current day only once it is over. By the hour it returns no more than the last 7 days, so the “hours” step exists only for short periods. Accounts are also counted only for the last 7 days — **“New accounts”** and **“When the network is active”** always show the last week.

</details>

## Wallets

**“Large wallets”** — wallets with their balances, largest first, with their share of all PKOIN issued. The green “staking” mark says how many of the last 100 blocks this wallet produced: in staking, the more coins a wallet has, the more often it gets a block. The **“active address”** mark means the address appeared often in recent blocks.

The network has no complete list of all wallets by balance: Pocketnet nodes cannot return addresses ordered by balance. So the list holds the wallets that produced the latest blocks and the most active addresses. Wallets that do not stake — exchanges and cold storage, for example — are not in it. You can look up the balance of any address with the explorer search.

The first time, the list takes about a minute to gather: the app asks about every block and every balance. Who produced a block never changes, and the app remembers it — next time only new blocks are checked.

Below is **“Active addresses”**: the addresses that appeared most often in recent blocks.

## Search

In the **“Block hash, txid, address or height”** field, paste a transaction number, an address or a block number and press **“Open”**. Below it is **“Recently opened”**. You can also paste a transaction number or an address into the regular [search](search.md): it offers to open them in the explorer.

A post, a comment, an account, an entry from the [transaction history](wallet-history.md) and a transfer in a [chat](pkoin-in-chat.md) can be viewed without leaving the page — see [“On blockchain”](#on-blockchain-without-leaving-the-feed).

## Block, transaction, address

- **A block**: height, time, number of transactions, **“Confirmations”**, **“Block reward”** and who produced it — **“Staker (PoS)”**. The **“Previous”** and **“Next”** buttons move between blocks; below is **“Transactions in block”**.
- **A transaction**: number, type, block, confirmations, **“Fee”**, inputs and outputs — where the coins came from and went. If it is an action in Bastyon — a post, comment, rating, subscription, block or boost — a card below it shows the details, with links to the author and the post. For a transfer with a message, the message is shown too.
- **An address**: **“Balance”**, **“Last activity”**, the profile if it is an account address, and all of the address’s transactions.

The question mark next to a field explains what it means. **“Show raw JSON”** shows the data as the node returned it. **“Share”** gives a link to the block, transaction or address that opens even for someone without the app.

## “On blockchain”: without leaving the feed

A post, a comment and a profile have an **“On blockchain”** item. It opens a window over the feed, chat or wallet: take a look, close it, and you are where you were.

- **A post** — the **“Share”** menu under the post. The author, when the post was published and in which block, the publication transaction and the edits — each edit is a transaction of its own — the language, tags, attachments, ratings, comments and reposts. Below: who rated it and how many stars, who boosted it and who sent coins with a comment under it.
- **A comment** — the **“Actions”** button with three dots. When it was written and edited, its transaction, how many coins went to the post author, votes and replies.
- **An account** — in the profile, under the address. Balance, reputation, when the account was registered and last changed its profile, posts, followers, blocks, whether chat keys are published, moderator flags, all-time earnings and recent transactions.
- **A transaction** — the same as in the explorer. Entries from the [transaction history](wallet-history.md), a transfer in a [chat](pkoin-in-chat.md) and an event from [notifications](notifications.md) open this way.

You can go further inside the window: from a post to an edit’s transaction, from there to an address. The arrow in the title takes you one step back. **“Open in the blockchain explorer”** at the bottom opens the same thing on an explorer page.

<details>
<summary>Why boosts and coins have no amounts</summary>

The app asks the node who rated, boosted and sent coins to a post in a single request. The node gets the boost and coin amounts in it wrong: anything above roughly 21 PKOIN comes out incorrect, and sometimes a person drops out of the list entirely. So the window shows only who it was.

</details>

## Network: the node map

The **“Network”** tab shows what the Bastyon network is made of right now: how many nodes there are, where they are, which versions they run and how they are connected to each other.

The network is surveyed only when you press **“Build the network map”**. Through the Bastyon proxies the app asks each node whom it is connected to, then asks its neighbors, until no new nodes turn up. That is about two hundred small requests and half a minute. Nodes don't see your address: the proxy asks them. The map is drawn as the survey goes, and **“Stop”** interrupts it.

The map is kept on the device: next time it shows right away, without requests to the network, with the time it was built above it. You can **“Update the map”** at most once a minute.

At the top are the key numbers: **“Nodes in the network”**, **“Accept connections”**, **“Countries”**, **“In sync”**, **“Latest version”** and **“Apps online”**. The question mark next to each explains what it means.

## The network diagram

Each dot is a node. In the **“Rings”** layout you are in the center, around you are the Bastyon proxies (gray ones don't respond), then the nodes that accept connections, and outside are the nodes behind a router: they connect to the network themselves, but nobody can connect to them. A dashed line from a proxy leads to the nodes in its pool: the proxy answers apps through them. **“Free”** lays the nodes out by their connections: you can see the core of nodes almost everyone is connected to.

**“Map”** puts the nodes on an OpenStreetMap world map — light or dark to match the app theme — each in its city, with lines for the connections between them. The app finds the city on the device using the DB-IP table: the first time it downloads the whole table (about 4 MB) and then reads it from the device, so node addresses never leave it. Until the table is there, or if the download fails, nodes sit in the middle of their country. Nodes with an IPv6 address don't go on the map — their number is shown at the bottom of the map. The base map comes from OpenFreeMap; with Tor, both it and the table go through Tor.

- Coloring: **“State”** — whether a node is in sync or behind, **“Type”**, **“Version”**, **“Country”** and **“Access”**. The legend above the diagram says how many nodes have each color.
- The legend is also a filter: untick a box and that group of nodes disappears from the diagram and the map, together with its connections. The same works for node connections, proxy pools and the running request dots.
- Dots running along the lines are the app’s requests right now: from you to a proxy and to the node that answered. When a new block comes out, the network’s nodes flash for a moment and its number appears at the top.
- Clicking a dot opens a card: the state, version, height, type, access, how many connections, since when the node has been online, whether its clock differs from its neighbors, which proxies have it in their pool and how many apps work through it.
- Drag the diagram and the map with the mouse; zoom with a pinch on the trackpad, Ctrl + wheel or the **“Zoom in”**, **“Zoom out”** and **“Fit to view”** buttons. On a phone, use two fingers: one finger scrolls the page. **“Full screen”** expands the diagram.

## Thick and thin clients

- **Nodes** are the “thick” clients: they store the blockchain and verify blocks. A **“Full node”** keeps the whole block history and serves it to new nodes. A **“Pruned node”** keeps only recent blocks: it can verify the network but can't sync a new node from scratch. How many of each there are is in the **“Network nodes”** block, together with sync and versions.
- Bastyon **apps** are the “thin” clients: they don't store the blockchain and work through a proxy. **“Apps online”** is how many of them hold a connection to the proxies right now. Where the apps themselves are can't be seen: the proxy doesn't reveal their addresses.

## Connection and proxies

The **“Connection and proxies”** block shows the path of your requests: **“Device”**, **“Proxy”**, the **“Node”** that prepared the last answer, and **“Network”**. The path updates with every answer. Below are all Bastyon proxies: whether they respond, how many apps are on each, how many requests per second and how many nodes it has in its pool. If two names lead to one server — as 1.pocketnet.app and 2.pocketnet.app do now — its apps aren't counted twice.

**“Proxy for the explorer”** — which proxy the explorer asks. By default it is **“Auto”**: the same one as the rest of the app. You can pin a specific one — then the explorer asks only that one, for example to compare what different proxies see. The rest of the app is not affected. If the pinned proxy does not answer, the explorer says **“Node unavailable”** — press **“Reset node and retry”**.

## Nodes by country and all nodes

**“Nodes by country”** — a map and a list of countries. Clicking a country highlights its nodes on the diagram and leaves only them in the table. The app looks up the country itself, in a built-in table from the regional IP address registries: node addresses aren't sent anywhere. The country is whoever the address block was issued to, so a server in a data center counts toward the data center’s country. IPv6 addresses have no known country.

**“All nodes”** — a table: address, country, version, type, state, access, number of connections, apps through the node and since when it has been online. Click a column header to sort; there is a search by address, country or version, and the **“Accept connections”** and **“In proxy pools”** filters. Clicking a row shows the node on the diagram.

## See also

- [Confirming actions](transactions.md)
- [Transaction history](wallet-history.md)
- [Network and nodes](network.md)
- [A public node for Bastyon](node-public.md)
