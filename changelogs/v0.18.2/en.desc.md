# v0.18.2 — Local storage works again

A fix after 0.18.0 for those who installed the app long ago. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Fixes

- **“Local storage unavailable” on every start.** If the app had been installed since an early version, from 0.18.0 on it could not upgrade its database on the device. Settings, favorites, notifications and playback positions were not saved. Now, at the first start, the app moves all of it into a new database by itself and works as usual.
- **“What’s new” opened on every start** for the same reason. Now it opens once per version, even if the database on the device is unavailable.
