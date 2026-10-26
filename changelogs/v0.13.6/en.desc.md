# v0.13.6 — Video in the AppImage, new chats in their place, a channel without the bottom bar

Video and sound play again in the AppImage on current Linux distributions, a new chat no longer hides at the bottom of the list, and a messenger channel has more room for the feed. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Messenger

- **A new chat does not hide at the bottom of the list.** When the other person starts the conversation, you are only invited until you open it, and the server does not hand out the messages yet. Such a chat sat at the very bottom of the list and moved to its place only after you opened it. Now it is placed by the time of the invite and marked with the **“New messages”** dot.
- **A channel without the bottom bar.** You can follow the author in their profile, and **“Message the author”** is now an icon next to the channel name in the header. The freed row goes to the feed.
- **The messenger window no longer blends into the page.** The widget had only a shadow, which is invisible in the dark theme. Now it has a border in both themes, and the big messenger’s border is more visible.

## Video

- **On a slow computer the quality goes down by itself.** If the processor cannot keep up and more than a fifth of the frames are dropped, the player switches to a lower quality. Before, it looked only at the network speed and on a slow laptop could keep 1080p, loading the processor completely.

## Installation

- **Video and sound play in the AppImage on current Linux.** Video and sound in the app are played by GStreamer. The AppImage carried its core from Ubuntu 22.04 but took the plugins from the system, and on Ubuntu 24.04, Linux Mint 22 and other current distributions no plugin matched that core. Now the needed plugins are inside the AppImage. The file grew from about 90 to 140 MB.
- **On Debian, Ubuntu and Linux Mint the .deb package is the better choice.** It uses the system WebKit and codecs, which are newer, and the graphics card can decode video instead of the processor. The “Installing the app” help article now says so.
