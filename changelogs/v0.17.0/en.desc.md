# v0.17.0 — Your own left panel, Windows updates without questions, playback in the Media studio

The left panel can now be set up the same way as the header: hide and reorder the sections and the blocks below them. On Windows the app is installed for your user account, and updates no longer ask for administrator permission. In the Media studio, clips play without opening their post. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## The left panel

- **“Settings” → “Header and panels”** (formerly “Header and menu”) has two more lists. In **“Left panel”**, the sections from “Feed” to “Help” can be hidden and reordered. **“Below the sections”** does the same for the blocks: “Best first” with “Feed language”, “Categories” and “Trending tags”.
- **A hidden block has no effect**: the categories and tags selected in it are cleared, and the feed goes in the usual order and in the interface language. Otherwise the feed would stay filtered by something no longer on screen.
- **On the phone**, the side menu shows the sections and blocks in the same order.

## Updating on Windows

- **No administrator rights.** The installer is now `-setup.exe` instead of `.msi`. It installs the app for your user account, so “Update” no longer brings up the “Do you want to allow this app to make changes” window.
- **Moving from the .msi happens by itself.** When updating from an earlier version, Windows asks once whether to allow removing it — answer “Yes”. Accounts and settings are kept, and autostart follows the app to its new place. Answer “No”, and the old version opens again; you can update later.
- **No processes left behind after an update.** Before installing, the app stops IPFS and the mesh networks module. On Windows they used to keep running without the app.

## The Media studio

- **“Watch” and “Listen”.** A clip’s cover, an item in the “⋯” menu and a button in the clip window open the same player as in the feed — also for a clip without a post. While a clip is being processed, its cover opens the clip window.
- **A post opened from the clip window** no longer opens underneath it: the clip window closes.

## Page width and chat

- **“Full width”** now means full width for the feed, profile posts and search too: they take all the space between the side panels. They used to stay a column of about 1000 points.
- **“Floating chat button”** in “Settings → General” replaces the “Messenger” switch. It hides only the round button in the bottom right corner; the chat, the header icon and the bottom bar item always work. If “Messenger” was off for you, the chat comes back and the button stays hidden.

## Fixes

- **The “Add to favorites” bookmark** on a post was black on a dark background in the dark theme. Now it is light, in the accent colour for a saved post, and it can be pressed from the keyboard.
