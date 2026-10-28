---
keywords: [pocketcoin.conf, node settings, ports, 37070, 37071, 38081, 8087, RPC, rpcauth, api, dbcache, sqltimeout, pocketcoin-cli]
---

# Configuring pocketcoin.conf

Where the node's settings file lives, which ports the node opens and which settings are worth knowing.

## Where the file is

The node's settings are a text file, `pocketcoin.conf`, in the data folder:

| System | Data folder |
|---|---|
| Linux | `~/.pocketcoin` |
| Windows | `%APPDATA%\Pocketcoin` |
| macOS | `~/Library/Application Support/Pocketcoin` |
| Docker | the folder you mounted to `/home/pocketcore/.pocketcoin` in the container |

The node doesn't create the file itself — create it. Each line is a command-line option without the dash: `-dbcache=2048` becomes `dbcache=2048` in the file. Lines starting with `#` are comments. After editing, restart the node.

A different data folder is set with `-datadir=<path>`. Then pass the same option to `pocketcoin-cli` as well.

## Ports

| Port | What it is | Open to the outside |
|---|---|---|
| 37070 | nodes talking to each other | yes, if you want inbound connections and a public node |
| 37071 | the control RPC: wallet, shutdown, all commands | **never** |
| 38081 | the public API — the Bastyon proxies query it | for a public node |
| 8087 | WebSocket: new blocks and transactions for the proxies | for a public node |
| 38881 | the public API over TLS | for a public node, preferably |
| 8887 | WebSocket over TLS | for a public node, preferably |
| 38082, 38083 | static resources and REST, usually off | no |

TLS on ports 38881 and 8887 uses a certificate the node creates itself, without domain validation. By default the Bastyon proxies use the plain ports 38081 and 8087, and in “TLS only” mode — 38881 and 8887.

> [!CAUTION]
> Port 37071 gives full access to the node and its wallet. Old guides sometimes suggest `rpcallowip=0.0.0.0/0` — never open it like that: the RPC password travels unencrypted, and guessing or intercepting it is a matter of time.

## A staking node

A node that only holds coins and produces blocks needs almost no settings: staking and the wallet are on by default.

```
# Accept pocketcoin-cli commands
server=1

# No public API: the node doesn't serve users
api=0

# More memory for the database cache — faster sync
dbcache=1024

# Disconnect old-version nodes stuck on their own branch
disconnectold=1
```

You don't need to set an RPC password: `pocketcoin-cli` on the same machine signs in with the `.cookie` file the node creates in its data folder on every start.

## A public node

The team publishes sample settings next to the snapshots — [pocketcoin.conf.example](https://snapshot.pocketnet.app/pocketcoin.conf.example). Its core:

```
server=1

# A few live nodes to start with
addnode=65.21.56.203
addnode=135.181.196.243
addnode=178.217.159.221

# Control only from this server
rpcbind=127.0.0.1
rpcallowip=127.0.0.1

# Threads and queues: few for control, many for the public API and incoming transactions
rpcthreads=2
rpcworkqueue=10
rpcpublicthreads=30
rpcpublicworkqueue=3000
rpcpostthreads=15
rpcpostworkqueue=1500

# Public API and WebSocket: the Bastyon proxies query them
api=1
publicrpcport=38081
wsport=8087

staking=1
disconnectold=1
logips=1
```

The port numbers here are the defaults, written out for clarity: don't change them, the proxies look for nodes only on the standard ports. If one of the `addnode` addresses stops answering, no harm done: the node finds peers by itself from there. The rest is in [A public node for Bastyon](node-public.md).

The sample also has `wsuse=1` — current node versions don't know this setting and skip it with a warning in the log.

## Settings worth knowing

**Network**

- `listen=0` — don't accept inbound connections from other nodes. The node still opens outbound ones.
- `maxconnections=<n>` — how many connections to other nodes to keep, 125 by default.
- `maxuploadtarget=<MiB>` — how much to serve to other nodes per day. Useful on plans with a traffic cap.
- `addnode=<address>` — connect to this node and learn about others from it. Helps when the node can't find peers.
- `externalip=<address>` — your public address, if the node can't detect it.
- `blocksonly=1` — receive only blocks, without relaying transactions; for the first sync, see [First sync and the snapshot](node-sync.md).
- `disconnectold=1` — disconnect from old-version nodes that drifted onto their own branch after a rule change. Off by default, on in the official sample.
- `proxy`, `onlynet`, `listenonion` — working over Tor; the node creates an onion address itself if Tor with an open control port runs next to it.

**Wallet and staking**

- `disablewallet=1` — no wallet. Then there is no staking either.
- `staking=0` — the wallet is there, but the node doesn't produce blocks.
- `stakingrequirespeers=0` — stake even without peers. Don't: with no peers the node would produce blocks nobody sees.

**RPC access**

- `rpcauth=<user>:<salt>$<hash>` — a login and password for controlling the node from another machine. The line is produced by the `share/rpcauth/rpcauth.py` script from the node repository. Safer than `rpcuser` and `rpcpassword`: the password isn't stored in the file in plain text.
- `rpcbind=<address>` and `rpcallowip=<address or subnet>` — which address the RPC listens on and which addresses it lets in. Local network or VPN only.

**Performance**

- `dbcache=<MiB>` — the block database cache, 450 by default. More means faster sync and block validation, at the cost of memory.
- `rpcthreads`, `rpcworkqueue` — threads and queue of the control RPC; `rpcpublicthreads`, `rpcpublicworkqueue` — of the public API; `rpcpostthreads`, `rpcpostworkqueue` — of incoming transactions. By default 4 threads and a queue of 16; incoming transactions get 2 threads. For a public node the official sample uses values many times higher.
- `rpccachesize=<MB>` — the cache of public API responses, 64 by default.
- `sqltimeout=<seconds>` — how long to wait for a heavy query to the social database, 10 by default. When time runs out, the client gets a `sql request timeout` error.
- `sqlcachesize=<MB>` — the SQLite cache per connection, 100 by default.

**Log**

- `logips=1` — write node addresses to the log.
- `debug=<category>` — a detailed log for a category, for example `debug=net`. The log grows fast; turn it on only for a while.

The full list is `pocketcoind -help`. The `share/examples/pocketcoin.conf` file in the node repository is an old template inherited from Bitcoin; better not rely on it.

## pocketcoin-cli commands

`pocketcoin-cli` sends commands to a running node. In Docker, run it through `docker exec`, for example `docker exec -it pocketnet.core pocketcoin-cli getblockchaininfo`.

| Command | What it shows |
|---|---|
| `getblockchaininfo` | the height, whether the first sync is still running (`initialblockdownload`), how much space blocks take (`size_on_disk`, without the social database) |
| `getnodeinfo` | the version, the last block, the network stake weight, the ports |
| `getconnectioncount`, `getpeerinfo` | how many peers and which |
| `getwalletinfo` | the wallet balance, including immature rewards |
| `getstakinginfo` | whether staking is running and how long to wait for a block |
| `getstakereport` | how much the wallet has staked over the last day, 7, 30 and 365 days |
| `stop` | shut the node down properly |
| `help <command>` | help on a command |

## See also

- [Installing a node](node-install.md)
- [A public node for Bastyon](node-public.md)
- [Staking on your node](node-staking.md)
