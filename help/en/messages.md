---
keywords:
  - message
  - reply
  - swipe
  - reaction
  - delete message
  - read receipt
  - emoji
  - typing
  - not sent
  - retry sending
  - unsent message
  - select messages
  - select several messages
  - copy messages
---

# Messages

How to write, reply to and react to messages, select and delete them, and tell whether a message was delivered.

## Writing

Type in the **“Type a message...”** field and press Enter or the send button. Shift+Enter starts a new line. The smiley button opens emoji; click elsewhere or press Esc to close them. In the desktop app you can dictate the text — see [Voice input](voice-input.md).

An unfinished message stays in its chat: you can go back to the list or to another chat and return to it. These drafts live only in the app's memory — they are never written to disk and are gone after you sign out or restart the app.

A link to a Bastyon post turns into a card: the author, a picture and the start of the text, and a click opens the post. Links to other sites get no card in an encrypted conversation: building one would mean showing the link to a server.

To send a photo, a file or a voice message, see [Photos, videos and files in chat](chat-attachments.md) and [Voice messages](voice-messages.md).

## Replies and reactions

- The three-dot button on a message is **“Actions”**. **“Reply”** — your reply will quote the original message; above the input field you see what you are replying to, and the cross cancels the reply.
- On a phone there is a quicker way: swipe the message to the left with your finger, as in Telegram. An arrow appears on the right; when it turns coloured, let go and the reply is set. If you stop short or bring your finger back, nothing happens. Swiping does not work while selecting messages or on messages that have not been sent yet.
- The smiley button on someone else’s message is **“Reaction”**: 👍 ❤️ 😂 😮 😢 🙏. Reactions show under the message with a count.

## Selecting several messages

As in Telegram: selected messages can be copied or deleted in one go.

- **On a phone** — press and hold a message.
- **On a computer** — hold the mouse button on the empty space next to a message and drag across others: everything in between gets selected. At the edge of the feed it scrolls by itself. Dragging over text selects the text, as before.
- **Anywhere** — **“Select”** in the message’s **“Actions”** menu.

Circles appear on the left of the messages. Tapping a message checks or unchecks it, Shift+click checks everything from the previous one. Links, pictures and players don’t open meanwhile. Uncheck the last one and the mode turns off.

In place of the input field you see how many are selected and the buttons:

- **“Reply”** — when one message is selected.
- **“Copy”** — the text of the messages to the clipboard. One message is copied as is, several — in order, each with the name and time: “Name, [11/09/2026, 02:30 PM]”. Photos, videos and voice messages are copied as their type, a file — with its name.
- **“Delete”** — for everyone, with the same question as for one message. The button is there only when all the selected messages can be deleted: other people’s — if you have that right (see [below](#deleting)), unsent ones — one at a time, with **“Delete”** under them.

The cross, Esc or Back on Android clear the selection. On a computer Ctrl+C copies the selected messages and Delete deletes them.

## Deleting

In the **“Actions”** menu of your own message — **“Delete”**. The app asks again: **“Delete message?”** The message is deleted for everyone in the chat, and in its place a **“You deleted a message”** mark with the time stays — for the other person, with your name.

Someone else’s message is deleted the same way — for everyone — if the chat server allows it: in a private chat both people have that right, in a group admins and moderators do. Where you don’t have it, other people’s messages have no **“Delete”** item.

If the chat is saved on the device, a deleted message is erased from the copy too — yours, and the other person’s if they save the chat as well. A message the server no longer has is removed from the device. See [Chats saved on this device](chat-archive.md#deleting-messages).

A sent message cannot be edited.

## Was it delivered

- The time on a message: today's show only hours and minutes, older ones also the date. Hover over it for the full date.
- **…** next to the time of your message means **“Sending”**.
- **✓** means **“Sent, not read yet”**: the message reached the server.
- **✓✓** means **“Seen”**: the other person opened the conversation and saw the message; in a group, at least one member did. A message counts as read only while the chat is open on screen: not in a minimized messenger, another tab or a hidden app window.
- “typing…” above the input field means the other person is typing.
- **“Not sent”** means the message did not go out, for example the connection dropped. You can send it again or delete it, see [below](#if-a-message-was-not-sent).

The same marks show in the chat list, next to your last message in a chat, and **!** there means it was not sent. While your message is going out, or if it did not go out, the list shows that message rather than the previous one — with **…** or **!**. In a private chat the mark itself says the message is yours, so “You:” appears before it only in groups.

## If a message was not sent

A message that did not go out has **“Not sent”** under it and two buttons:

- **“Retry”** — send it again. This works for text and for attachments alike: a voice message, photo, video or file goes out as the same file, with no need to record or pick it again. An unsent voice message can be played — the recording is already on the device.
- **“Delete”** — remove the message. The server does not have it, so it is deleted from this device only; the app asks again: **“The message was not sent and exists only on this device. Delete it?”** Chats over radio do not have this button.

An unsent message does not disappear when you close the app: it is kept on the device encrypted, and after a restart it is back in the chat with **“Retry”**. An attachment larger than 25 MB is not saved on the device — such a message stays only while the app is open. After you sign out, unsent messages stay on the device encrypted and come back to the chat the next time you sign in. See [What is stored on your device](local-data.md).

## Message notifications

When a message arrives in a chat that is not open, a sound plays, the chat’s unread count in the list goes up, and the messenger icon shows how many chats have unread messages. Several messages in a row make one sound, and a message the other person edited makes none. The **“Sound”** switch in the [notification settings](notifications.md) turns the sound off. If **“Browser notifications”** are on in the [notification settings](notifications.md) and the app window is minimised, the system tells you too — without the text: the sender’s name and what arrived, for example “New message” or “Image”.

## See also

- [Chats](chats.md)
- [Photos, videos and files in chat](chat-attachments.md)
- [Voice messages](voice-messages.md)
