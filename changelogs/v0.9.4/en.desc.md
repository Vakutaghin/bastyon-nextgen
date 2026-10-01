# v0.9.4 — Video studio, read marks and updates from inside the app

Videos are now uploaded in “My videos”, as in YouTube Studio: the upload runs in the background while you use the app. The chat has read marks, and the first message of a new chat no longer shows up encrypted. The desktop app installs its updates itself and no longer quits on the close button. Everything waiting for the blockchain is in the hourglass — on a phone too.

## Video

- **Uploads live in “My videos”, as in YouTube Studio.** The round button in the bottom left corner is gone. “Upload video” opens a window: the upload starts at once, and you can type the title along the way. “Minimize” — and the upload goes on in the “Uploads” panel in the corner while you use the app. When the video is uploaded, “Create post” opens the editor with the video attached and the title filled in.
- **“My videos” shows your clips on the video server:** whether a clip is in a post, whether it is still processing, with “Create post” and “Delete”.
- **On a computer a video can be compressed first** — with a checkbox in the same window, if FFmpeg is installed. Several videos are compressed one at a time.

## Chat

- **Marks on your own messages:** “✓” means the message is on the server, “✓✓” means it was read, in a group by at least one member. Before, “seen” almost never showed up. A message counts as read only while the chat is open on screen.
- **The first message of a new chat** no longer shows up as “*** Encrypted Message ***” — neither for the sender nor for the recipient — and is no longer repeated after the chat is opened again.
- **Chats open faster:** the list and the conversation come from the device’s memory instead of being downloaded from the server in full on every launch.
- **“Start chat” right after launch** opens the existing conversation, not the person’s card.

## The hourglass

- **The hourglass shows everything waiting for the blockchain.** Besides posts, comments and ratings: post promotion, PKOIN transfers, donations, mini app payments, edits and deletions, comment ratings, poll votes, profile, subscriptions, blocks and complaints. Each shows the post, the person or the amount and links to the explorer.
- **The hourglass is on phones too.**

## The desktop app

- **One-click updates.** When a new version comes out, the “Update” button downloads it, checks its signature and restarts the app. This version has to be installed by hand for the last time. The .deb package is not updated this way, and on Windows the installer may ask for permission.
- **The close button no longer quits the app:** the window hides, and Tor, IPFS, the chat and uploads keep working. On macOS the Dock icon brings the window back, quit with Cmd+Q. On Windows and Linux the window hides to the tray, quit with “Quit” in the tray menu or Ctrl+Q.
- **macOS no longer asks for the keychain password after every update.** All versions are signed with one certificate. After installing 0.9.4 macOS asks for the password one more time — click “Always Allow”.
- **If the browser did not open from “Go to download”**, the release link is shown on screen and copied.
