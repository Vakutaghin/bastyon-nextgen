# v0.18.1 — Registering a second account, chat images, voice messages

Fixes after 0.18.0. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Fixes

- **Registering from “Switch account”.** “Add account” → “Register” led back to the account list. Now registration opens.
- **A chat image has its size right away.** While an image downloaded and decrypted, it was tiny and grew a few seconds later. Now its place has the right size from the start. The same goes for videos.
- **“Local storage unavailable” for no reason.** The notice showed up, for example, after a voice message was cancelled with a swipe, and the app stopped saving its cache until restart. Now it shows up only when the app’s database on the device really fails.
- **Voice messages on Android.** If the button is released before the microphone turns on, recording no longer starts by itself and is not sent with the next tap. At the first recording the phone asks for permission: after “Allow”, press and hold the button again.
