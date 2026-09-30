---
keywords: [update, new version, what’s new, changelog, update the app]
---

# Updates

How the app tells you about a new version, how to update on each system, and where to read what changed.

## Checking

Once a day the app looks at the releases page on GitHub. If a new version is out, an **“Update available”** window appears — which version came out, which one you have and when the new one was published:

- **“Go to download”** — the release page opens in your browser, with installers for every system;
- **“Later”** — reminds you on the next launch;
- **“Skip this version”** — no more reminders about this version; the next one will be offered.

The app does not update itself: you install the new version yourself.

## Version number

The installed version is always in sight: on a computer at the bottom of the left panel, on a phone in the menu under the app name. The arrows button next to it checks for a new version:

- a new one is out — the **“Update available”** window opens, even if you skipped that version before; until you skip it, the new version number shows in place of yours;
- no new version — **“Up to date”** shows for a few seconds;
- GitHub did not answer — **“Check failed”**.

You can also check in **“Settings”** → **“Diagnostics”** → the **“Updates”** line → **“Check”**.

## How to update

- **Computer.** Download the installer for your system and install the new version over the old one — accounts and settings are kept. Which file to pick is in [Installing the app](install.md).
- **Android.** Download the .apk file and install the new version over the old one — accounts and settings are kept. The exception is moving from 0.7.1 or an earlier version: those were signed with a temporary key, and the phone refuses to install a new version over them, saying the package conflicts with an existing one. Then the old version has to be removed, and the account keys are removed from the phone with it. So before removing it, make sure your recovery phrase is written down and checked — see [Recovery phrase and private key](recovery-phrase.md). After installing, sign in with the phrase again.

## What’s new

After an update, the app shows once what changed in the new version — **“Got it”** closes the window. The changes in every version are in **“Settings”** → **“What's new”**.

## See also

- [Installing the app](install.md)
- [The Bastyon NextGen app](bastyon-nextgen.md)
