---
keywords: [upload video, upload audio, quota, PeerTube, file size, podcast, my videos, uploads, minimize upload]
---

# Uploading video and audio

How to upload your own video or audio: in the “My videos” section or right from the post window. Also formats, size, the daily quota and what to do if an upload was interrupted.

## In the “My videos” section

The section is in the account menu: **“My videos”**. It works like YouTube Studio: you upload clips here and see all your videos on the server.

1. Click **“Upload video”**. Drag a file into the window or click **“Select file”**: a video in any common format — MP4, MOV, MKV, WebM, AVI — or sound, such as MP3, M4A, FLAC, OGG.
2. The upload starts right away. While it runs, type the **“Title”**: it becomes the post title, and the video server gets it too when the upload finishes.
3. You do not have to wait in the window. **“Minimize”** closes the window, and the upload goes on while you use the app. You see it in the **“Uploads”** panel in the bottom left corner, above the bottom bar on a phone. Click an upload in the panel to open its window again.
4. When “The video is uploaded” appears, click **“Create post”**. The new post window opens with the video attached and the title filled in. Add text and tags and publish the post.

On a computer the upload window has **“Compress on this computer first”**: the video is made smaller first and then uploaded, see [Compressing a video](video-compression.md).

You can also make the post later. Your clips are in the section under **“On the video server”**:

- **“In a post”** — the clip is already published, **“Not in a post”** — not yet;
- **“Processing”** — the server is still preparing different qualities;
- **“Create post”** — a new post with this clip;
- **“Delete”** — delete the clip from the video server. Posts with it will stop playing it, so the app asks first.

## Right in a post

1. In the new post window, click **“Upload video or audio”** and choose a file.
2. While the file uploads, you see what percentage is already on the server. Do not close the post window until the upload finishes — or upload the video in “My videos”, where you can minimize it.
3. When **“PeerTube video attached”** or **“PeerTube audio attached”** appears, fill in **“Video title”** — without it the post will not be published: **“Add a title for the video”**. Add text and tags and publish the post as usual.

## How it works

The file goes to a [PeerTube](glossary.md#peertube) video server chosen by the network, and the app signs in to the server by itself, with your Bastyon key. The post gets a link to the clip.

Right after the upload, the server spends a few more minutes processing the clip — preparing different qualities. You can publish the post at once, but until the server finishes, the player may report an error: wait and click **“Retry”**.

Your own video cannot share a post with images, and video cannot be added to an article or when editing a published post. A new account can publish 5 video posts a day, a full one 30, and with a balance of 250 PKOIN or more up to 100 — see [Account status and limits](limits.md).

## Limits

- The file is no larger than 4 GB.
- The video server has a daily quota: how much can be uploaded per day. If the file does not fit, the app tells you how much is left for today.
- The server can also refuse by itself: **“The video server did not accept the file: it is too large or your quota is used up.”**

## If the upload was interrupted

On an error you see the reason:

- **“Retry”** — the upload continues from where it stopped, not from the start;
- in “My videos” **“Remove”** takes the upload off the list; in the post window **“Cancel”** gives up on the file so you can choose another one.

**“Cancel upload”** in “My videos” and **“Cancel”** in the post window stop the upload, and the partly uploaded file is deleted from the server. **“Remove”** on an already uploaded clip in the post window only detaches it from the post — it stays on the server.

The upload runs while the app is open. If you close it, start the upload again.

## What is not there yet

- “My videos” does not show the video server quota yet — only during an upload, when a file does not fit.
- You cannot set a cover or a description for the clip, import a video by link or replace the file of an uploaded clip.

The post with the video can be deleted like any other — see [Editing or deleting a post](edit-delete-post.md).

## See also

- [Compressing a video](video-compression.md)
- [The post editor](post-composer.md)
- [Account status and limits](limits.md)
