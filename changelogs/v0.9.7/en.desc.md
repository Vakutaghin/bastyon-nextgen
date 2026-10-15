# v0.9.7 — Paid subscriptions and the profile from a chat

Paid subscriptions now work right in the app: an author sets a price and sees who pays, and a reader subscribes for a month, six months or a year. A chat now leads to the other person’s profile. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package).

## Paid subscriptions

- **The “Paid subscriptions” section.** It is in the account menu and has two tabs: “My subscriptions” lists the authors you pay, and “My subscribers” holds your price and those who pay you.
- **The price.** An author sets, changes or turns off a monthly price in PKOIN. Six months cost 5.5 months, a year costs 10. The app asks before changing or turning off the price. The cover and the pinned post stay as they are.
- **Who subscribed.** You see how many subscriptions are active and how much PKOIN came in over 30 days and over a year. Each subscriber shows the term, the date it is paid until, the last payment and the total for the year. If someone paid but doesn’t follow you with a regular subscription, it is flagged: they can’t see paid posts yet. Ended subscriptions are in a collapsed list.
- **Subscribe.** The author’s page has a “Paid subscription” button with the price, and a post for paid subscribers shows a “Subscribe” button in place of the text. The payment window offers three terms: a month, six months and a year, each with its amount, saving and end date. If part of a term is already paid, the app offers only a top-up. If you don’t follow the author yet, the app follows them along with the payment. The posts open at once, without waiting for the network to confirm.
- **Notifications and history.** The author gets a “Subscription paid” notification, and the wallet history labels such transfers “Subscription”.
- **Works with the previous Bastyon.** Subscriptions bought there work here, and the other way round. The iPhone app can’t buy a subscription — App Store rules require this — but paid posts open there.

The help article “Paid subscriptions” has the details.

## Chats

- **Open the profile.** In the chat header — both in the small window and in the full messenger — the person’s avatar and name lead to their profile. In a group chat, the avatar next to a message leads to that member’s profile.

## Fixes

- **Closed posts in a chat.** A post “for subscribers” or “for paid subscribers” shared to a chat showed its text to everyone. Now, in place of the text, it says who the post is for. The post embed page is fixed the same way.
