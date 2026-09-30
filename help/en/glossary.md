---
keywords: [glossary, terms]
---

# Glossary

Terms used in this help and in the app.

## Address

A string starting with the letter P, for example `PFGJoLTrDwDutGs2L4Bo6aZzFiq6BHHxrW`. It is the account's public name on the [blockchain](#blockchain): coins are sent to the address, and the account is found by it. The address is derived from the [private key](#private-key), but the key cannot be derived from the address.

## Block

A batch of [transactions](#transaction) that the network adds to the [blockchain](#blockchain). A new block appears about once a minute, and each has a sequence number — the block height.

## Blockchain

A shared record of every action on the network: transfers, posts, ratings, subscriptions. It is kept by the network nodes, and what has been recorded cannot be changed after the fact.

## Boost

Promoting a post for [PKOIN](#pkoin): a participant spends coins, and the post rises in the feed with a "Promoted" label. The more coins, the higher the post. The author does not get the coins: they go as a [fee](#fee) to whoever produced the block. See [Promoting a post](boost.md).

## Bridge

A hidden entry point to the [Tor](#tor) network, for people whose Tor is blocked. obfs4 bridges disguise the traffic as random noise, Snowflake as a video call.

## CID

The fingerprint of a file’s contents in [IPFS](#ipfs). The file is found on the network by it, and it is used to check that exactly that file arrived.

## Confirmation

Inclusion of a [transaction](#transaction) in a [block](#block). Every following block adds one more confirmation, and the more there are, the more reliable the record. An action is visible to everyone from the first confirmation — usually within a minute.

## Emission

How many [PKOIN](#pkoin) have been issued in total. It grows with every [block](#block).

## End-to-end encryption

Encryption where only the participants can read a message: it is encrypted on the sender’s device and decrypted on the recipient’s, and the server sees only ciphertext. Bastyon’s private chats work this way — see [Message encryption](chat-encryption.md).

## Fee

The network’s charge for every action — a post, a rating, a transfer. It is usually 0.00000001 [PKOIN](#pkoin). The fee goes to whoever produced the [block](#block) with your [transaction](#transaction).

## Gateway

A website that fetches files from the [IPFS](#ipfs) network for people without their own IPFS program — for example dweb.link. Everything the app downloads through a gateway is checked against the [CID](#cid).

## Hash

A cryptographic fingerprint of data: a short string that changes with any change to that data. Hashes are used to find blocks and transactions and to check that data has not been swapped.

## IPFS

A file-sharing network where files are shared by the participants themselves, like a torrent. A file is found not by a server address but by its fingerprint — the CID.

## Kubo

The main program of the [IPFS](#ipfs) network. In the desktop app it runs as [the IPFS module](ipfs-module.md).

## Limit

How many actions of each kind an account can take per day: posts, ratings, comments, reports. It depends on the account status — see [Account status and limits](limits.md).

## Lottery

Handing out part of the [block](#block) reward. Since September 2025, 10% of the reward is shared by the moderators who voted in a jury in the previous block. Earlier, part of the reward went to the authors of well-rated posts and comments.

## Matrix

An open messaging protocol. Chats run on the Bastyon network's Matrix servers, and messages are encrypted on the participants' devices.

## Mini app

A third-party app that opens inside Bastyon and knows about you only what you allowed it. See [Mini apps](mini-apps.md).

## Node

A participant's computer running the Pocketnet Core software. Nodes keep the [blockchain](#blockchain), check new [transactions](#transaction) against the network rules and answer the apps: they serve feeds, profiles and comments.

## Passphrase

A password you can use to additionally protect the keys saved on your device. The app asks for it at launch and never stores it. It is not the same as the [recovery phrase](#recovery-phrase).

## PeerTube

Open-source video hosting software. PeerTube servers run by members of the network store Bastyon's videos, audio and images.

## Pin

Pinning a file in [IPFS](#ipfs): a computer or a service keeps the file and serves it to others until the pin is removed. A remote pin is a pin on a third-party service, see [Storing on a service](ipfs-remote-pin.md).

## PKOIN

The Bastyon network's own coin. It pays for fees and tips to authors, and it is also spent on post boosts.

## Private key

A secret number that signs every action of the account. It is derived from the [recovery phrase](#recovery-phrase) and shown as a 64-character string (hex) or in WIF format. Whoever knows the key controls the account.

## Recovery phrase

12 words from which your account keys are derived. It is also called a seed phrase or mnemonic. Whoever knows the phrase owns the account. If the phrase is lost, it cannot be recovered.

## Reputation

A number the network calculates from the ratings of your posts and comments by experienced members. It affects your limits and some features, such as low ratings.

## Staking

How new [blocks](#block) are produced on the network: nodes holding [PKOIN](#pkoin) in staking get the right to produce a block and its reward — the more coins, the more often. The transaction that pays the staker the reward is called coinstake, and it is always the first one in a block. The more coins are staked, the harder it is to attack the network.

## Tor

A network that hides your IP address: requests go through a chain of other people’s nodes. It is built into the desktop app — see [Tor](tor.md).

## Transaction

A record of an action signed with your account's key: a post, a comment, a rating, a subscription, a transfer. It reaches the [blockchain](#blockchain) when the network includes it in a [block](#block).

## Trial account

The status of a new account, with smaller daily limits. An account becomes full at a [reputation](#reputation) of 100 or a balance of 50 [PKOIN](#pkoin).

## TXID

A [transaction](#transaction) number — its [hash](#hash), 64 characters long. It is used to find the transaction in the [block explorer](explorer.md).
