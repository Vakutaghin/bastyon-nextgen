---
keywords: [staking, node wallet, wallet.dat, getnewaddress, encryptwallet, walletpassphrase, getstakinginfo, backup, split coins, listunspent]
---

# Staking on your node

How to put coins into the node's wallet, protect it, turn on staking and check that it runs.

## The node's wallet

A node has its own wallet, separate from your Bastyon account. The node creates it on the first start: a `wallet.dat` file in the data folder or a `wallets/` folder. Only coins in this wallet stake.

Get an address and transfer coins to it — for example from your Bastyon [wallet](wallet.md), as an ordinary [transfer](send-pkoin.md):

```
pocketcoin-cli getnewaddress "staking"
```

The coins start staking an hour after the transfer gets into a block.

> [!WARNING]
> Don't import your Bastyon account key into the node (`importprivkey`). Technically it works, but then the account key sits on the server: whoever breaks into the server gets both the coins and the account itself. A separate node address risks only what is on it.

## Backup

The node's wallet is keys. If the disk fails or the server is deleted, the coins are gone without a copy.

```
pocketcoin-cli backupwallet /path/to/copy/wallet-backup.dat
```

`backupwallet` makes a copy on the fly. Copy the `wallet.dat` file itself only while the node is stopped: a copy taken on the fly may come out corrupted.

Keep the copy off the server: on your computer, a USB stick, in an encrypted archive. The key of a single address can also go on paper: `pocketcoin-cli dumpprivkey <address>` prints it in WIF format.

Make a new copy after encrypting the wallet: encryption makes the node generate new keys, and the old copy doesn't know them.

## Whether to encrypt the wallet

This is a choice, and both options have a price.

**Without encryption** — that's what the official staking guide recommends. Staking resumes by itself after any restart, but whoever gets access to the server or to a copy of `wallet.dat` gets the coins too. Then keep copies only encrypted, and protect the server properly, see [Node maintenance](node-maintenance.md#security).

**With encryption** — the file and its copies are useless without the password:

```
pocketcoin-cli encryptwallet "<long password>"
```

But an encrypted wallet is locked, and a locked wallet doesn't stake. For staking to run, the wallet has to be unlocked — the password stays in the node's memory for the given time, in seconds:

```
pocketcoin-cli walletpassphrase "<password>" 100000000
```

100,000,000 seconds is the maximum, about three years. The Pocketnet node has no separate “unlock for staking only” mode: while the wallet is unlocked, anyone who gets to the node can also transfer the coins. So encryption protects mostly the file and its copies, not a running server.

> [!IMPORTANT]
> After every node restart — an upgrade, a server reboot, a crash — an encrypted wallet is locked again, and staking stops until you unlock it. This is the most common reason a node “suddenly stopped earning rewards”.

To keep the password out of the shell history, start the command with a space (in bash this works with `HISTCONTROL=ignorespace` or `ignoreboth`, usually the default) or enter it with `read -s`.

## Checking staking

```
pocketcoin-cli getstakinginfo
```

- `enabled: true` — staking is on in the settings;
- `staking: true` — the node is searching for a block right now;
- `weight` — how many of your coins take part, in satoshi (divide by 100,000,000);
- `netstakeweight` — the weight of the whole network;
- `expectedtime` — how many seconds to wait for a block on average.

If `staking: false` while `enabled: true`, the reason is one of these:

- the wallet is locked — `walletpassphrase`;
- the node is still syncing or has no peers — `getblockchaininfo`, `getconnectioncount`;
- the coins arrived less than an hour ago or are immature rewards — `getwalletinfo`, the `immature_balance` field;
- there are no coins in the wallet.

How much the node has staked so far is shown by `pocketcoin-cli getstakereport`: over the last day, 7, 30 and 365 days.

## Coins in parts

The network counts the weight of each output separately, and that matters twice.

- **An output weighs at most 10,000 PKOIN.** If the wallet holds one output of 50,000 PKOIN, staking sees only 10,000 — the rest sits idle.
- **After a win only the winning output freezes.** For 100 blocks, about an hour and a half, it doesn't stake. If all the coins are in one output, the whole stake idles after every block; if there are many outputs, only a small part does.

So top up the node's wallet with several transfers of 10,000 PKOIN or less. If a large amount has already arrived as one output, split it by sending it to yourself at several new addresses:

```
pocketcoin-cli sendmany "" '{"<address 1>": 10000, "<address 2>": 10000, "<address 3>": 10000}'
```

Get the addresses with `getnewaddress` and see the outputs with `listunspent`. The new outputs start staking in an hour.

From then on the node splits by itself: an output that reaches 10 PKOIN or more together with the reward is split in half, and outputs below 5 PKOIN are picked up into the next coinstake. Over time the wallet collects thousands of outputs of 5–10 PKOIN — that's by design. Don't merge them back: it only slows staking down.

> [!NOTE]
> Old guides mention a minimum of 50 PKOIN in the node's wallet. That's advice, not a rule: the network code has no minimum amount for staking. But with a couple dozen PKOIN a block will come once every few months.

## Withdrawing coins

```
pocketcoin-cli sendtoaddress <address> <amount>
```

If the wallet is encrypted, it must be unlocked. Coins that have just won a block can be transferred after 100 blocks. A transfer merges several outputs into one, so withdraw only what you need: the rest keeps staking as small outputs.

## See also

- [Staking and emission](staking.md)
- [Configuring pocketcoin.conf](node-config.md)
- [Node maintenance](node-maintenance.md)
- [Node troubleshooting](node-troubleshooting.md)
