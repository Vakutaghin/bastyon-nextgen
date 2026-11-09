---
keywords:
  - feed
  - recommendations
  - subscriptions
  - video
  - audio
  - articles
  - discussed
  - promoted
  - new posts
  - new posts live
  - refresh feed
  - pull to refresh
---

# Feed

What the Bastyon feed shows, how its sections differ and why it is in your language.

The feed is put together by a [node](glossary.md#node) using an open algorithm — Bastyon has no hidden recommendation system. The feed sections are in the left panel.

## Sections

- **“Feed”** — fresh posts from the whole network. The node ranks them by the post's ratings, the author's reputation and age: a new well-rated post rises higher, an old one gradually sinks.
- **“Subscriptions”** — posts from people you follow, newest first. The section is available once you sign in, see [Subscriptions](subscriptions.md).
- **“Articles”** — the same feed, but only articles.
- **“Video”** and **“Audio”** — separate sections with subscriptions, playlists and search — see [The Video section](video-section.md) and [The Audio section](audio-section.md).
- **“Favorites”** — posts you saved, see [Favorites](favorites.md).
- **“Discussed”** — the most commented posts of the last 24 hours.

Posts from authors you have [blocked](blocking.md) are not shown in the feed. To see only the best posts or only certain topics, turn on filters — see [Categories, tags and sorting](feed-filters.md).

## The feed language

The feed, tags and recommendations are in the feed language: the app passes it to the node, and the node picks posts in that language. At first it is the same as the interface language. To read posts in another language, or in several at once, without changing the interface, pick the languages in the **“Feed language”** field under the **“Best first”** and **“New posts live”** switches in the left panel; on a phone it is in the side menu. If you change the interface language in the header or in the settings, the feed switches to the same language. **“Subscriptions”** does not filter by language: posts of the people you follow show in any language. More in [Language and appearance](appearance.md).

## New posts and refreshing

- While **“New posts live”** is off (see below), every minute and a half and when you come back to the window, the app checks whether there are new posts. If there are, a "Show new posts" button with their number appears at the top of the feed.
- **“Refresh feed”** above the feed loads it again. On a phone a gesture does the same: pull the feed down from the very top — a circle with an arrow slides out from above; let go once it has slid out far enough, and the feed refreshes. While it loads, the circle spins.
- Older posts load by themselves as you scroll down.
- **“To top”** at the bottom of the screen takes you back to the start of the feed — the button appears once you have scrolled.

If you turn on **“New posts live”** — the switch under **“Best first”** in the left panel, on a phone in the side menu — there is no button to wait for: new posts appear at the top of the feed by themselves, all together, about 2 seconds after each new [block](glossary.md#block). A post enters the feed with its block, and a new block appears on the network about once a minute. If no signal about a new block arrives, the app checks the feed every 30 seconds. This works in feeds sorted by date; in **“Discussed”** new posts do not appear by themselves, and while **“Best first”** is on, the switch is unavailable. If the feed stayed in the background for a long time and many new posts piled up, the same "Show new posts" button appears instead.

## New from your subscriptions

If you are signed in and follow someone, the **“Feed”** section starts with your subscriptions’ posts from the last week you have not seen yet — up to 20, as in the previous Bastyon app. Below them is a bar saying “Above are new posts from people you follow. Below is the general feed.” with the **“Continue in “Subscriptions””** button: it opens the **“Subscriptions”** section. The general feed follows, without those posts.

A post counts as seen as soon as it has been on the screen, and the whole selection once you have scrolled down to the bar: the next time the feed loads, only newer ones are at the top. If the selection arrives when the feed is already on the screen (on a slow connection or through Tor, for example), it is not inserted at the top by itself — it appears after **“Refresh feed”**. With **“Best first”**, categories or tags turned on there is no such selection.

## Promoted posts

In the **“Feed”** section, after the 5th, 14th and 28th post and then after every tenth, you may see a post labeled **“Promoted”**: its author or another participant paid PKOIN to lift the post — this is called a [boost](glossary.md#boost). Which promoted posts get these places, the app picks at random, but the bigger the boost, the more often the post comes up. You can promote your own or someone else’s post with the **“Promote”** button under it — see [Promoting a post](boost.md).

## See also

- [A post in the feed](post-card.md)
- [Categories, tags and sorting](feed-filters.md)
- [Search](search.md)
