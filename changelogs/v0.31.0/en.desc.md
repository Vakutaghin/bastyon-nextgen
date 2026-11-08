# v0.31.0 — pinned post and search in the profile, unsent chat messages are not lost

A profile now shows its pinned post first and can be searched. An unsent chat message, a voice message too, can be retried or deleted, and it survives a restart. Articles open in a window as wide as the feed, and their images zoom. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Profile

- **The pinned post comes first** with a “Pinned” mark, even if the feed has not reached it yet. A post pinned in the previous Bastyon shows here too.
- **You can pin your own post:** “Pin to profile” or “Unpin” in its “Share” menu. You see it at once, others once the network confirms it.
- **Search posts** above the profile feed searches only this author’s posts. Results are ordered by how well they match, not by date. The cross in the field brings the feed back.

## Feed and articles

- **An article opens in a window no narrower than the feed.** Before, on a wide screen the article window was noticeably narrower than the feed itself.
- **Article images open on a click** in the viewer, and the arrows go through all images of the article. The “Zoom image” item of the right-click menu on Windows does not work in the app; click the image instead.
- **An article opens from its cover, title or preview,** not only from “Read article”.
- **“New posts at once” is really at once:** new posts arrive a couple of seconds after a block, together, instead of half a minute later and one by one.
- **A video closed while loading no longer starts playing unseen.** Before, a slow video went on playing its sound with no player after the post was closed, and only quitting the app stopped it.

## Chats

- **An unsent message can be retried or deleted.** Before, “Retry” worked only for text: a voice message, photo or file that failed kept spinning and was gone after a restart. Now an attachment is sent again with the same file, and unsent messages are kept on the device, encrypted, across restarts.
- **Voice messages load when you play them.** Before, opening a chat downloaded every voice message just to draw its waveform, and a chat with a dozen of them pulled megabytes. The waveform now comes with the message, encrypted in an encrypted chat.
- **Groups that are not encrypted say so:** “not encrypted” in the header, and why in the group window. This is the case for public groups and groups of 50 members or more, as in the previous Bastyon.
- **“Accept chat invitations right away”** in Settings → Chats. By default an invitation still opens with Accept and Decline.
- A group chat header no longer shows the group twice.
- The red “Sync error” bar no longer flashes for a second when you come back to the app.

## Services

- **A mini-app can always be closed.** If the app was not found or blocked under Tor, there was no Close button at all. Now it is always there, shows its label for the first seconds, and closing takes you back to where you opened the app from.

## Computer

- Header dropdowns (notifications, Tor, IPFS, account, language) no longer move away with the feed when the page scrolls.

## Android

- **The chat connection no longer drops over and over on a slow network.** The app treated the link as lost when the server did not answer a check within 10 seconds and failed every request. The check now runs less often, and a message is never sent twice.
