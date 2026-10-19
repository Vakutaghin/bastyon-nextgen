# v0.10.0 — Photos in a post laid out like an album, a subscription can be undone at once

Several photos in a post are now laid out by their proportions, and a subscription or a block can be undone without waiting for the block. The IPFS module installs again: the site it came from is not answering now. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package).

## Posts

- **Photos like an album.** The grid used to depend only on the number of photos: two side by side, three as one and two, four in a square. Portraits and panoramas were cut hard. Now the app picks the layout by the photos’ proportions: rows of different lengths, or one large photo with a column beside it. It keeps the variant that crops least and has no tiny tiles, and the first photo gets more room. Up to 10 photos are shown, the last one says “+N” for the rest.
- **Tapping a photo opens the viewer again.** Clicking a photo in the feed stopped opening the viewer. Now it opens, for photos in comments too.

## Subscriptions and blocking

- **Changed your mind? Click again.** A subscription, a block and the notifications bell are written to the blockchain, and until that record is in a block it can’t be undone: the network answered “you are not subscribed” and the button flipped back. Now the button switches at once, and the record with your latest choice goes out as soon as the first one is in a block. Subscribe and unsubscribe right away — the unsubscribe follows. Change your mind once more — nothing goes out. This survives restarting the app too. If a deferred action fails, the button goes back and the app says it didn’t work.

## Services and comments

- **“Load more” in “Services”** shows only when there is more to show. The button used to appear under any full page and added nothing when clicked: right now all apps fit on one page. Catalog pages also no longer repeat each other.
- **“Load more” in comments** has no number: fewer than 15 may be left. Under a post whose only comment is already visible there is no button any more. “Show all” appears only when there are more comments than “Load more” opens.

## IPFS

- **The IPFS module installs even when the IPFS site is down.** dist.ipfs.tech doesn’t answer at all right now, and the module didn’t install. Now the app takes it from its own mirror on GitHub or, if it is not there, from the IPFS release on GitHub or the IPFS site. The checksum is still checked against the one built into the app. Versions before 0.10.0 won’t install the module until the site is back.

## Interface

- **The language in the header is just a flag.** The language name and the arrow took room next to the logo. The name stays in the tooltip and in the menu.
- **“Create post” on your own profile** and the post cards no longer touch the right edge of the window.
