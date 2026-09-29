---
keywords: [messenger, chat, messaging, private messages, Matrix]
---

# Messenger

Private messaging in Bastyon: where it is, how it works, and how to turn it off if you do not need it.

## Where it is

- **On a computer**, the chat icon in the header opens the messenger full screen, and the round button in the bottom right corner opens it as a small window over the page.
- **On a phone**, it is **“Chats”** in the bottom bar. While the chat list is open, the bar stays visible, so you can go to any section straight from the chats.

The number on the icon is how many unread messages you have. The messenger is there only once you are signed in.

The chat list shows up as soon as the app starts, because it is kept on the device. The app connects to the server in the background, and until it is connected, a line above the list says what is going on, for example **“Connecting to the chat…”**.

## How it works

Messages go through the [Matrix](glossary.md#matrix) servers of the Bastyon network. You do not sign in to the chat separately: your Matrix account is your Bastyon account, and the app connects on its own.

Private messages are encrypted on your device, and the server sees only the ciphertext — see [Message encryption](chat-encryption.md). Chats are shared with the previous Bastyon app: a conversation started there shows up here, and the other way round.

If [Tor](tor.md) is on in the desktop app, the chat goes through Tor too.

## Turning it off

If you do not need the chat: **“Settings”** → **“General”** tab → **“Messenger”**. Turning it off removes the chat entirely: the round button, the header icon and the bottom bar item.

## See also

- [Chats](chats.md)
- [Messages](messages.md)
- [Message encryption](chat-encryption.md)
