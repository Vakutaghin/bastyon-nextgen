---
keywords: [video compression, transcoding, FFmpeg, compression module, video size, make a video smaller]
---

# Compressing a video

How to make a large video smaller on your computer before uploading it to Bastyon.

Video from a phone or a camera often weighs gigabytes. The desktop app can re-encode it to a smaller size without a noticeable loss of quality — so the clip uploads faster and uses less of the video server’s daily quota, see [Uploading video and audio](video-upload.md).

## Where it is

In the upload window: **“Media studio”** → **“Upload”** → **“Compress on this computer first”**. It is checked by itself when there is something to compress with. Compression is only in the desktop app.

## The compression module

The video is re-encoded by the FFmpeg program. Not everyone uploads videos, so it is not built into the app: it is downloaded as a separate module, once, when you need it:

- in the upload window, while there is nothing to compress with, — the **“Download the compression module”** button, with its size next to it and the percentage while it downloads;
- or **“Settings”** → the **“Modules”** tab → **“Video compression module”**. You can **“Remove”** the module there too.

The module weighs 36 to 56 MB, depending on the system. The app checks every downloaded file against a size and checksum built into it and does not install a tampered file. If [Tor](tor.md) is on, the module is downloaded through Tor. When a new version of the app brings a new FFmpeg build, it downloads in the background and takes over at the next start of the app; until then the old one compresses.

If FFmpeg is already installed on the system and can encode H.264 (x264), the module is not needed: the compression checkbox appears right away. On Windows on ARM and other systems without the module, the window tells you how to install FFmpeg yourself:

- macOS — `brew install ffmpeg`;
- Windows — `winget install ffmpeg` or download it from [ffmpeg.org](https://ffmpeg.org);
- Linux — `sudo apt install ffmpeg` or your distribution’s package manager.

## How to compress

1. Open **“Media studio”** → **“Upload”** and make sure **“Compress on this computer first”** is checked.
2. Drag a video into the window or click **“Select file”**.
3. Compression runs first, then the upload starts right away — you see the percentage in the window and in the **“Uploads”** panel. You can minimize the window: compression and upload go on while you use the app.

What you get: an MP4 video (H.264, AAC sound) at the resolution closest to the original — from 144p to 1080p, higher ones are reduced to 1080p — at no more than 30 frames per second and with a bitrate chosen for the resolution, for example about 1.5 Mbit/s for 720p. Such a file plays everywhere.

Audio is not compressed.

## When a video goes without compression

The app compresses a video only when that makes the file noticeably smaller. Otherwise the video is uploaded as is, and the window says why:

- **“Not compressed: the video is already compact, uploading it as is.”** — compression would shrink the file by less than a fifth. This happens with a video that is already compressed, for example by a messenger;
- **“The video is too long to compress in the app — uploading it as is.”** — the compressed file would be over 1 GB: roughly more than half an hour in 1080p;
- **“Compression failed — uploading the video as is.”** — FFmpeg could not handle the file. The upload does not suffer from it.

Several videos are compressed one at a time: while FFmpeg is busy, the next one waits as **“Waiting to compress”** and then is compressed and uploaded by itself.

## If the upload fails

The compressed file stays with the upload while the app is open: **“Retry”** uploads it without compressing it again. The app does not keep compressed copies on disk — the uploaded clip is already on the video server, see **“Media studio”**. If you close the app before the upload finishes, the video is compressed again.

## See also

- [Uploading video and audio](video-upload.md)
- [What is stored on your device](local-data.md)
