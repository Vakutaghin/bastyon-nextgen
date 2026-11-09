---
keywords: [collection, collections, playlist, playlists, selection, cover, add to collection, add to playlist, private list, public list, make private, make public, who sees it]
---

# Collections and playlists

How to put together your selections of video, audio and posts, who sees them and how to change that.

A **playlist** gathers videos or audio — it can be played in a row. A **collection** gathers any posts: articles, photos, videos. Every list has two properties:

- **what is inside** — video, audio or posts;
- **who sees it** — everyone or only you. A public list is kept in the blockchain, like posts: everyone sees it, and every change is a transaction. A private list is kept in your account data: only you see it, and edits are unlimited — see [Private lists](media-library.md).

Public lists show on your profile: video playlists on the **“Video”** tab, audio playlists on the **“Audio”** tab, collections on the **“Collections”** tab. The previous Bastyon shows them too — playlists as ordinary collections.

## All of yours on one page <!-- #page -->

**“Collections”** in the left panel or **“Collections and playlists”** in the account menu. On a phone it is **“Collections”** in the side menu. The **“All collections and playlists”** link is also on the **“Playlists”** tab of the Video and Audio sections and on your own profile.

At the top are the built-in lists, which are always there:

- **“Favorites”** — everything you marked with the bookmark on a post or with Add to Favorites — see [Favorites](favorites.md);
- **“Watch later”** — videos for later;
- **“Downloads”** — videos and tracks downloaded to this device — see [Download to watch offline](offline-video.md).

Below is **“My playlists and collections”**, one list sorted by name. Each row shows what is inside and how much (“12 videos”, “5 tracks”, “3 posts”) and who sees it: **“Everyone”** or **“Only me”**.

- The buttons above the list filter by both properties: **“Video”**, **“Audio”**, **“Posts”** and **“Everyone”**, **“Only me”**; **“All”** and **“Any”** clear the filter. When there are many entries, a search by name appears.
- The three-dot button on a row: for a public list — **“Edit”** (opens the editor), how many edits are left this month, **“Share”** (copies the link), **“Make private”** and **“Delete”**; for a private one — **“Rename”**, **“Make public”** and **“Delete”**. The app asks before deleting.
- Until a change is in a block, the row is marked **“Publishing”** or **“Deleting”**, and it can’t be edited until the network confirms it. **“Not in a block”** means the transaction wasn’t confirmed within an hour: **“Dismiss”** in the menu hides the row.

## Create <!-- #create -->

**“Create”** opens one window for every case:

1. **“What is inside”** — **“Video”**, **“Audio”** or **“Posts”**.
2. **“Who sees it”** — **“Only me”** or **“Everyone”**.
3. The name and the entries. Entries can be added right away from Favorites, and for a playlist also from your own videos or tracks.

A private list is created at once, even an empty one. A public one also has a description and a cover — by default the preview of the first entry: **“Upload”** sets your own picture, **“Use the first entry”** brings back the automatic one. The automatic cover changes by itself when another entry becomes first. A public list goes to the network as one transaction when you press **“Create”**, and the network won’t accept it empty — it needs at least one entry.

Entries in the window are reordered by the handle on the left with the mouse, a finger or the arrow keys, and the cross removes an entry.

## Adding an entry <!-- #add -->

- Under a post — the **“To collection”** button, for video and audio **“To playlist”**.
- In a video's or track's menu — **“Add to…”**.

The window lists first what only you see: **“Favorites”**, **“Watch later”** for videos, and your private lists. Below are the public ones. Each row shows what is inside and how much. A tick means the entry is already there; tap to add or remove it. New entries go to the end. **“New list…”** at the bottom opens the Create window with this entry already in it.

A video can go into a video playlist and into a collection of posts, a track into an audio playlist or a collection, other posts into collections only.

## Editing a public list

**“Edit”** opens the editor: the name, description, cover, the order of entries and new entries from Favorites or your own videos. Changes go to the network as one transaction when you press **“Save”**.

A list's page has **“Play all”**, **“Shuffle”** and **“Share”**, which copies the link. Its author also sees **“Edit”**, **“Make private”** and **“Delete”** there.

## Making it private or public <!-- #visibility -->

- **“Make public”** on a private list opens the Create window with the same name and entries, and Who sees it set to Everyone. Add a description and cover and press **“Publish”**. The private list is deleted by itself once the publication is in a block; if it doesn’t get there, the private list stays. A public list holds up to 100 entries: remove the extra ones right in the window.
- **“Make private”** on a public list: the app asks first, creates a private list with the same entries and deletes the public one from the network — that is a transaction, like any edit. The description and cover are not carried over. If the public one could not be deleted, the private list stays anyway.

## Blockchain limits

This is about public lists — private ones have no limits.

- Every change is a transaction. The fee is almost zero, but it takes registration and coins on the address — see [Confirming actions](transactions.md).
- A list can be changed at most 5 times per 43,200 blocks — about a month. The Add to… window and the row menu show how many edits are left. So change many things at once: the editor sends everything as one edit.
- While a change waits for a block, the network does not accept the next change to the same list. The app keeps it and sends it by itself once the previous one is confirmed. The wait shows in the header's hourglass.
- A list holds up to 100 entries. The name, description and cover together take at most 2,000 bytes: Latin letters take one byte, most other alphabets two or three.
- An entry its author deleted stays in the list. The app does not show it, and the list's author gets a **“Remove deleted”** button.
- The network has no ratings, comments or reports for collections — only for the posts themselves.

## Links

Links like `https://bastyon.com/collection?c=…` and `bastyon://collection?c=…` open the public list in the app.

## See also

- [Private lists](media-library.md)
- [Favorites](favorites.md)
- [The Video section](video-section.md)
- [The Audio section](audio-section.md)
