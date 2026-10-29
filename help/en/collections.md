---
keywords: [collection, collections, playlist, playlists, album, selection, cover, add to collection, add to playlist]
---

# Collections and playlists

Selections of posts and playlists of video and audio: how to put them together, where they show and what to know about keeping them in the blockchain.

A **collection** is a selection of posts with a name, cover and description. A **playlist** is a collection of videos or audio that can be played in a row. Video playlists show in the [Video section](video-section.md) and on the profile's **“Video”** tab, audio playlists and albums in the [Audio section](audio-section.md) and on the **“Audio”** tab. Collections of posts of any type are on the profile's **“Collections”** tab.

Collections and playlists are public: they are kept in the blockchain, like posts, and everyone sees them. The previous Bastyon shows them too — playlists as ordinary collections. Put what only you should see into [private lists](media-library.md).

## All of yours on one page

**“Collections”** in the left panel or **“Collections and playlists”** in the account menu opens everything you have put together: collections of posts, video playlists, audio playlists and albums, and below them your private lists — **“Saved videos”**, **“Watch later”**, **“My music”** and private playlists. On a phone it is **“Collections”** in the side menu. The **“All collections and playlists”** link is also on the **“Playlists”** tab of the Video and Audio sections and on your own profile.

- The buttons at the top choose what to show: **“All”**, **“Collections”**, **“Video”**, **“Audio”**, **“Private”**. When there are many entries, a search by name appears.
- **“Create”** — a video playlist, an audio playlist or album, a private video or audio playlist. A collection of posts is put together from posts: the network won’t accept an empty one, so tap **“To collection”** under a post and choose **“New collection”**.
- The three-dot button on a row: for a public one — **“Edit”** (opens the editor), how many edits are left this month, **“Share”** (copies the link) and **“Delete”**; for a private playlist — **“Rename”** and **“Delete”**. The app asks before deleting. Built-in lists have no menu: they can’t be renamed or deleted.
- Until a change is in a block, the row is marked **“Publishing”** or **“Deleting”**, and it can’t be edited until the network confirms it. **“Not in a block”** means the transaction wasn’t confirmed within an hour: **“Dismiss”** in the menu hides the row.

## Adding an entry

- Under a post — the **“To collection”** button, for video and audio **“To playlist”**.
- In a video's or track's menu — **“Add to…”**.

The window lists your private lists, playlists and collections. A tick means the entry is already there; tap to add or remove it. New entries go to the end. At the bottom are **“New playlist”** and **“New collection”**: they open the editor with this entry.

## Creating and editing

In the editor:

- the name — up to 100 characters, and a description;
- the cover — by default the preview of the first entry. **“Upload”** sets your own picture, **“Use the first entry”** brings back the automatic one. The automatic cover changes by itself when another entry becomes first;
- the entries — reorder them by the handle on the left with the mouse, a finger or the arrow keys, and remove one with the cross. A playlist also lists your videos or tracks below: tap to add.

Changes go to the network as one transaction when you press **“Create”** or **“Save”**. A collection's page has **“Play all”**, **“Shuffle”** and **“Share”**, which copies the link. Its author also sees **“Edit”** and **“Delete”** there.

## Blockchain limits

- Every change is a transaction. The fee is almost zero, but it takes registration and coins on the address — see [Confirming actions](transactions.md).
- A collection can be changed at most 5 times per 43,200 blocks — about a month. The Add to… window shows how many edits are left. So change many things at once: the editor sends everything as one edit.
- While a change waits for a block, the network does not accept the next change to the same collection. The app keeps it and sends it by itself once the previous one is confirmed. The wait shows in the header's hourglass.
- A collection holds up to 100 entries. The name, description and cover together take at most 2,000 bytes: Latin letters take one byte, most other alphabets two or three.
- An entry its author deleted stays in the collection. The app does not show it, and the collection's author gets a **“Remove deleted”** button.
- The network has no ratings, comments or reports for collections — only for the posts themselves.

## Links

Links like `https://bastyon.com/collection?c=…` and `bastyon://collection?c=…` open the collection in the app.

## See also

- [Private lists](media-library.md)
- [The Video section](video-section.md)
- [The Audio section](audio-section.md)
