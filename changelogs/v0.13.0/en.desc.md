# v0.13.0 — Channels in the messenger, groups with members

Any author’s posts can now be read in the messenger, next to the chats: the “Read in Messenger” button in the profile, no subscription needed. Groups stand out in the list and have a window with their members, and any chat can be muted. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Channels

- **“Read in Messenger” in the profile.** The author’s posts appear in the messenger as a separate channel. No subscription needed and no transaction. The button turns into **“Open in Messenger”**, and a crossed-out megaphone button next to it removes the channel.
- **A channel never looks like a chat.** It has the author’s square avatar with a megaphone in the corner and a violet megaphone before the name. Under the name you see what came out last: **“Photo”**, **“Video”**, **“Article”** or **“Repost”** and the start of the text. The number of new posts sits in a violet circle and does not count toward the total of messages: channels do not ring or send notifications.
- **Posts read like a conversation:** older at the top, newer at the bottom, with dates. A channel opens at the **“New posts”** line, and scrolling up loads older posts. A post opens in full, with ratings and comments. Instead of the message box, the bottom has **“Subscribe”** and **“Message the author”**.
- **The channel menu in the list:** **“Open profile”**, **“Mark as read”** and **“Stop reading in Messenger”**. If you removed a channel by mistake, tap the notification to bring it back.
- **Channels are the same on all your devices.** The list and the point you have read up to are kept on the chat server with your account. The chat server sees which authors you read in the messenger. The previous Bastyon app does not show these channels.
- **New posts are checked** every few minutes while the messenger is open.

## Chat list

- **“All”, “Chats” and “Channels” switches** above the list. **“Chats”** holds direct chats, groups and radio network channels. The choice is remembered and shared by the messenger window and the full-screen messenger. When a hidden section has something new, its switch shows the number.
- **Groups stand out.** A people icon before the name, the group picture or a mosaic of members’ avatars instead of an avatar, and the sender’s name before the last message. A group of two used to look like a direct chat, and some groups showed one member’s avatar instead of a picture.
- **“Mute notifications”** in any chat’s menu. The chat stops ringing and sending notifications, a crossed-out bell appears by its name, and its unread count turns grey. The setting is kept on the chat server, so it applies on all your devices and in the previous Bastyon app.

## Groups

- **The “About the group” window.** Tap the group name in the chat header or **“Members”** in its menu. The window shows the description, the member count, **“Mute notifications”**, **“Leave group”** and the member list: admins and moderators first, those who have not accepted the invitation yet last. A large group has a **“Find a member”** box.
- **For each member:** the profile on a tap on the name, **“Message privately”** and **“Hide messages”**.
- **The ⊘ “Hide messages” button in a group header hid a random member.** Groups no longer have it; a member’s messages are hidden in the **“About the group”** window.
- **A group invitation shows in the list at once.** It used to arrive only with some later event.
- **The first messages of a group you were invited to decrypt.** After accepting the invitation, such a group used to have no members and no key, and its first messages stayed unreadable.

## Profile and windows

- **A profile header on the phone.** The phone has no sidebar, so a profile had neither a name nor buttons, and an author without posts could not be followed. Now the top shows the name, **“Subscribe”**, the chat button and **“Read in Messenger”**.
- **A post from a chat on the phone opens over the messenger.** The post window used to end up under the full-screen messenger, out of sight.
- **Escape with a post open closes the post,** not the chat under it.
