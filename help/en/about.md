---
keywords: [Bastyon, Pocketnet, decentralization, censorship, blockchain, open source]
---

# About Bastyon

A decentralized social network owned by its users: no company behind it, no email or phone number to sign up, and open rules.

Bastyon is a social network built on the Pocketnet [blockchain](glossary.md#blockchain) with its own coin, [PKOIN](glossary.md#pkoin). People publish posts, articles, videos and audio here, comment and rate, chat, send coins and share files.

## How Bastyon differs from ordinary social networks

- **The network has no owner.** It runs on [nodes](glossary.md#node) — computers of participants all over the world. There is no company that can shut the network down, sell your data or change the rules on its own.
- **Nobody can take your account away.** Your account is a set of keys derived from your [recovery phrase](glossary.md#recovery-phrase), and only you have them. Signing up needs neither an email address nor a phone number.
- **The rules are open.** Limits, reputation and moderation are written into the node code, which anyone can read. Reports and moderators' decisions also go through the blockchain and are visible to everyone. How it works is explained in [Moderation and rules](moderation.md).
- **Authors get coins directly.** Readers send them tips in PKOIN — with no middleman taking a cut. How it works — see [Earnings](earnings.md).

## How it works

Posts, comments, ratings, subscriptions and transfers are recorded on the blockchain. Videos and audio are stored on PeerTube servers run by members of the network. Chats go through Matrix servers and are encrypted on the devices: private chats end to end, group chats with a simpler scheme. Files are shared by the users themselves over IPFS. More in [How the network works](how-bastyon-works.md).

## Where Bastyon comes from

Bastyon grew out of the Pocketnet project, which is still the name of the blockchain and of the node software. The network is developed by independent developers, and the nodes are run by the participants themselves. The code is open:

- the node — [pocketnet.core](https://github.com/pocketnetteam/pocketnet.core);
- the previous Bastyon app — [pocketnet.gui](https://github.com/pocketnetteam/pocketnet.gui);
- this app — [bastyon-nextgen](https://github.com/Vakutaghin/bastyon-nextgen), see [The Bastyon NextGen app](bastyon-nextgen.md).

## What this means for you

- Nobody can restore a lost phrase. Save it before you start using the network — see [Recovery phrase and private key](recovery-phrase.md).
- What you publish stays on the blockchain: editing and deleting add new records, and earlier versions remain in the history. What others can see is covered in [Privacy: what others can see](privacy.md).
- The network confirms every action in about a minute, so a post or a rating does not appear instantly — see [Confirming actions](transactions.md).
- New accounts can do less until their reputation or balance grows — see [Account status and limits](limits.md).

## See also

- [How the network works](how-bastyon-works.md)
- [Privacy: what others can see](privacy.md)
- [Getting started](getting-started.md)
- [Frequently asked questions](faq.md)
