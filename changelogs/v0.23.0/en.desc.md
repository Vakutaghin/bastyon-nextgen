# v0.23.0 — Incoming filter, Tor on the phone and live voice input

In chats you can hide the people who write to you: by reputation, status or nickname. Tor is built into the Android app. Voice input types as you speak on computers without a graphics card too. “Subscriptions” shows posts in every language. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Chats

- **Incoming filter.** In **“Settings”** → **“Chats”** → **“Incoming filter”** you can hide chats from people with reputation below a threshold, with or without a status (verified, moderator, shark), and specific people by nickname. Hidden chats make no sound and are not counted as unread. The eye button above the list shows them, and the number next to it is how many hidden chats have something new. The chat menu has **“Move to hidden”** and **“Unhide”**. The rules never hide chats you started. The filter works only on this device; the server knows nothing about it.
- **Unread count on the app icon**: in the Dock on a Mac, in the Windows taskbar and tray, on Linux, on the phone's app icon, in the installed web app and in the browser tab. Turn it off in **“Settings”** → **“Notifications”**.

## Tor on the phone

- **Tor is built into the Android app**, no download needed. The whole app goes through it: feed, chats, images, videos, updates. Bridges and automatic bridges work as on the computer. While Tor is connecting, the app does not go anywhere directly. The installer is about 20 MB bigger.

## Voice input

- **Words as you speak** without a graphics card too: on the phone and on computers where the processor does the recognition. Before, the text appeared there only after you stopped talking.
- **Auto stop** after 10 seconds without a new recognized word. Noise and people talking nearby no longer keep it on.

## Languages

- **“Subscriptions” in every language.** Posts of the people you follow show in any language, whatever is chosen in **“Feed language”**. The same goes for “new from subscriptions” at the top of the feed and “More videos by the author” under a video.
- **“Last comments”** follow the feed language, and tag hints in a new post follow the post language.
- **Buttons of built-in windows and empty lists** follow the interface language instead of English. Serbian is in Cyrillic.
- **The messenger sign-in error** changes language if you switch the language while it is on screen.
- **The background playback notification** on Android is in the phone's language.
- **Menus on a Mac** — the menu bar and the right-click menu — are in the system and app language instead of English.

## Phone

- **PKOIN balance** in the header next to the avatar.

## Fixes

- After switching accounts nothing of the previous one is left: Media studio, the wallet and profile settings show the new account's data, a video upload finishes under the account that started it, and a post draft stays with its account.
- “New from subscriptions” at the top of the feed no longer vanishes a second after sign-in.
