---
keywords: [server requirements, node hardware, VPS, dedicated server, SSD, NVMe, memory, swap, CPU, x86-64, ARM, blockchain size]
---

# A server for the node

What hardware a Pocketnet node needs, how much space the blockchain takes and where to run it.

## What the developers say

| | Minimum | Recommended |
|---|---|---|
| CPU | 2 x86-64 cores | 4 x86-64 cores |
| Memory | 4 GB | 16 GB |
| Disk | 150 GB, SSD | 500 GB SSD |
| Internet | 10 Mbit/s | 100 Mbit/s, a public IP and open ports |

That's what the node's README says. The minimum is for a node that stakes and serves as your wallet; the recommendation is for a public node that answers Bastyon users. The [official documentation](https://docs.bastyon.com/guide/full-node/) recommends 12 GB of memory.

## What it takes in reality at the end of 2026

The README minimum was written when the blockchain was several times smaller. Now:

- **Disk.** The [snapshot](node-sync.md) archive alone weighs about 96 GB and grows by roughly 1.3 GB a month, and the unpacked data takes several times more; the team doesn't publish the exact size. During installation you need room for both the archive and the unpacked data, and then a margin for growth. 150 GB is no longer enough: take 500 GB or more.
- **Memory.** Upgrades that rebuild the database need much more of it than usual: during the move to version 0.22 a node ran out of 4 GB of memory plus 3 GB of swap. Operators in 2025–2026 run nodes on 16–32 GB.
- **CPU.** With the public API on (`api=1`, the default), every 60 blocks the node recalculates account statistics and keeps one core fully busy for a few minutes. On two cores everything else slows down noticeably meanwhile.

## What to get

| | Staking node | Public node |
|---|---|---|
| CPU | 2 cores, better 4 | 4 cores or more |
| Memory | 8 GB plus 8 GB of swap | 16–32 GB |
| Disk | SSD, 500 GB or more | NVMe, 500 GB or more, better 1 TB |
| Network | any stable connection, no public IP needed | 100 Mbit/s or more, a permanent public IP |
| System | Ubuntu 22.04 or 24.04, Debian 12 | the same |

These aren't the program's requirements but a margin that lets the node survive the blockchain's growth and heavy upgrades in the coming years.

## CPU: x86-64 only

Ready builds and the Docker image are only for 64-bit Intel and AMD processors. On ARM — Raspberry Pi, Ampere servers, Apple Silicon Macs — the node can only be built from source, and that isn't officially supported. An operator who tried to sync a node on an ARM board in 2026 got through less than half of the chain in three weeks.

## Disk

The node constantly reads and writes the social network's SQLite database, and disk speed matters more than anything else.

- **An SSD is a must in practice.** The developers have said the node works on a fast hard drive, but under load and during sync it becomes the bottleneck.
- **NVMe for a public node.** Every feed or search request means database access.
- **The file system: ext4 or XFS on a local disk.** The database runs in WAL mode, which doesn't work on network drives (NFS, SMB) and some other file systems: the node crashes with `Failed apply journal_mode = wal`.
- **Cheap VPS plans often cap disk speed** at a number of operations per second. If a node on such a server can't keep up with the network, that's usually why, see [Node troubleshooting](node-troubleshooting.md#the-node-lags-and-catches-up-slowly).

## Memory and swap

Swap saves the node from crashing at peaks — during the first sync, database rebuilds, upgrades. On Linux you can add it as a file:

```
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

The node shouldn't live in swap: if it goes there during normal work, there isn't enough memory.

## Network

- **A staking node** can sit behind a home router: outbound connections are enough, inbound ones aren't needed. Stability matters — while there's no connection, the node doesn't stake.
- **A public node** needs a permanent public IP address and open ports, see [A public node for Bastyon](node-public.md). Traffic runs to tens or hundreds of gigabytes a month: check your plan's limits.

## Your own computer, a VPS or a dedicated server

- **Your own computer** suits staking if it stays on around the clock and never sleeps. The downsides are power and internet outages, noise and electricity. A public node at home usually lacks a permanent IP.
- **A VPS** is the most common choice: a permanent address, round-the-clock operation, no hardware of your own. Look at the disk type (NVMe), guaranteed cores and the absence of disk speed caps. On the cheapest plans neighbours on the same hardware take CPU and disk away.
- **A dedicated server** is for a public node under load: all the hardware is yours, and the disk is fast.

Half of the network's nodes are in Russia, many with the same hosting providers. A node at another provider or in another country makes the network more resilient than one more node where everybody already is.

## See also

- [Installing a node](node-install.md)
- [First sync and the snapshot](node-sync.md)
- [A public node for Bastyon](node-public.md)
