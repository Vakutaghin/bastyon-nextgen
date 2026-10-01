---
keywords: [video compression, transcoding, FFmpeg, video size, make a video smaller]
---

# Compressing a video

How to make a large video smaller on your computer before uploading it to Bastyon.

Video from a phone or a camera often weighs gigabytes. The desktop app can re-encode it to a smaller size without a noticeable loss of quality — so the clip uploads faster and uses less of the video server’s daily quota, see [Uploading video and audio](video-upload.md).

## Where it is

In the upload window: **“My videos”** → **“Upload video”** → **“Compress on this computer first”**. It is checked by itself when there is something to compress with. Compression is only in the desktop app.

## FFmpeg is needed

The video is re-encoded by the FFmpeg program, which has to be installed on the system separately: the app uses the one that is installed. If FFmpeg is not found, the window tells you how to install it instead of showing the checkbox:

- macOS — `brew install ffmpeg`;
- Windows — `winget install ffmpeg` or download it from [ffmpeg.org](https://ffmpeg.org);
- Linux — `sudo apt install ffmpeg` or your distribution’s package manager.

## How to compress

1. Open **“My videos”** → **“Upload video”** and make sure **“Compress on this computer first”** is checked.
2. Drag a video into the window or click **“Select file”**.
3. Compression runs first, then the upload starts right away — you see the percentage in the window and in the **“Uploads”** panel. You can minimize the window: compression and upload go on while you use the app.

What you get: an MP4 video (H.264, AAC sound) at the resolution closest to the original — from 144p to 1080p, higher ones are reduced to 1080p — at no more than 30 frames per second and with a bitrate chosen for the resolution, for example about 1.5 Mbit/s for 720p. Such a file plays everywhere.

A file up to 500 MB can be compressed: FFmpeg gets it whole. A larger file is uploaded without compression, and the window says so. Audio is not compressed.

Several videos are compressed one at a time: while FFmpeg is busy, the next one waits as **“Waiting to compress”** and then is compressed and uploaded by itself.

## Compressed copies

The compressed copy stays on the computer: **“My videos”** → **“Compressed on this computer”**. Each has:

- click the clip to watch it;
- **“Upload to the video server”** — upload this copy again, without compressing it, for example if the upload failed;
- **“Information”** — parameters and the size before and after compression;
- **“Download”** — save the file to the computer;
- **“Delete”** — with a confirmation.

The copies are kept inside the app and take up disk space. The app keeps no more than 50 clips, 500 MB, and nothing older than 30 days: it deletes old ones itself and tells you so. Everything stored on the device is listed in [What is stored on your device](local-data.md).

## See also

- [Uploading video and audio](video-upload.md)
- [What is stored on your device](local-data.md)
