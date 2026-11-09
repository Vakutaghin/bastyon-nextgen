# v0.32.0 — clear collections and playlists, one Favorites, audio downloads

“Collections and playlists” is rebuilt: all your lists are on one page, each shows what is inside and who sees it, and one window creates them. Bookmarks, “Saved videos” and “My music” are now one Favorites list, the same on all your devices. Audio downloads work, and the header has a Downloads icon. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Collections and playlists

- **Everything on one page.** Favorites, Watch later and Downloads are on top. Below them, one list sorted by name holds your playlists and collections. Each shows two marks: what is inside (“12 videos”, “5 tracks”, “3 posts”) and who sees it (“Everyone” or “Only me”). The list can be filtered by both.
- **One “New list” window:** choose what goes inside — videos, audio or posts — and who sees it. A private list is seen only by you and can be edited as much as you like. A public one is published on the blockchain, with up to 5 edits a month. Entries can be added right away from Favorites or from your own videos and tracks.
- **A private list can now hold posts too,** not only videos and audio.
- **Visibility changes from the list’s menu:** “Make public” or “Make private”. The name and entries stay. The private list is deleted only once the public one is in a block, so nothing is lost if publishing fails.
- **The “Add to…” window** lists what only you see first (Favorites, Watch later, private lists), then public lists. Each row says what is inside. “New list…” creates a list with this entry already in it.
- The word “album” is gone: these are all playlists and collections.

## Favorites

- **One Favorites on all devices.** The post bookmark, “Saved videos” and “My music” are now one list, kept in your account. Bookmarks used to stay on one device; on first sign-in they move into Favorites by themselves.
- **A Favorites tab in the Video and Audio sections** shows its videos or tracks. Old links to “Saved” and “My music” lead there.
- Without signing in, the bookmark offers to sign in: Favorites is kept in the account.
- **Update the app on all your devices.** Versions before 0.32 still show their own “Saved” and “My music”, but when they save their lists they erase the new Favorites and private lists of posts on the server. A device with 0.32 brings them back the next time it starts.

## Downloads

- **Audio now downloads.** Before, every track stayed “still processing” forever.
- **“Download” is under every video and track in the feed,** not only on the post page.
- **A Downloads icon in the header:** the overall percentage and how many are downloading, the latest downloads with pause, Play and “Save as file”. On the computer a finished download says “Downloaded: …”.
- **“Save as file”** takes a download out of the app as a regular file: the Save dialog on the computer, Share on the phone. Videos are saved as .mp4, tracks as .m4a.

## Chats

- **Voice and video messages can be downloaded** with “Download” in the message’s “⋯” menu.
- **The eye above the chat list is now a menu:** “Don’t show hidden chats”, “Show them with all chats” or “Hidden chats only”. The “Hidden chats…” window lists every chat the filter hides, with the reason; any of them can be opened or brought back to the list.
- **A gear next to search** opens Chat settings.
- In the full messenger the header buttons sit on the right instead of in the middle.

## Profile

- **Subscribers and subscriptions can be sorted and searched.** Order them “Newest first” or “By reputation”. Search by nickname or part of the address. In a long list nicknames load in steps, and matches appear as they arrive.

## Post editor

- **Images in the editor are laid out as they will be in the feed,** not as identical squares.
- **Drag an image onto another to change the order.** Before, a thumbnail dropped on “Add images” was added once more.
- While the post is publishing, its images cannot be changed.

## Help

- **A “?” button next to what people ask about most:** in settings, at Tor, IPFS and the hourglass in the header, in chats, the wallet, and the tip, subscription, report and payment windows. It opens the right section of the article on the side.
- **F1 in settings** opens help for the open tab.
- Outdated statements are fixed: chat invitations open with Accept and Decline, groups without encryption, the PKOIN transfer fee depends on size (from 0.00001 PKOIN), unsent messages, “New posts at once”.
