# v0.11.0 — Videos compress without installing FFmpeg, “My Videos” shows every clip

To compress a video before uploading, you no longer have to install FFmpeg yourself: the app downloads the compression module when you ask for it. “My Videos” shows clips from every video server, and an IPFS link can simply be pasted into search. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package).

## Video compression

- **A compression module instead of installing FFmpeg.** Videos used to be compressed only if FFmpeg was installed on the system. Now the app downloads it itself: the **“Download the compression module”** button in the upload window, or Settings → General → “Video compression module”. Not everyone uploads videos, so the module is not built into the app and is downloaded once: 36 to 56 MB depending on the system. The app checks every file against a size and checksum built into it. If Tor is on, the module downloads through Tor. A system FFmpeg works too if it has the H.264 codec (x264).
- **Compression only when it helps.** If compression would shrink the file by less than a fifth, for example because a messenger has already compressed the video, it uploads as is, with no needless wait. A video that could not be compressed uploads as is too. The upload window says why a video went out uncompressed.
- **Files over 500 MB are compressed too.** Such files used to upload without compression. The limit is different now: the compressed file must not exceed 1 GB, about half an hour in 1080p.
- **No more copies on the computer.** The “Compressed on this computer” section kept a copy of every compressed video. An uploaded clip is on the server anyway, and “Retry” takes the compressed file from the upload itself, so the copies only took up space. They are deleted after the update.

## My Videos

- **Clips from every video server.** The list took clips only from the servers that take uploads now. Clips uploaded earlier sit on dozens of other servers and never made it to the list: one account saw 2 of its 20 clips. Now the app finds them through your video posts and shows them with the rest, newest first. A clip on an old server that is not in any post still can’t be found.
- **“In a post” without a reload.** While a post with the clip waits for a block, the clip says “Publishing”. Once the post makes it into a block, it turns “In a post” on its own.
- **Open the post right here.** **“Open post”** shows the post in a window. If the clip is in several posts, the “Posts: 2” button lists them by date and caption.
- **A more compact header.** “Refresh” is now an icon next to “Upload video”, and the “On the video server” heading is gone.

## IPFS

- **Paste an IPFS link into search.** An `ipfs://…` or `ipns://…` link, a gateway address (with or without `https://`) or a bare CID pasted into the search bar opens right away, the same way as clicking a link in a post. A typed one opens on Enter. A private link opens together with its key.
- **“Open IPFS browser”.** In the desktop app the IPFS icon menu has its own address bar. Paste a link and press “Open”: the content opens in the viewer window. Under the bar, “Recent” keeps the last 8 addresses. Private links never go there: they carry the file’s key.

## Interface

- **A divider in the left menu** between “Discussed” and “Services”: feeds above, services, explorer and help below.
