---
keywords: [blockchain, node, decentralization, PeerTube, Matrix, IPFS, network design]
---

# How the network works

Where your posts, videos, messages and files live, and why the network has no owner.

Bastyon has no single server that someone could switch off. Different data is stored in different places, and each of them is run by members of the network.

| What | Where it is stored |
|---|---|
| Posts, comments, ratings, subscriptions, profiles, transfers | the [blockchain](glossary.md#blockchain) on every node |
| Videos, audio, post images and avatars | [PeerTube](glossary.md#peertube) servers run by members of the network |
| Private and group messages | [Matrix](glossary.md#matrix) servers, encrypted |
| Files sent over IPFS | the devices of the people sharing them |
| Keys, settings, drafts | your device only |

## The blockchain: a shared record of actions

Every action you take — a post, a comment, a rating, a subscription, a profile change, a transfer — is a [transaction](glossary.md#transaction) signed with your account's key. The network collects transactions into [blocks](glossary.md#block) about once a minute, and from then on every node has the record.

A record cannot be changed after the fact. When you edit or delete a post, a new transaction goes to the blockchain, and the earlier versions stay in the history. The network's coin is [PKOIN](glossary.md#pkoin): it pays for transfers, tips and boosts.

<details>
<summary>Where the text of a post actually lives</summary>

A block holds a fingerprint ([hash](glossary.md#hash)) of the post, which lets anyone check that the text has not been swapped. The text itself, links and settings are kept by the nodes next to the blockchain, in their own database. That is why a post cannot be changed quietly: altered text would not match the fingerprint in the block.

</details>

## Nodes

A [node](glossary.md#node) is a participant's computer running the Pocketnet Core software. Nodes keep the blockchain, check new transactions against the network rules and answer the app: they serve feeds, profiles and comments.

The app picks a live node from the list of public ones by itself and switches to another if the current one stops answering. More in [Network and nodes](network.md).

Anyone can run their own node. You need a computer that is always online: at least 2 cores, 4 GB of memory and 150 GB of disk, better 4 cores, 16 GB and a 500 GB SSD, plus a public IP address. The software and instructions are in the [pocketnet.core](https://github.com/pocketnetteam/pocketnet.core) repository.

## Videos and images

Videos and audio are uploaded to PeerTube servers run by members of the network, and the post only holds a link to the clip. Post images and avatars also go to PeerTube servers. How to upload your own video is covered in [Uploading video and audio](video-upload.md).

## Messages

Chats go through the Bastyon network's Matrix servers. Messages are encrypted on the sender's device, and the server only stores the encrypted text. How the encryption works and how group chats differ from private ones is explained in [Message encryption](chat-encryption.md).

## Files

Files over [IPFS](glossary.md#ipfs) are shared by the users themselves, like a torrent: Bastyon has no storage of its own. A file is available as long as at least one person is sharing it. More in [Files and IPFS](ipfs.md).

## Your device

Account keys, settings, drafts and cache stay on your device only and are not sent anywhere. What exactly is kept there is described in [What is stored on your device](local-data.md).

<details>
<summary>What happens if a node or a server disappears</summary>

- **A node.** The app switches to another one: every node has the blockchain, nothing is lost.
- **A PeerTube server.** Its videos, images and avatars stop loading. The posts remain, but show an error instead of the clip.
- **A Matrix server.** Chats do not work until the server is back: the conversations are stored on it.
- **The people sharing a file.** If nobody shares an IPFS file any more, it cannot be downloaded.

</details>

## See also

- [About Bastyon](about.md)
- [Privacy: what others can see](privacy.md)
- [Network and nodes](network.md)
- [What is stored on your device](local-data.md)
