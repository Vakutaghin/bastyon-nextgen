---
keywords: [public node, proxy, open ports, 38081, 8087, 37070, ufw, port forwarding, public API, WebSocket]
---

# A public node for Bastyon

How to make your node answer Bastyon users: which ports to open, how the proxies find it and how to check that everything works.

## How the proxies find nodes

The Bastyon apps don't talk to nodes but to the network's proxy servers. The proxies know a few nodes from their code, and then every 30 seconds they ask the nodes they know whom those are connected to, and try each new peer:

- the public API — on port 38081, and proxies that require encryption on 38881;
- the WebSocket for events — on port 8087, with encryption on 8887.

A node that answers and knows a recent block gets on the list. From there the proxies spread users' requests over the fastest and least loaded nodes. A node that lags behind the network by more than 20 blocks or has drifted onto another branch isn't used. Old node versions are eventually dropped by the proxies altogether.

Hence the requirements:

- **A permanent public IP address**, or at least port forwarding on your home router. The address may change — the proxies will find the node again, but it takes time.
- **Open ports 37070, 38081 and 8087**, preferably also 38881 and 8887. The numbers are the standard ones: on other ports the proxies won't find the node.
- **A recent version** and a **synced** chain.
- **Good hardware.** A public node answers feeds, search and profiles — heavy database queries. See [A server for the node](node-server.md).

There is no separate reward for being public: it's a contribution to the network. A public node can stake just like any other.

## Setup

The public API and the WebSocket are on by default in `pocketcoin.conf` (`api=1`). Sample settings are in [Configuring pocketcoin.conf](node-config.md#a-public-node).

Open the ports in the firewall. For `ufw` on Ubuntu and Debian:

```
sudo ufw allow 37070/tcp
sudo ufw allow 38081/tcp
sudo ufw allow 38881/tcp
sudo ufw allow 8087/tcp
sudo ufw allow 8887/tcp
```

If your provider has its own firewall in the control panel, open the ports there too.

> [!CAUTION]
> Don't expose port 37071 — node and wallet control. In Docker publish it only on the local address: `127.0.0.1:37071:37071`, not `37071:37071` as in the example from the node's README. Docker bypasses `ufw` rules, so a published port is open to the whole internet even if `ufw` blocks it.

## Checking from outside

From another computer, not from the server itself, query the public API:

```
curl -X POST http://<your IP>:38081/public/ -H 'Content-Type: application/json' -d '{"method":"getnodeinfo","params":[]}'
```

The reply contains the node version and the last block (`lastblock`). The height should match the [blockchain explorer](explorer.md) or lag by a block or two. Check the WebSocket port with `nc -zv <your IP> 8087`.

No reply — check the server's and the provider's firewall, port forwarding on the router and that the node runs with `api=1`.

The same over TLS: `curl -k -X POST https://<your IP>:38881/public/ …` — the `-k` flag is needed because the node's certificate is its own, self-signed.

Whether the proxies find your node depends on whom it's connected to. Usually it takes from a few minutes to hours. The proxies won't take a node that isn't synced.

To make new nodes find yours too, you can ask for its address to be added to the list built into the program: the [pocketnet.core issues](https://github.com/pocketnetteam/pocketnet.core/issues) have a “Request to add an IP address to the source code” template. The node must run around the clock with 38081 and 8087 open.

## Load

- **Database queries.** Feeds, search and profiles are SQLite queries. When there are more of them than the node can handle, the log shows requests rejected because the queue is full, and users get `sql request timeout`. A fast NVMe disk, more memory and threads help: `rpcpublicthreads`, `rpcpublicworkqueue`.
- **Traffic.** Blocks and transactions for other nodes plus proxy responses add up to tens or hundreds of gigabytes a month. Keep your plan's limits in mind; serving to other nodes can be capped with `maxuploadtarget`.
- **CPU.** Every 60 blocks a node with the public API recalculates account statistics and keeps one core fully busy for a few minutes. That's normal, but on two cores everything answers slower meanwhile.
- **Connections.** A public node keeps many connections. Raise the system limit on open files — in Docker that's `ulimits: nofile: 65536`, as in the docker-compose example from the node's README.

## Worth knowing

- **Your IP address becomes known.** The proxies, neighbouring nodes and anyone who asks them will see it. Keep a public node on a separate server, not on a home computer with personal data.
- **Attacks.** A public port can be flooded with requests. If that happens, limit connections per address with the firewall or put nginx in front of the ports.
- **Tor.** Since version 0.22.19 the public API and the WebSocket can also be published as a Tor hidden service — then the node is reachable even if its IP is closed from outside.
- **Lag shows immediately.** A node that has fallen behind or crashed simply stops getting requests, and users won't notice. But if it drops out often, the proxies will pick it less.

<details>
<summary>How the proxies talk to a node</summary>

Public API requests are HTTP POST to `http://<address>:38081/public/` with a JSON-RPC body: `{"method": "<method>", "params": [...]}`. Users' transactions are sent by the proxies to `http://<address>:38081/post/`. Control and wallet methods aren't available on the public port — only on port 37071 with a password.

Over the WebSocket `ws://<address>:8087/ws` the proxies subscribe to new blocks and to events for users' addresses.

</details>

## See also

- [Configuring pocketcoin.conf](node-config.md)
- [A server for the node](node-server.md)
- [Node maintenance](node-maintenance.md)
- [Network and nodes](network.md)
