# v0.11.1 — Downloaded modules no longer go missing

Tor and the IPFS module no longer have to be downloaded again, and the IPFS node comes back on its own after the app restarts. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package).

## Desktop

- **Disk cleaning no longer removes the IPFS module.** The module’s program lived in the cache folder. macOS empties it when the disk fills up, and so do disk cleaning apps, after which the module had to be downloaded again. Now it lives with the rest of the app’s data. A module you already have moves there on its own the first time this version starts, with no download. On Windows the module was not in the cache before either.
- **Tor is not downloaded again on update.** When a new app version shipped a new Tor, the app deleted the previous one and downloaded the new one when you turned Tor on. If the download failed, Tor did not turn on at all. Now the previous Tor turns on right away, and the new one downloads through it in the background and takes over the next time you turn Tor on. The same goes for a Tor you installed before 0.9.8 and have not turned on since.
- **The IPFS node starts on its own after a restart**, an update included, unless you pressed “Stop”. It used to need starting by hand, and while it was off, your “My files” were not served. With Tor on, the node still does not start.
- **The video compression module of a previous version keeps working.** When the app moves to a new FFmpeg build, you won’t have to download the module again.
