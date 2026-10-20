# v0.10.1 — Videos upload again, a file dropped on the window no longer replaces the app

Video uploads finish again, and the list of your clips no longer waits for the slowest video server. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package).

## Video

- **Uploads finish again.** Since 0.9.4 an upload in “My Videos” reached the end and failed with “The video could not be uploaded.” In the post window this happened when the title was filled in. The video server tells the clip’s format by the file name, and the app sent it the title without the extension, for example “Holiday” instead of “Holiday.mp4”. Now the real file name goes out. An upload that failed this way before starts over when you retry it instead of failing again.
- **“On the video server” shows clips right away.** There are several video servers, and one of them takes about a minute to answer right now. The list used to wait for the slowest one, so it looked like it never loaded. Now clips from each server appear as soon as it answers. If a server stays silent for more than 15 seconds, “Not every video server sent its list — some videos may be missing.” appears, and when it answers later, its clips are added on their own.

## Desktop

- **A file dropped on the window no longer replaces the app.** A video dragged onto the window outside a place for files opened instead of the app, and only a restart brought it back. Now only the places for files accept them: the video upload window, the “+” tile next to a post’s images, and the chat. Elsewhere the cursor shows you can’t drop there. Text still drags into input fields as before.

## Chatting over radio

- **The Reticulum node no longer restarts for nothing.** If an interface, such as a hub, did not come up at start, the app restarts the node a minute later. The restart used to happen even when the interface had come up on its own, and the connection dropped meanwhile. Now that restart is cancelled.
