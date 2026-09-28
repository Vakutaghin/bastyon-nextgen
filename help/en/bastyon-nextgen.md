---
keywords: [NextGen, previous app, Pocketnet, compatibility, features, open source, bastyon.com]
---

# The Bastyon NextGen app

How this app differs from the previous Bastyon, what it already has and what it does not have yet.

Bastyon NextGen is a new app for the same Bastyon network, written from scratch. It runs on Windows, macOS, Linux and Android. The previous Bastyon app, including the web version at bastyon.com, keeps working, and you can use both at the same time.

## The same network, the same accounts

- You can sign in to NextGen with the recovery phrase or private key from the previous app — see [Signing in](sign-in.md).
- Everything you do here is visible there and the other way round: posts, comments, ratings, subscriptions, the profile and the wallet are the same, because they are stored on the blockchain, not in the app.
- `bastyon://` links and the old `pocketnet://` ones open in this app — see [bastyon:// links](deep-links.md).

## What is new here

- [Tor](tor.md) right inside the desktop app — to hide your IP address from nodes and the chat.
- Files of any size over [IPFS](ipfs.md): sharing from your computer, private links with encryption, sending in a chat.
- [Voice input](voice-input.md) that recognizes speech on your computer, without sending the recording to the internet.
- [Polls](polls.md) you can vote in.
- A passphrase for the keys on the device and a check of your phrase backup — see [Protection on this device](device-protection.md).
- Built-in help — the one you are reading, with search and F1 hints.
- The interface in 9 languages.

## What is not here yet

These features exist in the previous app but are not done here yet. Meanwhile you can use them there:

- post boosts, paid subscriptions and staking;
- post collections;
- calls, creating group chats, editing and forwarding messages, stickers;
- the “My videos” section, importing a video by link and live streams;
- creating your own mini apps.

## Polls in the two apps

The previous app let you create polls, but the node did not save them, so such polls are not visible anywhere. Polls created here are saved. A vote in a poll is a special comment, and in the previous app it looks like a "🗳 option" comment.

## Open source

The app's code is open: [github.com/Vakutaghin/bastyon-nextgen](https://github.com/Vakutaghin/bastyon-nextgen). The [releases page](https://github.com/Vakutaghin/bastyon-nextgen/releases) there lists all versions and their changes. Found a bug — write as described in [Reporting a bug](report-bug.md).

## See also

- [Installing the app](install.md)
- [Updates](updates.md)
- [Reporting a bug](report-bug.md)
