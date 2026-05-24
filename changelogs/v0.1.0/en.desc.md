# v0.1.0 — First public NextGen release

This is the first release of the new **Bastyon NextGen** client — a rewritten interface focused on decentralization, speed, and self-custody.

## What's inside

- **Feed & posts** — top feed, hierarchical feed, profile feed; full-featured post cards with video, images, tags, and comments.
- **Comments** — threaded discussions, votes, replies, and live updates.
- **Messenger** — end-to-end encrypted (E2E) group chats, contact search, profile caches.
- **Wallets** — balance, transaction history, PKOIN send, addresses linked to the Block Explorer.
- **Block Explorer** — native browser for blocks, transactions, addresses, and peers.
- **Tor** — optional Tor routing in the desktop build.
- **Profile** — profile card, author feed, navigation by address.

## New in this release

- **Bastyon search.** A search bar in the header with a quick dropdown (users / tags / posts) and a dedicated `/search` page with tabs and paginated loading. Posts in the results are rendered with the same cards used in the main feed.
- **"What's new" dialog.** This very window — it pops up once after each version upgrade and is also available in `Settings → What's new`. Notes in Russian and English live in the repo under `changelogs/`.
- **Language selector.** `Settings → General` now has a language switcher (RU/EN). For now it only affects changelog text — we'll gradually extend it to the rest of the UI.

## Under the hood

- TanStack Query as a uniform cache layer for RPC calls to the node.
- Pinia for state, lazy routes for code-splitting, styled-components for theming.
- IndexedDB as the local persistent layer (settings, history, cache).

## Principles

- **Mnemonic-only** — no SSO, no intermediaries. Keys stay with the user.
- **Standalone** — the app must work as an independent client, with no required ties to other services.
