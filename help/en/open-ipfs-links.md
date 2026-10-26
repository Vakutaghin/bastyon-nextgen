---
keywords: [IPFS link, 'ipfs://', 'ipns://', IPNS, DNSLink, inbrowser.link, IPFS node, CID check, download a file]
---

# Opening an IPFS link

What happens when you open an ipfs:// or ipns:// link in the app, in the browser or on a phone, and why the file cannot be swapped.

You open an `ipfs://…` link like any other: by clicking it in a post, a comment or a chat.

A link that came from somewhere else can be pasted into the search bar in the header (on a phone, on the search page): it opens right away, without a search. This works for `ipfs://…` and `ipns://…`, a gateway address like `…/ipfs/<CID>` or `<CID>.ipfs.dweb.link`, also without `https://`, and a bare CID. A private link opens together with its key.

The desktop app also has an address bar for this: the IPFS icon in the header → **“Open IPFS browser”**. Paste the link and click **“Open”** — the content opens in the viewer window. Below the bar is **“Recent”**: addresses you opened before, one click away. Private links are not added there: they contain the file’s key.

## The IPFS node in the app

In the browser, on a phone and in the desktop app without the IPFS module, the link is opened by an IPFS node inside the app itself. It fetches the content straight from those who serve it and checks every part against the link, so no one can swap the content. No public gateway is needed — ipfs.io and dweb.link stopped serving files to sites and apps in September 2026.

The viewer window appears right away. While the node looks for someone who serves the content, the window says **“Looking for it on IPFS…”**. It usually takes seconds; rare content can take up to a minute. If nobody serves it, the window says **“Not found on IPFS”**. This also happens with old links to websites: when a site is updated, its IPFS address changes.

What the window shows:

- pictures up to 50 MB, video and audio up to 200 MB, text. For a long text, only the beginning;
- an HTML page — as text. The whole website opens with **“Open website”**: it opens in your browser through inbrowser.link;
- a folder — as a list with sizes. A file or a subfolder opens with a click, **“Back”** returns to the previous one;
- anything else, such as PDFs and archives, is not shown; the window offers **“Download”** instead.

Every file in the window has **“Download”**. While the file downloads, you see how much has arrived, and **“Cancel”** stops the download. If the content is easier to view in the browser, there is **“Open in browser”**: the link opens through inbrowser.link.

Where the file is saved:

- in the desktop app, where you choose in the Save dialog;
- in Chrome and Edge, the browser asks where to save it and writes the file straight to disk;
- in Firefox, Safari and other browsers, as an ordinary download;
- on a phone, the system share menu opens: from there you can save the file to Files or send it to another app.

The node starts with the first link and stops after a few idle minutes.

## With the IPFS module

The first time, the desktop app asks how to open such links:

- **“Install IPFS module (~80 MB)”** — links are opened by the module. It also reaches files on home computers that browsers cannot see, shows websites right in the viewer window, and is needed to share your own files. See [The IPFS module](ipfs-module.md).
- **“Open without the module”** — links are opened by the IPFS node in the app, as in the browser. The app remembers the choice; you can install the module later with the IPFS icon in the header.

With the module, the viewer window also appears right away and shows **“Looking for it on IPFS…”** or **“Not found on IPFS”** in the same way. Pictures, videos, audio, text and web pages are shown in the window, and so are PDFs except on Linux. For anything else the app offers to save the file: while it downloads, you see **“Looking for the file on the network…”** and how much has arrived, and **“Cancel”** stops the download.

Over a picture, video, audio, PDF or text the window has a **“Download”** button at the top right: the app asks where to save the file. Download links on websites in the window work the same way, one file at a time.

## IPNS names and DNSLink

An `ipns://…` link points not to the files themselves but to a name. The owner of the name can point it to a new version of the content, and the link stays the same. There are two kinds of names:

- a key like `k51…` — the name’s record is signed by its owner, and the app checks the signature;
- a domain name, such as `ipns://docs.ipfs.tech` — where it points is written in the domain’s DNS (DNSLink).

Without the module, the viewer window shows where the name points now and, for a key, until what date the record is valid.

You can make a name of your own — a permanent link to a file — in [My files](my-files.md).

## Private files

If the link contains a key — the part after `#key=` — it is a private file. It is decrypted on your device, and the key from the link is not sent anywhere. A private file is always downloaded: it cannot be shown in a window or a tab.

The app asks **“Download the private file?”** → **“Download”**, then downloads the file, decrypts it and saves it as described above. With the IPFS module, the module decrypts the file.

## What others can see

As with torrents, the nodes the app gets content from see your IP address and what you download. The app asks the lookup services delegated-ipfs.dev and cid.contact who serves the content, so they also see the content address and your IP. Domain names are looked up with Cloudflare and Google DNS. The key of a private link is not sent anywhere, so only you can see what is inside a private file.

With [Tor](tor.md) on, IPFS links do not open, so as not to reveal your address.

## Limits

- In the browser and on a phone, a file of up to 4 GB can be downloaded; in Firefox, Safari and other browsers except Chrome and Edge, up to 1 GB. In the desktop app without the module, up to 4 GB. Anything larger works only with the IPFS module.
- A folder behind a link cannot be downloaded, only single files.
- In old browsers, such as Safari 15, the IPFS node does not start. Then the link can be opened in the browser through inbrowser.link with **“Open in browser”**.
- A file served only by someone’s home computer behind a router may not open without the module: the node in the app cannot always reach such a computer. With the IPFS module, such files open.

## If it does not open

- **“Not found on IPFS”** — nobody serves this address right now, or the link has a mistake. Ask the person who shared the file to open Bastyon; for a website, find a fresh link.
- **“Could not open”** — the window says why below:
  - **“The IPFS node could not reach the network. Check your internet connection and try again.”**;
  - **“The name was not found on the network: it has not been updated for a long time or has not been published yet.”**;
  - **“The record for this name failed the signature check.”** — the name’s record is forged or damaged;
  - **“The IPFS node cannot start in this browser. Open the link in your browser through inbrowser.link or in the Bastyon app.”**
- When downloading:
  - **“The file was not found on the network. Most likely the person who shared it is offline. Try again later.”** — nobody is serving the file;
  - **“The file did not arrive in full. Try again later.”**;
  - **“The file did not match its CID: someone on the network sent different data. The file was not saved.”**
- **“There is no such file at this link.”** or **“The link or the file behind it is damaged.”** — the link was copied incompletely or with a mistake.
- **“Could not decrypt the file: the key in the link is wrong or the file is damaged.”** — part of the key in a private link got lost. Ask for the link again.
- **“This file cannot be verified in the browser. Open the link in the Bastyon desktop app.”** — this happens with files put together in a way the app does not expect.

## See also

- [The IPFS module](ipfs-module.md)
- [My files](my-files.md)
- [Privacy: what others can see](privacy.md)
