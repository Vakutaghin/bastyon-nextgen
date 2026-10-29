---
keywords: [update, new version, what’s new, changelog, update the app]
---

# Updates

How the app tells you about a new version, how to update on each system, and where to read what changed.

## Checking

Every time the app starts, it looks at the releases page on GitHub. If a new version is out, an **“Update available”** window appears — which version came out, which one you have and when the new one was published. On a phone, bringing a minimized app back is not a start: the window appears when the app is opened anew.

- **“Update”** — the app downloads the new version, showing the progress in the window, and installs it over this one. Accounts and settings are kept. A computer then restarts the app, and on Android you confirm the installation — see [How to update](#how-to-update). If it cannot install by itself, “Go to download” appears instead;
- **“Go to download”** — the release page opens in the browser, with installers for every system. If the browser does not open, the link is copied and shown in a message;
- **“Later”** — reminds you on the next launch;
- the **“Skip this version”** checkbox — the button then reads **“Close”**, and the app no longer reminds you about this version; the next one will be offered. The checkbox also applies when you close the window with the cross.

The update is checked by its signature: only a build from a Bastyon NextGen release can be installed this way. On Android the file is also checked against the checksum GitHub shows for the release. With Tor on, a computer downloads the update over Tor.

## Version number

The installed version is always in sight: on a computer at the bottom of the left panel, on a phone in the menu under the app name. The arrows button next to it checks for a new version:

- a new one is out — the **“Update available”** window opens, even if you skipped that version before: then the **“Skip this version”** checkbox in it is already ticked, and if you untick it, the app reminds you again. Until you skip the version, the new version number shows in place of yours;
- no new version — **“Up to date”** shows for a few seconds;
- GitHub did not answer — **“Check failed”**.

You can also check in **“Settings”** → **“What's new”** → **“Check”**: the app version is there too.

## How to update

- **Computer.** Click “Update” in the “Update available” window, and the app does the rest. This works on macOS, Windows and the Linux AppImage; update a .deb install with a new .deb. You can also do it by hand: download the installer for your system and install it over the old version — accounts and settings are kept. Which file to pick is in [Installing the app](install.md). In versions without the “Update” button, install the next one by hand; after that the app updates itself.
- **macOS.** macOS does not stop an update made with “Update”. If you install a new version by hand, macOS blocks it on its first launch again: allow it the same way as at installation, with “Open Anyway”. macOS may also ask for your computer password once to let Bastyon NextGen use its keychain item. In that item WebKit keeps the key that encrypts the account keys on this computer. Enter the password and click “Always Allow”. All versions are signed with one certificate, so after that updates no longer ask for the password and do not ask for microphone and camera access again.
- **Windows.** The update installs without questions from Windows: the app lives in your user account’s folder. If it was installed from an .msi file, the first update moves it there, and Windows asks once whether to allow removing the old version — answer “Yes”. Answer “No”, and the old version opens again; you can update next time.
- **Android.** Press “Update” in the “Update available” window. The app downloads the new version and checks it: it has to be Bastyon NextGen from a release, signed with the same key as the installed one. Then Android asks whether to update the app — confirm, and when the installation finishes, press “Open”. The first time, Android first opens the “Install unknown apps” settings for Bastyon NextGen: turn the permission on and go back — the installation continues by itself. If you cancel the installation, the app offers to press “Update” again.

  You can also do it by hand: download the .apk file and install the new version over the old one — accounts and settings are kept. In versions where the phone shows only “Go to download” instead of “Update”, install the next one by hand; after that the app updates itself. The exception is moving from 0.7.1 or an earlier version: those were signed with a temporary key, and the phone refuses to install a new version over them, saying the package conflicts with an existing one. Then the old version has to be removed, and the account keys are removed from the phone with it. So before removing it, make sure your recovery phrase is written down and checked — see [Recovery phrase and private key](recovery-phrase.md). After installing, sign in with the phrase again.

## What’s new

After an update, the app shows once what changed in the new version. The arrows at the bottom of the window page back to earlier versions and forward again, **“All versions”** opens the [version history](releases.md) in the help, and **“Got it”** closes the window. The changes in every version are also in **“Settings”** → **“What's new”**.

## See also

- [Installing the app](install.md)
- [The Bastyon NextGen app](bastyon-nextgen.md)
