# v0.29.1 — chat invitations and the Services catalog

Fixes after 0.29.0. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Chats

- **A chat invitation can be accepted or declined.** When someone invited you to a chat or a group, there was no window for it: the chat joined by itself as soon as you opened it. And if joining failed, for example because the person who invited you had already left, the chat stayed empty and you could not write in it. Now an open invitation shows who invites you and to which group, with “Accept” and “Decline”. After “Accept” the conversation appears; a declined invitation disappears from the list. If joining is no longer possible, the window says so and offers to remove the chat from the list.
- If a chat could not be deleted, a message now says so. Before, the chat silently came back to the list.

## Services

- **The catalog loads more by itself as you scroll.** Few people found the “Load more” button at the very bottom, and apps past the first twenty went unnoticed. If a page fails to load, the button stays so you can try again.
- **The “Built into Bastyon” section is gone.** The page shows the catalog and the apps you added yourself. Barteron is still in the favourites on the left panel.
