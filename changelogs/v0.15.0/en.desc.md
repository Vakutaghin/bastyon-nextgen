# v0.15.0 — Voice input as you speak, “Top accounts”, a feed language, a YouTube-like Media studio

Voice input now types words as you speak, like a phone keyboard, and turns itself off after 10 seconds of silence. New: “Top accounts” by reputation, a separate feed language and a header and menu builder. A comment notification opens the comment itself, and you can reply right from the notification. The Media studio gets a list view and a clip window with details, cover and statistics. The desktop app finally receives new comments and confirmations from the node at once. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Voice input

- **Words appear as you speak.** While you say a phrase, its draft stands in the field and grows. When the phrase is over, the app recognizes it as a whole and puts the final text in its place: more accurate and with punctuation.
- **It turns itself off.** If no speech and no recognized text come for 10 seconds, dictation ends and what you said is finished.
- **Ctrl+Z** (Cmd+Z on a Mac) removes the last dictated phrase in one step.
- **A note under the list of models:** the more accurate the model, the slower it recognizes, especially on phones.

## Feed and posts

- **“Feed language”** is a separate field under **“Best first”** in the left panel and in the phone menu. It changes only the feed, tags and recommendations, and the interface keeps its language. Switching the interface language switches the feed along with it.
- **Links in the post text** are coloured and underlined. Mentions are underlined on hover.
- **The link card** under a post is neater: the image is a square on the left, the title and description on the right, at most 800 points wide. The image opens in the viewer; the rest of the card opens the link in a new window.

## “Top accounts”

- **A new page** in the left panel and in the phone menu, open without signing in too. The accounts with the highest reputation, 30 rows at a time, more as you scroll.
- **How the top is built.** The network has no list of all accounts, so the top is built from the subscribers of the most popular authors: almost the whole active network follows them. The page says so. A top older than half an hour is rebuilt the next time you open the page, and the previous list stays on screen until the new one arrives.

## Notifications

- **A comment, a reply and a comment rating** open the post with that comment highlighted and its thread expanded. A comment rating used to lead to the profile of whoever rated it, and comments from the network had no text.
- **“Reply”** opens the post at the comment with the reply field ready.
- **“All” and “Comments”** switch the list, with an unread count for comments. **“Show more”** comes after 20 notifications. **“You replied”** marks a comment you have already answered.
- **Sender nicknames.** With 10 or more different authors in the list, the node did not manage to return their profiles, and addresses stayed instead of all the nicknames. Now the nicknames come in that case too, and one that does not come at once appears later by itself. A pop-up notification of a new event waits up to 2.5 seconds for the nickname.

## Settings: “Header and menu”

- **A new tab** in the settings: the icons to the right of the search and the items of the avatar menu can be hidden and reordered — by dragging a row by its handle or with the arrow keys.
- **A rethought default order.** The Tor and IPFS icons are in the header only in the desktop app; in the browser they are gone. **“Report a bug”** is in the avatar menu by default, so a bug can be reported from a phone too.
- **What cannot be turned on** on this device is shown with the reason. Until you change anything, new items and a better order from future versions arrive by themselves.

## Media studio

- **“Grid” and “List”** — the view is remembered on the device. The list shows the cover, the title with the start of the description, status, upload date and views. There is a search, an **“In posts”** and **“Not in a post”** filter, and an order by date, views or title.
- **The clip window, “Details”:** the title and description on the video server, and the cover can now be changed for any clip — with a frame of the clip itself or your own image. On the side: type, state, duration, quality, size, views and the posts with the clip.
- **The clip window, “Statistics”:** viewers, watch time, audience retention and countries for 7, 28 or 90 days or all time.
- **Views are counted.** The player now reports watching to the video server, as the previous client did. Without it, clips watched in this app never gained views and the statistics stayed empty. A clip that flashes by in the feed for less than 5 seconds does not count as a view.

## Fixes

- **The desktop app did not connect to the node directly.** Its security settings blocked the connection to the node's port. So new comments, transaction confirmations, new blocks in the explorer and block events for mini-apps came late or not at all, and support reports were full of the “The operation is insecure” error. The connection now works on Windows, macOS and Linux.
- **The feed, profile, favourites and promoted posts** no longer break as a whole when the node answers with an empty spot instead of one post.
