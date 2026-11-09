# v0.33.0 — “Send to chat”, swipe to reply, a feed in several languages

A post, comment, profile, collection, file and more can now be sent straight to a chat. On the phone you can reply to a message with a swipe and select several messages, as in Telegram. The feed can be built from several languages at once, and authors with low reputation can be hidden from it. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Send to chat

- **“Send to chat” in a post’s Share menu and in the comment menu.** The window lists your chats, the freshest first, with a search. Pick up to 10 chats and add a caption if you like. Below are “Copy link” and “Share via…”. The window closes at once, and the message joins the chat as if typed there: without a connection it waits.
- **Where else:**
  - a new “Share profile” menu on a profile, your own included;
  - the collection page and the list menu in “Collections and playlists”;
  - video and track menus in lists (which also gained “Copy link”) and in the media studio;
  - files and permanent links in “My files”;
  - a “To chat” button on a transaction, block and address in the blockchain explorer;
  - the Share button in mini apps.
- **A private file’s link carries its key,** so it cannot be sent to open groups: messages there are not encrypted.
- **Profile and collection links arrive as cards.** A profile shows the avatar, nickname and reputation; a collection shows the cover, title, number of entries and author. A tap opens them in the app.
- A `bastyon.com/author?address=…` link opens the right profile instead of a profile named “author”.

## Chats

- **Swipe to reply.** On the phone, drag a message to the left with your finger: an arrow appears on the right, and past the threshold the phone gives a short tick. Let go and the reply is ready to type.
- **Several messages can be selected.** Selection starts with a long press on the phone, a mouse drag next to the messages, or “Select” in the message menu. The input field gives way to the count and the “Reply” (for one message), “Copy” and “Delete” buttons. Shift+click selects a range, Ctrl+C copies, Delete deletes, Esc clears the selection.
- **The unread counter counts chats, not messages.** If two people sent 2 and 3 messages, the messenger button, the app icon and the tab title show 2, as Telegram does. Each chat in the list still shows its own number of messages.
- F in the expanded messenger no longer turns the feed video behind it full screen.

## Feed

- **A feed in several languages at once.** “Feed language” now takes several languages, and their posts come as one feed — by time, by ratings or by comments, as the chosen section sorts them. Subscriptions and Favorites still show all languages. Tags, categories and promoted posts use the interface language when it is among the chosen ones, otherwise the first of them.
- **“Author reputation”** hides posts by authors below the chosen reputation: from 0, 10, 100, 1,000, 10,000 or a whole number of your own. It works in the feed, Video, Audio, Articles and Discussed, but not in Subscriptions and Favorites. Your own posts are never hidden. When only hidden posts keep coming, the feed stops and offers “Keep looking”.
- **The new posts button says “20+”** when there are more new posts than one check sees. After a break it used to always say exactly 20. The same goes for “New posts live”.

## Voice input

- **You now dictate punctuation yourself:** “comma”, “period”, “question mark”. The model writes only words and adds no marks of its own, so the result is predictable. The old behaviour is “The model adds it” in the “Punctuation” setting under Voice input.

## Windows

- **An app installed in Program Files updates again without administrator rights.** If its folder cannot be written to, the update asks whether to move the app to your account’s folder (shortcuts follow it), install the update with administrator rights, or wait. If the 0.32 update did not install for you, download this version and install it by hand: the installer offers a suitable folder. Later updates will ask by themselves.
