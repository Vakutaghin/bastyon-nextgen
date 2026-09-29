---
keywords: [questions, sign in, recovery phrase, fees, moderation, delete account, IP address]
---

# Frequently asked questions

Short answers to the questions people ask most often.

## How is Bastyon different from ordinary social networks?

The network has no owner: it is run by participants’ [nodes](glossary.md#node), and its rules — limits, reputation, moderation — are written in open code. Your account is your keys: signing up needs no email or phone, and nobody can take the account away. More in [About Bastyon](about.md).

## How do I sign in?

Your account is a 12-word [recovery phrase](glossary.md#recovery-phrase). There is no email, no password and no central server: the phrase is the account. You can also sign in with a private key or a QR code — see [Signing in](sign-in.md). Whoever knows the phrase controls the account, so keep it offline and never share it.

## Can I sign in to an account from the previous Bastyon app?

Yes. It is the same account on the same network: sign in with its phrase or key, and your posts, subscriptions, coins and chats will be there. You can use both apps at the same time. See [Signing in](sign-in.md).

## What if I lose my recovery phrase?

> [!CAUTION]
> It cannot be recovered. Only you hold the keys, and there is no service that could give you access back.

If the app is still open on some device, look at the phrase in the settings right away and write it down — see [If you lost access](lost-access.md). Better still, make a secure backup before you start posting.

## What happens to my coins and posts if I reinstall the app?

Nothing: everything is stored on the network, not on the device. After installing, sign in with the same phrase. On Android, version 0.7.1 and earlier have to be removed before updating — the keys are removed with the app, so first make sure your phrase is written down. See [Updates](updates.md).

## Can I delete my account?

Not in this app yet: an account can be deleted from the network in the settings of the previous Bastyon app. Others see a deleted account with the label “Account deleted”. **“Sign out”** in the account menu removes the account from this device only. See [Several accounts and signing out](accounts.md).

## Is it free?

Yes. Every action — a post, a rating, a subscription — is a transaction with a tiny fee of 0.00000001 PKOIN. The network sends a new account some coins, and they cover the fees for a long time. This protects the network from spam. See [Confirming actions](transactions.md).

## What is PKOIN and why would I need it?

[PKOIN](glossary.md#pkoin) is the network’s own coin. It pays the fees for actions, it is used to thank authors with tips and to promote posts. With a balance of 50 PKOIN an account gets its full limits. More in [PKOIN](pkoin.md) and [How to get PKOIN](how-to-buy-pkoin.md).

## Why did my post not appear right away?

The network confirms every action by including it in a block — in about a minute. Until then you see the post with a note that it is not published yet, and an hourglass in the header. See [Confirming actions](transactions.md).

## Why can I not give 1–3 stars?

Low ratings are available from a [reputation](glossary.md#reputation) of 100 — so that new accounts cannot mass-downrate other people’s posts. See [Rating posts](ratings.md) and [Reputation](reputation.md).

## Who moderates content?

The participants themselves, by the rules written in the node code. Low ratings lower an author’s reputation, experienced accounts send reports, and when enough reports pile up a jury of moderators decides — all of it visible on the blockchain. Little is prohibited, and above all child sexual abuse material — everywhere on the network, without exception. For what is merely unpleasant there is [blocking](blocking.md). See [Moderation and rules](moderation.md).

## Who can read my messages?

Private messages are encrypted on your device, and only you and the other person can read them. Group chats use a simpler scheme. The chat server sees who talks to whom and when, but not the text. See [Message encryption](chat-encryption.md).

## How do I hide my IP address?

Turn on [Tor](tor.md) in the desktop app: node requests and the chat go through it. Whatever would still go directly — images, videos, embeds — the app blocks or asks about first. See [Privacy: what others can see](privacy.md).

## Why does YouTube not play in the desktop app?

On macOS and Linux, YouTube does not allow videos to play inside the app window. There you get a picture and a **“Watch on YouTube”** button instead of the player: the video opens in the browser. See [Images or videos do not show](media-problems.md).
