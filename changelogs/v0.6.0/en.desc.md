# v0.6.0 — Files over IPFS, built-in help and every Bastyon language

A big release. Files go over IPFS right in a chat, and IPFS links open in the browser and on phones too. The app has its own help now, the interface is translated into all nine languages of the original Bastyon, and a post can carry your own video. The desktop app gets a security fix, so it is worth updating.

## Security

- **Sites in the IPFS viewer window can no longer drive the app.** That window shows other people's sites, and any of them could call the app's internal commands, such as starting and stopping Tor and IPFS, and read large responses meant for the main window. Now only the app's own interface can call those commands, and Tauri, the framework the app is built on, is updated to 2.11.6 with its security fixes.

## Files over IPFS

- **Large files in chat.** On desktop the paperclip menu has "File via IPFS". The file is shared from your computer and is private by default: the key travels inside the message, so in an encrypted chat only its members hold it. You can pick several files at once. The other side sees a card with the name and size and an "Open" or "Download" button, and on desktop "Keep sharing" keeps the file available from their computer while you are offline.
- An attachment over 25 MB used to vanish from the chat without a word. Now the app says why it was not sent and suggests IPFS.
- **My files.** This desktop page gathers everything the account has shared from this computer: copy a link again, stop sharing a file, or share a new one, openly or privately. It shows whether the node is serving right now and, with a pinning service connected, whether the copy is there.
- **Private files have no size limit.** They used to stop at 512 MB, and the whole file was held in memory. Old links open as before.
- **ipfs:// links open in the browser and on phones.** These used to say that IPFS is only in the desktop app. Viewing goes through a public gateway, every part of a download is checked against the link, and private files are decrypted right on the device.
- **Files from the public gateway are verified in the desktop app too.** The gateway cannot swap the contents: a file that does not match its link is not saved. Saving shows its progress and can be cancelled.
- **The IPFS cache no longer grows past 2 GB.** The limit was set before but did not work: everything ever viewed stayed on disk.
- **Installing the IPFS module can be cancelled** with "Cancel installation", in the install dialog and in the IPFS menu in the header. A failed installation no longer leaves the header waiting forever.

## Help

- A new Help section: contents, index, search that understands word forms, and favorites. The "?" icon and F1 open the article about the current screen in a side panel without leaving it. Help works without signing in.
- About Bastyon, Frequently asked questions, Getting started and How to get PKOIN moved there, and the old links lead there too.
- The footer keeps only the name: its links are gone, together with the support and legal pages.

## Languages

- **The interface speaks all nine languages of the original Bastyon:** Russian, English, German, French, Spanish, Italian, Serbian, Korean and Chinese. As in the old app, the interface language also decides the feed, the tag cloud and the recommendations.
- Help and release notes stay in Russian and English for now.

## Creating a post

- **Your own video or audio.** "Upload video or audio" sends the file to a Bastyon video server with a progress bar and a cancel button, and the post becomes a video or audio post. The file name becomes the title if there is none yet. After a dropped connection "Try again" continues from the same place, and a slow line or Tor does not interrupt the upload. When something goes wrong, the app says what: a wrong format, a file over 4 GB, the daily quota used up, no free video server, the server refused the sign-in, the connection dropped. Pictures and your own video do not share a post: in the feed the pictures would cover the player.
- **Link previews.** The first plain link in the text is attached to the post, as in the old app, and a card with the page's title, description and picture appears under the text. The cross removes the card and detaches the link; the text stays as typed. As in the old app, a link needs some text next to it. In the feed such posts show the same card. The node fetches the page, so the site does not see your IP. The "Link previews" setting now covers posts too.
- **The app explains why the node said no.** When the node does not accept a post, comment, rating or report, you see the reason instead of "Failed to publish the post", for example the daily limit of posts, comments, ratings or reports. A star rating the node refused used to vanish silently.
- "Paid subscribers" is offered in a post's visibility only when the author has set a subscription price: otherwise nobody can subscribe, and nobody would see the post.

## Articles

- **Articles from the old app show in full.** Nearly half of them came out as plain text without pictures or links, cut off at the first quotation mark. New articles are stored the way the old app stores them, so it can open them for editing.

## Messenger

- **The chat list is ready right after launch.** The app shows the list from the previous launch and refreshes it after syncing, with no more long "Loading dialogs...".
- **Your messages are yours again.** In 0.5.0 your own messages from the history looked like the other person's: the chat list had no "You:" before them, and they could not be deleted.
- If signing in to the messenger fails, the app retries in the background instead of waiting for you to open the messenger.
- Removing the current account wipes its messages from the device. They used to stay on disk when other accounts remained on the device.

## Video player

- **Space pauses on the first press.** The video used to resume at once, and only the icon flashed. M and the speed keys fired twice the same way.
- Clicking the video no longer draws a frame around the player. Moving there with Tab still shows it.
- The pause icon sits in the middle, in a round badge, and appears right on the key press.
- A held arrow no longer jerks the video 30 times a second: seeking goes at a steady pace, and the hint adds up: +10s, +20s.
- Shortcuts with Cmd, Ctrl and Alt go to the browser again: Cmd+F, for one, no longer makes the video full screen.
