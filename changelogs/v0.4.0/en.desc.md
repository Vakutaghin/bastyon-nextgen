# v0.4.0 — The player, the messenger and the things that got in the way

A small release following 0.3.0: two conveniences you stop noticing once they work, and a clean-up of what annoyed in daily use — the player in dark theme, the full-screen messenger over the feed, favorites, links in previews.

## A video continues from where it was left

- The position is kept per video rather than per post: the same clip opened from the feed and from the post page continues the same way.
- Clips under a minute and a half, the very beginning and the last seconds are left alone — "continue" there only gets in the way.
- A clip watched to the end forgets its position, so a replay starts over.
- Everything is stored locally, on the device.

## The desktop window reopens where and how it was left

The app remembers the window's size, position and maximized state. Fullscreen is deliberately not restored: quitting from fullscreen should not lock the next launch into it.

## Player

- **The control bar and the settings menu are no longer white in dark theme.** The "Quality" and "Speed" labels used to turn white on white and were simply invisible.
- On mobile the bar stopped reserving room for the system gesture bar — it sits inside a post card, not at the edge of the screen, and was taller than it needs to be.

## Messenger

Opening the full-screen messenger no longer drags the feed to the top or pauses the video. Closing it puts you back exactly where you were, and a clip keeps playing while you answer in chat.

## Feed and posts

- **Favorites work again.** A bookmarked post went missing from the Favorites tab if it had ever been edited. It is found now.
- **A link in a post preview is no longer cut in half.** The truncated piece used to end up in the link itself, so "copy link address" handed over a stub.
- **"The feed is empty" no longer flashes** before the posts arrive.

## Creating a post

- The tag suggestion list shows everything instead of the first eight.
- Scrolling the tag list or the mentions list no longer turns into scrolling the dialog itself, carrying the suggestions off screen.

## A note about the release itself

The files on the release page are named in plain words and grouped by system, and the description now explains which file to download and how to install it, in Russian and in English.
