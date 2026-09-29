---
keywords: [moderation, rules, report, jury, ban, prohibited content, censorship, free speech]
---

# Moderation and rules

What is prohibited on Bastyon, who removes violations and how, and what you can do.

Bastyon has no administration that removes posts at its own discretion. The members moderate the network themselves, by rules written into the node code, and every step they take is visible on the blockchain.

## What is prohibited

The network moderates only what is explicitly prohibited:

- erotica and pornography;
- child exploitation — material depicting sexual abuse of children is prohibited across the whole network, without exceptions;
- direct threats of violence;
- promotion and sale of illegal drugs;
- spam.

An opinion you disagree with is not a violation. For things you simply dislike there is [blocking](blocking.md) and a low rating.

## How moderation works

**Ratings.** The first filter is ratings: low ratings from experienced members lower the author's [reputation](reputation.md), and comments of authors with a negative reputation are collapsed.

**Reports.** A report is a transaction on the blockchain: a flag on a post, a comment or an account, with a reason. Only experienced accounts can send reports — so new or bought accounts cannot flood someone with reports. How to report is covered in [Reports](reports.md).

**Jury.** When an account collects enough reports within 30 days, the network assembles a jury of moderators — long-standing accounts the community trusts. The bigger the author's audience, the more reports this takes. The moderators look at what was reported and vote.

**Ban.** If the jury agrees that the rules were broken, the account is banned: for 30 days the first time, for 90 days the second time, and indefinitely the third time. While a ban is in force, nodes do not show the account's posts in feeds.

<details>
<summary>Who can report and who sits on a jury</summary>

- **Reporting** is open to an account whose posts and comments have been rated by at least 100 different people, at least 25 of them for comments, and which is at least a year old. Up to 30 reports a day, one per author per 30 days.
- **A moderator** is an account older than 90 days with the same requirement for raters. A moderator votes once per jury.
- Jury members get a small reward from the block lottery.
- The thresholds are in the node code, [pocketnet.core](https://github.com/pocketnetteam/pocketnet.core), and change only with an update of the network rules.

</details>

## Your tools

- [Report](reports.md) a post or a comment with prohibited content.
- [Block](blocking.md) someone you find unpleasant: you stop seeing their posts and comments, and they can no longer rate or comment on yours.
- Give a low rating to a post that does not match its tags or is simply bad — see [Rating posts](ratings.md).

## Free speech and rules

A report is not a way to silence someone you are arguing with: reports without a violation only waste the jury's time. Rate posts honestly: high for good ones, low for bad ones, not in return for other people's ratings. That keeps reputation a measure of quality and moderation a defense against what is truly dangerous.

## See also

- [Reports](reports.md)
- [Blocking](blocking.md)
- [Reputation](reputation.md)
