# v0.16.0 — “Video” and “Audio” sections, playlists and collections, a mini player, the feed as in the previous Bastyon

“Video” and “Audio” are now separate sections with their own subscriptions, playlists and search, and music keeps playing in a mini player while you move around the app. New: collections and playlists — the same as in the previous Bastyon app — and the private lists “Saved”, “Watch later” and “My music”. The feed now starts with what is new from your subscriptions, videos show their view counts, and promoted posts are picked the way they used to be. The page can stretch to the full width or stay a column, and on a computer you choose what the window’s close button does. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## “Video” and “Audio” sections

- **“Video”** — a grid of videos with the tabs “Home” (“New” and “Best of the week”), “Subscriptions”, “Playlists”, “Saved”, “Watch later”, “Uploads” and search.
- **“Audio”** — a track list with the categories “Music”, “Audiobooks”, “Podcasts and talks”, the tabs “Subscriptions”, “My music”, “Playlists” and search. The node does not index recordings, so search goes to the video servers tracks are uploaded to now, and older recordings may not be found.
- **A profile** gets the tabs “Posts”, “Video”, “Audio” and “Collections”.
- Old links to the “Video” and “Audio” feed modes open the new sections.

## Mini player

- **Tracks keep playing** when you leave the page: a mini player at the bottom with a queue, “Shuffle”, repeat and control from the keyboard, headphones and the lock screen. Recordings longer than 10 minutes resume where you stopped.
- **A video queue** opens the video’s post with an “Up next” panel: the next video starts after 5 seconds.
- **On Android** the queue plays on in a minimized app: the notification has Previous and Next, and its title and cover change with the track.

## Collections and playlists

- **“To collection”** under a post, for video and audio — **“To playlist”**. Collections and playlists are public: they live on the blockchain, everyone sees them, and they are the same as in the previous Bastyon app, including `collection?c=` links.
- **The editor**: name, description, cover, drag-and-drop order. The default cover is the first item’s preview. A collection takes at most 5 changes a month, and the window shows how many are left; a change made before the previous one is in a block waits its turn.
- **Private lists** “Saved”, “Watch later”, “My music” and private playlists are visible only to you. They are kept in your account data on the chat server and are the same on all your devices.

## Feed

- **New from your subscriptions first.** When you are signed in, the feed starts with posts from people you follow that you have not seen yet — as in the previous app. Below them is the “Continue in “Subscriptions”” button, then the general feed. Posts you have scrolled past do not come back to the top next time.
- **Views under a video** — to the right of the post’s buttons; for audio — listens, for a live stream — how many are watching now.
- **Promoted posts** are picked at random, with a chance proportional to the boost, and placed after the 5th, 14th and 28th post, then after every tenth. That is how the previous app did it, and the forecast in the “Promote” window assumes it. Before, only the most expensive boosts were ever shown, and the rest never.
- **“Report”.** The network accepts reports only from accounts with the “Shark” badge. The report window now says right away if you do not have it and offers to block the author, instead of sending a report the network would reject.
- **“Start chat”** under a post and in a profile opens the sign-in window when you are not signed in, and then the chat. Before, the button did nothing.

## Page width and the window on a computer

- **“Page width”** in Settings → General: a column up to 1280 points or the full window width. It is also switched by a header button next to the theme; the button can be hidden. In full width the feed and posts stay a column of about 1000 points, so lines do not stretch.
- **“When the window is closed”** in Settings → System (Windows and Linux): “Minimize to tray” or “Quit the app”.
- **“Icon in the menu bar”** in the same place on macOS: the Bastyon icon at the top of the screen can be removed.

## “Top accounts” and search

- **“Subscribe”** in each row of the top; unsubscribing asks first. Above the list is a search by name and address that keeps each account’s place in the top.
- **The clear button in the search field** no longer opens the list with the erased query and recent searches.

## Help

- **The “Blockchain and your own node” book** — 14 articles: how the Pocketnet blockchain works, network rules, staking and how to run your own node.

## Fixes

- **Broken previews and avatars.** Images, previews and avatars from retired video servers now come from their archive, as in the previous app. If a video’s preview still fails to load, the Media studio looks it up the way the player does, and only then shows an icon instead of a broken image.
- **The account menu** in the header got icons, as in the phone menu.
