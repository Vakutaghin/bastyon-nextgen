# v0.9.3 — Post promotion, videos from retired servers and links on a computer

Posts can now be promoted for PKOIN, as in the old app. Clips from retired PeerTube servers play again, and a broken video switches to the backup file within seconds. On a computer external links open again, the chat window stretches, and a touchpad pinch no longer changes the zoom.

## Post promotion

- **The “Promote” button** with a lightning bolt is on every published post, yours and other people’s. A promoted post shows up more often in the feed of its language for about a day.
- **The amount starts at 2.5 PKOIN.** The author does not get the coins: they go to the network as a fee, just as in the old app.
- **The window shows what to expect:** the chance to be among the first 30 posts of the feed given the current promotions in that language, how much the post already has, and the amount that makes it 100%.
- The new help article “Promoting a post” has the details.

## Video

- **Clips from retired PeerTube servers play again.** Bastyon retires old PeerTube servers and moves their clips to an archive, but posts still link to the old address. The player went there and showed an error; even posts from August 2026 did not play. Now such clips, their thumbnails and subtitles come from the archive. If a server does not answer and is not on the retired list, the Bastyon proxy finds the clip, as in the old app.
- **A broken video switches to the backup file within a few seconds**, not about two minutes, and continues from the same second. In Safari on older iPhones a video stalled without an error and never switched; now it switches once it has not moved for 15 seconds.
- **Seeking with the mouse no longer pauses or plays the video**, neither a click on the bar nor dragging the handle.

## Chat

- **The chat window on a computer stretches** by its left or top edge and its top-left corner: from the original 360×500 up to 60% of the app window’s width and 80% of its height. The size is remembered, and a double click on the corner restores the original.
- **Shorter message times:** “19:29” today, “yesterday, 19:29” for yesterday, the date and time for older ones. The full date is in a tooltip.
- **A friendlier input bar.** The buttons stay at the bottom while the field grows, and in a tall window the field grows up to 30% of its height. Emoji open above the bar and close on a click elsewhere or Esc, and Esc no longer closes the chat then. A file can be dropped anywhere on the chat. An unfinished message stays in its chat while the app is open. On a phone the keyboard shows a “Send” key.

## Posts

- **The post window is locked while the post publishes:** nothing changes by accident, and a second press on “Publish” sends nothing. If publishing fails, the window unlocks with everything in place.
- **A video from the draft** no longer asks you to pick the file again: the panel shows the video as attached.
- **The post count in a profile matches the profile feed.** Before, an account with one post could show 0, and your own profile missed posts published after you signed in.

## Computer

- **External links open in the browser again.** Since 0.3.0 no external link opened on a computer: links in posts, comments and chat, profile websites, “Watch on YouTube”, sharing to other apps, links from mini-apps.
- **A touchpad pinch no longer changes the zoom**, so the window does not jump on accidental touches. Cmd + and Cmd − change it (Ctrl on Windows and Linux), and Cmd 0 returns to 100%. The steps are the same as in the settings, 80 to 150%, and the chosen zoom survives a restart. Ctrl with the mouse wheel no longer changes the zoom either.

## Help

- **Help opens above windows.** Before, F1 or a help link inside an open window showed nothing: the panel opened under the window.
