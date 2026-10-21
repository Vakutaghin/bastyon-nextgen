---
keywords: [IPFS link, 'ipfs://', inbrowser.link, public gateway, dweb.link, CID check, download a file]
---

# Opening an IPFS link

What happens when you open an ipfs:// link in the app, in the browser or on a phone, and why the file cannot be swapped.

You open an `ipfs://…` link like any other: by clicking it in a post, a comment or a chat.

A link that came from somewhere else can be pasted into the search bar in the header (on a phone, on the search page): it opens right away, without a search. This works for `ipfs://…` and `ipns://…`, a gateway address like `…/ipfs/<CID>` or `<CID>.ipfs.dweb.link`, also without `https://`, and a bare CID. A private link opens together with its key.

The desktop app also has an address bar for this: the IPFS icon in the header → **“Open IPFS browser”**. Paste the link and click **“Open”** — the content opens in the viewer window. Below the bar is **“Recent”**: addresses you opened before, one click away. Private links are not added there: they contain the file’s key.

## In the desktop app

The first time, the app asks how to open such links:

- **“Install IPFS module (~80 MB)”** — files come straight from the IPFS network, with no one in between. See [The IPFS module](ipfs-module.md).
- **“Open in the browser”** — your browser opens the link through inbrowser.link: the browser itself fetches the content from the IPFS network and checks it. The app remembers the choice; you can install the module later with the IPFS icon in the header.

With the module, the viewer window appears right away. While the module looks for someone who serves the content, the window says **“Looking for it on IPFS…”**. It usually takes seconds; rare content can take up to a minute. If nobody serves it, the window says **“Not found on IPFS”**. This also happens with old links to websites: when a site is updated, its IPFS address changes.

Pictures, videos, audio, text and web pages are shown in this window, and so are PDFs except on Linux. For anything else the app offers to save the file: while it downloads, you see **“Looking for the file on the network…”** and how much has arrived, and **“Cancel”** stops the download.

A private file can’t be opened without the module: the module decrypts it. The app offers to install it — **“The IPFS module is needed”** → **“Install & start (~80 MB)”**.

## In the browser and on a phone

There is no IPFS program here. The public gateways ipfs.io and dweb.link, through which such links used to open, stopped serving files to sites and apps in September 2026. So the link opens in a new tab on inbrowser.link: the browser itself fetches the content from the IPFS network, checks it and shows or saves it.

A private file is downloaded and decrypted by the app itself: **“Download the private file?”** → **“Download”**. Right now this may fail: the gateway private files are downloaded from in the browser stopped answering along with the public ones. It is more reliable to open such a link in the desktop app with the IPFS module.

Where the file is saved:

- in Chrome and Edge, the browser asks where to save it and writes the file straight to disk;
- in Firefox, Safari and other browsers, as an ordinary download;
- on a phone, the system share menu opens: from there you can save the file to Files or send it to another app.

## Private files

If the link contains a key — the part after `#key=` — it is a private file. It is decrypted on your device, and the key from the link is not sent anywhere. A private file is always downloaded: it cannot be shown in a window or a tab.

## Limits

- In the browser, a private file of up to 4 GB can be downloaded. Anything larger works only in the desktop app with the IPFS module.
- In Firefox, Safari and other browsers except Chrome and Edge — up to 1 GB.
- A folder behind a link cannot be downloaded, only single files. You can look at the folder: in the desktop app in the viewer window, in the browser in a new tab.
- With [Tor](tor.md) on, IPFS links do not open.

## If it does not open

- **“Not found on IPFS”** — nobody serves this address right now, or the link has a mistake. Ask the person who shared the file to open Bastyon; for a website, find a fresh link.
- When downloading a private file in the browser:
  - **“The file was not found on the network. Most likely the person who shared it is offline. Try again later.”** — nobody is serving the file;
  - **“The public gateway is overloaded right now. Try again in a minute.”**;
  - **“The public gateway sent an incomplete file. Try again later.”**;
  - **“Could not reach the public gateway. Check your connection and try again.”**
- **“There is no such file at this link.”** or **“The link or the file behind it is damaged.”** — the link was copied incompletely or with a mistake.
- **“Could not decrypt the file: the key in the link is wrong or the file is damaged.”** — part of the key in a private link got lost. Ask for the link again.
- **“This file cannot be verified in the browser. Open the link in the Bastyon desktop app.”** — this happens with files put together in a way the app does not expect.

## See also

- [The IPFS module](ipfs-module.md)
- [My files](my-files.md)
- [Privacy: what others can see](privacy.md)
