---
keywords: [my files, share a file, private file, file link, seeding, stop sharing, permanent link, IPNS, new version of a file]
---

# My files

How to share a file by link or privately, and keep track of what your computer is serving.

## Where it is

Account menu → **“My files”**, or the IPFS icon in the header → **“My files”**. The page exists only in the desktop app; in the browser it says that files can be shared only there.

The top of the page shows whether the computer is serving files right now:

- **“The IPFS node is running: files are served while Bastyon is open.”**;
- **“The IPFS node is stopped: nobody can get your files from this computer right now.”** — press **“Start”**;
- **“The IPFS module is not installed yet: it installs when you share your first file.”** — see [The IPFS module](ipfs-module.md).

## Sharing by link

Press **“Share a file…”** and pick a file — several at once if you like. The app publishes it and copies the link to the clipboard. Anyone with the link can open the file — on a computer, in a browser or on a phone.

The file name is part of the link: everyone the link reaches sees the name and the file type.

## Sharing privately

**“Share privately…”** — the file is encrypted on your computer, and only the ciphertext goes to the network. The key is only in the link itself, after the `#` sign, and is never sent to the network. Only someone with the whole link can read the file. The file name is hidden in the link too.

The link can be forwarded like any other: whoever it reaches can open the file. Pass it on where outsiders cannot see it — for example, in a [chat](ipfs-in-chat.md): conversations are encrypted.

## The list

Each file shows its name, size, date and a label: **“by link”**, **“private”** or **“received, sharing”** — files you started serving from a chat with **“Keep sharing”**.

- **“Copy link”** — get the link to the file again.
- **“Stop sharing”** — the computer no longer serves the file. People who already downloaded it can keep sharing it, so a file cannot be removed from the network for good.

Each account has its own list: another account on this computer does not see your files or the keys to your private ones. When you sign out of an account, its files stop being served.

## Permanent link

A regular link always leads to the same file: a new version of the file gets a new link. A permanent link like `ipns://k51…` never changes and leads to the version you choose. You can post it once — in your profile, a post or on a website — and update it later.

- **“Permanent link”** next to a file marked **“by link”** creates a link to this file and shows it with a QR code. Private files have no permanent link.
- When a new version comes out, share it as usual. Then in **“Permanent links”** click **“Update to a new version”**, choose the new file and click **“Switch the link”**. Others will see the new version within a few minutes.

A permanent link belongs to the account: it is the same on all your computers and comes back when you restore the account. The link itself does not reveal your account.

Your computer keeps the link alive on the network while Bastyon is open: the app renews it by itself. If Bastyon is not opened for more than two days, the link stops opening until you start it again. When you publish or update a link, the delegated-ipfs.dev service sees it and your IP address. With [Tor](tor.md) on, permanent links are not created or updated.

## When the computer is off

Files are served while Bastyon is open on the computer. When it is off, a file can only be downloaded from people who already serve it. To keep files available around the clock, connect a storage service — see [Storing on a service](ipfs-remote-pin.md).

## See also

- [Storing on a service](ipfs-remote-pin.md)
- [The IPFS module](ipfs-module.md)
- [Files over IPFS in chat](ipfs-in-chat.md)
