---
keywords: [promotion, boost, promote a post, lift a post, advertising, promoted, PKOIN]
---

# Promoting a post

How to lift a post in the feed for PKOIN, what to expect and what it costs.

## How to promote

1. Under the post, click **“Promote”** — the button with a lightning bolt. You can promote your own post and someone else’s.
2. In the **“Promote the post”** window choose an amount — 2.5, 5, 10 or 25 PKOIN — or type your own. You cannot send less than 2.5 PKOIN. Below the field you see how many coins you have available.
3. Click **“Promote”**. The message “The post is promoted” appears: the promotion starts once the network confirms the transaction, in about a minute.

If you are not signed in, the button opens the sign-in window first.

## What a boost gives

In the **“Feed”** section, roughly after every ten regular posts, the app inserts a promoted one — labeled **“Promoted”**. Promoted posts are seen by those whose feed is in the post’s language: a Russian post in the Russian feed, an English one in the English feed.

A boost lasts about a day: the network counts boosts from the last 1440 blocks. Boosts of one post — yours and other people’s — add up, and the larger the sum, the higher the post among the promoted ones.

The window shows a forecast — the chance that the post will be among the first 30 posts of its language’s feed for about a day. It is calculated the same way as in the previous Bastyon app: the post’s boost times three, divided by the sum of boosts of the other promoted posts in that language. If there are no other boosts, any amount gives 100%. Below the forecast is the amount needed for 100%: click it, and it goes into the field. The forecast is available for posts in the languages of the app’s interface.

If the post already has a boost from the last day, the window shows its amount.

## What it costs

You spend the chosen amount plus the network fee of 0.00000001 PKOIN. Neither the author nor the app gets the coins: the boost amount becomes the transaction fee, taken by the node that produced the block. The coins cannot be returned.

The app does not send a boost if:

- the amount is less than 2.5 PKOIN — “Minimum 2.5 PKOIN” appears below the field;
- **“Insufficient funds”** — the address has fewer coins than the amount together with the fee; next to it there is a link to [How to get PKOIN](how-to-buy-pkoin.md);
- **“Enter a valid amount”** — the field does not contain a number.

The network rejects a boost if the post has been deleted or if you and the author have blocked each other — see [The network rejected an action](action-rejected.md).

<details>
<summary>How it works</summary>

A boost is a `contentBoost` transaction: its OP_RETURN holds the type and the hash of the post’s txid. It has no output to the author’s address: the boost amount stays as the difference between inputs and outputs, that is, the fee, and the node counts it as the boost. The node method `getboostfeed` returns the boosts per language. The previous Bastyon app sends the same boost, and boosts from both apps are visible in both.

</details>

## See also

- [Feed](feed.md#promoted-posts)
- [PKOIN](pkoin.md)
- [Tipping the author](tips.md)
