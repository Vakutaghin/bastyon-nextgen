# v0.11.2 — IPFS links open in the app itself, permanent links to files

IPFS links open again in the browser, on the phone and on a computer without the IPFS module: an IPFS node inside the app now opens them instead of the public gateways that shut down. A file in “My files” can get a permanent link: it never changes and leads to the version of the file you choose. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package).

## IPFS links

- **No public gateways needed.** Since September the ipfs.io and dweb.link gateways no longer serve files to websites and apps: they show a Cloudflare check instead. Links that opened through them got stuck. Now in the browser, on the phone and on a computer without the IPFS module, an IPFS node inside the app opens the link. It downloads the content straight from those who share it and checks every piece against the link, so no one can swap the content. The node starts with the first link and stops after a few idle minutes.
- **The viewer.** Pictures, video, audio and text show right in the window, a folder as a list with sizes and a **“Back”** button. **“Open website”** opens a website in your browser, and anything else, such as PDFs and archives, you can **“Download”**. On the phone a downloaded file opens in the Share menu. Private links are decrypted on your device.
- **`ipns://` names.** Links to names like `ipns://k51…` open, with the name record’s signature checked, and so do domains such as `ipns://docs.ipfs.tech`. The window says where the name leads now and until when the record is valid.
- **With the IPFS module the window opens at once.** The window used to appear only after the search, sometimes tens of seconds later, and if the module did not find the content in 8 seconds, the window went to a closed gateway and hung. Now the window shows **“Looking for it on IPFS…”** right away, or **“Not found on IPFS”** if no one shares the content. Closing the window stops the search.
- **What others see.** As with torrents: those the app gets the content from see your IP address, and so do the lookup services delegated-ipfs.dev and cid.contact. With Tor on, IPFS links still do not open.

## Permanent links

- **A link that never changes.** With a regular link, a new version of a file gets a new link. A permanent link like `ipns://k51…` stays the same and leads to the version you choose. Post it once in your profile, a post or on a website, and update it later.
- **How to make one.** In “My files”, a file you shared by link has a **“Permanent link”** button: it shows the link and a QR code. When a new version is out, share it as usual, then in **“Permanent links”** press **“Update to a new version”** and **“Switch the link”**. Others see the new version within a few minutes. Permanent links are made in the desktop app.
- **The link belongs to your account.** It is the same on all your computers and comes back when you restore the account. The link itself does not reveal your account.
- **Your computer keeps the link alive.** While Bastyon is open, the app renews the link on the network by itself. If Bastyon stays closed for more than two days, the link stops opening until you start it again. When you create or update a link, the delegated-ipfs.dev service sees it and your IP address. With Tor on, permanent links are not created or updated.
- **In chat.** A message with a permanent link shows as a **“Permanent link”** card with **“Open”** and **“Follow updates”**. While the app is open, it checks the link once an hour and shows **“A permanent link was updated”** when the owner switches it to a new version. The app also republishes the link’s record, so the link opens even while its owner is offline. The card itself makes no network requests until you press one of its buttons, so reading a chat shows your IP address to no one.

## Desktop

- **Quitting with Cmd+Q on macOS closes everything.** After quitting with Cmd+Q or from the Dock, the IPFS module, the microphone and radio connections kept running. Now they close on any quit.
