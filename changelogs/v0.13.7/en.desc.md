# v0.13.7 — A cache limit, a “Modules” tab, decrypted messages by choice

The desktop app now shows how much space the cache and the modules take, and the cache can get a limit and be cleared with a button. Whether decrypted messages are kept on the device is now up to you. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Disk space

- **A web cache limit.** **“Settings”** → **“System”** → **“Local data”** → **“Web cache”** shows how much it takes, and you can pick a limit: 100 MB, 250 MB, 512 MB (the default) or 1 GB. When the cache is above the limit, the app clears it by itself at startup and every half hour. The **“Clear”** button does it at once. Accounts, keys and settings are not touched.
- **An IPFS cache limit.** The **“IPFS cache”** row appears once the IPFS module is downloaded. The limit is from 512 MB to 5 GB, 2 GB by default, as before. **“My files”** stay when it is cleared.
- **Video compression temp files no longer pile up.** If the app closed in the middle of compressing a video, its temp file stayed on disk for a day. Now such files are removed at the next start.
- The **“Clear cache”** button is now called **“Clear saved data”**: it erases watch positions, decrypted messages and notifications, not the cache.

## Modules

- **A “Modules” tab in the settings.** It gathers IPFS, Tor, voice input, video compression and mesh networks: what is downloaded, how much each takes on disk and how much all of them take together. These cards moved here from the **“General”** tab.
- **IPFS can be downloaded from the settings.** The **“Download and turn on”** button does the same as the button in the header.
- **Tor can be removed.** The **“Remove”** button works while Tor is off. Bridges stay in the settings, and Tor downloads again when you turn it on.

## Privacy

- **“Keep decrypted messages”.** So as not to decrypt a conversation every time it opens, the app kept message texts on the device unencrypted. It still does by default, but **“Settings”** → **“System”** → **“Local data”** now has a switch. Turning it off erases the saved texts of all accounts on the device, and messages are decrypted again at every start.
