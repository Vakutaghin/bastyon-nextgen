---
keywords: [images not loading, video not playing, error 153, YouTube, embedded video, no images]
---

# Images or videos do not show

Why there is a button instead of an image, a video does not play or YouTube shows an error — and how to fix it.

## Tor is on

If [Tor](tor.md) is on in the desktop app, images, videos and embeds are blocked: they would load directly and reveal your IP address.

- Instead of an image there is a **“Load through Tor”** button: press it, and the image loads through Tor.
- Before a video the player asks: **“Video will bypass Tor”**. Press **“Watch bypassing Tor”** if you agree that the video server will see your IP.
- YouTube, Vimeo and other embeds are turned off: “Embeds are disabled while Tor is on: they would load directly, with your IP.”

## Embedded videos are turned off

If a post shows only a link instead of a YouTube or Vimeo player, check **“Settings”** → **“General”** → **“Show embedded videos”**.

## YouTube in the desktop app

On macOS and Linux, YouTube does not allow its videos to play inside the app window — instead of the player it showed error 153. So there a YouTube video appears as a picture with a **“Watch on YouTube”** button that opens it in the browser. On Windows, on the phone and in the browser the YouTube player is embedded in the post as usual. See [Video and audio](video.md).

## A video does not play

The player says what happened, with a **“Retry”** button under the message:

- **“Video not found on this node”** — the video was deleted from the video server or is unavailable;
- **“Video is taking too long to load”** or **“Network error while loading video”** — a bad connection or an overloaded server; try again later;
- the video was uploaded just now — the server is still preparing it; wait a few minutes.

More in [Watching videos](video-player.md).

## Images do not show without Tor

Images live on the network’s image and video servers. If a server is unavailable, the image simply does not appear in the post, and the rest of the post is visible. This is usually temporary — try later. If images are missing everywhere, check the connection — see [No connection to the network](connection-problems.md).

## See also

- [Tor](tor.md)
- [Watching videos](video-player.md)
- [Settings](settings.md)
