---
keywords: [privacy, anonymity, public, IP address, encryption, data, tracking]
---

# Privacy: what others can see

What on Bastyon is public forever, what is encrypted, what stays on your device, and which services see your IP address.

## Public and permanent

Everything recorded on the [blockchain](glossary.md#blockchain) is visible to everyone, including in the [block explorer](explorer.md):

- posts, articles, comments and their earlier versions;
- ratings of posts and comments — who rated what and how;
- subscriptions and blocks, including notifications turned on for an author's posts (that is a blockchain record too);
- the profile: name, avatar, description, website, language;
- PKOIN transfers and the balance of every address;
- reports.

> [!IMPORTANT]
> A record cannot be removed from the blockchain. A deleted or edited post disappears from feeds, but the earlier version stays in the history and can be found. Do not publish anything you are not ready to leave on the network forever.

## Encrypted

- **Private messages** are encrypted on your device, and the server stores only the encrypted text. Group chats are encrypted too, but with a simpler scheme — details in [Message encryption](chat-encryption.md).
- **Private files over IPFS** are encrypted, and the key exists only in the link: without the link the file cannot be opened — see [Files and IPFS](ipfs.md).

## Anonymity

An account needs no name, phone number or email: the account is a set of keys. But all actions of one account are linked to each other, and transfers link addresses. If you want to keep roles apart, create several accounts — see [Several accounts and signing out](accounts.md) — and do not send coins between them directly.

## Who sees your IP address

Bastyon itself does not collect IP addresses, but the app talks to servers, and each of them sees the address a request came from:

| Who | When |
|---|---|
| Network nodes | always: feeds, profiles, publishing |
| PeerTube servers | when you watch videos, view images and avatars |
| Matrix servers | when the messenger is open |
| YouTube and Vimeo | when a post with an embedded clip from these sites is on screen |
| Websites from links | when a link preview image is shown |
| CoinGecko | when you open the PKOIN price chart in the wallet |
| GitHub | when checking for updates (in the desktop and phone apps) |
| Hugging Face | when downloading the voice input model |
| Tor Project, IPFS | when Tor or the IPFS module is turned on for the first time — downloading the programs |
| IPFS gateways and peers | when you open IPFS links and share files |

Link previews in posts are built by a node: the node opens the page, not your device. The preview image is loaded by the app itself.

## How to hide your IP address

- The desktop app has built-in [Tor](tor.md): requests to nodes and to the chat go through it. Under Tor, images load on a click and also through Tor, while embedded players, mini apps and IPFS are turned off so as not to reveal your address.
- In [Settings](settings.md) you can turn off **“Show embedded videos”** — then a post shows a link instead of a YouTube or Vimeo player — and **“Link previews”**.
- In the browser and on the phone the app has no Tor — use a VPN or Tor Browser.

## On your device

Keys, settings, drafts, cache and decrypted conversations are stored on the device only. What exactly is kept there and how to protect it is covered in [What is stored on your device](local-data.md) and [Protection on this device](device-protection.md).

## See also

- [Tor](tor.md)
- [What is stored on your device](local-data.md)
- [Message encryption](chat-encryption.md)
- [Protection on this device](device-protection.md)
