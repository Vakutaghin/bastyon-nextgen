---
keywords: [upload video, upload audio, quota, PeerTube, file size, podcast, my videos]
---

# Uploading video and audio

How to attach your own video or audio to a post: formats, size, the daily quota and what to do if an upload was interrupted.

## Uploading

1. In the new post window, click **“Upload video or audio”** and choose a file: a video in any common format — MP4, MOV, MKV, WebM, AVI — or sound, such as MP3, M4A, FLAC, OGG.
2. While the file uploads, you see what percentage is already on the server. Do not close the post window until the upload finishes.
3. When **“PeerTube video attached”** or **“PeerTube audio attached”** appears, fill in **“Video title”** — without it the post will not be published: **“Add a title for the video”**. Add text and tags and publish the post as usual.

The file goes to a [PeerTube](glossary.md#peertube) video server chosen by the network, and the app signs in to the server by itself, with your Bastyon key. The post gets a link to the clip.

Right after publishing, the server spends a few more minutes processing the clip — preparing different qualities. Until it finishes, the player may report an error: wait and click **“Retry”**.

Your own video cannot share a post with images, and video cannot be added to an article or when editing a published post. A new account can publish 5 video posts a day, a full one 30, and with a balance of 250 PKOIN or more up to 100 — see [Account status and limits](limits.md).

## Limits

- The file is no larger than 4 GB.
- The video server has a daily quota: how much can be uploaded per day. If the file does not fit, the app tells you how much is left for today.
- The server can also refuse by itself: **“The video server did not accept the file: it is too large or your quota is used up.”**

A large video can be made smaller on a computer beforehand — see [Compressing a video](video-compression.md).

## If the upload was interrupted

On an error you see the reason and two buttons:

- **“Try again”** — the upload continues from where it stopped, not from the start;
- **“Cancel”** — give up on this file and choose another one.

**“Cancel”** during an upload stops it, and the partly uploaded file is deleted from the server. **“Remove”** on an already uploaded clip only detaches it from the post — it stays on the server.

## What is not there yet

- The **“My Videos”** section in the account menu is empty for now: there is no list of uploaded clips, no deleting them and no quota in it yet.
- You cannot set a cover or a description for the clip on the server, import a video by link, or change or delete an already uploaded clip.

The post with the video can be deleted like any other — see [Editing or deleting a post](edit-delete-post.md).

## See also

- [Compressing a video](video-compression.md)
- [The post editor](post-composer.md)
- [Account status and limits](limits.md)
