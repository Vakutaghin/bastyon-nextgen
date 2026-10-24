# v0.13.4 — Chats on the phone, version history, account badges

On the phone, a big account’s conversations load again, a video from a channel no longer flickers, and the phone layout is tighter. In “What’s new” you can page through past versions, and the help now has a version history and an article on account badges. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Messenger

- **Conversations load on the phone even for an account with hundreds of chats.** The first chat load on a new device brings tens of megabytes for a big account. The phone ran out of memory on them, and the load stopped silently: no error, but no conversations either, only the channels stayed in the list. Now the chat server’s answer is saved to the device piece by piece, and even 40 megabytes load in a few seconds.
- **You can see that conversations are still loading.** Channels show up at once, since they do not need the chat server, and they made the list look ready. Now, until the conversations arrive, **“Loading dialogs...”** is shown above the channels.

## Video

- **A video from a channel no longer flickers.** A video opened from a channel starts by itself, and a softly blinking placeholder stayed over it, as if something were loading. Now the placeholder shows only while the thumbnail loads.

## Phone

- **A lower header, the logo left of the menu.** The header is 8 pixels lower, and the logo comes before the menu button. The phone header no longer has the language flag; change the language in **“Settings”** → **“General”**.
- **A lower bottom bar, buttons in a new order:** **“Home”**, **“Search”**, **“Chats”**, **“Wallet”**, **“Services”**. There is less empty space under the labels.
- **Tighter lines.** Line spacing on the phone is a little smaller throughout the app, so more text fits on the screen. On a computer nothing changed.
- **The comment field.** Its text and hint are smaller, and the lines are tighter. The field grows with the text up to seven lines, then scrolls, and the buttons stay by the last line.
- **Titles no longer hide under the header.** The **“Wallets”** title went under the header together with the status bar. The same happened to the start of a post opened from a link (on a computer too) and to the new post page, and in a narrow computer window to **“My files”** and **“Mesh networks”**.
- The line “Bastyon is a decentralized social network” is gone from the bottom of pages.

## “What’s new” and help

- **Past versions in “What’s new”.** The arrows at the bottom of the window page to earlier versions and back, and **“All versions”** opens the history in the help.
- **Version history in the help.** The table of contents now ends with the **“Version history”** book, with an article for each released version, newest first. Search finds it, and the help home shows the latest versions with a link to the rest.
- **The “Account badges” article.** It explains what **“Verified”**, **“Moderator”**, **“Shark”** and **“Established”** mean, what they are given for and when they are taken away. The rules are checked against the node’s code.

## Account badges

- **Each badge has its own colour.** **“Verified”** is blue, **“Moderator”** gold, **“Shark”** purple, **“Established”** green.
- **A hint on tap.** Tap a badge in a profile: a short explanation appears, and **“More in the help”** opens the article. On the phone, badges now show under the name.
- **The avatar mark is at the top left.** At the bottom right it was mistaken for the “online” dot, especially in chats. The mark has the badge’s colour, the crown and flag are filled, and the check is thicker. In the dark theme the mark is easier to see: a white line on bright green was barely readable.
