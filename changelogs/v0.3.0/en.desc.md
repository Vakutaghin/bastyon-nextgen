# v0.3.0 — Audit: messenger, mini-apps, platform

The end-to-end audit continues: waves 4 to 7 are closed — feed and notifications, wallet, messenger, mini-apps, desktop, video and the block explorer. Two things are new in the app itself: it opens `bastyon://` links straight from the system, and it tells you when a new version is out.

## The app tells you about a new version

- Once a day the app asks GitHub about the latest release, and when a newer version is out it offers to open the release page, where installers for every platform live.
- The offer can be postponed until the next launch, or a particular version can be skipped for good.
- Settings → Diagnostics has an "Updates" row with a manual check.
- The check goes through the app's own transport: with Tor on, the request to GitHub goes over Tor instead of straight out. In a browser there is no automatic check — what is open there is already the deployed build.

## bastyon:// links open in the app

- A link like `bastyon://post?s=<txid>`, `bastyon://application?id=<...>` or simply `bastyon://<nickname>` opens the right page — from a browser, a messenger or an email.
- It works both when the app is already running and when it is still closed.
- The scheme is registered on every platform: macOS, Windows, Linux, Android, iOS. An installed web app picks up `web+bastyon:` — browsers do not hand over arbitrary schemes.
- Clicking such a link inside the app leads to exactly the same place: link parsing is now shared by every case.

## Messenger

- **Delivery status is visible.** A message that did not go through is marked and resent by a button instead of silently disappearing.
- **An honest refusal instead of silence** when the other side has no encryption keys yet (they have never opened the messenger).
- **Direct chats use the same room format as the old client** — a conversation no longer splits into two chats.
- A voice message goes to the chat it was recorded in, even if you switch chats mid-recording.
- A pasted screenshot lands in the chat field only when the focus is there — Ctrl+V works in the post composer again.
- A collapsed messenger window no longer marks messages as read.
- Blocking from the profile silences the conversation: blocked messages are neither shown nor announced.
- The system notification says who wrote what instead of a generic placeholder.
- Voice waveforms are drawn on a plain canvas: a dozen voice messages in a chat no longer blank them all out.

## Feed, posts, notifications

- A loading error no longer eats the posts already loaded: they stay, with an error and "Retry" below them.
- "Best first" counts depth in blocks — the day, three-day and week windows work instead of timing out on the node.
- Your own post cannot be rated, and a refused rating explains itself.
- Editing a post keeps its video, visibility and language.
- The block list applies to the feed, to boosts and to recommendations.
- Notifications: their own paging cursor, survival across restarts, an honest badge and working type toggles.
- "Share" gives a bastyon.com link rather than an internal app path.

## Wallet

- One seed derives every address — extra wallets no longer drift away from the keys.
- Receiving into wallets you cannot spend from is gone from the UI.
- An honest balance and the real fee before sending.
- The recipient address is validated: a bitcoin address in a PKOIN field is refused with a readable message.

## Mini-apps

- **A grant is bound to the origin.** An app that changed its address asks for access again.
- **Revoking a permission sticks** across restarts, including for preinstalled apps.
- **Access ends with the window:** a closed mini-app can do nothing more — its popup will not open a payment.
- A signing request shows what exactly is being signed.
- A mini-app can be removed — from its card and from settings.
- A payment shows the app's name, and a malformed recipient address is refused before the modal opens.
- A catalogue app opens from "Favorites" and "Recent" even after a restart.

## Video and player

- **Cancelling a transcode really cancels it** — the ffmpeg process is killed instead of the progress being hidden.
- Large files make it to the end: the video goes to the backend as a raw body instead of being inflated into an array of numbers.
- ffmpeg is found even when the app is launched from the Dock with a trimmed PATH.
- The player stopped piling up instances and listeners when videos are switched quickly.
- Seeking ten seconds counts from the live position, not from where playback started.
- One YouTube and Vimeo link parser for the whole app, shorts and live streams included.

## Desktop

- External links open in the system browser again instead of trying to open inside the window.
- Player fullscreen works; the set of system permissions is trimmed to what is actually used.
- The bundle carries one Content-Security-Policy instead of two conflicting ones — remote mini-apps and the local IPFS viewer load again.

## Explorer and embedding

- Block, address and transaction pages survive errors and fast switching: no stuck spinners and no other page's data on screen.
- "Load more" on an address no longer loses transactions that share a block.
- Peer ping is shown in seconds and the node version in short form.
- An embedded post takes links out of the frame, and the app itself does not render inside someone else's frame.
- "What's new" shows the notes of the version that is actually running.

## Under the hood

- The database may be unavailable — in private mode or with storage blocked the app keeps working and says so once instead of flooding you with toasts.
- Hotkeys stopped stealing input from fields and modals.
- Links in post text are inserted into text nodes only: markup no longer breaks.
- Articles understand the same block set as regular Bastyon: tables, delimiters, links, nested lists.
- Quality gates: 2655 frontend tests, 37 Rust tests, zero lint errors, types against a fixed baseline.
