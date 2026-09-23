# v0.2.0 — Audit: privacy, money, accounts

This release is all about reliability. I ran an end-to-end audit of the app (160 findings) and closed the first four waves: critical money and content bugs, key storage, honest Tor, and correct multi-account behaviour.

## Tor became honest

- **Fail-closed routing.** While Tor is enabled but not ready yet, requests wait for it instead of silently going out over the open network. Part of the traffic used to leak past Tor.
- **Media no longer gives you away.** With Tor on, images, embedded players and iframes are not loaded directly: an image is fetched through Tor on click, and an embed is replaced by an honest explanation. Playing a video requires explicit consent to bypass Tor.
- **Working WebSocket over Tor** and a truthful lifecycle: installation can be cancelled, a crashed process is visible in the UI, stopping closes the connections.
- **Turning Tor off reloads the window** — otherwise the lifted restrictions would stay in place until the next restart.

## Wallet and transactions

- Fixed PKOIN vs satoshi confusion: history and extra-wallet balances no longer show zero.
- A transaction is never re-broadcast to another node on retry, and a PKOIN donation in chat is not re-sent when only the chat message failed.
- Selected UTXOs are locked in every send path, so a race can no longer produce a double spend.
- Typing a recipient nickname clears the previously entered address, so funds cannot go to a stale one.

## Multiple accounts

- **A single reset on account switch.** Subscriptions, block list, notifications, favorites, drafts, search history and limits now always belong to the current account. Some of them used to stay behind from the previous one.
- **Favorites, drafts, search history and notification filters** are bound to the address; existing data migrates to the first account that opens it, and removing an account wipes its local data.
- **The seed phrase is shown only to its owner** — "show mnemonic" for one account can no longer reveal another account's phrase.
- **Signing out revokes the messenger session** on the server instead of just forgetting the token.
- **Registration tells the truth:** a node rejection (a taken nickname, for example) is surfaced immediately, waiting is capped at 30 minutes, and the seed is shown even if the app is reloaded mid-registration.

## Keys and security

- Key vault: confirmed reset, KDF self-tuning, persistent browser storage, keys in the system key store on mobile.
- Backup verification: the app periodically asks you to confirm the mnemonic is written down.
- The messenger pins the peer's keys (TOFU), shows an honest placeholder for a message it cannot decrypt, and purges local data on sign-out.
- Signing out now also removes what used to be left behind: PeerTube tokens, unfinished uploads, drafts.
- Desktop devtools are available only in debug builds.
- Mini-apps can no longer reach the local network through the host (SSRF), and deleting a video requires a node-known host plus user confirmation.
- Links in posts and the profile cover image can no longer inject markup or CSS.

## Feed, posts, comments

- A post is rated by its txid rather than the hash of the latest edit, so a vote is no longer lost after an edit.
- A reply to a reply lands in the right thread again.
- Related videos on the post page load again.
- Photos, videos, files and PKOIN transfers in chat are rendered as attachments again instead of plain text.

## Language

The language switcher in the header and in settings now really owns the interface language: the choice survives a reload, the "General" tab shows the actual value, and there is no more flash of Russian before English on startup.

## Under the hood

- Quality gates in CI: zero lint errors, types against a fixed baseline, a run of 2425 tests and a build on every commit.
- Large files split into composables and adapters: feed, post card, composer, comments, wallet, messenger.
