# v0.27.0 — network statistics, “Who rated” and images over Tor

Big bloggers’ profiles and their followers open again, the feed no longer gets stuck on the same posts, and the blockchain explorer has charts for any period and large wallets. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Profile and followers

- **Big bloggers’ profiles open, and the follower list shows avatars and reputation.** The app asked the network for whole profiles, with every follower in them, and for accounts with tens of thousands of followers the network did not answer in time. Now it asks only for what it shows.
- The owner of a big account sees their own name and avatar after signing in again.
- Names like “Just%20Saying” are shown as “Just Saying”.

## Feed

- **The feed no longer gets stuck on the same posts.** Next pages now come from the same point as the first one — before, up to 20 of 20 posts on a page could be repeats.
- The feed loads three screens before the end, not at the last moment.
- In languages with few posts — Korean, for example — the best of the month is shown with a note instead of an error.
- A late batch of new posts from your subscriptions no longer jumps above a feed that is already open: it waits for **“Refresh feed”**. A post counts as seen once it has been on screen, and only posts from the last week get into the batch. Because of this, Bastyon_Team posts kept showing up at launch over Tor.

## Ratings

- **“Who rated”**: the number of ratings under the stars opens a window with the share of each rating from 5 to 1 and the people with their rating and reputation, those you follow first. It works without signing in.
- Without signing in, the stars no longer fill on hover or tap — it looked like a rating given.

## Blockchain explorer

- New **“Statistics”** and **“Wallets”** tabs.
- Charts for 48 hours, a week, a month, half a year, a year, 2 and 3 years, all time or your own dates — by hour, day, week or month. A click on a legend item hides a series or brings it back, hovering shows the values, and every chart has a table.
- New charts: publications by kind, engagement, PKOIN transfers, new accounts, the hours when the network is active, PKOIN issued and staking difficulty.
- **“Wallets”** lists large wallets with their balances and share of all PKOIN: the ones that produced the latest blocks and the most active addresses. The network does not provide a complete list by balance.

## Tor

- **On the computer, images, avatars and video previews show over Tor**: the app downloads them itself, through Tor. Before, avatars were letters, images opened on a click and previews did not show at all. Videos themselves still go outside Tor only with your consent.
- At the top of the Tor icon menu is **“Network connection”**: “Auto”, “Proxy” or “Direct to nodes” — how requests go while Tor is off.

## Other

- **“Report a bug”** is the last item of the left panel and of the phone menu.
- Search shows reputation under the name instead of the address.
- Media Studio: the video menu has **“Copy link”** — to the post with the video or, if there is no post, to the video’s page on the video server.
- On a phone held sideways, an open chat takes the whole screen, and more of the conversation is visible with the keyboard up.
- On a Mac, the unread count no longer shows next to the menu bar icon; it stays on the Dock icon.
