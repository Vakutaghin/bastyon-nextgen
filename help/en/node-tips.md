---
keywords: [operator tips, experience, staking, yield, operator mistakes, Node Owners, upgrades, monitoring, snapshot]
---

# Tips from node operators

What you only learn in practice: from GitHub discussions, node operators' experience and the node's own code.

## The most common ways to lose rewards

1. **The wallet is locked after a restart.** The node got upgraded or the server rebooted, the encrypted wallet is locked again, and staking silently stops. Check `getstakinginfo` after every restart, see [Staking on your node](node-staking.md).
2. **The node wasn't upgraded before a rule change.** Mandatory upgrades come out in advance, but the margin can be small: version 0.22.19 came out on 11 September 2025, ten days before block 3,480,000, after which versions up to and including 0.22.17 stopped working with the network. Subscribe to releases on GitHub.
3. **The node got stuck and nobody noticed.** You need at least some scheduled height check, see [Node maintenance](node-maintenance.md#monitoring). One operator polls `getnodeinfo` of every known node every 10 minutes; by those measurements, on 28 April 2026 the number of responding nodes fell from 69 to 11.

## Coins and staking

- **Don't merge outputs.** Each output stakes separately, and after a win only the winning one “freezes” for 100 blocks. If all coins are in one output, the whole stake idles for an hour and a half after every block. The node splits rewards by itself — an output of 10 PKOIN or more is split in half — and over time the wallet collects thousands of small outputs. That's normal and by design.
- **Top up in parts of 10,000 PKOIN or less.** The network won't count more than that per output anyway.
- **Withdraw only what you need.** A transfer from the node's wallet merges outputs into one and thereby slows down staking of the rest.
- **What it earns.** Operators reported about 30% a year in 2026: for example, 28,300 PKOIN brought about 700 PKOIN in 30 days. From January 2027 the block reward halves, and the income with it. Node settings don't affect income — only the amount staked and how much of the time the node is up.
- **Abandoned stakes are normal.** The log and the wallet sometimes show stakes marked “abandoned” or “not in memory pool”: someone else produced a block almost in the same second. If the balance hasn't dropped, nothing needs doing; since version 0.22.17 the node cancels such stakes itself. If there are suddenly many of them, see hard shutdowns below.

## Hardware and system

- **The disk is what matters.** Almost all complaints of “the node can't keep up” and “the node is slow” come down to the disk. NVMe with the data on it does more than extra cores.
- **Keep swap.** Heavy database upgrades need much more memory than usual, and without swap the node crashes in the middle of a rebuild.
- **100% CPU once an hour is normal.** With the public API on, every 60 blocks the node recalculates account statistics, and one core is fully busy for a few minutes. The RPC answers slower meanwhile.
- **Windows: add the data folder to the antivirus exclusions.** Otherwise Windows Defender keeps the database files open, and the node crashes with a file system error.
- **Debian 13.** There are reports that the 0.22.20 .deb package hangs after starting on Debian 13, while a node built from source works. If you run into it, try Docker.

## Hard shutdowns

The node takes several minutes to close its databases, and not for nothing: killed in the middle of a write, it can corrupt a database. Usually it gets away with it, but there are known cases where the social network's registration table got damaged, and the symptom wasn't obvious: the node began producing blocks the network rejected, and abandoned stakes piled up in the wallet. The cure is restoring the [snapshot](node-sync.md) again. Therefore:

- in Docker — `stop_grace_period: 10m`;
- in systemd — `TimeoutStopSec=600`;
- on your own computer — a UPS, if the node matters.

## The snapshot

- **Check the checksum.** There's a `sha256sum.txt` next to the archives — 96 GB over the network sometimes arrive with an error.
- **Compare the block hash after starting.** Once, in 2023, a snapshot turned out to hold a chain on a wrong branch. After syncing, compare the hash of the last block with the [blockchain explorer](explorer.md).
- **The first start is slow.** According to the developers, the database indexes aren't in the archive, and the node builds them itself — that can take hours. It isn't hanging.

## The network

- **10–12 peers is normal.** With one or two the node easily falls behind and drifts onto a wrong branch: add `addnode` with a few live nodes. Three addresses are in the official sample settings, [pocketcoin.conf.example](https://snapshot.pocketnet.app/pocketcoin.conf.example).
- **`disconnectold=1`** disconnects old-version nodes that are stuck on their own branch and confuse their peers. It's in the official sample settings.
- **To make new nodes know yours,** its address can be added to the list built into the program: the “Request to add an IP address to the source code” issue template in [pocketnet.core](https://github.com/pocketnetteam/pocketnet.core/issues) or a change to `contrib/seeds/nodes_main.txt`. It takes open ports 38081 and 8087 and round-the-clock operation.

## When the network stopped

On 28 April 2026 every node of version 0.22.20 crashed on the same block. What it taught:

- The fixed Docker image (`0.22.21`) came out at about 10:30 UTC, and the GitHub release at about 12:15. If you're on Docker, watch the Docker Hub tags too.
- Until the fix was out, some operators kept staking by turning the public API off (`api=0`) — they say that stopped the crashes.
- After installing 0.22.21 no database rebuild was needed — starting the new version was enough.
- A version number proves nothing by itself: the string “0.22.21” appeared on the network back in March, long before the fix.

## Where to ask

- The [pocketnet.core issues on GitHub](https://github.com/pocketnetteam/pocketnet.core/issues) — developers answer there, and it holds the history of almost every known problem.
- The official documentation — [docs.bastyon.com](https://docs.bastyon.com/guide/full-node/).
- Node operators talk in the Node Owners chat inside Bastyon itself. Who adds people to it is written in the official node documentation.

## See also

- [Node troubleshooting](node-troubleshooting.md)
- [Node maintenance](node-maintenance.md)
- [Staking on your node](node-staking.md)
