---
keywords: [IPFS link, 'ipfs://', public gateway, CID check, download a file, dweb.link]
---

# Opening an IPFS link

What happens when you open an ipfs:// link in the app, in the browser or on a phone, and why the file cannot be swapped.

You open an `ipfs://…` link like any other: by clicking it in a post, a comment or a chat.

## In the desktop app

The first time, the app asks how to open such links:

- **“Install IPFS module (~80 MB)”** — files come straight from the IPFS network, with no one in between. See [The IPFS module](ipfs-module.md).
- **“Use public gateway”** — through dweb.link, a site that fetches files from IPFS for people without their own program. The app remembers the choice; you can install the module later with the IPFS icon in the header.

Pictures, videos, audio, text and web pages open in a separate viewer window, and so do PDFs except on Linux. For anything else the app offers to save the file: while it is being found and downloaded, you see **“Looking for the file on the network…”** and how much has arrived, and **“Cancel”** stops the download.

If a file is saved through the public gateway, every piece of it is checked against the link. If the gateway sends different data, the file is not saved, and the app says: **“The file does not match its CID: the public gateway sent different data. The file was not saved.”**

## In the browser and on a phone

There is no IPFS program here, so files come through the public gateway.

- Pictures, videos, audio, text and PDFs open in a new tab straight from the dweb.link gateway. On Android, PDFs are downloaded.
- Other files are downloaded by the app itself: **“Download the file?”** → **“Download”**. Every piece of the download is checked against the link, so the gateway cannot swap the contents.

If the name does not tell what kind of file it is, the app first looks at its beginning — **“Opening the file from IPFS…”** — and then either asks **“Open in a new tab?”** or offers to download it.

Where the file is saved:

- in Chrome and Edge, the browser asks where to save it and writes the file straight to disk;
- in Firefox, Safari and other browsers, as an ordinary download;
- on a phone, the system share menu opens: from there you can save the file to Files or send it to another app.

## Private files

If the link contains a key — the part after `#key=` — it is a private file. It is decrypted on your device, and the key from the link is not sent anywhere. A private file is always downloaded: it cannot be shown in a window or a tab.

## Limits

- Through the public gateway you can download a file of up to 4 GB. Anything larger works only in the desktop app with the IPFS module.
- In Firefox, Safari and other browsers except Chrome and Edge — up to 1 GB.
- A folder behind a link cannot be downloaded, only single files. You can look at the folder: in the desktop app in the viewer window, in the browser in a new tab.
- With [Tor](tor.md) on, IPFS links do not open.

## If it does not open

- **“The file was not found on the network. Most likely the person who shared it is offline. Try again later.”** — nobody is serving the file. Ask the person who shared it to open Bastyon.
- **“The public gateway is overloaded right now. Try again in a minute.”**
- **“The public gateway sent an incomplete file. Try again later.”**
- **“Could not reach the public gateway. Check your connection and try again.”**
- **“There is no such file at this link.”** or **“The link or the file behind it is damaged.”** — the link was copied incompletely or with a mistake.
- **“Could not decrypt the file: the key in the link is wrong or the file is damaged.”** — part of the key in a private link got lost. Ask for the link again.
- **“This file cannot be verified in the browser. Open the link in the Bastyon desktop app.”** — this happens with files put together in a way the app does not expect.

## See also

- [The IPFS module](ipfs-module.md)
- [My files](my-files.md)
- [Privacy: what others can see](privacy.md)
