---
keywords: [cache, clear cache, local data, storage, private window, uninstall]
---

# What is stored on your device

Which data the app keeps on your computer or phone, how to clear the cache and what happens in a private browser window.

Everything published is stored on the network. On the device the app keeps only what is needed for convenience and speed, and it sends none of it anywhere.

## What is on the device

- **Account keys** — encrypted, see [Protection on this device](device-protection.md). And the list of saved accounts.
- **App settings**: language, theme, feed, notifications.
- **Drafts** of posts and comments.
- **Favorites** — saved posts, see [Favorites](favorites.md).
- **Search history.**
- **Decrypted messages** — so that conversations are not decrypted again every time you open them.
- **Notifications** that have already arrived.
- **Transcoded videos** and the places where you stopped watching.
- In the desktop app also the [Tor](tor.md) and [IPFS](ipfs-module.md) programs, the [voice input](voice-input.md) models and your [files in IPFS](my-files.md).

## Clearing the cache

**“Settings”** → the **“System”** tab → **“Clear cache”**. This removes transcoded videos, viewing positions, decrypted messages and saved notifications — the app loads all of that again later. Accounts, keys, settings and favorites stay.

## Private windows and blocked storage

If the browser does not let websites store data — for example, in a private window or with strict settings — the app shows **“Local storage is unavailable”**. It keeps working, but loads everything again, and after the window closes it forgets everything, including your sign-in. Usually a reload or a regular browser window helps.

## Removing everything

1. Sign out of all accounts — see [Several accounts and signing out](accounts.md). This removes the keys from the device.
2. Uninstall the app.
3. In the desktop app, also delete the data folder — Tor, IPFS and the voice input models stay there:
   - macOS: `~/Library/Application Support/com.bastyon.app`
   - Windows: `%APPDATA%\com.bastyon.app`
   - Linux: `~/.local/share/com.bastyon.app`

On Android everything is removed together with the app.

## See also

- [Privacy: what others can see](privacy.md)
- [Several accounts and signing out](accounts.md)
- [Settings](settings.md)
