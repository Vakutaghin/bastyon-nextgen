---
keywords: [staking, Proof of Stake, PoS, block reward, emission, halving, coinstake, stake weight, netstakeweight, yield]
---

# Staking and emission

How the network chooses who produces the next block, how much it pays and how many PKOIN have been issued.

## How the block producer is chosen

There is no mining in Pocketnet. Blocks are produced by nodes that hold PKOIN in their wallet — that is [staking](glossary.md#staking) (Proof of Stake).

Every 16 seconds a node goes through its coins and for each output computes a “lottery ticket” — a hash of the output, the current time and data from past blocks. If the hash is below a threshold, the node produces a block. The threshold is proportional to the number of coins in the output, so everyone wins sometimes, but the more coins, the more often. The network adjusts the difficulty so that a block comes out about once a minute.

The coins don't go anywhere: they sit in the node's wallet and can be transferred at any moment — except the ones that have just won a block, see below.

## Which coins take part

- **The output is older than an hour.** Coins received less than an hour ago don't stake yet.
- **Rewards have matured.** The output that won a block becomes a new one together with the reward, and for 100 blocks, about an hour and a half, it can be neither spent nor staked again. In the node's wallet such coins show up as `immature_balance`.
- **An output weighs at most 10,000 PKOIN.** An output of 50,000 PKOIN stakes the same as one of 10,000. A large amount is better kept as several outputs — how to do it, see [Staking on your node](node-staking.md).
- **The wallet is unlocked, the node is in sync and sees other nodes.** Otherwise staking waits.

There is no minimum amount for staking: even 1 PKOIN takes part, it just has a tiny chance of producing a block.

## The block reward

The node that produced a block gets:

- **the block reward** — currently 2.5 PKOIN;
- **all fees** of the transactions in the block, including the money spent on [boosts](boost.md): the whole amount of a boost is a fee.

If moderators voted in a jury in the previous block, 10% of the block reward goes to them and 90% to the node. This is the [lottery](glossary.md#lottery); more in [Earnings](earnings.md).

The reward halves every 2,100,000 blocks, roughly every four years:

| Blocks | When | Block reward |
|---|---|---|
| up to 2,100,000 | February 2019 — February 2023 | 5 PKOIN |
| 2,100,000 — 4,199,999 | since 17 February 2023 | 2.5 PKOIN |
| 4,200,000 — 6,299,999 | expected in mid-January 2027 | 1.25 PKOIN |

Fees don't depend on halvings.

<details>
<summary>How the reward was shared before</summary>

Until block 3,480,000 (21 September 2025) part of the block reward went to authors: at first half of it was shared by authors of well-rated posts and comments and by those who had invited them to the network; later the authors' share kept shrinking — down to 2.5% before it was cancelled. From that block on, authors get nothing from emission; they still have tips, paid subscriptions and sales. The history of changes is in [Network rules and upgrades](blockchain-rules.md).

</details>

## How much you can earn

Your chance to produce a block equals your share of all coins being staked. The node shows the total stake of the network as `netstakeweight`, and the [block explorer](explorer.md) as Net stake weight. At the end of October 2026 it was about 4.6 million PKOIN — roughly a quarter of all coins issued.

The node itself estimates when it will produce a block: the `expectedtime` field of `getstakinginfo`, in seconds. The formula is simple: one minute times the network weight divided by your weight.

An example for a network weight of 4.6 million PKOIN, with coins split into outputs of no more than 10,000 PKOIN:

| Coins staked | A block on average every | PKOIN a day |
|---|---|---|
| 1,000 | 3.2 days | about 0.7 |
| 10,000 | 7.7 hours | about 7 |
| 100,000 | 46 minutes | about 70 |

Per year that is about 28%; operators reported about 30% in 2026. These are averages: blocks come at random, and a week without a single block on a small amount is normal. The network weight changes daily, and in January 2027 the block reward will halve — and the earnings with it. On top of the reward the node gets fees, but they are usually small.

> [!WARNING]
> Staked coins sit in the node's wallet, on the server. Whoever gets access to the server and the wallet password can transfer them. How to protect yourself — see [Staking on your node](node-staking.md) and [Node maintenance](node-maintenance.md).

## Emission

[Emission](glossary.md#emission) is how many PKOIN have been issued in total. New coins appear only as block rewards. At block 4,081,938 (28 October 2026) there were 18,829,845 of them. Emission is now growing by about 3,700 PKOIN a day; after the halving in January 2027 it will grow by about 1,900.

The current emission is shown in the [block explorer](explorer.md): the **“Emission”** field on the home page.

<details>
<summary>Technical details</summary>

- Pocketnet staking works as in Peercoin and BlackCoin: the stake “kernel” is a hash of the stake modifier, the output's time, its txid and index, and the time of the new transaction.
- The search steps in 16 seconds — a transaction's time is a multiple of 16.
- The output that won a block becomes an input of the coinstake transaction. If together with the reward it comes to 10 PKOIN or more, the coinstake splits the amount into two equal outputs, and it picks up small outputs below 5 PKOIN of the same address into the same coinstake, up to 100 inputs.
- A node estimates the network weight from the difficulty of recent blocks, so `netstakeweight` differs slightly between nodes.
- The first 1,020 blocks were mined; from the next one on, only staking.

</details>

## See also

- [Staking on your node](node-staking.md)
- [Earnings](earnings.md)
- [PKOIN](pkoin.md)
- [How the blockchain works](blockchain-basics.md)
