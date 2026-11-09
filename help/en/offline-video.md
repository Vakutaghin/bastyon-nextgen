---
keywords:
  - download
  - download video
  - download audio
  - offline
  - no network
  - downloads
  - save as file
  - watch without internet
  - quality
  - Wi-Fi
  - author deleted
---

# Download to watch offline

How to download a video or a track into the app, like in YouTube, and watch it without the internet: on a plane, in the subway, where data is expensive or slow.

## How to download

Tap **“Download”** under a video or a track — in the feed and on the post page, next to the ratings and **“Share”**. The same item is in the three-dot menu of a video in the Video and Audio sections. Live streams are not downloaded. In a browser without file storage (for example, a private Safari window) the button says that downloading is not possible here.

The app asks for the quality: rows like “144p · 3 MB”, “480p · 95 MB”, and how much space is free at the bottom. Tick **“Remember”**, and later videos will download right away in that quality (if a video doesn't have it — in the nearest lower one). Tracks don't ask: they are small, the lightest option is taken.

While a video downloads, the button shows a ring with the percentage. Tap it to pause or cancel the download. When it's done, the button says **“Downloaded”**, and its menu has **“Play”**, **“Save as file”** and **“Delete download”**.

You need to be signed in to download. A video that the server is still processing after upload can't be downloaded yet — the app will say so.

## Where downloads are and how to get a file <!-- #where -->

In the header, next to the hourglass, a **“Downloads”** icon appears — an arrow pointing down. While something downloads, it shows a ring with the overall percentage and the number of downloads. Click it to see the latest ones: pause for what is downloading, resume for what stopped, **“Play”** and **“Save as file”** for what is done. At the bottom there is a link to all downloads — the **“Downloads”** tab. The icon stays while you have downloads — it is your download history. When a download finishes, the app says “Downloaded: …”.

Downloads are kept inside the app, in its data, not in your Downloads folder: the app's player opens them, and they play without a network. Where exactly — see below: [on the computer](#on-the-computer), [on the phone](#on-the-phone), [in the browser](#in-the-browser).

To get a regular file — say, to play a track in another player or send it — click **“Save as file”**: in Downloads in the header, in the menu of the **“Downloaded”** button under a post, or on a card in Downloads. On the computer a “Save as” window opens, on the phone — “Share” (from there “Save to Files” or any app), in the browser — a regular file save. A track is saved as `.m4a`, a video as `.mp4`. The download stays in the app.

## A whole collection or playlist

A video playlist, an audio playlist and a personal list (Favorites in the Video and Audio sections, “Watch later”, your own playlist) have a **“Download all”** button next to **“Play all”**. The quality is asked once for all videos: each row shows how much they take together, and every video gets the chosen quality or the nearest lower one. If a quality is remembered, there is no question. Tracks are downloaded in the lightest variant.

What is already downloaded is not downloaded again. A video that is still processing, or whose server isn’t answering right now, is skipped, and the app says how many were skipped. When everything from the list is in Downloads, the button says **“All downloaded”**.

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

You can also keep downloads in a folder of your own, for example on another disk: **“Choose folder…”** in the **“Where to keep”** row of the settings (see below). The app moves all videos there (into a “Bastyon offline” subfolder); running downloads pause for the move and continue there. Everything is copied first, and only then the old copies are deleted: if the move fails, everything stays where it was. If the disk with that folder is disconnected, the app warns you and downloads into the default folder; **“Default folder”** moves the downloads back.

With [Tor](tor.md) on, videos download only through Tor. That is also a way to watch a video under Tor without the “bypasses Tor” warning: download it — a downloaded video plays from the disk and doesn't go to the network. Through Tor downloads are slower; if Tor is still connecting, the download waits for it.

## On the phone

Downloads run in the background with a “Downloading 34 %” notification and pause and cancel buttons — you don't have to keep the app open. Android 15 limits such background work to six hours a day: when the limit is used up, the download pauses and continues when you open the app.

If the phone has a memory card, downloads can be kept on it: **“Memory card”** in the **“Where to keep”** row of the settings. Videos are moved, and downloads continue on the card; **“Phone memory”** moves them back. If the card is removed, the app warns you and downloads new videos into phone memory. The folder on the card belongs to the app: Android erases it when the app is uninstalled.

By default videos download only over Wi-Fi: no Wi-Fi — the download waits and continues by itself when it appears. To download over mobile data too, turn off **“Wi-Fi only”** in the settings (see below). A minimized app also plays a downloaded track from the device.

## In the browser

In the web version videos are stored in the site storage and download while the tab is open; closed it — the download continues next time. Safari may erase site data by itself if the site isn't opened for a week and isn't installed as an app — for long-term storage the desktop or phone app is better. Without a network the web version won't open by itself: you can watch downloads offline in a tab opened beforehand.

## New videos from subscriptions, automatically

Turn on **“Download new videos from subscriptions automatically”** in the settings (below **“Downloaded videos”**), and fresh videos from the people you follow will be waiting in Downloads — like Smart downloads in YouTube.

- The app checks the subscriptions feed while it is open: after launch, once an hour and when you come back to it. On the phone, a started download continues in the background.
- Wi-Fi only: new videos are not downloaded over mobile data.
- Up to 5 freshest videos at a time, up to 20 in total. The quality is the default from the settings, or 360p if it is set to **“Ask”**. If less than 2 GB would stay free on the disk, the app does not download.
- A video that is still processing on the server is picked up at the next check.
- The card of such a video is marked “Downloaded automatically” and shows in how many days it will be deleted: after a week it goes away by itself. Tap **“Keep”**, and it stays for good, like one downloaded by hand.

## Settings

**“Settings”** → **“System”** → **“Local data”** → **“Downloaded videos”**: how much the downloads take and how much is free, the default quality (**“Ask”** or one of the qualities), on Android — **“Wi-Fi only”**. The **“Delete all”** button erases everything downloaded on the device by all accounts. The next row is **“Where to keep”**: your own folder on the computer, phone memory or a memory card on Android.

## Several accounts

Downloads belong to an account: the Downloads tab shows only yours. If two accounts downloaded the same video, there is one file on the device. An account removed from the device — its downloads are deleted, except what other accounts need. Signing out of all accounts erases all downloads.

## See also

- [Watching videos](video-player.md)
- [What is stored on your device](local-data.md)
- [Tor](tor.md)
