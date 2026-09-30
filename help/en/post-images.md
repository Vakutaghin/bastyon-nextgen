---
keywords: [images, photos, pictures, crop, rotate, filter, GIF, metadata]
---

# Images in a post

How to add up to 10 images, crop and rotate them, apply a filter — and where they are uploaded.

## Adding

Click **“Add images”** in the post editor or drag files onto that area with the mouse. One post takes up to 10 images, each up to 30 MB. Common photo formats and GIFs work.

Images and a video uploaded from your device do not go together in one post: while a video is attached, you cannot add images, and the other way round.

## Editing

Each image in the editor has three buttons:

- **“Rotate image”** — 90° clockwise;
- **“Edit image”** — open the editor;
- **“Remove image”** — take it out of the post.

In the editor you can crop the image (**“Crop”**), rotate it with the **“Left”** and **“Right”** buttons and apply a filter: Original, B&W, Sepia, Vivid, Warm, Cool, Bright or Contrast. The **“Apply”** button saves the changes.

## What the app does to an image

The app scales large photos down to fit into 1920 × 1080 and re-saves them as JPEG. This removes the photo's metadata: the camera model, the date and the coordinates of where it was taken. GIFs are sent as they are, so the animation is kept.

## Where they are uploaded

When you click **“Publish”**, the app uploads the images to the Bastyon network's PeerTube servers, and if they do not accept an image, to the Bastyon image server `pocketnet.app:8092`, as the old app does. The post gets links to them. An image is available to anyone who has the link, and it cannot be deleted from the server from the app, even if you delete the post. Do not publish what should not become public — see [Privacy: what others can see](privacy.md).

If no server accepts the image, the post is not published and the app says **“Could not upload the image. Try publishing again.”** The small line under the message says what each server answered. If you report a problem, include it — see [Report a problem](report-bug.md).

## See also

- [The post editor](post-composer.md)
- [Privacy: what others can see](privacy.md)
