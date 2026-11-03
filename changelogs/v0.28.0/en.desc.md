# v0.28.0 — feed by date in any language and new posts live

The feed now goes by date and no longer stays empty in languages people rarely post in, and new posts can show up in it by themselves. On Windows, updating no longer breaks off halfway. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Feed

- **Posts go by date — newest first, one after another.** The network used to order fresh posts by ratings and the authors’ reputation. “Best first” works as before.
- **The feed no longer stays empty in languages people rarely post in** — Italian, Spanish, Serbian, Korean. The network could not put together a page of posts in such a language in time, and the best of the month shown instead was often empty too. Now posts come one at a time, and across long gaps the app finds the next ones by the language’s tags. If there are no posts in the language, the feed says so.
- **“New posts live”** — a new switch above the categories: new posts appear at the top of the feed by themselves, one by one. If you are reading further down, the feed does not move under you.
- “New from subscriptions” at the top of the feed is in the feed language only. Posts from subscriptions in every language are on the **“Subscriptions”** tab.
- Dropdowns open at once, including when you click the arrow.

## Chats

- In a new chat, before the first message, the input sits at the bottom of the window.
- Blank lines at the start and end of a message are no longer shown — messages from other clients sometimes have them.

## Blockchain explorer

- **The network’s activity history is kept on the device.** It is collected once for all time — about a minute and a half the first time — and after that any period and your own dates are built without asking the network. Under the periods are the date of the data and **“Refresh”**, which loads only what is new.
- The “Loaded x of y” line no longer shifts the charts.

## Windows

- **Updating no longer breaks off with a file write error.** The installer waits until the previous version has fully closed — an antivirus, for example, may still be holding it.
- If the previous version was installed for all users (versions before 0.17) and Windows would not remove it without administrator rights, the installer explains this and offers to retry, install the new version just for you, or keep the old one. Before, the update silently brought the old version back.
