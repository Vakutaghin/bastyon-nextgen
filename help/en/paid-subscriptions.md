---
keywords:
  - paid subscription
  - privileged subscription
  - subscription price
  - paid subscribers
  - support an author
  - author income
---

# Paid subscriptions

How an author sets a price and publishes posts only for those who support them, and how a reader subscribes.

Everything about paid subscriptions is in the [“Paid subscriptions”](bastyon://paid-subscriptions) section of the account menu. The **“My subscriptions”** tab lists the authors you pay; the **“My subscribers”** tab holds your price and those who pay you.

## How it works

The author sets a monthly price in PKOIN. A subscriber pays them with a regular transfer marked “subscription”: the money reaches the author’s wallet at once, with no middleman and no service fee. The subscriber pays the network fee of 0.00000001 PKOIN.

A subscription is active while the payments to the author over the last month cover the price of a month, over the last six months — the price of six months, or over the last year — the price of a year:

| Term     | Cost                         |
| -------- | ---------------------------- |
| 1 month  | the monthly price            |
| 6 months | 5.5 monthly prices — save 8% |
| 1 year   | 10 monthly prices — save 17% |

The author’s posts with “Paid subscribers” visibility open to those whose subscription is paid and who follow the author with a regular subscription.

The rules are the same as in the previous Bastyon app (where it is called a “privileged” subscription): a subscription bought there works here, and the other way round.

## For authors: set a price

1. Open [“Paid subscriptions”](bastyon://paid-subscriptions), the **“My subscribers”** tab — or press **“Paid subscription”** in your profile.
2. Enter the price in the “PKOIN a month” field — a whole number from 1 to 1500. Below the field you see what six months and a year cost.
3. Press **“Turn on paid subscriptions”** — or **“Save price”** if a price is already set.

The price is written to the blockchain with an account settings transaction; the network confirms it in about a minute. Until then the price shows “waiting for the network”. You can publish posts for paid subscribers right away.

A new price applies to all subscribers at once: those whose payments no longer cover a term at the new price lose access until they top up. The app asks before changing the price.

**“Turn off”** — your posts for paid subscribers become visible to all your followers. You can turn it back on at any time.

To publish a post only for paid subscribers, choose **“Paid subscribers”** visibility in the post editor — see [Visibility, language and publishing time](post-settings.md).

## For authors: who subscribed

On the **“My subscribers”** tab, below the price:

- how many subscriptions are active now and how much PKOIN came in over 30 days and over a year;
- subscribers: the term, the date it is paid until, the last payment and the total for the year;
- a note when someone paid but doesn’t follow you with a regular subscription: until they do, they don’t see paid posts;
- those whose term has ended — in a collapsed list below.

Each payment brings a **“Subscription paid”** notification, and in the [transaction history](wallet-history.md) such a transfer is labelled **“Subscription”**.

## For readers: subscribe

The **“Paid subscription”** button with the price is on the author’s page if they have set a price. You can also subscribe straight from a post for paid subscribers: in place of the text there is a “Subscribe” button.

1. In the window, choose a term: a month, six months or a year. Each shows the date it will be paid until.
2. If part of a term is already covered by earlier payments, the app offers only a top-up, marked “top-up to…”.
3. Press “Pay”. If you don’t follow the author yet, the app follows them along with the payment.

The posts open at once, without waiting for the network to confirm. A payment can’t be refunded: it is a regular transfer.

Your subscriptions are on the **“My subscriptions”** tab: the date they are paid until, the last payment, and the **“Extend”** and **“Subscribe again”** buttons.

While a term is running, you can extend it by moving to a longer term with a top-up. The same term is bought again once it ends: payments count over the last month, six months or year, so paying early for the same term barely lengthens the subscription.

> [!NOTE]
> Subscriptions can’t be bought in the iPhone app — App Store rules require this, and the previous app did the same. Buy one in the desktop or Android app or in a browser: paid posts will open on the iPhone.

## Good to know

> [!IMPORTANT]
> A paid subscription is not encryption. The text of the post sits in the blockchain in the open; apps hide it. Anyone who looks at the record in the [block explorer](explorer.md) or in an app that doesn’t check subscriptions can read the post.

- If the author turned paid subscriptions off, their posts for paid subscribers are open to all their followers.
- If the author never set a price, you can’t subscribe to them, and their posts for paid subscribers stay closed.
- Payments are public: like any transfer, they are recorded in the blockchain.

<details>
<summary>How the app checks a subscription</summary>

There is no separate “subscription bought” record in the blockchain. A payment is a transfer to the author with the `a:subscription` mark in OP_RETURN. The node returns such transfers for the year on a `getfromtotransactions` request; the app adds up the payments to the author and compares them with the price from the author’s account settings — the `paidsubscription` field of the `accSet` transaction. A month here, as in the previous app, is 30.5 days.

</details>

## See also

- [Visibility, language and publishing time](post-settings.md)
- [Subscriptions](subscriptions.md)
- [Tipping the author](tips.md)
- [Earnings](earnings.md)
