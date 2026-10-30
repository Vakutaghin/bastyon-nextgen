# v0.22.0 — Telegram-style voice messages and Tor without leaks

Voice messages record from the first touch, lock with a swipe up and cancel with a swipe left. Tor 16.0, and nothing goes around it anymore. Amounts below 1 PKOIN in notifications. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Voice messages

- **Instant.** The recording time shows from the first touch of the microphone button, the microphone starts recording almost at once, and when you let go the message is sent without a pause.
- **Hands-free.** Slide your finger or the mouse up to the lock to lock the recording; **“Cancel”** and a send button appear at the bottom.
- **Cancel.** Slide left or press Esc.
- **A short press** sends nothing: a hint “Hold to record, release to send” appears above the button.
- With the keyboard, Enter or Space on the button starts a recording that is already locked.

## Tor

- **Tor 16.0.** If Tor is already downloaded, the new one downloads through Tor in the background and is installed the next time you turn Tor on.
- **Nothing around Tor.** Photos, voice messages and files in chats were sent directly even with Tor on — now they go through it. The rest is closed too: “Apply” and “Retry” in the bridges briefly let requests out directly, the window connected to a node around Tor at startup, and IPFS and notifications could work directly while Tor was connecting or when it was turned on while running.
- **Music in the mini player** first asks **“Listen bypassing Tor”** when Tor is on, like videos.
- **Automatic bridges in Russia are faster.** The Tor Project bridge service is out of reach there: the app waits for it no longer than half a minute and tries the built-in methods, including a new one — Snowflake through Google's AMP cache.
- **Linux.** Tor starts where the system has no libevent library: before, it did not start there at all.

## Interface

- **The side menu on the phone** has no account items: they are already in the avatar menu.
- **A press outside an open menu** only closes it and does not press what is underneath.
- **“Posts” view in “Video” and “Audio”** stretches with the width button in the header instead of staying a narrow column.

## Fixes

- A transfer below 1 PKOIN could show as “0” in notifications and events. Now amounts from 1 PKOIN show up to two decimals, below that up to three, and if those are zeros, up to the first non-zero digit.
- When you send photos, videos and files in a chat, you now see how many percent have been uploaded. Through Tor the file goes in one piece, so the percentage shows up at the end.
