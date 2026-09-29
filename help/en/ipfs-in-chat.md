---
keywords: [file over IPFS, large file, keep sharing, chat, send a large file]
---

# Files over IPFS in chat

How to send someone a file of any size and help serve a file you received.

## Sending

A regular chat attachment is limited to 25 MB. A bigger file can go through IPFS — in the desktop app:

1. **“Attach”** → **“File via IPFS”**.
2. Pick a file — several at once if you like: each goes as a separate message.

While the file is being published, you see **“Publishing the file to IPFS…”**. The file is sent privately: it is encrypted on your computer, and the key travels in the message itself — the conversation is encrypted, so only the chat members see the key. There is no size limit.

Your computer serves the file while Bastyon is open, and the file shows up in your [My files](my-files.md). If you close the app before the other person downloads the file, they get it only when you open Bastyon again or someone else starts serving it. To keep the file available around the clock, connect a [storage service](ipfs-remote-pin.md).

## Receiving

The file arrives as a card: name, size, **“private, via IPFS”** and a **“Download”** button. It can be downloaded in any version of the app: on a computer, in the browser and on a phone. The browser and the phone have size limits — see [Opening an IPFS link](open-ipfs-links.md). In the chat list, such a message shows as “📎” and the file name.

If the other person uses the previous Bastyon app, they see an `ipfs://…` link instead of a card.

## Keep sharing

A card with someone else’s file has a **“Keep sharing”** button in the desktop app. Your computer downloads the file and becomes one more source of it: the file stays available even when the sender is offline. The network will see that your computer serves it.

The file appears in [My files](my-files.md) labelled **“received, sharing”**, and the card shows **“Sharing”**. To stop, go to **“My files”** and press **“Stop sharing”**.

## See also

- [My files](my-files.md)
- [Photos, videos and files in chat](chat-attachments.md)
- [Opening an IPFS link](open-ipfs-links.md)
