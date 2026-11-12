---
keywords:
  - monetization
  - author earnings
  - ads on a channel
  - payouts to authors
  - advertiser
  - cash out PKOIN
  - sell PKOIN
---

# Monetization for authors

How Bastyon pays authors for reader activity: who takes part, how much and when it arrives, and how to cash out.

The [“Monetization for authors”](bastyon://monetization) page shows it briefly, with a diagram. A card at the bottom of the wallet’s **“Earnings”** tab leads there; the page opens without signing in too.

## How it works

1. An advertiser buys PKOIN and [promotes](boost.md) their post.
2. Promoted posts show in the feed and on the channels of authors who take part in the program.
3. Readers rate these authors’ posts and comment under them.
4. Bastyon splits payouts between authors by the activity under their posts and sends PKOIN to each one’s main wallet.

An author can sell the coins they earned on an exchange or person to person, and the coins go back to advertisers. So PKOIN goes round in a circle.

## Who takes part

At present, authors with the **“Verified”** mark whom the Bastyon team has added take part — see [Account badges](account-badges.md#verified). The program started in September 2024, and verified channels were its first stage; the team plans to add other active channels over time.

To take part, write to the Bastyon team at [support@bastyon.com](mailto:support@bastyon.com). The same address is used to request the “Verified” mark if you have a channel outside Bastyon with more than a thousand subscribers.

## How much it pays

The amount depends on two things: how much advertisers paid for the period and how much activity your channel has. Advertisers’ money is split between authors: the more ratings and comments under your posts, the bigger your share. More people bring new advertisers, and payouts grow.

How to earn more:

- post more often;
- invite people to discuss your posts;
- do not chase video length: ads are not inserted into the video, activity under the post is what counts.

## When payouts arrive

A payout arrives at your main wallet as a transfer from Bastyon. In the [transaction history](wallet-history.md) it is labeled **“Monetization”**, and on the **“Earnings”** tab it is part of **“Received as transfers and tips”**.

According to the team, a payout is for activity on posts from the last two weeks. In 2026 payouts came irregularly: sometimes several in a week, and the longest gap was up to three weeks.

## How to cash out

PKOIN is sold on exchanges or person to person for dollars, rubles and other currencies. Where to do it is described in [How to get PKOIN](how-to-buy-pkoin.md#buying): the exchanges and dealers work both ways. Questions about cashing out go to [support@bastyon.com](mailto:support@bastyon.com).

> [!WARNING]
> Blockchain transfers cannot be reversed. Person-to-person deals are at your own risk: the network does not guarantee them.

## What this app does not have

This app explains the program but cannot do everything in it yet:

- it shows promoted posts only in the feed, not on authors’ pages;
- there is no weekly payout table and no switch to take part or not. They are in the previous Bastyon app, in the “Monetization” section of the profile that authors with the “Verified” mark see. This app keeps the choice made there when it changes other account settings.

<details>
<summary>How it works inside</summary>

The program’s rules are not in the blockchain: whom to pay and how much is calculated by the Bastyon team’s monetization server. Payouts are ordinary transfers from the address `PHdW4pwWbFdoofVhSEfPSHgradmrvZdbE5` with the `a:monetization` label, up to 50 recipients per transaction. In September–November 2026, author payouts went to 87–146 accounts at a time, nearly all with the “Verified” mark.

With the same label, small amounts, usually fractions of a PKOIN, also go each time to another one to two thousand addresses without that mark. The previous app does not explain what they are for.

The coins of a boost itself go to the node that produced the block — see [Promoting a post](boost.md#what-it-costs). Bastyon pays authors separately, from its own address.

Taking part is stored in the account settings — the `accSet` transaction, the `monetization` field: empty or `true` means taking part, `false` means the author switched monetization off. The previous app shows ads on an author’s channel if the author has the “Verified” mark and has not switched it off.

</details>

## See also

- [Earnings](earnings.md)
- [Promoting a post](boost.md)
- [How to get PKOIN](how-to-buy-pkoin.md)
