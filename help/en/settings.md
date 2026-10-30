---
keywords: [settings, preferences, content, modules, cache, diagnostics, what’s new, settings tabs, header and panels, header and menu, header icons, account menu, menu order, left panel, left panel sections, hide categories, hide tags, page width, closing the window, menu bar, saving chats]
---

# Settings

Every settings tab in order: what each one holds and where to read more.

Settings open from the account menu — **“Settings”**. They are available only once you are signed in. The language, theme and other app options are shared by all accounts on the device.

## General

- **“Language”** and **“Theme”** — see [Language and appearance](appearance.md).
- **“Page width”** — **“Limited”** or **“Full width”**, and **“Button in the header”** to switch quickly; on a computer only, see [Language and appearance](appearance.md).
- **“Content”**:
  - **“Show embedded videos”** — YouTube and Vimeo players right in the post; turned off, a link remains;
  - **“Autoplay videos”** — a video starts once it appears on screen;
  - **“Link previews”** — a card with the title and image under a link;
  - **“Comments order”** — the order a discussion opens in, see [Comments](comments.md);
  - **“Floating chat button”** — the round button in the bottom right corner, on a computer; without it the header icon opens the chat, see [Messenger](messenger.md).

## Header and panels

What stands in the header to the right of the search, what is in the avatar menu and what is in the left panel — and in what order.

- **“Header icons”** — **“Services”**, **“Notifications”**, **“Chats”**, Tor, IPFS, the theme switch, **“Page width”** and **“Report a bug”**. The hourglass is not configurable: it appears on its own, next to the bell, when an action is waiting for the network. The avatar is always at the edge.
- **“Account menu”** — the items of the avatar menu. **“Settings”** cannot be hidden: that is how hidden items are brought back. **“Switch account”** and **“Sign out”** are always at the bottom.
- **“Left panel”** — the sections to the left of the feed, see [Finding your way around](interface.md#the-left-panel); on a phone this is **“Navigation”** in the side menu. If you hide **“Feed”**, the logo in the header still leads to the feed. Pinned mini apps come below the sections; unpin them with the star in the catalog, see [Services](mini-apps.md).
- **“Below the sections”** — what comes below the sections in the left panel, and on a phone at the bottom of the side menu: the **“Best first”** switch with the **“Feed language”** field, **“Categories”** and **“Trending tags”**. A hidden block has no effect: whatever was selected in it is cleared. The feed goes in the usual order and in the interface language, without filtering by categories and tags.

The switch on the right shows or hides an item. To change the order, drag a row by the handle on the left — with the mouse or a finger. From the keyboard: Tab to the handle, then the up and down arrow keys. Everything changes at once, there is nothing to save. **“Restore defaults”** under the list brings back the original set and order.

Items that this version of the app does not have are shown with an explanation, and their switch does not turn on. Tor, IPFS and **“My files”** are only in the desktop app, **“Mesh networks”** — also on Android.

What hiding an icon means:

- without the bell, notifications still pop up; turn them off on the **“Notifications”** tab;
- without the speech bubble, chats open with the round button in the bottom right corner, and on a phone with **“Chats”** in the bottom bar;
- Tor and IPFS are turned on and off only from their icons: a hidden icon does not turn them off, but there is nowhere to control them from until you bring the icon back.

On a phone only the bell and the theme fit in the header, in the order set here. The layout is per device and shared by all accounts on it. Until you change anything, the app keeps the default layout and updates it by itself in new versions.

## Notifications

Which events to show, sound and system notifications — see [Notifications](notifications.md).

## Chats

**“Privacy”** — what the people you chat with see about you: “online”, “typing”, “recording a voice message”, see [Chats](chats.md#what-the-other-person-sees-about-you). Below it — whether to save chats on this device — the chat server deletes them after three months — for all chats or selected ones, how much is saved and how to erase it. See [Chats saved on this device](chat-archive.md).

## System

- **“Network connection”** (in the desktop and Android apps) — **“Auto”**, **“Proxy”** or **“Direct to nodes”**, see [Proxy or direct to nodes](network.md#proxy-or-direct-to-nodes).
- **“Animations”** — smooth transitions; turn them off if the app feels sluggish.
- **“Interface scale”** and **“Launch at login”** — in the desktop app, see [Language and appearance](appearance.md) and [The desktop app](desktop-app.md).
- **“When the window is closed”** (Windows and Linux) — **“Minimize to tray”** or **“Quit the app”**; **“Icon in the menu bar”** (macOS) — whether Bastyon shows at the top of the screen. See [The desktop app](desktop-app.md).
- **“Local data”**: **“Web cache”** and **“IPFS cache”** with a limit and a **“Clear”** button (in the desktop app), **“Keep decrypted messages”** and **“Clear saved data”** — see [What is stored on your device](local-data.md).

## Modules

Only in the desktop app. The programs the app downloads when you ask, and how much disk space each one takes:

- **“IPFS module”** — **“Download and turn on”** or **“Remove module”**, see [The IPFS module](ipfs-module.md);
- **“Tor”** — downloads by itself the first time you turn it on; you can remove it here while it is off, see [Tor](tor.md);
- **“Voice input”** — the recognition models, see [Voice input](voice-input.md);
- **“Video compression module”** — see [Video compression](video-compression.md);
- **“Mesh networks module”** — download, update or remove it, see [Chatting over radio](mesh.md).

Under each module you can see how much space it takes and its version. Modules update together with the app: a new version downloads in the background and takes over at the next start, while the old one keeps working.

## Private key

The recovery phrase and account key, checking that the phrase is written down, and protection on this device — see [Recovery phrase and private key](recovery-phrase.md) and [Protection on this device](device-protection.md).

## Blocked users and permissions

- **“Blocked users”** — whom you have blocked, see [Blocking](blocking.md).
- **“App permissions”** — what you allowed mini apps, see [Mini app permissions](mini-app-permissions.md).

## What’s new

At the top are the app version, where it is installed, and the **“Check”** button: whether there is a new version, see [Updates](updates.md). Below are the changes in every version of the app, newest first. They are also in the help — see [Version history](releases.md).

## Network and connection

Proxies, nodes and the path of your requests are not in the settings but in the **“Blockchain explorer”**, on the **“Network”** tab. The proxy for the explorer is chosen there too — see [Blockchain explorer](explorer.md#network-the-node-map).

## See also

- [Language and appearance](appearance.md)
- [Notifications](notifications.md)
- [What is stored on your device](local-data.md)
