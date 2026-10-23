# v0.12.0 — The “On blockchain” window, Android updates from inside the app

What the blockchain holds about a post, a comment, an account or a transaction now shows in a window over the feed: close it and you are at the same place. The phone updates with the “Update” button, like the desktop. Wallet history shows transactions again, and avatars got marks, as in the previous app. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, install this version by hand; the app installs the next ones itself.

## On blockchain

- **A window over the page.** **“On blockchain”** opens a window over the feed, a chat or the wallet. Take a look, close it, and the feed is where you left it.
- **A post** — the **“Share”** menu. The window shows the publication transaction and block, edits (each one a separate transaction), language, tags, attachments, ratings, comments and reposts, and who rated the post, who boosted it and who attached coins to a comment.
- **A comment** — the comment’s menu. Its transaction, when it was written and edited, coins to the post author, votes, replies.
- **An account** — in the profile, under the address. Balance, reputation, the registration and latest profile transactions, counters, chat keys, the moderator flag and jury bans, all-time earnings, recent transactions.
- **A transaction** — tap an entry in the wallet history, a transfer in a chat, or use a notification’s menu. Links to other transactions and addresses open in the same window, and **“Back”** returns to the previous record. **“Open in block explorer”** opens the full page.
- **Windows no longer scroll the feed to the top.** Opening any window in the app used to throw the feed back to its start.

## Updates on Android

- **“Update” on the phone.** The **“Update available”** window on Android now has **“Update”** too. The app downloads the new version, showing progress in the window, and checks it. The size and checksum must match what GitHub shows for the release, and the file must be Bastyon NextGen, newer than the installed one and signed with the same key. Then Android asks whether to update the app. When the installation is done, press **“Open”**. Accounts and settings are kept.
- **The first time,** Android opens the “Install unknown apps” setting for Bastyon NextGen. Turn on the permission and go back — the installation continues by itself.
- **If you cancel the installation,** the window says the update was not installed and keeps the **“Update”** button. If the file failed the check or did not download, the window offers **“Go to download”**, as before.
- **The button arrives with this version,** so this version itself has to be installed on the phone by hand. After that, the app installs updates itself.

## Wallet and sounds

- **Wallet history shows transactions again.** The app asked the node for transactions the wrong way, so the wallet history and an address’s transaction list in the block explorer were always empty. Now the transactions are there. New labels: **“With a comment”** — coins attached to a comment under your post, **“Monetization”** — a monetization payout from Bastyon, and **“Lottery”** — a block lottery win. **“Boost”** shows that the whole boost amount went to the network.
- **Transaction types in the block explorer** now have the right names: transfer, boost, report, comment and post deletion, moderation. Some of them used to carry other types’ names.
- **A sound for each kind of event.** When coins arrive — a transfer, a tip, coins with a comment, a subscription payment, a lottery win — a coin sounds; other notifications get a short chime. The coin also sounds when you send PKOIN. A new chat message sounds once per burst of messages, and an edited message makes no sound. The **“Sound”** switch in the notification settings now turns off all of the app’s sounds.
- **A comment with coins is one notification.** It used to arrive as two notifications; now it is one, with the amount shown.

## Interface

- **“Back” and “Forward” arrows in the header,** as in a browser: the desktop app has no browser buttons of its own. While there is nowhere to go, the arrow is pale. From the keyboard — Alt+← and Alt+→, on a Mac — Cmd+[ and Cmd+]; the side mouse buttons work too. On the phone, the **“Back”** arrow appears to the right of the menu button when there is somewhere to go back to.
- **A phone turned sideways.** A rotated phone used to get the desktop layout, with a wide sidebar on a screen a few lines tall. Now the section bar is a column at the left edge, the header is lower, pictures and videos in the feed are no taller than the screen, and windows fit the screen. Chats show the list and the conversation side by side when the screen is wide enough. Content stays clear of the camera cutout.
- **Avatar marks, as in the previous app:** a check mark for **“Verified”**, a crown for **“Moderator”** and a flag for **“Shark”**. They show in the feed, comments, search, follower lists, notifications and chats, and in the profile under the name. The check mark never showed before. In the **“Most interesting first”** order, comments from verified accounts rank higher again, as in the previous app.
- **Smoother feed scrolling.** On a phone, every new batch of 20 posts stopped scrolling for 0.6–0.8 seconds. Now posts appear one per frame.

## Chats

- **Voice messages show their waveform again.** It used to shrink to a sliver next to the play button.
- **Voice messages and files from the chat server mirror load.** Some messages sent through the matrix.2.pocketnet.app mirror showed “The voice message has no file link”. The app now fetches such files through its own chat server, so the sender still does not see your IP address.

## Mesh networks on the desktop

- **The mesh networks module is a separate download.** In the desktop app, radios and the Reticulum node now work through a separate program, like Tor and the IPFS module. Not everyone needs mesh, so the module, a couple of megabytes, is downloaded only when you ask: the **“Mesh networks”** page shows the **“Mesh networks module”** card. The app checks the file against the size and checksum built into it, and with Tor on it downloads the module through Tor.
- **If your Reticulum node started by itself,** that is, **“Start the node when signing in”** is checked, the module downloads by itself when you sign in, and messages keep arriving.
- **To update or remove the module,** go to **“Settings”** → **“General”** → **“Mesh networks module”**. The app downloads the new module version by itself along with its own update. On Android mesh is built into the app, as before.
