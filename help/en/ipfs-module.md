---
keywords: [IPFS module, Kubo, IPFS node, install IPFS, remove IPFS, disk space]
---

# The IPFS module

What gets installed on your computer for IPFS, how much space it takes, and how to stop, update or remove it.

## What it is

The IPFS module is Kubo, the main program of the IPFS network. It lets you serve files and get them straight from the network, without a public gateway. It exists only in the desktop app.

The module does not install itself. The app downloads it — about 80 MB — when you share your first file, choose **“Install IPFS module (~80 MB)”** when opening an IPFS link, or press **“Install & start (~80 MB)”** in the IPFS menu. The program comes from the official IPFS site, and the app checks its checksum: it will not install a tampered copy.

The module runs while Bastyon is open and stops together with the app. It does not start while [Tor](tor.md) is on.

## The IPFS icon in the header

The icon shows the module’s state: a green check means running, a spinner means installing or starting, a triangle means an error. The icon’s menu has:

- a status line, for example **“Local IPFS node running”** or **“IPFS module installed (stopped)”**;
- **“Install & start (~80 MB)”**, **“Start”** or **“Stop”**. While the module installs, there is also **“Cancel installation”**;
- **“Update”** — when a new Bastyon version brings a new version of the module. The icon then gets a dot, and the menu says **“A newer IPFS version is available.”**;
- **“My files”** — see [My files](my-files.md).

## What it serves

Only your files: those you shared and those you chose to **“Keep sharing”** from a chat. Files you only opened stay in the module’s cache but are not served to others.

## Disk space

Everything you open through the module ends up in its cache. The cache does not grow beyond 2 GB: when it is 90% full, the module deletes old data by itself — it checks once an hour.

The module keeps a copy of the files you share for as long as you share them, and they take as much space as they weigh. To free the space, press **“Stop sharing”** in [My files](my-files.md).

## Removing it

**“Settings”** → **“General”** tab → **“IPFS module”** → **“Remove module”**. The section is visible only while the module is installed.

The program and the whole cache are deleted from disk, your files are no longer served, and the lists in My files and the connected [storage service](ipfs-remote-pin.md) have to be set up again. IPFS links will open through the public gateway.

## See also

- [My files](my-files.md)
- [Opening an IPFS link](open-ipfs-links.md)
- [Tor](tor.md)
