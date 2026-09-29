---
keywords: [link, 'bastyon://', 'pocketnet://', open in the app, link to a post]
---

# bastyon:// links

How links to posts, profiles and sections open right in the app — from a website, a messenger or another program.

## Kinds of links

Links starting with `bastyon://` lead straight into the app. The old `pocketnet://` ones work too.

| Link | What opens |
| --- | --- |
| `bastyon://post?s=…` | a post; with `&c=…`, a comment under it |
| `bastyon://index?v=…` | a video |
| `bastyon://name` or `bastyon://profile?address=…` | a profile |
| `bastyon://application?id=…` | a [mini app](mini-apps.md) |
| `bastyon://i?stx=…` | a transfer in the [block explorer](explorer.md) — the previous Bastyon app marks transfers in a chat this way |
| `bastyon://wallets`, `bastyon://settings`, `bastyon://help` and other sections | that section of the app |

Links to posts and profiles on bastyon.com — `https://bastyon.com/post?s=…` — are understood the same way.

## Where they open

- **On a computer**, such links are opened by the installed app: click a link in a browser or another program, and it opens in the window already running or starts the app. If the previous Bastyon app is installed too, the link is opened by whichever one the system treats as the main one for `bastyon://`.
- **On Android** — the same: the system opens the link in the app or asks which one to use.

## Links inside Bastyon

`bastyon://` links and links to posts and profiles on bastyon.com in posts, comments and chats open in the app itself, not in a browser. In a chat, a link to a post turns into a card with the start of the post. If a full-screen chat was open at that moment, it closes so that the page becomes visible.

Links to other sites open in the browser.

## See also

- [Reposting and linking to a post](sharing.md)
- [The desktop app](desktop-app.md)
