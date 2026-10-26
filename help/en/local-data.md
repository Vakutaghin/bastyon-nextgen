---
keywords: [cache, clear cache, web cache, cache limit, local data, storage, disk space, decrypted messages, private window, uninstall]
---

# What is stored on your device

Which data the app keeps on your computer or phone, how much space the cache takes, how to clear it and what happens in a private browser window.

Everything published is stored on the network. On the device the app keeps only what is needed for convenience and speed, and it sends none of it anywhere.

## What is on the device

- **Account keys** — encrypted, see [Protection on this device](device-protection.md). And the list of saved accounts.
- **App settings**: language, theme, feed, notifications.
- **Drafts** of posts and comments.
- **Favorites** — saved posts, see [Favorites](favorites.md).
- **Search history.**
- **Decrypted messages** — so that conversations are not decrypted again every time you open them. This can be turned off, see below.
- **Notifications** that have already arrived.
- **The places where you stopped watching** videos.
- **Web cache** — pictures, videos and pages the app has already downloaded.
- In the desktop app also the [Tor](tor.md) and [IPFS](ipfs-module.md) programs, the [voice input](voice-input.md) models, the [video compression module](video-compression.md), the [mesh networks module](mesh.md) and your [files in IPFS](my-files.md). Which of them are downloaded and how much space they take is shown on the **“Modules”** tab in the settings; you can download or remove them there too.

## The cache and its limit

In the desktop app: **“Settings”** → the **“System”** tab → the **“Local data”** section.

- **“Web cache”** — pictures, videos and pages. You see how much space it takes and can choose a limit: 100 MB, 250 MB, 512 MB (the default) or 1 GB. When the cache is above the limit, the app clears it by itself — at startup and every half an hour. The **“Clear”** button does it right away. Accounts, keys and settings are not touched.
- **“IPFS cache”** — what you opened through the [IPFS module](ipfs-module.md); the row is there while the module is downloaded. The limit is from 512 MB to 5 GB, 2 GB by default. **“My files”** stay when it is cleared.

## Decrypted messages

The **“Keep decrypted messages”** switch is in the same section. When it is on, chats open faster, but message texts are stored on the device unencrypted. Turning it off erases the saved texts, and messages are decrypted again at every start. When you sign out of an account they are erased anyway.

## Clearing saved data

**“Settings”** → the **“System”** tab → **“Clear saved data”**. This removes viewing positions, decrypted messages and saved notifications — the app loads all of that again later. Accounts, keys, settings and favorites stay.

## Private windows and blocked storage

If the browser does not let websites store data — for example, in a private window or with strict settings — the app shows **“Local storage is unavailable”**. It keeps working, but loads everything again, and after the window closes it forgets everything, including your sign-in. Usually a reload or a regular browser window helps.

## Removing everything

1. Sign out of all accounts — see [Several accounts and signing out](accounts.md). This removes the keys from the device.
2. Uninstall the app.
3. In the desktop app, also delete the data folder — Tor, IPFS, the voice input models and the web cache stay there:
   - macOS: `~/Library/Application Support/com.bastyon.app` and `~/Library/Caches/com.bastyon.app`
   - Windows: `%APPDATA%\com.bastyon.app` and `%LOCALAPPDATA%\com.bastyon.app`
   - Linux: `~/.local/share/com.bastyon.app`

On Android everything is removed together with the app.

## See also

- [Privacy: what others can see](privacy.md)
- [Several accounts and signing out](accounts.md)
- [Settings](settings.md)
