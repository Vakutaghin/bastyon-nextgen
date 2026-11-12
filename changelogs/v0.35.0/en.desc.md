# v0.35.0 — mentions in groups, searching a conversation, voice message speed

In a group you can now mention a member with “@”, as in Telegram. The chat search finds messages through the whole history of a conversation, and the search above the chat list looks in all chats at once. Voice messages can be played faster, a photo shows in the conversation right after you pick it, and a chat invitation counts as a new message. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Mentions

- **“@” in a group.** Type “@” and a list of members appears above the input; the letters after “@” narrow it. Pick a person with the arrows and Enter, or with a tap. Esc closes only the list, not the chat. A member’s “@name” typed by hand becomes a mention too.
- **Mentions read like names.** Mentions from the old Bastyon and Forta Chat used to show as a long code. Now they show as “@name”, a link to the profile, and a mention of you is highlighted. The chat list, quotes, search, notifications and copied text show “@name” too.
- A mention is sent in the form the old Bastyon and Forta Chat understand.

## Searching a conversation

- **Chat search works like Telegram.** It used to just hide the loaded messages that did not match. Now it steps through matches from newest to oldest with a “3 of 17” counter, highlights the words found and searches the whole history of the chat. The server cannot search encrypted chats, so the app reads and decrypts the history on the device itself. Words match by their start, ignoring case and the difference between “е” and “ё”.
- **A “Messages” section in the search above the chat list:** matches from all chats, with the chat, the date, the sender and the words around. A tap opens the chat right at that message. This searches the messages on the device; the search inside a chat covers its whole history.
- **A quote leads to the original message.** Tap the quote in a reply and the chat scrolls to the original and highlights it, loading history if needed. The arrow at the bottom takes you back to the reply.
- **“Messages from a member” in a group:** with no words the search walks through all messages of the chosen person, with words only their messages that contain them.
- **“Jump to date”:** the calendar opens the first message of the chosen day.

## Chats

- **A photo shows right after you pick it.** Until it was sent, there was no telling whether it was uploading. Now the picture appears in the conversation at once with a spinning ring, and with a percentage once the upload starts. Several photos go one by one in the order you picked them, and to the chat where you picked them, even if you open another one meanwhile.
- **A chat invitation is a new message.** It counts in the unread number on the chats button and on the app icon, shows “1” in the list, and a fresh invitation comes with a sound and a notification.
- **Voice message speed.** While a voice message plays, a “1×” button sits next to the time: taps switch 1 → 1.25 → 1.5 → 1.75 → 2. The speed is one for all voice messages and is remembered on the device.
- **Chat photos shrink to 2048 pixels** on the long side. A phone shot weighed 3–8 MB, and everyone in the chat downloaded all of it just to look at it. Screenshots stay PNG; GIFs and animations go as they are.
- **“File” in the “Attach” menu** sends a picture at its original size (still without the location), with the 25 MB file limit.

## Posts and videos

- **“Publish” does not wait for coins for the fee.** Before every post the app spent 2–9 seconds asking the network for the account’s coins, and a hiccup at that moment left the post unpublished. Now they are fetched ahead: when the video upload window opens, when a video finishes uploading and when the editor opens.
- **The “Videos” tab of a profile:** search through the author’s videos, order (“Latest”, “Popular”, “Most discussed”, “Oldest”) and topic. The network gives more than 20 videos only in the “Latest” order, and a hint says so.
- **Post pictures are lighter** at the same size: a shot resized to 1620×1080 weighs about 360 KB instead of 490 KB.
- **Pictures from mini-apps** are fitted into 1080×1080 and lose their location, as in the old Bastyon.
- In the image editor, rotating does not spoil quality: four turns give back the original picture.

## Network

- **A post is not published twice.** On a computer a long publication was taken as failed, and publishing again could make a copy. Now the app first checks whether the post reached the network.
- **A hanging server does not slow every request.** After a failure the app no longer asks the servers that have just stayed silent: one such server cost 13–30 seconds per attempt.
- **Clearer errors.** Instead of “All RPC servers failed. Last error: Request canceled”, the video upload window and the post editor say “The Bastyon network is not responding”. The error text now names the first cause of the failure, which is usually the real one.

## Interface

- **Menu items in the top right corner stay on one line** on any screen, from a computer to a phone.
- **A downloaded picture gets a clear name:** `image_from_bastyon_2026-11-12_14-05-33.jpg` — the date and time of the download, with the extension of the picture itself.
- **Windows on the phone stay clear of the status bar and the navigation buttons.** For example, the “Send” and “Cancel” buttons of “App details” used to lie under the navigation buttons. The post window scrolls to its end above them.
