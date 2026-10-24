# v0.13.1 — Whole posts in channels, the reason for a sync error, ticks in the chat list

Channel posts no longer shrink to a single line, and a video from a channel opens and starts playing. On the phone posts run the full width of the screen, without frames. The red “Sync error” bar now says why the chats did not load, and the chat list shows whether your last message was sent or already read. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Channels

- **Posts show in full.** In a long channel posts were squeezed to one line to fit the window. Now each post shows in full, with its pictures, and the channel scrolls.
- **Pictures as in the feed:** in a grid, and a tap opens them full screen. With Tor on, they load through Tor.
- **Videos open for watching.** A post with a YouTube or Vimeo link is now a video post, as in the feed: it has a cover with a play badge. A tap on the cover opens the post with the video already playing. The link itself is no longer repeated in the text. With Tor on, videos have no cover.
- **“Subscribed” instead of the “Subscribe” button.** Followers of an author sometimes saw “Subscribe” until the subscription list loaded, and for good if it failed to load. Now the button appears only when it is known that you do not follow the author, and a follower sees **“Subscribed”**.

## Posts on the phone

- **Full width, as on Instagram.** In the feed, the profile, search and on the post page, posts run edge to edge, without frames, with a thin line between them. Pictures and videos take the full width too. Channels in the messenger look the same.
- **A post opened in full takes the whole screen.**
- Nothing changes on a computer.

## Sync error

- **The bar says why.** It used to say only “Sync error”. Now the reason follows the colon: “no connection to the chat server”, “the chat server did not answer in time”, “the chat server returned error” with its code, “Tor is not ready yet”. Under it, in small print, is a technical note: send it to support if the error does not go away.
- **The “Retry” button** tries at once, without waiting for the next attempt.
- **The messenger window shows the error too.** It used to show only an endless loading of dialogs.
- **A dropped sign-in no longer stops the chats.** When the chat server dropped the sign-in (for example, after you signed out on all devices), the chats stayed on the error until the app was restarted. Now the app signs in again by itself.

## Chat list

- **Ticks by your last message,** the same as in the conversation: “…” sending, “✓” reached the server, “✓✓” read (in a group, by at least one member), “!” not sent. In a direct chat the tick replaces “You:”; groups keep “You:”.
- **“…” turns into “✓” as soon as the server accepts the message.** The list used to learn about it only with the next message.
