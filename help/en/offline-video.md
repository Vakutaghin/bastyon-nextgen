---
keywords: [download, download video, offline, no network, downloads, watch without internet, quality, Wi-Fi, author deleted]
---

# Download to watch offline

How to download a video or a track into the app, like in YouTube, and watch it without the internet: on a plane, in the subway, where data is expensive or slow.

## How to download

Open a post with a video and tap **“Download”** under it — next to the ratings and **“Share”**. The same item is in the three-dot menu of a video in the Video and Audio sections.

The app asks for the quality: rows like “144p · 3 MB”, “480p · 95 MB”, and how much space is free at the bottom. Tick **“Remember”**, and later videos will download right away in that quality (if a video doesn't have it — in the nearest lower one). Tracks don't ask: they are small, the lightest option is taken.

While a video downloads, the button shows a ring with the percentage. Tap it to pause or cancel the download. When it's done, the button says **“Downloaded”**, and its menu has **“Delete download”**.

You need to be signed in to download. A video that the server is still processing after upload can't be downloaded yet — the app will say so.

## Downloads

All downloaded videos are on the **“Downloads”** tab of the [Video section](video-section.md), tracks — on the same tab of the [Audio section](audio-section.md). It shows what is downloading and how much is left, why a download is waiting, and has **“Retry”**, **“Delete download”** and **“Delete all”** buttons.

Tap a downloaded video to open it in a window: the player, title, author and description with chapters. All of it is on the device, no network needed. If there is a network, the window also has **“Open post”** — with comments and ratings.

When there is no network, the home feed and the Video and Audio sections show a **“No network”** bar with a link to your downloads.

## How downloading works

- A video downloads in chunks. The network dropped, the app was closed, Wi-Fi changed — the download continues from where it stopped, not from the start. The network went away — the app continues by itself when it comes back.
- Every chunk is checked against the checksum the server provides. A damaged chunk is downloaded again: no truncated or corrupted video stays on the disk.
- If the video's server was retired, the app takes the file from the archive or a mirror — just like for normal playback.
- One or two videos download at once, the rest wait in the queue.
- If there isn't enough disk space, the download won't start — the app tells how much is needed. Space ran out on the way — the download pauses.

## A downloaded video plays from the device

If a video is downloaded, the player always plays it from the device, even when there is a network. It saves data and seeking is instant. The resume position, chapters and the mini player work as usual. Views are not counted offline.

## If the author deleted the video

Your download stays: the app never deletes anything by itself. Once a day, when there is a network, it checks downloaded videos, and if a video is on no server any more, the card gets an **“The author deleted the video”** mark. You can still watch it; only you can delete it.

There are no time limits like in YouTube: a video won't disappear even if you stay offline for a month.

## On the computer

Videos are stored in the app's data folder — not in the cache the system cleans. Downloads run while the app is open, also when it's hidden in the tray.

With [Tor](tor.md) on, videos download only through Tor. That is also a way to watch a video under Tor without the “bypasses Tor” warning: download it — a downloaded video plays from the disk and doesn't go to the network. Through Tor downloads are slower; if Tor is still connecting, the download waits for it.

## On the phone

Downloads run in the background with a “Downloading 34 %” notification and pause and cancel buttons — you don't have to keep the app open. Android 15 limits such background work to six hours a day: when the limit is used up, the download pauses and continues when you open the app.

By default videos download only over Wi-Fi: no Wi-Fi — the download waits and continues by itself when it appears. To download over mobile data too, turn off **“Wi-Fi only”** in the settings (see below). A minimized app also plays a downloaded track from the device.

## In the browser

In the web version videos are stored in the site storage and download while the tab is open; closed it — the download continues next time. Safari may erase site data by itself if the site isn't opened for a week and isn't installed as an app — for long-term storage the desktop or phone app is better. Without a network the web version won't open by itself: you can watch downloads offline in a tab opened beforehand.

## Settings

**“Settings”** → **“System”** → **“Local data”** → **“Downloaded videos”**: how much the downloads take and how much is free, the default quality (**“Ask”** or one of the qualities), on Android — **“Wi-Fi only”**. The **“Delete all”** button erases everything downloaded on the device by all accounts.

## Several accounts

Downloads belong to an account: the Downloads tab shows only yours. If two accounts downloaded the same video, there is one file on the device. An account removed from the device — its downloads are deleted, except what other accounts need. Signing out of all accounts erases all downloads.

## See also

- [Watching videos](video-player.md)
- [What is stored on your device](local-data.md)
- [Tor](tor.md)
