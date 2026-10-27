# v0.14.0 — A new post window and article editor, covers for video and audio, “Media studio”

The new post window is simpler: a “Post” and “Article” switch, the text without a frame, all attachments on one bar. Articles are written in a new editor — no panels, Markdown as you type and a block menu on “/”. An uploaded video can have the cover you choose: the first frame, any other frame or your own image; audio can have your own image. “My videos” is now called “Media studio”. A like on a comment counts at once, and “Load more” no longer reshuffles comments. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Post window

- **“Post” and “Article”** — a switch at the top of the window instead of the “Article (rich editor)” checkbox.
- **Text without a frame.** The field grows as you type, the attachments and tags go under it, and the tag counter sits in the tags line itself.
- **One bar under the text:** **“Add images”**, **“Upload video or audio”**, **“Poll”**, **“Emoji”** and voice input. The button for an attachment that cannot be added right now (images and video together) is not shown. A poll is removed with the **“Remove poll”** cross in its header.
- **Images** can be pasted from the clipboard or dropped onto the window.
- **Settings** fold into a line like “Everyone · English · Right away” on the right of the bar. A click unfolds visibility, language and scheduling right in the window.

## Articles

- **A new editor** — no frames and no permanent panels. Select text, and a bar appears over it: **“Bold”**, **“Italic”**, **“Link”**, **“Heading”**, **“Subheading”**, **“Quote”**, **“Inline code”**.
- **“/” or “+”** on an empty line opens the block menu: headings, lists, quote, code, **“Divider”**, **“Image”**. Pick with the mouse or with the arrows and Enter.
- **Markdown as you type:** “## ” — heading, “- ” and “1. ” — lists, “> ” — quote, three backticks — code, “---” — divider, text between double asterisks — bold.
- **Images** go in from the menu, from the clipboard or by dropping, and the caption is edited right under the image. Publishing waits until the image is uploaded.
- **Older articles** open for editing without losing anything: the storage format is the same. Tables and link cards from the previous editor show as a grey box and are kept as they are.

## Video and audio

- **A video cover** is the first frame by default, not a frame from the middle as the video server picked. In the upload window and in the post window, slide along the frame strip to pick another frame, or press **“Upload image”** — it is cropped to the video’s shape. The (i) hint reminds you: make the first second or two of the video a still image, and it becomes the cover.
- **An audio cover.** Without your own image, the video server takes the picture embedded in the file (an album cover, for example), or the Bastyon splash if there is none. You can upload your own image during the upload or after, and it is not cropped.
- **The cover reaches the server** as soon as the file is uploaded. **“Create post”** and publishing wait until it is saved.
- **“Media studio”** is the new name of “My videos”: audio is uploaded there too. Its button is now just **“Upload”**.

## Comments

- **A like on a comment counts at once:** the mark and the +1 show while the vote waits for a block, including after an app restart. The count is the same under the post and in the full comment list. A vote that never makes it into a block is taken back.
- **“Load more”** no longer reshuffles comments: the ones shown keep their places, and new ones go where the sort puts them. A new comment or a list refresh no longer folds the expanded comments back, and the comment you saw under the post stays first. The list is sorted again only when you pick another sort.
