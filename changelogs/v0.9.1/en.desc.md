# v0.9.1 — A new logo, the version in sight and sturdier image uploads

The app has a new logo on every system, and Android and iOS get their own icon instead of a placeholder for the first time. The version number is always in sight now, with an update check button next to it. Images in posts upload more reliably, and on Android the new version runs right after an update.

## Posts

- **Images upload more reliably.** If the PeerTube servers do not accept an image, the app uploads it to the Bastyon image server, as the old app does. A server that hangs no longer holds up publishing: every attempt has a time limit. If an image still fails to upload, a small line under the message says what each server answered. Include that line when you report a problem.

## Version and updates

- **The version number is always in sight:** on a computer at the bottom of the left panel, on a phone in the menu under the app name.
- **The arrows button next to it checks for updates.** If a new version is out, the “Update available” window opens, even if you skipped that version before, and the new version number shows in place of yours. If there is nothing new, “Up to date” shows for a few seconds.

## New logo

- The new logo is in the header, on the app icon on every system, on the splash screen and in the browser tab.
- **Android and iOS** used to show a placeholder instead of the icon and the splash screen. Now they show the Bastyon logo, and on Android the icon follows the icon shape of your phone.
- On macOS the icon now has the same size and shape as the system apps.

## Android

- **The new version runs right after an update.** Before, on the first launch after an update the app could show a blank screen or run as the previous version, with its old bugs. The web page cache was to blame: 0.9.1 deletes it on the first launch and no longer creates it.
- The update from 0.8.0 and 0.9.0 installs over the old version.
