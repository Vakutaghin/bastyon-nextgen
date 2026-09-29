---
keywords:
  - player
  - video quality
  - speed
  - fullscreen
  - autoplay
  - background playback
  - subtitles
  - chapters
---

# Watching videos

Quality, speed, fullscreen, keyboard shortcuts and what to do if a video does not play.

## The player

Click a clip to start it, click again to pause. A double click makes the video fullscreen.

At the bottom of the player:

- play and pause, volume — a slider and a mute button;
- the gear button: **“Quality”** and **“Speed”**. Quality is **“Auto”** by default — the player picks it for your connection speed. Speed goes from 0.25× to 2×;
- the progress bar and the time;
- picture-in-picture, if the system supports it, and fullscreen.

Only one clip plays at a time: start another and the first one pauses. A clip you scroll off the screen pauses too.

**Where you stopped.** If you close a clip longer than a minute and a half halfway through, next time it continues from the same place. The position is kept on this device.

**Chapters.** If the video’s description has timecodes — `0:00 Intro`, `3:15 The main part` — they become chapters: marks on the progress bar, with the current chapter’s name next to the time. Click a timecode in the text to jump to that moment.

**Subtitles.** If the clip has subtitles on PeerTube, they turn on by themselves.

## Keyboard shortcuts

The keys act on the fullscreen clip, or if there is none, on the one that is playing or was started last. Until you have started any clip, the space bar scrolls the page as usual.

| Key | What it does |
|---|---|
| Space or K | play and pause |
| ← and → or J and L | back and forward 10 seconds |
| ↑ and ↓ | volume |
| M | sound on/off |
| F | fullscreen |
| Shift + > and Shift + < | faster and slower |
| Shift + ? | list of keys — **“Keyboard shortcuts”** |

Other shortcuts of the app are in [Keyboard shortcuts](keyboard-shortcuts.md).

## Autoplay and embedded videos

In the [settings](settings.md):

- **“Autoplay videos”** — a clip starts playing as soon as it appears on the screen. Off by default;
- **“Show embedded videos”** — YouTube and Vimeo players right in the post, see [Video and audio](video.md).

## More from this author

On a video post’s page, under the clip, there is **“More from this author”**: their other clips. Click one to go to it.

## On a phone

In the Android app a clip or audio keeps playing when you minimise the app or turn off the screen. You can control it from the notification and the lock screen. While the app is minimised, the video plays in the lowest quality: the picture is not visible anyway, and the sound is the same.

## With Tor

If [Tor](tor.md) is on, the player asks before starting: **“Video will bypass Tor”**. The PeerTube server will see your IP address, while node requests and the chat stay in Tor. Click **“Watch bypassing Tor”** if you agree.

## If a video does not play

The player says what happened, with a **“Retry”** button under the message:

- **“Video not found on this node”** — the clip was removed from the server or is unavailable;
- **“Video is taking too long to load”** or **“Network error while loading video”** — a poor connection or a busy server: try again later;
- the clip was uploaded just now — the server is still preparing it for playback. Wait a few minutes and click **“Retry”**.

More in [Images or videos do not show](media-problems.md).

## See also

- [Video and audio](video.md)
- [Keyboard shortcuts](keyboard-shortcuts.md)
- [Images or videos do not show](media-problems.md)
