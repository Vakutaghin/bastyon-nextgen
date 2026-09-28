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

## Hash

A cryptographic fingerprint of data: a short string that changes with any change to that data. Hashes are used to find blocks and transactions and to check that data has not been swapped.

## IPFS

A file-sharing network where files are shared by the participants themselves, like a torrent. A file is found not by a server address but by its fingerprint — the CID.

## Matrix

An open messaging protocol. Chats run on the Bastyon network's Matrix servers, and messages are encrypted on the participants' devices.

## Node

A participant's computer running the Pocketnet Core software. Nodes keep the [blockchain](#blockchain), check new [transactions](#transaction) against the network rules and answer the apps: they serve feeds, profiles and comments.

## Passphrase

A password you can use to additionally protect the keys saved on your device. The app asks for it at launch and never stores it. It is not the same as the [recovery phrase](#recovery-phrase).

## PeerTube

Open-source video hosting software. PeerTube servers run by members of the network store Bastyon's videos, audio and images.

## PKOIN

The Bastyon network's own coin. It pays for fees and tips to authors, and it is also spent on post boosts.

## Private key

A secret number that signs every action of the account. It is derived from the [recovery phrase](#recovery-phrase) and shown as a 64-character string (hex) or in WIF format. Whoever knows the key controls the account.

## Recovery phrase

12 words from which your account keys are derived. Whoever knows the phrase owns the account. If the phrase is lost, it cannot be recovered.

## Reputation

A number the network calculates from the ratings of your posts and comments by experienced members. It affects your limits and some features, such as low ratings.

## Transaction

A record of an action signed with your account's key: a post, a comment, a rating, a subscription, a transfer. It reaches the [blockchain](#blockchain) when the network includes it in a [block](#block).

## Trial account

The status of a new account, with smaller daily limits. An account becomes full at a [reputation](#reputation) of 100 or a balance of 50 [PKOIN](#pkoin).
