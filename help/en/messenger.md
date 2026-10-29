---
keywords: [messenger, chat, messaging, private messages, Matrix]
---

# Messenger

Private messaging in Bastyon: where it is, how it works, and how to turn it off if you do not need it.

## Where it is

- **On a computer**, the chat icon in the header opens the messenger full screen, and the round button in the bottom right corner opens it as a small window over the page. Drag the window's left or top edge or its top-left corner to resize it — up to 60% of the screen width and 80% of its height; the size is remembered. Double-click the corner to get the original size back.
- **On a phone**, it is **“Chats”** in the bottom bar. While the chat list is open, the bar stays visible, so you can go to any section straight from the chats. The system Back button first closes the open conversation, then the messenger, like Esc on a computer.

The number on the icon is how many unread messages you have. The messenger is there only once you are signed in.

The chat list shows up as soon as the app starts, because it is kept on the device. The app connects to the server in the background. While it is connecting or still loading fresh messages, a spinner with a note turns in the header next to **“Messages”**, for example **“Connecting…”** or **“Updating…”**; in an open chat, a spinner after the person's name shows that its messages are loading. While the spinner turns, the list may not be complete yet. The first time you sign in on a device, there is no list yet: while the conversations load, the list says **“Loading dialogs...”**. For an account with hundreds of chats this takes up to a few minutes. Channels show up at once: they do not need the chat server.

## How it works

Messages go through the [Matrix](glossary.md#matrix) servers of the Bastyon network. You do not sign in to the chat separately: your Matrix account is your Bastyon account, and the app connects on its own.

Private messages are encrypted on your device, and the server sees only the ciphertext — see [Message encryption](chat-encryption.md). Chats are shared with the previous Bastyon app: a conversation started there shows up here, and the other way round.

If [Tor](tor.md) is on in the desktop app, the chat goes through Tor too.

Besides conversations, the messenger lets you read authors’ posts — as channels next to your chats, see [Channels](channels.md).

## Hiding the round button

On a computer the chat opens with the round button in the bottom right corner and with the header icon. If the button is in the way: **“Settings”** → **“General”** tab → **“Floating chat button”**. The chat keeps working: the header icon opens it. The icon can be hidden too, on the **“Header and panels”** tab, but then nothing on the computer opens the chat. Phones and tablets have no round button — chats are in the bottom bar.

## See also

- [Chats](chats.md)
- [Channels](channels.md)
- [Messages](messages.md)
- [Message encryption](chat-encryption.md)
