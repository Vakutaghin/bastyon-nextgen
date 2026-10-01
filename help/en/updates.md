---
keywords: [update, new version, what’s new, changelog, update the app]
---

# Updates

How the app tells you about a new version, how to update on each system, and where to read what changed.

## Checking

Once a day the app looks at the releases page on GitHub. If a new version is out, an **“Update available”** window appears — which version came out, which one you have and when the new one was published:

- **“Update”** — on a computer: the app downloads the new version, installs it over this one and restarts, showing the progress in the window. Accounts and settings are kept. If it cannot install by itself, “Go to download” appears instead;
- **“Go to download”** — on a phone: the release page opens in the browser, with installers for every system. If the browser does not open, the link is copied and shown in a message;
- **“Later”** — reminds you on the next launch;
- **“Skip this version”** — no more reminders about this version; the next one will be offered.

The update is checked by its signature: only a build from a Bastyon NextGen release can be installed this way. With Tor on, it is downloaded over Tor.

## Version number

The installed version is always in sight: on a computer at the bottom of the left panel, on a phone in the menu under the app name. The arrows button next to it checks for a new version:

- a new one is out — the **“Update available”** window opens, even if you skipped that version before; until you skip it, the new version number shows in place of yours;
- no new version — **“Up to date”** shows for a few seconds;
- GitHub did not answer — **“Check failed”**.

You can also check in **“Settings”** → **“Diagnostics”** → the **“Updates”** line → **“Check”**.

## How to update

- **Computer.** Click “Update” in the “Update available” window, and the app does the rest. This works on macOS, Windows and the Linux AppImage; update a .deb install with a new .deb. You can also do it by hand: download the installer for your system and install it over the old version — accounts and settings are kept. Which file to pick is in [Installing the app](install.md). In versions without the “Update” button, install the next one by hand; after that the app updates itself.
- **macOS.** macOS does not stop an update made with “Update”. If you install a new version by hand, macOS blocks it on its first launch again: allow it the same way as at installation, with “Open Anyway”. macOS may also ask for your computer password once to let Bastyon NextGen use its keychain item. In that item WebKit keeps the key that encrypts the account keys on this computer. Enter the password and click “Always Allow”. All versions are signed with one certificate, so after that updates no longer ask for the password and do not ask for microphone and camera access again.
- **Windows.** During an update Windows asks whether to let the installer make changes — answer “Yes”.
- **Android.** Download the .apk file and install the new version over the old one — accounts and settings are kept. The exception is moving from 0.7.1 or an earlier version: those were signed with a temporary key, and the phone refuses to install a new version over them, saying the package conflicts with an existing one. Then the old version has to be removed, and the account keys are removed from the phone with it. So before removing it, make sure your recovery phrase is written down and checked — see [Recovery phrase and private key](recovery-phrase.md). After installing, sign in with the phrase again.

## What’s new

After an update, the app shows once what changed in the new version — **“Got it”** closes the window. The changes in every version are in **“Settings”** → **“What's new”**.

## See also

- [Installing the app](install.md)
- [The Bastyon NextGen app](bastyon-nextgen.md)
