---
keywords:
  - chat
  - new chat
  - conversation
  - group chat
  - group members
  - leave group
  - mute notifications
  - search in chat
  - find a chat
  - find a person
  - delete conversation
  - contact profile
---

# Chats

How to start a conversation, find a chat or a message, see a group’s members, mute notifications, delete a conversation or hide someone’s messages.

## Starting a chat

You start a conversation with someone from their profile — the **“Start chat”** button — or with the chat button next to their name in a post header. A card with the person opens: name, reputation, followers and following, and a field for the first message. The other person gets the chat only once you send it: a single press of the button used to leave them an empty chat. If they have not published their encryption keys yet, the app says so and the text stays in the field. You can also write to someone who has never opened chats: the message waits for them. The first message goes out once the chat server confirms the other person is invited, usually within a second. If the server does not answer, the app says it could not create the chat, the text stays in the field, and you can send it again.

You can find a person right in the messenger — with the magnifier above the chat list, see [below](#find-a-chat-or-a-person) — or by name with [search](search.md).

If someone new writes to you, the chat with them appears in the list by itself, labelled **“Invitation to chat”** (for a group, with the name of who invited you) and with the time of the invitation. Its messages show when you open it: the app accepts the invitation itself.

## Why a chat has no messages

In an empty chat and at the start of a conversation the app says what it knows:

- who created the chat and when;
- **“There are no messages in this chat.”** — for example, the other person opened a chat with you in an earlier version of the app and never wrote anything;
- “Messages before such-and-such date were deleted from the server” — the chat server does not keep conversations forever and erased the old ones. The app learns this from read receipts: they are still there, while the messages they point to are gone from the server. To keep old messages, save the chat on the device — see [Chats saved on this device](chat-archive.md);
- how long messages are kept, if the chat has such a setting;
- **“Could not load the chat history.”** with details and a **“Retry”** button — a connection or server failure, not a deletion.

Messages people deleted stay in the conversation as a mark: **“You deleted a message”** or “… deleted a message” with the time of deletion. A message that could not be decrypted reads **“Could not decrypt the message”**.

## The chat list

Each chat shows the other person’s name and avatar, the start of the last message (**“You:”** if you wrote it), the time and the number of unread messages.

A group stands out at once: a people icon before its name, the group picture or a mosaic of members’ avatars with a badge in the corner instead of an avatar, and the sender’s name before the last message.

Above the list there are **“All”**, **“Personal”**, **“Groups”** and **“Channels”** switches. **“All”** shows the whole list, and the other three turn on and off like checkboxes, in any combination. **“Personal”** has one-to-one chats, **“Groups”** has groups and radio network channels ([Mesh](mesh.md)), **“Channels”** has posts of authors you read in the messenger, see [Channels](channels.md). With all three on, it is **“All”** again. The choice is remembered.

The three-dot button on a chat:

- **“Members”** — groups only: opens the group window, see [below](#group-chats).
- **“Save on this device”** — keep this chat on the device so it stays when the server deletes it. The app asks again. **“Stop saving on this device”** turns it back off, see [Chats saved on this device](chat-archive.md).
- **“Mute notifications”** — the chat stops making sounds and sending notifications. A crossed-out bell appears next to the name, the unread count turns grey, and if the server sent no count, a grey dot takes its place. **“Unmute notifications”** puts it back. The setting is kept on the chat server, so it applies on all your devices and in the previous Bastyon app.
- **“Delete dialog”** — the app asks again: **“Delete dialog?”** You leave the conversation, and it disappears from your list. The other person keeps it, and if either of you starts a chat again, it will be a new conversation. The copy of the chat saved on this device, if any, is deleted with it.
- **“Leave group”** — what groups have instead of deleting. You leave the group and stop receiving its messages. You can return to a private group only with a new invitation.

## Find a chat or a person

The magnifier in the messenger header, next to the cross, opens a search field above the list. As you type, two sections appear below:

- **“Chats and groups”** — your conversations, groups and channels whose name contains what you typed, up to five. Those whose name starts with it come first. All chats are searched, whichever switch is on;
- **“People on Bastyon”** — network accounts with that name, up to fifteen. The app searches from two letters and once you pause typing; while it searches, a spinner turns in the field.

Tap a chat to open it, or a person to open your conversation with them: the existing one or a new one, as with the **“Start chat”** button. **Enter** opens the first result. To close the search, use the cross in the field, **Esc** or the magnifier again.

## The other person’s profile

The avatar and name in the header of an open chat lead to the other person’s profile. In the conversation, the avatar next to a message does the same — that is how you open any member’s profile in a group chat.

On a computer the chat window stays open and the profile opens beneath it. On a phone the chat closes; to get back, press **“Start chat”** in the profile — it opens the same conversation.

A group has its name and member count in the header instead of a profile link; they open the group window. A chat over the radio network ([Mesh](mesh.md)) has no link: it has no Bastyon profile.

## Search

The **“Search in conversation…”** field is at the top of an open chat. It searches the messages that are already loaded: to find an old one, scroll the conversation up first — earlier messages load as you scroll.

## Group chats

Groups created in the previous Bastyon app work here too: you can read and write in them.

Press the group name in the header of an open chat to open **“About the group”**: the description, the member count, the **“Mute notifications”** and **“Leave group”** buttons and the member list. Admins and moderators come first, people who have not accepted the invitation yet come last. A large group has a **“Find a member”** field above the list. The **“Members”** item in the group’s menu in the chat list opens the same window.

For each member in the list:

- the name and avatar lead to their profile;
- **“Message privately”** opens your private chat with them, or a card to start one if there is none yet;
- **“Hide messages”** — you stop seeing their messages, as with the ⊘ button in a private chat.

This app cannot yet create groups, invite or remove members. PKOIN can be sent only in private chats.

Group messages use a simpler encryption scheme than private ones — see [Message encryption](chat-encryption.md).

## An unpleasant contact

- **“Hide messages”** is the ⊘ button next to the conversation search. It works in the chat only. Groups have no such button: you hide a member’s messages in **“About the group”**.
- **“Block”** in the person’s profile goes further: it removes them from your feeds and from the chat.

More in [Blocking](blocking.md).

## See also

- [Channels](channels.md)
- [Messages](messages.md)
- [Blocking](blocking.md)
- [Messenger](messenger.md)
