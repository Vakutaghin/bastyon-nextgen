---
keywords: [snapshot, sync, snapshot.pocketnet.app, latest.tgz, first sync, blocksonly, initialblockdownload, blockchain download]
---

# First sync and the snapshot

How a new node gets the whole blockchain: from the snapshot in a few hours to a day, from scratch in several days.

## Two ways

- **From the [snapshot](glossary.md#snapshot).** The Bastyon team regularly publishes an archive with a ready blockchain and social database at [snapshot.pocketnet.app](https://snapshot.pocketnet.app). You download it, unpack it into the data folder, and the node fetches from the network only the blocks produced after the snapshot. It's fast, and it's what the node's README recommends.
- **From scratch.** The node downloads every block since 2019 from its peers, checks each one and builds the social database anew. It's slow — several days, and over a week on a slow disk — but you rely on no one. The official documentation recommends this way for the sake of decentralization.

<details>
<summary>How far the snapshot can be trusted</summary>

The team prepares the snapshot, and it contains history already checked by someone else. Your node will check the blocks that come after the snapshot by itself, but not the past. Faking a snapshot unnoticed is hard: the height and hash of the last block are easy to compare with the [blockchain explorer](explorer.md) and any other nodes, and a faked chain would part ways with the network at the very first new block. But mistakes happen: in 2023 one snapshot turned out to hold a chain on a wrong branch. So after starting, compare the hash of the last block, and if you need full independence, sync from scratch.

</details>

## From the snapshot

The server keeps the five latest snapshots, and a new one appears every 7–11 days. The file name is the block height at which the snapshot was taken, and `latest.tgz` is a copy of the newest one. At the end of October 2026 the archive weighs about 96 GB. You need free space for both the archive and the unpacked data, which is several times bigger, see [A server for the node](node-server.md).

1. Stop the node if it's already running: `pocketcoin-cli stop`, in Docker — `docker compose stop`.
2. If the data folder already has a wallet, copy `wallet.dat` or the `wallets/` folder and `pocketcoin.conf` somewhere safe.
3. Download the archive. `-c` lets you resume if the download breaks:

   ```
   wget -c https://snapshot.pocketnet.app/latest.tgz
   ```

   At 100 Mbit/s that's about two and a half hours, at 10 Mbit/s almost a day.

4. Check that the archive downloaded without errors:

   ```
   wget https://snapshot.pocketnet.app/sha256sum.txt
   sha256sum -c --ignore-missing sha256sum.txt
   ```

   You should see `latest.tgz: OK`. If not, resume or download it again.

5. Delete the old databases from the data folder — everything except the wallet and settings. The data folder is the one with `pocketcoin.conf`; in the examples it's `/home/pocketcoin/.pocketcoin`, as in [Installing a node](node-install.md):

   ```
   cd /home/pocketcoin/.pocketcoin
   sudo rm -rf blocks chainstate indexes pocketdb
   ```

6. Unpack the archive into the data folder — another few dozen minutes:

   ```
   sudo tar -xzf /path/to/latest.tgz -C /home/pocketcoin/.pocketcoin
   ```

7. Check the owner of the files: it must be the user the node runs as. For the package — `sudo chown -R pocketcoin:pocketcoin /home/pocketcoin/.pocketcoin`, for Docker — `sudo chown -R 1000:1000 <data folder>`.
8. Start the node. The first start is slow: the node builds the social database indexes, which aren't in the archive, and then catches up with the blocks produced after the snapshot. It can take several hours — meanwhile the log shows database messages; it isn't hanging.
9. Once the node has caught up with the network, compare the hash of the last block with the [blockchain explorer](explorer.md) and delete the archive.

On Windows the data folder is `%APPDATA%\Pocketcoin`, and any archiver that understands `.tgz`, for example 7-Zip, will unpack the archive.

> [!TIP]
> Download the 96 GB inside `screen` or `tmux`: if the SSH connection drops, the download keeps going.

## From scratch

The node syncs by itself from the first start. To make it faster and lighter on traffic, the node's README suggests starting it for the first sync with these options:

- `-listen=0` — don't serve blocks to others until it has caught up itself;
- `-blocksonly=1` — download only blocks, without relaying individual transactions;
- `-disablewallet=1` — no wallet.

You can also raise `dbcache`, for example to 4096, if there's enough memory.

> [!IMPORTANT]
> When the sync is over, remove these options: with them the node doesn't stake and doesn't help the network.

## How to tell the sync is over

```
pocketcoin-cli getblockchaininfo
```

- `initialblockdownload: false` — the first sync is over;
- `blocks` equals `headers` — the node has caught up with everything it knows about the network;
- the height matches the [blockchain explorer](explorer.md).

While the sync is running, the node doesn't stake, and the Bastyon proxies don't use it.

## See also

- [Installing a node](node-install.md)
- [A server for the node](node-server.md)
- [Node troubleshooting](node-troubleshooting.md)
