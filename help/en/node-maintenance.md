---
keywords: [node maintenance, node upgrade, systemd, autostart, stopping the node, backup, monitoring, time, NTP, debug.log, server security]
---

# Node maintenance

How to upgrade the node, stop it properly, keep an eye on it and not lose your coins.

## Upgrading

New versions come out on the [pocketnet.core releases page](https://github.com/pocketnetteam/pocketnet.core/releases), and Docker images are tagged with the version number on Docker Hub; an image sometimes appears an hour or two before the release. Mandatory upgrades — the ones that change the network rules from a certain block — must be installed before that block, or the node falls out of the network, see [Network rules and upgrades](blockchain-rules.md).

**The .deb package:**

```
pocketcoin-cli stop
sudo dpkg -i pocketnetcore_<version>_linux_x64_setup.deb
```

Wait until the node has stopped (the `pocketcoind` process is gone from `ps`) before installing the package. Then start the node the way you usually do.

**Docker Compose:**

```
docker compose pull
docker compose up -d
```

In `docker-compose.yml` it's better to name the version explicitly (`pocketnetteam/pocketnet.core:0.22.21`, not `latest`): you can see what is running, and an upgrade happens only when you change the number.

After upgrading:

- check the version — `pocketcoin-cli getnodeinfo`;
- unlock the wallet if it is encrypted, or staking stays stopped, see [Staking on your node](node-staking.md);
- make sure the height keeps growing.

## Stopping properly

The node writes to two databases at once — blocks and the social network. Killing it in the middle of a write — `kill -9`, a power cut, a hard server reset — can corrupt the database, and you'll have to restore the [snapshot](node-sync.md) again.

- Stop the node with `pocketcoin-cli stop` and wait: stopping can take several minutes.
- In Docker give the container time: `stop_grace_period: 10m` in `docker-compose.yml`, as in the example from the node's README. By default Docker waits 10 seconds and then kills the process.
- In systemd set `TimeoutStopSec=600`: by default systemd waits a minute and a half.

## Autostart

The node should come back by itself after a server reboot. In Docker that's `restart: on-failure` or `unless-stopped`. Without Docker — a systemd service, for example `/etc/systemd/system/pocketcoind.service`:

```
[Unit]
Description=Pocketnet Core
After=network-online.target
Wants=network-online.target

[Service]
User=pocketcoin
ExecStart=/usr/local/bin/pocketcoind -datadir=/home/pocketcoin/.pocketcoin
Restart=on-failure
TimeoutStopSec=600
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Check the path to `pocketcoind` with `which pocketcoind`. Then run `sudo systemctl enable --now pocketcoind`. A sample service with extra hardening is in the node repository: [contrib/init/pocketcoind.service](https://github.com/pocketnetteam/pocketnet.core/blob/master/contrib/init/pocketcoind.service).

## Backups

- **The wallet** — after creating it, after encrypting it and after importing keys: `pocketcoin-cli backupwallet <file>`. Copy the `wallet.dat` file itself only while the node is stopped. Keep the copy off the server.
- **Settings** — `pocketcoin.conf` and, if you have them, `docker-compose.yml` and the systemd service.
- **The blockchain itself** isn't worth copying: you can always get it from the snapshot or the network.

## Monitoring

A node that has quietly crashed or got stuck brings no rewards for weeks, and you find out last. Check at least once a day — better with a scheduled script:

- **Height.** `pocketcoin-cli getblockcount` should match the [blockchain explorer](explorer.md) or lag by a block or two.
- **Staking.** `pocketcoin-cli getstakinginfo` — `staking: true`.
- **Peers.** `pocketcoin-cli getconnectioncount` — above zero, ideally ten or more.
- **Disk.** `df -h` — the blockchain grows, and space runs out unnoticed.
- **Log.** `debug.log` in the data folder: when something is wrong, the answer is usually there.

A simple way is a cron script that compares your node's height with the network's and sends you a notification when the difference exceeds a dozen blocks. The network height is available, for example, from a Bastyon proxy:

```
curl -s -X POST https://1.pocketnet.app:8899/rpc/getnodeinfo -H 'Content-Type: application/json' -d '{"method":"getnodeinfo","parameters":[]}'
```

The height is in the `data.lastblock.height` field. If the proxy isn't reachable from your network, ask another public node, see [A public node for Bastyon](node-public.md#checking-from-outside).

## Time on the server

Blocks and transactions carry a time, and nodes reject blocks from the future. The server clock must be accurate: check `timedatectl` — the line `System clock synchronized: yes`. If not, turn on time sync (`systemd-timesyncd` or `chrony`).

## The log

`debug.log` keeps growing. On every start the node trims it to the last 10 MB unless a detailed log (`debug=…`) is on. If the node runs for months without a restart, watch the file size or set up logrotate: after rotating, send the node `SIGHUP` and it opens a new log file.

## Security

- Port 37071 is closed to the outside; you log in to the server with an SSH key, not a password.
- The node runs as a separate user, not root.
- The system gets updates; unneeded services are off.
- The node's wallet holds as much as staking needs. Keep the rest where the key isn't on a server.

## See also

- [Node troubleshooting](node-troubleshooting.md)
- [Staking on your node](node-staking.md)
- [Network rules and upgrades](blockchain-rules.md)
- [Tips from node operators](node-tips.md)
