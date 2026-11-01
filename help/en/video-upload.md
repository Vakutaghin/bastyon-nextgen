---
keywords: [media studio, my videos, upload video, upload audio, quota, PeerTube, file size, podcast, uploads, minimize upload, cover, video thumbnail, preview image, frame]
---

# Uploading video and audio

How to upload your own video or audio: in the “Media studio” or right from the post window. Also the clip's cover, formats, size, the daily quota and what to do if an upload was interrupted.

## In the “Media studio”

The section is in the account menu: **“Media studio”**. It works like YouTube Studio: you upload video and audio here and see all your clips on the server.

1. Click **“Upload”**. Drag a file into the window or click **“Select file”**: a video in any common format — MP4, MOV, MKV, WebM, AVI — or sound, such as MP3, M4A, FLAC, OGG.
2. The upload starts right away. While it runs, fill in the post right in this window:
   - the **“Title”** becomes the post title, and the video server gets it too when the upload finishes;
   - below it is the [cover](#cover);
   - **“Description”** is the post text under the video;
   - tags — at least one, up to five, as in the [post editor](post-composer.md#tags);
   - the “Everyone · English · Right away” line sets who sees the post, its language and publishing time, see [Visibility, language and publishing time](post-settings.md).
3. Click **“Publish”**. You do not have to wait for the upload to finish: the window minimizes, and the post goes out by itself when the video is uploaded — nothing needs a second click. While the post waits, the **“Uploads”** panel shows “Post after upload”. Changed your mind — open the upload in the panel and click **“Don't publish”**: the video finishes uploading, and the post does not go out.
4. If the button is greyed out, the line above it says what is missing, for example **“Add at least one tag”**. A typed tag does not need confirming: the word in the tag field already counts as a tag.

You do not have to wait in the window without a post either. **“Minimize”** closes the window, and the upload goes on while you use the app. You see it in the “Uploads” panel in the bottom left corner, above the bottom bar on a phone. Click an upload in the panel to open its window again: what you wrote there is kept.

If the network did not accept the post, for example because of the daily limit, the window shows the reason — “The post was not published: …” — and the video and what you wrote stay. Click **“Publish”** again, see [The network rejected an action](action-rejected.md).

On a computer the upload window has **“Compress on this computer first”**: the video is made smaller first and then uploaded. If there is nothing to compress with yet, the window offers **“Download the compression module”**, see [Compressing a video](video-compression.md).

You can also make the post later: **“Save without a post”** closes the window, the clip stays in the “Media studio” list, and it has a **“Create post”** button there, see [Media studio](media-studio.md).

## Right in a post

1. In the new post window, click **“Upload video or audio”** on the toolbar under the text and choose a file.
2. While the file uploads, you see what percentage is already on the server. Do not close the post window until the upload finishes — or upload it in the “Media studio”, where you can minimize the upload.
3. Fill in **“Video title”** right away, without waiting for the upload — without it the post will not be published: **“Add a title for the video”**. Add text and tags.
4. Click **“Publish”** — this also works before the upload finishes. A spinner turns on the button, “The post goes out as soon as the video is uploaded. Keep this window open.” appears next to it, and the post goes out by itself when **“PeerTube video attached”** or **“PeerTube audio attached”** appears. Changed your mind — **“Don't publish”**.

## Cover

The cover is the clip's picture in the feed before someone plays it. By default it is the first frame: the app takes it as soon as you choose the file.

The easiest way is to make the first second or two of the clip a still image, such as a title card. It becomes the cover, and there is nothing to choose. The (i) icon next to **“Cover”** reminds you of this.

You can choose another cover in the upload window in the “Media studio” — the **“Cover”** block under the title. In the post window, click **“Change cover”** next to the thumbnail, and **“Done”** when you have chosen.

- Slide along the frame strip under the preview: the frame shows in the preview at once, and when you let go it becomes the cover. Above the preview you see what is chosen: “First frame”, “Frame at 0:15” or “Your image”.
- Or click **“Upload image”** and choose a JPEG, PNG or WebP. The image is cropped around the center to the clip's shape, so the preview in the feed does not change size when the video starts playing.

The cover, title and description of a clip that is already uploaded can be changed in the “Media studio”, in the clip window, see [Media studio](media-studio.md#cover).

You can change the cover while the video is uploading too: the video server gets it when the upload finishes — until then you see “Will be saved when the upload finishes”. After the upload a new cover goes at once, then “Cover saved” appears. The post goes out only once the cover is on the server; in the “Media studio” it waits no longer than 30 seconds for a stuck cover save. If it did not get there — “Couldn't save the cover” and **“Retry”**.

If the app cannot show the file, you cannot pick a frame. This happens, for example, in the Linux app without the video codec, see [Images or videos do not show](media-problems.md). Then upload your own image or leave the choice to the video server: without your cover it takes a frame from the middle of the clip. That frame appears in the **“Cover”** block when the upload finishes, labeled “From the video server”.

Audio has no frames. Without your own image the video server makes the cover: it takes the picture embedded in the file — usually the album cover — or puts the Bastyon splash if there is none. It also shows in the **“Cover”** block when the upload finishes. To use your own, click **“Upload image”**, as with video, except that it is not cropped.

## How it works

The file goes to a [PeerTube](glossary.md#peertube) video server chosen by the network, and the app signs in to the server by itself, with your Bastyon key. The post gets a link to the clip.

Right after the upload, the server spends a few more minutes processing the clip — preparing different qualities. You can publish the post at once, but until the server finishes, the player may report an error: wait and click **“Retry”**.

Your own video cannot share a post with images, and video cannot be added to an article or when editing a published post. A new account can publish 5 video posts a day, a full one 30, and with a balance of 250 PKOIN or more up to 100 — see [Account status and limits](limits.md).

## Limits

All the limits are in the **“Upload limits”** window — the **“Limits”** button next to **“Upload”** in the “Media studio”, like the daily limits block of the old app.

- **“You can upload today”** — how much of the daily limit is left on the video server the upload goes to. The limit covers the last 24 hours: an upload stops counting a day later. If a file does not fit in what is left, the app says so during the upload.
- **“What the limit depends on”** — 250 MB a day for any account, 500 MB with reputation 100 or more or at least 5 PKOIN in the balance, 2 GB for a full account, 5 GB with at least 50 PKOIN in the balance. Your tier is marked. The video server recalculates the limit when the app signs in to it again, so a new limit does not show up right away.
- **“Files the video server accepts”** — a file up to 4 GB, the video and audio formats, and the quality the server stores videos at, for example up to 480p: a better file only takes longer to upload and uses up the limit faster.

How many video posts you can publish per day is a different limit, it is in [“My limits”](limits.md).

The server can also refuse by itself: **“The video server did not accept the file: it is too large or your quota is used up.”**

## If the upload was interrupted

On an error you see the reason:

- **“Retry”** — the upload continues from where it stopped, not from the start;
- in the “Media studio” **“Remove”** takes the upload off the list; in the post window **“Cancel”** gives up on the file so you can choose another one.

**“Cancel upload”** in the “Media studio” and **“Cancel”** in the post window stop the upload, and the partly uploaded file is deleted from the server. **“Remove”** on an already uploaded clip in the post window only detaches it from the post — it stays on the server.

The upload runs while the app is open. If you close it, start the upload again.

## What is not there yet

- You cannot import a video by link or replace the file of an uploaded clip.

The post with the video can be deleted like any other — see [Editing or deleting a post](edit-delete-post.md).

## See also

- [Media studio](media-studio.md)
- [Compressing a video](video-compression.md)
- [The post editor](post-composer.md)
- [Account status and limits](limits.md)
