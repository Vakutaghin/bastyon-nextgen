---
keywords:
  - save chats
  - chat archive
  - old messages
  - messages disappeared
  - deleted from the server
  - chat copy
  - message storage
---

# Chats saved on this device

The Bastyon chat server keeps messages for three months and then deletes them. To keep old conversations, you can save them on your device — all chats or only selected ones.

## Turning it on

Open **“Settings”** → **“Chats”** and turn on **“Save chats on this device”**. Saving is off by default.

**“Which chats to save”** has two options:

- **“All”** — every chat is saved except the ones you turn off in the list below.
- **“Selected”** — only the chats you turn on in the list or in the chat’s menu are saved.

You can also turn on a single chat right in the messenger: the three-dot button next to the chat in the list → **“Save on this device”**. The app asks again. If saving was off altogether, it turns on for this chat only; other chats don’t start saving. The same menu has **“Stop saving on this device”**: new messages in the chat stop being saved, the saved ones stay.

New messages are saved, and so is everything the server still keeps — that is, the last three months. The app loads the history in the background, bit by bit, and carries on after a restart. If the app was not opened for a while, at the next start it saves what arrived in the meantime, as long as the server still has it. Messages you write on other devices and in the previous Bastyon app are saved too: the copy is taken from the conversation on the server.

## How it looks in a chat

While the messages are on the server, the chat looks as usual. When the server deletes old messages, they stay in the chat: scroll up and the saved ones load. Next to their time there is a disk icon with the hint **“Saved on this device: the server no longer has this message”**, and above the first message from the server there is a line saying that only what is saved on this device is above it.

Other devices and the previous app don’t have these messages: the copy exists only where it was saved.

## Where it is kept and who can see it

The copy is kept only on this device and is never sent anywhere. It is encrypted with a key derived from the account’s private key, so it can’t be read without signing in to the account — neither by another account on this device nor by someone who copies the app’s files. Each account has its own copy and its own settings.

After you sign out, the copy stays on the device encrypted and opens again when you sign back in to this account. Removing the account from the device removes its copy too.

Photos, videos, voice messages and files are not downloaded into the copy: the message with a link to the file is saved, and the file itself stays on the server.

## Deleting the saved copy

**“Settings”** → **“Chats”** lists the chats: how many messages are saved and since when. Each chat has a switch — whether to save it — and a **“Delete copy”** button. The app asks again. What is still on the server stays in the chat, and what the server has already deleted is gone for good. If saving for the chat stays on, what the server still keeps is saved again.

**“Delete all saved chats”** erases the copies of all the account’s chats. The app asks twice: the second time it warns that the messages the server has deleted exist only in this copy.

Deleting a dialog or leaving a group also deletes its copy on the device. The question before deleting says so.

## Deleting messages

A deleted message disappears from the copy too — for everyone who keeps one:

- if you delete a message the server still has, it is deleted for all participants and from the copies on their devices as well;
- if you delete a message the server no longer has, it is erased from your device, and the participants get a deletion notice: those who also save the chat in Bastyon NextGen have it erased from their copy.

You can delete someone else’s message for everyone where the server allows it: always in a private chat, in a group if you are an admin or moderator. More in [Messages](messages.md#deleting).

## See also

- [Chats](chats.md)
- [Messages](messages.md)
- [Message encryption](chat-encryption.md)
- [What is stored on your device](local-data.md)
