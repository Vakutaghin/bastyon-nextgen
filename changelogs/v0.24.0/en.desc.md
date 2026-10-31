# v0.24.0 — Videos without a network, a lock code and Back without a restart

Videos and tracks can be downloaded and watched offline. The app can be locked with a PIN or an unlock pattern. On the phone, Back no longer closes the app, and the “Auto” network mode no longer moves to nodes over drops in the background. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Videos without a network

- **“Download”** under a video in a post and in the three-dot menu in “Video” and “Audio”. The app asks for a quality and shows the free disk space; with **“Remember”** it downloads right away next time. While downloading, the button shows a ring with the percentage.
- **The “Downloads” tab** in “Video” and “Audio”: what is downloading and why something is paused, **“Retry”**, **“Delete all”**. A downloaded video opens in a window with its description and chapters, no network needed. Without a network, a **“No network”** bar on the home page links to your downloads.
- **Downloads play from the device** even when the network is up: no traffic, instant seeking. With Tor on, such a video plays without the warning.
- **A download does not start over**: if the network drops or the app is closed, it continues from the same place. Every piece is checked against the server's checksum, so no broken file is left.
- **On Android** it downloads in the background with a notification, over Wi-Fi only by default. **In the browser** — while the tab is open; Safari private windows cannot download.
- **A video deleted by its author stays** on your device with a mark. There are no time limits.
- The default quality, “Wi-Fi only” and “Delete all” are in **“Settings”** → **“System”** → **“Downloaded videos”**.

## Lock code

- **A PIN or an unlock pattern** keeps the app closed to whoever holds your phone or computer: **“Settings”** → **“Security”** → **“App sign-in”**. The code is asked at launch and after a break (by default a minute on the phone, 15 minutes on a computer), and before showing the recovery phrase.
- **Forgot the code** — remove it with the 12 words or the key of any account on this device: accounts and chats stay.
- While a code is set, Android does not show your chats in the recent apps list.
- The **“Private key”** settings tab is now called **“Security”**.

## Phone

- **Back in a chat no longer closes the app.** First it closes whatever is on top: a dialog, a picture, the conversation, the messenger. Then it goes to the previous page, and on the first page it minimizes the app; when you come back, everything is where it was, with no reload.
- **Back closes dialogs**: sign-in, confirmations, settings windows.
- **When you come back to the app**, notifications and chats reconnect right away instead of after a pause.
- **Settings on the phone**: tabs in one row, even margins, nothing runs off the screen.

## Network

- **“Auto” no longer moves to nodes over drops in the background.** While the app is minimized, the phone may cut its network, and “Auto” used to decide the proxies were down: not all images loaded and chats were slow. Now such failures do not count, and the proxies are rechecked every minute and when you come back to the app.
- **“Direct to nodes”**: if a node does not answer in 4 seconds, the same request goes to the next one. A hung node used to hold it up to 30 seconds.

## Fixes

- Messages in large groups no longer freeze the app while decrypting.
- Taps no longer stop working after a menu closes badly.
- On slow phones the app no longer freezes at launch while opening the key storage.
- Sending a message turns voice input off.
- “App info” for support now includes a freeze log: if the app is slow, it shows where.
