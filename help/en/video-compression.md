---
keywords: [video compression, transcoding, FFmpeg, video size, make a video smaller]
---

# Compressing a video

How to make a large video smaller on your computer before uploading it to Bastyon.

Video from a phone or a camera often weighs gigabytes. The desktop app can re-encode it to a smaller size without a noticeable loss of quality — so the clip uploads faster and uses less of the video server’s daily quota, see [Uploading video and audio](video-upload.md).

## Where it is

The round button with a video camera in the bottom left corner of the window — **“Video compression”**. It is there only in the desktop app.

## FFmpeg is needed

The video is re-encoded by the FFmpeg program, which has to be installed on the system separately: the app uses the one that is installed. If FFmpeg is not found, the window tells you how to install it:

- macOS — `brew install ffmpeg`;
- Windows — `winget install ffmpeg` or download it from [ffmpeg.org](https://ffmpeg.org);
- Linux — `sudo apt install ffmpeg` or your distribution’s package manager.

## How to compress

1. Drag a video file into the window or click **“Select video file”**.
2. The app examines the file and shows two columns: **“Source video”** and **“Target video”** — resolution, bitrate, frame rate. If it is the wrong file — **“Select another file”**.
3. Click **“Start transcoding”**. You can stop it with **“Cancel”**.
4. When **“Video transcoded successfully!”** appears, the file is ready.

What you get: an MP4 video (H.264, AAC sound) at the resolution closest to the original — from 144p to 1080p, higher ones are reduced to 1080p — at no more than 30 frames per second and with a bitrate chosen for the resolution, for example about 1.5 Mbit/s for 720p. Such a file plays everywhere.

## Finished videos

Re-encoded clips are in the **“Saved videos”** list of the same window. Each has:

- click the clip to watch it;
- **“Information”** — parameters and the size before and after compression;
- **“Download”** — save the file to the computer;
- **“Delete”** — with a confirmation.

Download the file and upload it to a post in the usual way — [Uploading video and audio](video-upload.md).

The clips are kept inside the app and take up disk space. The app keeps no more than 50 clips, 500 MB, and nothing older than 30 days: it deletes old ones itself and tells you so. Everything stored on the device is listed in [What is stored on your device](local-data.md).

## See also

- [Uploading video and audio](video-upload.md)
- [What is stored on your device](local-data.md)
