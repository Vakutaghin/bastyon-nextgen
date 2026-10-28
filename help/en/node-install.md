---
keywords: [node installation, pocketcoind, deb, Docker, docker-compose, Windows, pocketnetcore, release, Ubuntu, Debian]
---

# Installing a node

How to install Pocketnet Core: as a package on Linux, in Docker or with the installer on Windows.

The team's official guide is the [Full Node Guide](https://docs.bastyon.com/guide/full-node/) on docs.bastyon.com. This article covers the same ground, corrected for what has changed and for what operators stumble over.

## What to download

All versions are on the [pocketnet.core releases page](https://github.com/pocketnetteam/pocketnet.core/releases). Each release has:

| File | What it is |
|---|---|
| `pocketnetcore_<version>_linux_x64_setup.deb` | a package for Debian and Ubuntu: the node, `pocketcoin-cli` and the windowed wallet `pocketcoin-qt` |
| `pocketnetcore_<version>_linux_x64.tar.gz` | the same programs as an archive, for other distributions |
| `pocketnetcore_<version>_win_x64_setup.exe` | the Windows installer |
| `…_daemon.bin` | just the node, a single file — the old Bastyon app downloads these |

The builds are for 64-bit x86 processors only (Intel and AMD); on ARM — Raspberry Pi, Ampere servers — the node can only be built from source.

For macOS the latest ready build is 0.22.20, and it crashes at block 3,806,251, see [Network rules and upgrades](blockchain-rules.md#the-outage-of-28-april-2026). A 0.22.21 build for macOS was promised later. Until it appears, on a Mac the node is built from source or run in Docker; on an Apple Silicon Mac Docker runs the image in x86 emulation, which is too slow for permanent use.

## Linux: the .deb package

Works on Ubuntu 20.04 and later and Debian 11 and later: the program needs glibc 2.29. On Debian 13 there are reports that the node from the package hangs after starting; if you run into it, use Docker.

1. Create a separate user for the node — so it doesn't get extra rights:

   ```
   sudo adduser --disabled-password pocketcoin
   ```

2. Download the package from the releases page and install it:

   ```
   sudo dpkg -i pocketnetcore_*_linux_x64_setup.deb
   ```

   The programs go to `/usr/local/bin`: `pocketcoind` is the node, `pocketcoin-cli` sends commands to it, `pocketcoin-qt` is the windowed wallet.

3. Create the data folder as this user and the `pocketcoin.conf` settings in it, see [Configuring pocketcoin.conf](node-config.md):

   ```
   sudo -u pocketcoin mkdir -p /home/pocketcoin/.pocketcoin
   sudo -u pocketcoin nano /home/pocketcoin/.pocketcoin/pocketcoin.conf
   ```

4. Before starting the node, restore the [snapshot](node-sync.md) — otherwise it will sync from scratch for several days.
5. Start the node as a systemd service — an example is in [Node maintenance](node-maintenance.md#autostart) — or, to try it out, by hand:

   ```
   sudo -u pocketcoin pocketcoind -datadir=/home/pocketcoin/.pocketcoin -daemon
   ```

6. Check that it runs:

   ```
   sudo -u pocketcoin pocketcoin-cli -datadir=/home/pocketcoin/.pocketcoin getblockchaininfo
   ```

   While the node loads its database, it answers “Loading block index…” or “Verifying blocks…” — wait a few minutes.

## Docker

The official image is `pocketnetteam/pocketnet.core` on Docker Hub; every release has its own tag, for example `0.22.21`. Inside the container the node runs as the `pocketcore` user with UID 1000 and keeps its data in `/home/pocketcore/.pocketcoin`.

A sample `docker-compose.yml` based on the node's README:

```
services:
  pocketnet.core:
    container_name: pocketnet.core
    image: pocketnetteam/pocketnet.core:0.22.21
    restart: unless-stopped
    # Let the node close its databases calmly when stopping
    stop_grace_period: 10m
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
    volumes:
      - /srv/pocketcoin:/home/pocketcore/.pocketcoin
    ports:
      - 37070:37070
      # Node control — from this server only
      - 127.0.0.1:37071:37071
      # Public API and WebSocket, plain and TLS — for a public node
      - 38081:38081
      - 38881:38881
      - 8087:8087
      - 8887:8887
    logging:
      driver: local
      options:
        max-size: 10m
        max-file: "3"
```

The data folder on the host must be owned by UID 1000, or the node in the container can't write to it and stops with `Failed saving settings file`:

```
sudo mkdir -p /srv/pocketcoin
sudo chown -R 1000:1000 /srv/pocketcoin
```

Start it with `docker compose up -d`; send commands with `docker exec -it pocketnet.core pocketcoin-cli getblockchaininfo`.

> [!WARNING]
> The node's README publishes port 37071 as `37071:37071`. That opens it to the whole internet, and the `ufw` firewall won't stop it: Docker bypasses its rules. Publish it only on `127.0.0.1` or not at all — `docker exec` works without it.

Name the image version explicitly instead of `latest`: then an upgrade happens when you want it, see [Node maintenance](node-maintenance.md#upgrading).

## Windows

Run `pocketnetcore_<version>_win_x64_setup.exe` and go through the installer. Check the file's checksum against the one in the release: the team asks to download the node only from its GitHub page. On the first start the windowed wallet asks where to keep the blockchain; by default it's `%APPDATA%\Pocketcoin`. Put the [snapshot](node-sync.md) there before the first start.

Add the data folder to the Windows Defender exclusions: otherwise Defender keeps the database files open, and the node crashes with a file system error.

A Windows computer running a node must stay on around the clock and never sleep: turn sleep off in the power settings and set Windows Update not to restart the computer without asking.

## The old Bastyon app

The old Bastyon desktop app (Windows and Linux) has a “Node” section — the official documentation calls it Easy Node. The app downloads the node and the snapshot by itself, shows syncing and staking, and lets you deposit and withdraw coins. Pick a data folder on an SSD with a path in Latin letters only. It's the easiest way for a home computer, but the node runs only while the app is open. Bastyon NextGen has no such section.

## From source

Instructions for Linux, macOS and Windows are in the repository's [doc](https://github.com/pocketnetteam/pocketnet.core/tree/master/doc) folder: `build-unix.md`, `build-osx.md`, `build-windows.md`.

## See also

- [First sync and the snapshot](node-sync.md)
- [Configuring pocketcoin.conf](node-config.md)
- [Staking on your node](node-staking.md)
