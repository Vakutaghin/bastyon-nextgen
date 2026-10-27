---
keywords: [media studio, my videos, upload video, upload audio, quota, PeerTube, file size, podcast, uploads, minimize upload, cover, video thumbnail, preview image, frame]
---

# Uploading video and audio

How to upload your own video or audio: in the “Media studio” or right from the post window. Also the clip's cover, formats, size, the daily quota and what to do if an upload was interrupted.

## In the “Media studio”

The section is in the account menu: **“Media studio”**. It works like YouTube Studio: you upload video and audio here and see all your clips on the server.

1. Click **“Upload”**. Drag a file into the window or click **“Select file”**: a video in any common format — MP4, MOV, MKV, WebM, AVI — or sound, such as MP3, M4A, FLAC, OGG.
2. The upload starts right away. While it runs, type the **“Title”**: it becomes the post title, and the video server gets it too when the upload finishes.
3. You do not have to wait in the window. **“Minimize”** closes the window, and the upload goes on while you use the app. You see it in the **“Uploads”** panel in the bottom left corner, above the bottom bar on a phone. Click an upload in the panel to open its window again.
4. When “The video is uploaded” appears, click **“Create post”**. The new post window opens with the video attached and the title filled in. Add text and tags and publish the post.

On a computer the upload window has **“Compress on this computer first”**: the video is made smaller first and then uploaded. If there is nothing to compress with yet, the window offers **“Download the compression module”**, see [Compressing a video](video-compression.md).

You can also make the post later. The section shows all your clips, newest first: those from your posts — whichever video server they are on — and the unpublished ones on the servers that take uploads now. The button with arrows next to **“Upload”** is **“Refresh”**. Each clip has:

- **“In a post”** — the clip is already published, **“Not in a post”** — not yet;
- **“Publishing”** — a post with the clip has been sent and is waiting to get into the blockchain. Once it does, **“In a post”** appears, no need to reload the page;
- **“Processing”** — the server is still preparing different qualities;
- **“Open post”** — open the post with this clip. If there are several posts, the button shows their number, for example “Posts: 2”, and opens a list: pick the post by date and title;
- **“Create post”** — a new post with this clip;
- **“Delete”** — delete the clip from the video server. Posts with it will stop playing it, so the app asks first.

There are several video servers, and they answer at different speeds. Clips from each one appear as soon as it answers. If a server or the list of posts stays silent for more than 15 seconds, **“Not every video server sent its list — some videos may be missing.”** appears; when it answers later, its clips are added on their own.

## Right in a post

1. In the new post window, click **“Upload video or audio”** and choose a file.
2. While the file uploads, you see what percentage is already on the server. Do not close the post window until the upload finishes — or upload it in the “Media studio”, where you can minimize the upload.
3. When **“PeerTube video attached”** or **“PeerTube audio attached”** appears, fill in **“Video title”** — without it the post will not be published: **“Add a title for the video”**. Add text and tags and publish the post as usual.

## Cover

The cover is the clip's picture in the feed before someone plays it. By default it is the first frame: the app takes it as soon as you choose the file.

The easiest way is to make the first second or two of the clip a still image, such as a title card. It becomes the cover, and there is nothing to choose. The (i) icon next to **“Cover”** reminds you of this.

You can choose another cover in the upload window in the “Media studio” — the **“Cover”** block under the title. In the post window, click **“Change cover”** next to the thumbnail, and **“Done”** when you have chosen.

- Slide along the frame strip under the preview: the frame shows in the preview at once, and when you let go it becomes the cover. Above the preview you see what is chosen: “First frame”, “Frame at 0:15” or “Your image”.
- Or click **“Upload image”** and choose a JPEG, PNG or WebP. The image is cropped around the center to the clip's shape, so the preview in the feed does not change size when the video starts playing.

You can change the cover while the video is uploading too: the video server gets it when the upload finishes — until then you see “Will be saved when the upload finishes”. After the upload a new cover goes at once, then “Cover saved” appears. The post is published and **“Create post”** opens the post window only once the cover is on the server. If it did not get there — “Couldn't save the cover” and **“Retry”**.

If the app cannot show the file, you cannot pick a frame. This happens, for example, in the Linux app without the video codec, see [Images or videos do not show](media-problems.md). Then upload your own image or leave the choice to the video server: without your cover it takes a frame from the middle of the clip. That frame appears in the **“Cover”** block when the upload finishes, labeled “From the video server”.

Audio has no frames. Without your own image the video server makes the cover: it takes the picture embedded in the file — usually the album cover — or puts the Bastyon splash if there is none. It also shows in the **“Cover”** block when the upload finishes. To use your own, click **“Upload image”**, as with video, except that it is not cropped.

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
- in the “Media studio” **“Remove”** takes the upload off the list; in the post window **“Cancel”** gives up on the file so you can choose another one.

**“Cancel upload”** in the “Media studio” and **“Cancel”** in the post window stop the upload, and the partly uploaded file is deleted from the server. **“Remove”** on an already uploaded clip in the post window only detaches it from the post — it stays on the server.

The upload runs while the app is open. If you close it, start the upload again.

## What is not there yet

- The “Media studio” does not show the video server quota yet — only during an upload, when a file does not fit.
- You cannot add a description for the clip, change the cover of a clip uploaded earlier, import a video by link or replace the file of an uploaded clip.

The post with the video can be deleted like any other — see [Editing or deleting a post](edit-delete-post.md).

## See also

- [Compressing a video](video-compression.md)
- [The post editor](post-composer.md)
- [Account status and limits](limits.md)
