---
keywords: [IPFS, file sharing, share a file, CID, torrent, large file]
---

# Files and IPFS

How to share files of any size without a cloud: your computer serves the file, and the recipient checks that it is exactly the file you sent.

## What IPFS is

[IPFS](glossary.md#ipfs) is a network for sharing files. A file in it is found not by a server address but by a fingerprint of its contents — the CID — and everyone who has the file serves it, like a torrent. A link to a file looks like `ipfs://…` and contains that fingerprint. So a link cannot be used to slip in a different file: when downloading, the app checks every piece against the link.

Bastyon has no storage of its own: files are not uploaded anywhere; whoever shared a file serves it.

## What Bastyon can do

- **Open IPFS links** — in the desktop app, in the browser and on a phone. See [Opening an IPFS link](open-ipfs-links.md).
- **Share files** — in the desktop app only: only the IPFS program on your computer can serve files, see [The IPFS module](ipfs-module.md). You can share by link or privately — see [My files](my-files.md) — or send a file straight into a chat: [Files over IPFS in chat](ipfs-in-chat.md).

## While someone serves the file

A file is available while at least one computer serves it:

- yours — while Bastyon is open on it;
- those of people who received the file and pressed **“Keep sharing”**;
- a storage service, if you connected one — see [Storing on a service](ipfs-remote-pin.md).

If none of them is online, the file cannot be found, and the app says: **“The file was not found on the network. Most likely the person who shared it is offline. Try again later.”**

Whoever serves a file is visible on the network: with the link, anyone can find the IP addresses of the computers serving it.

## IPFS and Tor

If [Tor](tor.md) is on in the desktop app, IPFS does not work at all — you can neither open a link nor share a file. The viewer window and the IPFS program go online directly, not through Tor, and would reveal your IP address. The app shows a **“Tor is on”** window. To use IPFS, turn Tor off.

## See also

- [My files](my-files.md)
- [Opening an IPFS link](open-ipfs-links.md)
- [Files over IPFS in chat](ipfs-in-chat.md)
