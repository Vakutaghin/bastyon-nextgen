---
keywords: [sign in, log in, mnemonic, seed phrase, private key, WIF, QR code, another device]
---

# Signing in

How to sign in with a 12-word phrase, a private key or a QR code — including an account from the previous Bastyon app.

Bastyon has no password: to sign in you need the account's [recovery phrase](glossary.md#recovery-phrase) or its private key. They work with any Bastyon app, so this is also how you sign in on a new device or to an account from the previous app.

## Phrase or key

Click **“Sign in”** in the header and paste one of three things into the **“Mnemonic phrase or private key”** field:

- **the 12-word phrase**, words separated by spaces — in English or in Russian, whichever the app gave you; letter case and extra spaces do not matter;
- **the private key in hex** — a string of 64 characters 0–9 and a–f;
- **the private key in WIF format** — the way some wallets show it.

The eye button shows what you typed so you can check for typos. Make sure nobody is looking over your shoulder.

## QR code

If your key is saved as a QR code — the previous Bastyon app, for example, can show the key that way — click **“Scan QR code”**:

- **“Use camera”** — point the camera at the QR code;
- **“Upload image”** — pick a picture or a screenshot with the QR code.

In the desktop app the camera works on macOS. On Windows and Linux, upload a picture of the QR code instead.

## What happens when you sign in

The app derives the keys and the address from the phrase, loads your profile and saves the key on this device in encrypted form, so you do not have to enter it again next time. How to protect the key on the device with a password is covered in [Protection on this device](device-protection.md). The messenger connects in the background, and the chat list appears within a few seconds.

## An account from the previous app

It is the same account on the same network: your profile, posts, subscriptions, conversations and coins are all there, because they are not stored in the app. Only the settings of the previous app itself are not carried over — the theme, the language, the chosen categories: they lived on its device. You can set them again in [Settings](settings.md).

## If you cannot sign in

- **The phrase does not fit.** Check every word and their order: one typo or swap makes a different phrase. There should be no extra characters, quotes or word numbers.
- **The key does not fit.** A hex key is exactly 64 characters without spaces. If your key looks different, paste it as it is: the app also understands the WIF format.
- **Signing in does not finish.** There may be no connection to the nodes — see [No connection to the network](connection-problems.md).
- **The phrase is lost.** What you can do is covered in [If you lost access](lost-access.md).

## See also

- [Several accounts and signing out](accounts.md)
- [Recovery phrase and private key](recovery-phrase.md)
- [If you lost access](lost-access.md)
