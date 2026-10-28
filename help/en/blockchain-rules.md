---
keywords: [network rules, consensus, PIP, hard fork, fork, node upgrade, activation height, Pocketnet Core, 0.22.21]
---

# Network rules and upgrades

Who changes the rules of the Pocketnet blockchain and how, what a PIP is, and why a node has to be upgraded before new rules take effect.

## Where the rules live

The network rules — which transactions are valid, how much a block pays, how reputation is counted, who may file reports — are written in the code of the Pocketnet Core node. There is no central server that could change them on the fly: every node checks blocks and transactions against the rules in its own version of the program.

So the rules change only with a new node version. The developers publish releases on the [pocketnet.core releases page](https://github.com/pocketnetteam/pocketnet.core/releases), and the node operators accept a change by installing the new version.

## PIP: changes from a block known in advance

A rule change is filed as a PIP — a Pocketnet Improvement Proposal. Every PIP has an activation height: until that block the node checks everything by the old rules, from it on — by the new ones. The new version comes out in advance so that operators have time to upgrade.

Recent rule changes:

| PIP | From block | What changed |
|---|---|---|
| 107 | 2,930,000 | a post can be edited for a month (43,200 blocks) instead of a day |
| 108 | 3,123,800 | up to 10 report categories |
| 113 | 3,247,300 | a moderation jury has 240 moderators |
| 109 | 3,291,900 | moderation and boosts for Barteron offers, mixed collections |
| 110 | 3,479,999 | lottery: 87.5% of the reward to the node, 2.5% to post authors, 10% to moderators |
| 115 | 3,480,000 | authors no longer get paid from emission; a “shark” needs 518,400 blocks (about a year) since sign-up; paid Barteron offers; account badges via `OP_RETURN` |

PIP 115 took effect on 21 September 2025: from that block the block reward is shared only by the node that produced the block and the moderators who voted in a jury. The full list is in [doc/pips.md](https://github.com/pocketnetteam/pocketnet.core/blob/master/doc/pips.md) of the node repository.

## What happens to a node that was not upgraded

A node of an old version keeps checking blocks by the old rules. As soon as the network reaches the activation block, the old node parts ways with the rest:

- either it rejects the new blocks and gets stuck at one height;
- or it accepts what the others consider invalid and drifts onto its own branch that nobody continues.

Release notes say so explicitly: for example, version 0.22.19 warned that from block 3,480,000 nodes up to and including 0.22.17 would no longer work with the network.

Either way it falls out of the network: the network won't accept its staked blocks, there are no rewards, and the Bastyon proxies stop sending it requests — they use only nodes that lag behind the network by no more than 20 blocks.

> [!IMPORTANT]
> Watch the pocketnet.core releases and install a new version before its activation height. On GitHub you can subscribe to releases: **Watch** → **Custom** → **Releases**.

## The outage of 28 April 2026

Sometimes the network is stopped not by a new rule but by a bug. On 28 April 2026 a Barteron offer without a tag got into block 3,806,251, and every node of version 0.22.20 crashed while processing it — the network halted. The fixed version 0.22.21 came out the same day, and once nodes upgraded, the network moved on.

The lesson for an operator is simple: keep the ability to upgrade quickly — a clear installation, access to the server, a wallet backup — and watch whether your node keeps getting blocks. How to do it — see [Node maintenance](node-maintenance.md).

<details>
<summary>How the rules are organised in the code</summary>

The social network rules live in the `src/pocketdb/consensus` folder of the node repository: basic checks for all transactions and separate ones for posts, comments, ratings, subscriptions, reports and Barteron. When a rule changes, the code gets a new version of it with the height it applies from, for example `LotteryConsensus_pip_115` from block 3,480,000. The old version stays: the node uses it to check old blocks when it syncs from scratch.

So a new node doesn't need any separate “history of rules” — everything is in one program.

</details>

## See also

- [How the blockchain works](blockchain-basics.md)
- [Staking and emission](staking.md)
- [Node maintenance](node-maintenance.md)
- [Moderation and rules](moderation.md)
