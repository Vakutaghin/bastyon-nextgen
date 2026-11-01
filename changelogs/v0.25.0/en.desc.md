# v0.25.0 — “Download all”, subscription videos by themselves and playlists with the screen off

A playlist or a personal list can be downloaded in one go, and fresh videos from subscriptions download by themselves on Wi-Fi. Downloads can move to another disk or a memory card. Chats no longer hang while loading, the video speed is remembered, and voice input is faster. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Videos without a network

- **“Download all”** for video and audio playlists and personal lists: “Saved”, “Watch later”, “My music” and your own playlists. The quality is chosen once for all videos, and each option shows how much they take together. What is already downloaded is not downloaded again. Videos that are still processing or whose server doesn't answer are skipped, and the app tells you how many.
- **New videos from subscriptions download by themselves** if you turn it on in **“Settings”** → **“System”** → **“Downloaded videos”**. While the app is open and on Wi-Fi: up to 5 fresh videos at a time and no more than 20 in all, and only if more than 2 GB stay free on the disk. Such a video is marked “Downloaded automatically” and goes away after a week unless you tap **“Keep”**.
- **“Where to keep”**: on a computer you can pick your own folder, for example on another disk; on Android, the memory card. Downloads move there: first everything is copied, the old copies are deleted only afterwards, and if something fails everything stays where it was. If the disk is unplugged or the card is out, new downloads go to the standard place, and once the disk is back, its downloads show up again.

## Chats

- **A chat no longer hangs on “Loading messages...”.** If the chat server is slow to answer, after 15 seconds you see what has loaded so far and a **“Retry”** button. A message that takes long to decrypt no longer holds up the whole chat and falls into place once it is decrypted.
- After switching accounts, the profiles of the people you chat with can no longer wait forever.

## Player

- **One speed for the whole app, and it is remembered**: a new video, a track and background playback all go at the chosen speed.
- **A video pauses when scrolled away only in feeds.** In an open post, the post window and a playlist it keeps playing.
- **A video playlist on Android plays on with the screen off**: the next videos play by themselves. When you come back, the video the playlist got to is open, at the same spot.
- **Closing a playlist** in the mini player and in “Up next” on the post page is now in the **“More”** menu (three dots), so it can't be closed by accident. The same menu has **“Open playlist”**, and the playlist title is now a link to it.

## Voice input

- **The second press turns the microphone off at once**: the button goes dark, and the app writes in the last phrase by itself.
- The field scrolls after the text, so the last line is always visible.
- The draft while you speak has no period at the end; the finished phrase keeps its punctuation.
- **Faster on a CPU**: the “Fast” and “Accurate” models now come in a format the processor computes faster, especially the drafts while you speak, and a hard phrase is retried fewer times. On a computer the new file downloads by itself, and the old one keeps working meanwhile. On a phone, a **“Speed up”** button appears in **“Settings”** → **“Modules”** → **“Voice input”**.
- **Voice input settings are back on Android**, now on the **“Modules”** tab. Since 0.13.7 they were only in the desktop app, and on a phone you couldn't switch or remove a model.
