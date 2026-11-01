# v0.26.0 — video and post in one window, faster Tor from Russia and Tor on Android

A video is published straight from the upload window with one button, even while the file is still uploading. Tor connects faster from Russia, and on Android it can finally be turned on. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Media Studio

- **The upload window is the post**: title, cover, **“Description”**, tags and the “Everyone · English · Right away” line, with a single **“Publish”** button at the bottom. Before, you had to press “Create post” and then “Publish” again in a second window.
- **“Publish” can be pressed during the upload**: the window minimizes and the post goes out by itself once the video is uploaded. The “Uploads” panel shows “Post after upload”; to change your mind, press **“Don't publish”**.
- If the network rejects the post, the reason is shown and the video and your text stay: press **“Publish”** again. “Done”, which published nothing, is now **“Save without a post”**.

## Post editor

- A greyed-out **“Publish”** explains what is missing as soon as the post has anything in it, not only text.
- A typed tag counts without Enter, and a space or comma splits tags on Android keyboards too.
- While your own video uploads, the title field shows at once and **“Publish”** is not greyed out: it waits for the upload to finish and publishes by itself.

## Tor

- **Tor can now be turned on on Android**: its icon is in the header. Tor has been built into the app since 0.23.0, but on the phone there was nowhere to open its menu.
- **Faster from Russia.** If the Tor Project's bridge service does not answer, Snowflake through the AMP cache is tried first, and the built-in methods that are blocked in Russia come later. From a home connection in Russia the first connection took about a minute and a half instead of three to four.
- **The next connection takes seconds.** Once connected over a slow method, the app asks the Tor Project, through Tor itself, for faster bridges for your country and tries them first next time: from a home connection in Russia, 15 seconds instead of 47.
- **“Get bridges”** asks through Tor when Tor is connected, so it works from Russia too.
- A set of bridges is no longer dropped because of one bridge that does not work: before, WebTunnel gave up even though its second bridge worked.

## Feed

- Instead of “Error: No Pocketnet nodes answered directly” the feed says “No node answered directly. Check your internet connection.” and shows **“Retry”**. Retry now works: after 30 seconds the nodes are asked again, for example after you turn on a VPN.
