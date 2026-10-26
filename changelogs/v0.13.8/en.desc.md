# v0.13.8 — Blocking and profile as in Bastyon, file downloads, video in the background on the phone

Blocking, subscriptions and the profile have caught up with the previous Bastyon app: comments hidden by the post author are collapsed, and the profile has donation addresses. On the computer, files and images download again, and on the phone video keeps playing with the app minimised. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Blocking and comments

- **Comments hidden by the post author.** If a post author has blocked someone, that person’s comments under the author’s posts are collapsed for every reader: **“Hidden: the post author blocked this user”**. The previous app worked this way, while here such comments were shown openly. The commenter still sees their own comments, and others can open them with **“Show anyway”**.
- **Links from new accounts.** A comment linking to an outside site from an account with reputation below 20 is collapsed: **“Hidden: a link to an outside site from a low-reputation account”**. This is the previous app’s anti-spam rule too.
- **The last comment under a post in the feed** follows the same rules. It used to show even when the discussion hid it.
- **“Block author” in the post menu.** An item in the **“Share”** menu; for a blocked author it reads **“Unblock author”**.
- **Confirmations.** Blocking, unblocking and unsubscribing now ask first — in the profile, in the post header, in people lists and on the **“Blocked users”** tab. They are blockchain records, and a single stray click sent a transaction. The question windows no longer hide under the window they were opened from.
- **Subscriber and subscription lists** leave out the people the profile owner has blocked. If the list has someone you have blocked, they have **“Unblock”** instead of subscribing.
- **The feed right after signing in.** If you signed in or switched accounts right on the feed, blocked people’s posts stayed in it until you went to another page. Now blocks and subscriptions load right after signing in.

## Profile

- **“Donation addresses”.** In the **“Edit profile”** window you can add wallets in other currencies: Bitcoin, Ethereum, USDT (ERC20 and TRC20), Litecoin, Monero and six more. The app checks that an address looks like one of the chosen currency. Addresses set in the previous app show up in the form.
- **The “Tip the author” window** shows these wallets: **“Or send in another currency”**. A click copies the address.
- **A taken name** is caught before sending: **“This name is already taken”**. The **“Save”** button is active only when the profile has changes.

## Downloads

- **Files from the IPFS window.** A public file opened in the IPFS window on the computer could not be downloaded: clicking did nothing. Now images, video, audio, PDF and text have a **“Download”** button on top, and the app asks where to save the file. Download links on websites in that window work too.
- **“Download image”** — in the image viewers of posts and chats. On the computer the button in the post gallery did nothing, and chat images had none. Chat files on the computer are saved through the save dialog too. On the phone, the system “Share” sheet opens.

## Video

- **In the background on the phone.** On Android a video stopped as soon as you minimised the app or turned the screen off, although the notification with its buttons stayed. Now the video’s sound keeps playing, from the lightest quality, with pause, play and seeking from the notification and the lock screen. When you come back, the video continues from the same spot. The sound may pause for a second or two when you minimise.
- **Picture in picture.** A video in the mini window stopped when you went to another page, and there was no way to start it again. Now it plays on while the window is open.
- **Esc in the full screen messenger** closes only the open image, not the whole conversation.

## Modules and the computer

- **Modules update themselves.** IPFS, video compression and the voice input models update with the app: the new version downloads in the background and takes over at the next start. The separate IPFS update button in the header is gone. Each module’s version is shown in **“Settings”** → **“Modules”**.
- **No autocorrect on the Mac.** Text fields no longer correct words on their own — nicknames, addresses and words in other languages stay as typed.
