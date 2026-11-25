# v0.38.0 — audiobooks in one post, a rating can be undone

Several recordings — chapters of a book, songs of an album — now go into one post. A slip on the stars can be fixed: the rating goes to the network five seconds later. Hashtags from the text become tags by themselves, and menus and lists open where they fit. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Audiobooks and albums

- **Up to 100 recordings in one post.** In the new post window pick several audio files at once or add them one by one. They upload in turn, can be renamed and reordered, and after publishing you can add more through “Edit”.
- **In the feed such a post has a list of recordings instead of the player.** The mini player plays them one after another, in the background too, and a book continues with the recording you stopped at.
- Track lists, the queue and playlists take such a post as a whole, and “Download” saves all the recordings.
- The old Bastyon and versions before 0.38 play only the first recording. The post window reminds you of that.
- The Media studio also marks audio that is already in posts. Listens in the mini player now count on the video server.

## Ratings

- **Five seconds to change your mind.** The network takes one rating of a post from each person and cannot take it back. So the rating no longer goes out at once: a countdown runs next to the stars, and until it ends you can pick another star or press “Undo”.
- **Comments can be rated right in notifications:** comments and replies in the list have 👍 and 👎 with counts.
- With a section selected in notifications, the button at the top reads “Clear” and hides only that section.

## Tags

- **A tag keeps the underscore and letters of any language.** Before, “крипта_пкоин” became “криптапкоин”, “liberté” lost its é, and Chinese and Korean tags vanished.
- **Hashtags from the post text go into the tag field by themselves.** A tag removed with the cross does not come back.
- A list of tags can be pasted as a whole: separated by spaces, commas or new lines.
- Up to 15 tags instead of five, as in the old Bastyon. Posts with more than five tags can be edited again.

## Chats

- **An edited message changes in place** and gets an “edited” mark. Before, an edit from the old Bastyon or forta.chat came as a new message, and the original could vanish.
- **The unread number** matches the list and drops as chats are read. Chats you have read no longer become unread after a restart.
- **A deleted chat** no longer comes back to the list. A chat you are no longer in can be removed.

## Video

- **The player remembers the quality:** what you pick in one video applies to all of them until you change it.
- **On slow networks** videos many hours long now start: before, their description did not load in time and was downloaded again. The next video takes the network speed into account at once, and a paused player does not load extra while another one plays.

## Menus and language

- **Menus, lists, hints and panels look where there is room:** at the bottom of the screen they open upwards, at the right edge to the left. This covers the “⋯” menu in the chat list, mentions, emoji, attachments, tag hints, search and the player settings.
- **Errors are in the language of the app.** About forty places showed a technical English text, for example without a network or when sending PKOIN.
- All nine languages now have the Tor and IPFS download progress and the “The app could not start” screen, and on macOS the microphone, camera and Bluetooth prompts. The macOS menu and the tray menu no longer switch to Russian at every launch.
- The block explorer in Russian has Russian labels where English words were left.
