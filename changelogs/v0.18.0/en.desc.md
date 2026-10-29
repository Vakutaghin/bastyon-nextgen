# v0.18.0 — Fast start, chats saved on the device, a blockchain explorer with a network map

The app starts several times faster, especially on a phone. Chats can be saved on the device: the chat server deletes messages after three months, and the copy stays. The blockchain explorer shows the node network live. All your collections and playlists are now on one page. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Faster on the phone

- **Start.** On every start the app decrypted the saved account keys several times in a slow way. On a phone that meant seconds while the screen was empty or did not respond. Now the key is derived once and off the main thread: measured with a slowed-down processor, the buttons respond after 2 seconds instead of 12, and the first posts appear after 4 seconds instead of 17.
- **White screen after coming back.** If Android unloaded the app in the background, it now starts again right away instead of staying white or closing.
- **The feed does not wait for unavailable servers.** The app takes the first server that answers instead of waiting for the unavailable ones to time out.
- **Chats over the feed no longer stutter.** While the messenger is open, the feed under it is drawn bit by bit when the phone is idle.
- **Coming back to the app** no longer re-requests the feed every time: at most once a minute, and never in the background.

## Chats saved on the device

- **“Settings” → “Chats” → “Save chats on this device”** (off by default): all chats or selected ones. A single chat can also be saved from its “⋯” menu in the chat list. The copy is encrypted with the account key and is not sent anywhere.
- **Old messages** load as you scroll up once the server no longer has them. They are marked with a device icon, with a divider above them.
- **Other people’s messages** can be deleted where the chat permissions allow it; in a personal chat, both of you can. A deleted message also disappears from the other person’s saved copy.
- **The message menu** in the full-screen messenger opened under it. Now it opens on top.

More in the help article “Chats saved on this device”.

## Chats

- **The first message of a new chat** showed up for the other person as “Could not decrypt the message”. Now it is sent only once the other person is invited to the chat. If the server does not confirm the invite within 15 seconds, the app says “Could not create the chat”, and the text stays in the field.
- **Voice messages on Android** did not turn the microphone on even with access granted. Fixed. Without access, the phone asks for permission. If it was denied for good, tapping the error message opens the app’s page in the phone settings.
- **“Back” on Android** first closes what is open on top: a post, the group window, the open chat, the messenger itself, an image, the attachment menu.
- **The messenger header** shows what is going on: “Connecting…”, “Updating…”, “No connection, reconnecting…”. While a chat’s messages load, there is a spinner next to the other person’s name.
- **Read ticks** are two overlapping ticks, as in Telegram.
- **Switching accounts.** Chats and unread counts of the previous account no longer get into the new one. Counts update when a chat is read on another device.

## Blockchain explorer

- **Two tabs: “Overview” and “Network”.** “Overview” has blocks, transactions and addresses, as before.
- **“Network”**, at the press of a button, walks the nodes through the Bastyon servers and draws a live diagram: your app, the proxies, nodes that accept connections and nodes behind a router. The lines show the app’s requests as they go. Colour by state, version or country; a node card has its version, height and uptime. There are also a country map, a list of versions and a table of all nodes. Your address is not sent to the nodes.
- **The “Block Explorer” and “Diagnostics” tabs are gone from Settings.** The proxy choice and the connection path are on the “Network” tab; the app version and the update check are in “What’s new”.

## Video, audio and collections

- **“Collections and playlists”** is a new page with everything of yours: collections of posts, video and audio playlists, private lists. Filter, search, create, edit, share, rename, delete. It opens from the “Collections” section in the left panel, the account menu, the “Playlists” tab and your profile.
- **Feed view in the “Video” and “Audio” sections:** “Grid” or “Track list” ↔ “Posts”. Each section remembers its own.
- **A video from the grid** opens in the post window and plays right away, with the post text and comments below.
- **After a fullscreen video** the feed stays where it was instead of jumping to the top.
- **A video missing from the archive too** is shown as not found right away instead of failing in the player.

## Media studio

- **A “Limits” button** next to “Upload”: how much you can still upload today, the daily quota tiers and yours, the formats and the quality videos are stored in.
- **While video servers answer,** a loading line sits above the list. The warning that not the whole list arrived is gone; an error with “Retry” appears only if no server answered.

## Fixes

- **Updates are checked on every start.** “Skip this version” is a checkbox that applies when the window closes.
- **“Subscribe” buttons** read “Loading…” until your subscriptions arrive and no longer offer to subscribe to people you already follow.
- **QR scanner:** if camera access is denied, an “Open settings” button appears.
