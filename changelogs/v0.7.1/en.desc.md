# v0.7.1 — Voice input, polls and a calendar

This is 0.7.0 plus the macOS installers, which did not get built for 0.7.0. On Windows, Linux and Android 0.7.1 is the same as 0.7.0, so updating from 0.7.0 is optional.

Voice input comes to the desktop app, with speech recognized right on your computer. Polls in posts finally work: the feed shows them, and you can vote. The time of a scheduled post is now picked in a calendar, and names show up where addresses used to be. On macOS, voice messages and QR sign-in work now.

## Voice input

- **Dictation in chats and in the post composer.** In the desktop app a button with bars sits next to the emoji button of the text field. Speak, and the text appears phrase by phrase where the cursor is. Speech is recognized right on your computer; the recording never leaves it.
- **Punctuation can be dictated:** "period", "comma", "question mark", "new line" and more, in all nine interface languages. In phrases like "a period of time" these words stay words. Esc ends dictation without closing the post window, and dictated text is undone like typed text.
- **The speech model is downloaded once**, the first time you turn voice input on: "Fast" (57 MB), "Accurate" (181 MB, recommended) or "Best" (547 MB). The downloaded file is checked against its known checksum, and with Tor on it comes through Tor. Settings → General lets you switch or remove the model and lists the voice commands.
- Voice input is desktop only and needs a processor with AVX2, which covers most processors made since 2013. On older ones the button is not shown.

## Polls

- **Polls show up in the feed, and you can vote.** A poll used to be created in the composer but never reached the network: the node dropped it on publishing, and the Bastyon protocol has no voting at all. Now the poll lives in the post settings, and a vote goes out as a comment on the post.
- Until you vote, the options are buttons. After your vote, and for guests right away, the results show bars and percentages, with your option checked. Until the network confirms your vote, the poll says it is waiting for confirmation.
- One vote per account, with no changing it. Like any comment, it needs a signed-in account and counts toward the daily comment limit.
- Votes stay out of the discussion and the comment count. The old app does not show the poll, and the votes there look like comments reading "🗳 option".
- Editing a post leaves its poll as it was.
- Polls in posts published earlier cannot be recovered: the network never kept them.

## Creating a post

- **A calendar for scheduled posts.** The system field, which looked different in every browser, gives way to a calendar in the app's style: pick a day, then hours and minutes. Past days and times are disabled, the next full hour is suggested, and the empty field reads "Right away". Months and weekdays follow the interface language.

## Names instead of addresses

- **A name shows where an address used to:** at the last comment under a post in the feed, in comments and in "More from this author".
- **Comments of deleted accounts** read "Account deleted", as in the old app.
- **In the messenger** the name replaces a long hex string: in a quoted reply, in "typing…" and for a sender whose profile did not load.

## macOS

- **Voice messages and QR sign-in work in the macOS app.** The app lacked the microphone and camera permissions, so macOS silently denied it access. Now macOS asks for permission the first time.
- The macOS app now needs macOS 10.15 Catalina or newer.

## Interface

- **Dropdowns open in place.** A list used to appear off to the side and then jump to its field.
- The "Report a bug" icon in the header is green now and no longer gets lost among its neighbours.
