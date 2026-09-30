---
keywords: [video, audio, PeerTube, YouTube, Vimeo, podcast, music]
---

# Video and audio

Where video and audio in Bastyon come from, how to watch and listen to them, and how to upload your own.

## Your own video lives on PeerTube

Video and audio uploaded to Bastyon are stored on [PeerTube](glossary.md#peertube) video servers that work for the network. Only the post with a link to the clip goes to the blockchain — a link like `peertube://server/identifier`. The file itself is not stored on the blockchain. When the network shuts down an old server, its clips move to an archive, and the player finds them there by itself.

Such clips play in the built-in player right in the feed — see [Watching videos](video-player.md). All posts with video are collected in the **“Video”** section of the left panel, posts with audio in the **“Audio”** section.

How to upload your own — see [Uploading video and audio](video-upload.md). In the desktop app a large video can be made smaller beforehand — see [Compressing a video](video-compression.md).

## YouTube and Vimeo

If a post has a YouTube or Vimeo link, that site’s player appears under it. It loads from YouTube’s or Vimeo’s servers, and they see your IP address — see [Privacy: what others can see](privacy.md). If you do not want that, turn off **“Show embedded videos”** in the [settings](settings.md): a link remains instead of the player.

In the desktop app on macOS and Linux the YouTube player does not work — YouTube refuses to show videos in such a window. There you see the video’s picture and a **“Watch on YouTube”** button instead: the video opens in the browser.

If [Tor](tor.md) is on, the YouTube and Vimeo players do not load, and PeerTube clips go around Tor only with your consent.

## See also

- [Watching videos](video-player.md)
- [Uploading video and audio](video-upload.md)
- [Privacy: what others can see](privacy.md)
