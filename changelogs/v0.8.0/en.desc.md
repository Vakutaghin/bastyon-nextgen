# v0.8.0 — Mesh networks, a YouTube-like player and phone navigation

Bastyon can now chat without the internet: over Meshtastic and MeshCore LoRa radios and over the Reticulum network. The video player looks and works like YouTube, the phone menu has the same sections as the desktop app, and the help is complete. The Android app now updates over the old version. There are also many fixes in the wallet, notifications and the messenger.

## Android: updates install over the old version

- **From this version on, the Android app installs over the previous one**, as on desktop. Until now every build was signed with its own temporary key, and the phone refused to install a new version over the old one.
- **If the phone has 0.7.1 or an earlier version, you need to remove it one last time.** Before removing it, make sure your recovery phrase is written down: the account keys are removed with the app. After installing, sign in with the phrase.
- The Android app is built as a release build: its data can no longer be read over USB debugging.

## Mesh networks: chat without the internet

- **LoRa radios.** The account menu has a new "Mesh networks" section. It connects a radio with Meshtastic or MeshCore firmware over USB, Bluetooth or Wi-Fi, in the desktop app and on Android. One radio of each network can stay connected at the same time.
- **Radio chats live in the messenger** next to the usual ones, marked with their network: direct messages and channels, Meshtastic replies and reactions, MeshCore rooms with a password login. Your own messages show their state: sending, on the air, delivered. On Android, messages keep arriving while the app is in the background as long as a radio is connected.
- **Reticulum.** The app has a built-in Reticulum node with LXMF chats. They are encrypted end to end with keys the app itself holds. The Reticulum address comes from the account key, so the recovery phrase restores it along with the account. The node reaches the network through community nodes on the internet, neighbours in the local network and an RNode over USB, and leaves messages for people who are offline on a propagation node. It works on macOS, Linux and Android, not yet on Windows.
- Reticulum chats can send pictures and files, including to Sideband and MeshChat users. A message can also travel with no network at all, as a QR code or an lxm:// link that only the recipient can read.
- The Reticulum tab opens NomadNet node pages: boards, guides, forms.
- **In case the internet goes down:** the attachment menu of an ordinary chat has "My Reticulum address", and an address someone sent you has a "Message via Reticulum" button.
- How to connect a radio and what the marks in the chats mean is in the help, in the "Chatting over radio" article. Mesh networks were tested against software nodes, not yet with real boards. If something does not work, please report a bug.

## A video player like YouTube

- **On desktop** the bottom bar now looks like YouTube's: on hover the thin red progress bar shows the time and the chapter under the pointer. A click pauses, a double click goes full screen, and quality and speed are in the gear menu.
- **YouTube keys:** ← and → seek 5 seconds, J and L seek 10, the digits 0–9 jump to that part of the video, "," and "." step one frame while paused, I turns on picture-in-picture. The full list is in the help.
- **On a phone** a tap shows and hides the buttons without stopping the video. A double tap on the left or right seeks 10 seconds, and every quick tap after that adds 10 more. While your finger rests on the video, it plays twice as fast. In full screen a landscape video rotates by itself, a swipe down leaves full screen, and the settings open from the bottom.
- The quality menu has an "Auto" item: until now, once you picked a quality by hand, there was no way back to automatic.
- After seeking while paused, the time and the progress bar update at once.

## Navigation on a phone

- **The menu opens the same sections as the desktop left panel**, plus categories and tags. A signed-in user also finds the "Account" section there: profile, wallets, limits, videos and settings. A guest is offered to sign in or sign up at the top of the menu.
- **Sections that need an account no longer throw you back to the feed.** A guest sees the sign-in window, and after signing in the section opens by itself.
- Every item of the bottom bar opens, from open chats too, and a second tap scrolls the page to the top. Above the chat list the bottom bar stays in place.
- The search page has its own search field. Before, the hint pointed to a field in the header that a phone does not have.
- "Create post" in the feed and on the profile opens the full-screen editor. Before, on Android the button opened the camera, and there was no way to write a post from a phone.

## Help

- **The help is complete:** 92 articles in Russian and English, from the first steps to the wallet, the messenger, files, mini apps, the network and troubleshooting, plus the FAQ and a glossary.
- The link the help copies leads to the article on GitHub: there is no bastyon.com/help page.

## Wallet and transfers

- **The message of a transfer now reaches the recipient.** It used to get lost on the way and never reached the blockchain. The message is public, and the form says so. It holds 80 bytes, which is about 80 Latin or 40 Cyrillic letters, and the form shows how much is left. A long Russian message used to break the whole transfer.
- **Tips are visible on the chain:** the wallet history marks them "Tip", and the recipient gets a "Tip received" notification.
- When the node does not return a balance, the wallet shows "—" instead of "0 PKOIN".
- The earnings cards are named after what the node actually counts: "Received with comments" and "Received as transfers and tips".
- The block explorer shows the text of a transfer, and "Share" gives a link the recipient can open. The boost tooltip no longer says the author gets the coins: they go to the fee.

## Notifications

- **Notifications understand the events the node actually sends.** A comment on your post no longer looks like "New post". Comment ratings, reposts, boosts and new posts of authors with the bell on have proper titles, and their switches in the settings now take effect.
- **New notifications about received PKOIN**, with the amount and the sender, and about lottery rewards.

## Messenger

- **A contact's keys can no longer be swapped silently.** If a contact's profile shows different keys, the chat keeps encrypting with the old ones until you press "Accept new keys". Before, the warning appeared, but messages were already encrypted with the new keys.
- The note of a PKOIN transfer in a personal chat is encrypted like any other message. Transfers from forta.chat show as a card instead of code.
- When a voice message cannot be recorded, the chat says why: no permission, no microphone, or another program is using it.
- The connection state of the chat server is shown in the interface language.
- The explorer link of a transfer and bastyon:// links in messages open their page and close the full-screen chat.

## Posts and the feed

- **Posts "for subscribers" and "for registered users" are shown only to the people they are for.** Everyone else sees a note instead of the text. Posts "for paid subscribers" are shown only to the author: the app cannot check a paid subscription yet.
- "Share" links and the embed code open on bastyon.com. Links to bastyon.com posts and profiles open in the app.
- Vimeo videos and videos from posts made in the old app play in the player. In the macOS and Linux apps a YouTube video shows a "Watch on YouTube" button instead of error 153.
- Editing a comment no longer wipes its pictures and link.
- Nicknames show under posts even when the first name lookup fails. "Latest comments" refresh by themselves once a minute.
- Search understands the letters of all nine interface languages. Before, ё, umlauts and Serbian letters got lost, and Chinese and Korean queries were not sent at all. The search button now shows a magnifier instead of a key.

## Other

- **The "Private key" screen shows the phrase of this very account.** With several accounts it could show another account's phrase before.
- When a registration is not confirmed within 30 minutes, the app suggests "Finish registration" in the account menu instead of signing up again: a new sign-up would spend the free-coin limit of your IP address.
- A profile shows its address, registration date and links even without an "About" text. The profile language at sign-up comes from the interface language. The blocking texts explain that a block works both ways.
- Mini apps open only over https, except those running on your own computer (localhost).
- The hint about IPFS pinning services names services that work: Pinata, Filebase, your own ipfs-cluster. A file the service failed to keep can be sent again.
- The "Report a bug" button is hidden while the messenger is off: the report goes through the chat.
- Video compression shows the format it will actually produce: H.264 and AAC in MP4.
