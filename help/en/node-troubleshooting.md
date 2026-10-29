---
keywords: [node not syncing, node stuck, no peers, addnode, fork, reindex, corrupted database, sql request timeout, out of memory, OOM, staking not working]
---

# Node troubleshooting

What to do if the node can't find peers, is stuck at one block, crashes or doesn't stake.

## First

1. Look at the end of the log: `tail -n 100 ~/.pocketcoin/debug.log`, in Docker also `docker logs --tail 100 pocketnet.core`. Lines with `ERROR` usually name the cause.
2. Check the version — `pocketcoin-cli getnodeinfo` — and compare it with the latest one on the [releases page](https://github.com/pocketnetteam/pocketnet.core/releases). An old version is a frequent cause of almost everything below.
3. Check disk space — `df -h` — and memory — `free -h`.

## No peers

`pocketcoin-cli getconnectioncount` shows 0 or 1–2, and the height doesn't grow or grows in jerks. Normal is 10–12 peers or more.

- Check that the server can reach the internet and that outbound connections to port 37070 aren't blocked by a firewall.
- Add a few live nodes to `pocketcoin.conf`: `addnode=<address>`. Three addresses are in the official sample [pocketcoin.conf.example](https://snapshot.pocketnet.app/pocketcoin.conf.example); more can be taken from the Bastyon app: [blockchain explorer](explorer.md) → the **“Network”** tab → **“Build the network map”**, then the **“Accept connections”** filter in the **“All nodes”** table. Restart the node.
- If the node works over Tor (`onlynet=onion`), it'll have few peers: make sure Tor is running.

## The height doesn't grow

There are peers, but the block stays the same.

- **An old version after a rule change.** If the network has passed the activation height of a new PIP, an old node gets stuck or drifts onto its own branch. Upgrade, see [Network rules and upgrades](blockchain-rules.md).
- **The node is on a wrong branch.** `pocketcoin-cli getchaintips` shows the branches the node knows; the main one has the status `active`. If the active branch is lower than the network and the log shows block validation errors, find the block hash at that height in the [blockchain explorer](explorer.md) and compare. If they differ, `pocketcoin-cli invalidateblock <your block's hash>` rolls the node back off the wrong branch, then run `reconsiderblock` with the same hash. Another way to roll back is to start the node once with `-disconnectlast=<height>`: it rolls the chain back to that height and then goes through the blocks above it again. A log with `-debug=consensus` shows the details of validation. If that doesn't help — the snapshot.
- **Old-version peers confuse the node.** Turn on `disconnectold=1`: the node will disconnect from nodes stuck on an old branch.
- **A bug in the node at a specific block.** That's what happened on 28 April 2026, when all nodes of one version crashed. Only a fixed version helps then: watch the releases.

## The node lags and catches up slowly

The height grows, but slower than the network, or after a restart the node takes hours to catch up.

- **A slow disk.** The node needs an SSD, preferably NVMe: on a regular hard drive the social database can't keep up with the network. Check disk load with `iostat -x 5` — if `%util` is close to 100, the disk is the problem.
- **Not enough memory.** If the system starts swapping, everything slows down many times over. Add memory or lower `dbcache`.
- **A server with “stolen” CPU.** On cheap virtual servers neighbours on the same hardware take CPU time away: in `top` that's the `st` column. If it's above 10–20%, change the plan or the host.

Hardware requirements are in [A server for the node](node-server.md).

## The node crashes

- **Out of memory.** `dmesg -T | grep -i -E 'killed process|out of memory'` — if `pocketcoind` is there, the system killed it for lack of memory. Add memory or swap of at least 4 GB, lower `dbcache`.
- **Out of disk space.** With zero free space the node stops by itself and may corrupt the database. Free up space; if the node doesn't start afterwards — the snapshot.
- **Too many open files.** `Too many open files` in the log — raise the limit: `LimitNOFILE=65536` in the systemd service or `ulimits` in Docker.
- **Unsuitable file system.** The error `Failed apply journal_mode = wal` means the social database can't run in WAL mode on this disk. That happens on network drives and some file systems; keep the data on a local disk with ext4 or XFS.
- **Windows: a file system error or “file in use”.** Add the data folder to the Windows Defender exclusions.
- **The crash reason isn't visible.** Under systemd run the node with `Type=simple` and `StandardError=journal`: then the crash message ends up in `journalctl -u pocketcoind` instead of getting lost.

## The database is corrupted

After a power cut or a hard reboot the node logs `Corrupted block database detected`, `database disk image is malformed` or doesn't start at all.

The fastest fix is to restore the [snapshot](node-sync.md) again, keeping the wallet. That's a few hours, while a full rebuild with `-reindex` takes several days.

<details>
<summary>Partial rebuild</summary>

If only the social database is damaged and the blocks are fine, you can rebuild part of it by starting the node once with an option:

- `-reindex=5` — only the search part (`web.sqlite3`), the fastest;
- `-reindex=4` — the social database indexes;
- `-reindex=3` — the whole social database anew from the blocks;
- `-reindex=2` — only the chain;
- `-reindex=1` or `-reindex` — everything.

After the rebuild remove the option, or it will start again on the next launch. Rebuilding the social database takes long too — the snapshot is often faster anyway.

</details>

## Staking doesn't work

`getstakinginfo` shows `staking: false`. The causes, from the most frequent:

1. the wallet is locked after a restart — `walletpassphrase`;
2. the node is still syncing or has no peers;
3. the coins arrived less than an hour ago or are immature rewards;
4. staking is off in the settings (`staking=0`) or the wallet is disabled (`disablewallet=1`).

More in [Staking on your node](node-staking.md#checking-staking).

## A block was produced, but there is no reward

Sometimes the log shows that the node produced a block, but the wallet has no reward, or the wallet's transaction list marks a stake as `abandoned` or `not in memory pool`. That means someone else produced a block almost at the same time, and the network chose theirs. If the balance hasn't dropped, nothing needs doing; since version 0.22.17 the node cancels such stakes itself. It's normal if it happens rarely. If often:

- the server clock is off — `timedatectl`;
- the node has few peers or a slow connection, and its block reaches the network later than the other one;
- the node lags and builds blocks on an old tip;
- the social database was damaged by a hard shutdown, and the node assembles blocks the network rejects — then only the [snapshot](node-sync.md) helps.

## The CPU at 100% once an hour

With the public API on, every 60 blocks the node recalculates account statistics and keeps one core fully busy for a few minutes; the RPC answers slower meanwhile. That's normal operation, not a fault. If the node only stakes, turn the public API off — `api=0`.

## Public node: sql request timeout

Users and proxies get `sql request timeout` — heavy database queries don't fit into the allotted time. Usually the disk or the CPU can't cope with the flow of requests. A faster disk, more memory for the file system cache and more threads (`rpcpublicthreads`) help. Raise `sqltimeout` carefully: requests will pile up even more.

## Nothing helped

Ask in the [pocketnet.core issues](https://github.com/pocketnetteam/pocketnet.core/issues): include the node version, the system, the end of `debug.log` and what you have already tried. Remove passwords and keys from the log and settings.

## See also

- [Node maintenance](node-maintenance.md)
- [First sync and the snapshot](node-sync.md)
- [Tips from node operators](node-tips.md)
