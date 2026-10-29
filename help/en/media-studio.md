---
keywords: [media studio, my videos, my clips, cover, preview, thumbnail, video description, video title, video statistics, views, viewers, watch time, audience retention, delete video]
---

# Media studio

The “Media studio” is the section for your video and audio, like YouTube Studio: all your clips in one list, their title, description and cover, and viewing statistics. How to upload a new clip is in [Uploading video and audio](video-upload.md).

## Your clips

The section is in the account menu: **“Media studio”**. Under the title you see how many clips you have and how many views they have together.

The list has all your clips: those from your posts — whichever video server they are on — and the unpublished ones on the servers that take uploads now. The button with arrows next to **“Upload”** is **“Refresh”**, and **“Limits”** shows how much more you can upload today and which files the video server accepts — see [Uploading video and audio](video-upload.md#limits).

Above the list:

- **search** — by title, description and the titles of posts with the clip;
- **“All videos”**, **“In posts”** or **“Not in a post”** — which clips to show;
- order: **“Newest first”**, **“Oldest first”**, **“Most viewed”** or **“By title”**;
- view: **“Grid”** — large covers, or **“List”** — the cover on the left, the title and the start of the description on the right, then the status, upload date and views. The app remembers the view you chose.

Each clip shows:

- **“In a post”** — the clip is already published, **“Not in a post”** — not yet;
- **“Publishing”** — a post with the clip has been sent and is waiting to get into the blockchain. Once it does, **“In a post”** appears, no need to reload the page;
- **“Processing”** — the server is still preparing different qualities;
- **“Audio”** on the cover — this is sound, not video.

The button under the clip is **“Create post”** if there is no post yet, or **“Open post”** if there is. If there are several posts, the button shows their number, for example “Posts: 2”, and opens a list: pick the post by date and title.

Click the cover to watch the clip or listen to the recording: it opens in a window with the same player as in the feed, even if there is no post with it yet. While the clip is being processed, the cover opens the clip window. The title opens the clip window; in the list, the whole row does. The **“More”** button with three dots holds **“Watch”** (for audio — **“Listen”**), the clip's **“Details”** and **“Statistics”**, **“Create post”** — one more post with a clip that is already in a post — and **“Delete”**.

For a clip on a video server that has been retired, the app takes the cover from its archive. If a cover does not load — the server does not answer or its certificate has expired — the app looks the clip up the way the player does, and if that fails too, it shows a clip icon instead of an empty picture.

There are several video servers, and they answer at different speeds. Clips from each one appear as soon as it answers. If a server or the list of posts stays silent for more than 15 seconds, **“Not every video server sent its list — some videos may be missing.”** appears; when it answers later, its clips are added on their own.

## Clip details

The **“Details”** tab of the clip window. On the left is what you can change on the video server:

- **“Title”** — from 3 to 120 characters;
- **“Description”** — up to 10,000 characters, or empty;
- **“Cover”** — the clip's picture in the feed.

The title and description are stored on the video server: they show here and on the clip's page on the video server. The post text and title are something else: the post is in the blockchain and is edited in the post itself, see [Editing or deleting a post](edit-delete-post.md).

Edits add up until you click **“Save”** — the bottom of the window shows “Unsaved changes”. **“Undo changes”** puts everything back. If you close the window with unsaved edits, the app asks first.

At the top right is **“Watch”** (for audio — **“Listen”**): the player opens over the clip window. Below is what is known about the clip: its type, whether it is ready, duration, upload time, qualities and file size, views and the video server. Next is **“Posts with this video”**: click a post to open it — the clip window closes — or click **“Create post”**. At the very bottom is **“Delete video”**.

## Cover

You can change the cover of any of your clips, including ones uploaded long ago. In the **“Cover”** block:

- slide along the frame strip under the preview — frames come straight from the clip on the video server. Let go, and the frame becomes the new cover;
- or click **“Upload image”** and choose a JPEG, PNG or WebP. The image is cropped around the center to the clip's shape, except for audio.

Above the preview you see what is chosen: “Current cover”, “Frame at 0:15” or “Your image”. The new cover goes to the server together with everything else when you click **“Save”**, and shows in the feed within a minute.

Audio has no frames — only your own image.

If [Tor](tor.md) is on, frames from the video server do not open: the server would see your IP address. Upload your own image instead.

## Statistics

The **“Statistics”** tab of the clip window, like analytics in YouTube Studio. At the top is the period: 7, 28 or 90 days, or **“All time”**. It applies to everything below.

- **“Viewers”** — how many different viewers watched the clip in the period;
- **“Watch time”** — how long everyone watched it together;
- **“Average per viewer”** — how long one viewer watched;
- **“All-time views”** — the view counter since the clip was uploaded.

**“Viewers”** and **“Watch time”** are also switches: the chart below them shows that value by day, or by hour for a short period. Hover over a bar to see the number, or open **“Show as a table”**.

**“Audience retention”** shows what share of viewers watched up to each point of the clip. It shows where people stop watching. Retention is for all time.

**“Countries”** — where people watched from, by number of viewers.

The video server collects these statistics: Bastyon players tell it how much the clip is watched, see [Watching videos](video-player.md#views). So viewers and watch time exist only since the server started collecting them, and for new clips the numbers take a while to appear.

## Deleting

**“Delete video”** in the clip window or **“Delete”** in the **“More”** menu deletes the clip from the video server. The app asks first. If the clip is in a post, the post stays, but with text only: the video in it stops playing. Deleting cannot be undone.

The post itself can be deleted like any other — see [Editing or deleting a post](edit-delete-post.md).

## What is not there yet

- You cannot replace the file of an uploaded clip, or add subtitles or chapters.
- The clip's tags on the video server are not edited here: Bastyon does not show them anywhere, and post tags are set in the post.

## See also

- [Uploading video and audio](video-upload.md)
- [Watching videos](video-player.md)
- [Compressing a video](video-compression.md)
