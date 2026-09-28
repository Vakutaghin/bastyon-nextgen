---
keywords: [recovery phrase, seed phrase, mnemonic, 12 words, private key, backup, scammers]
---

# Recovery phrase and private key

What the 12 words and the private key are, how to keep them and where to see them again.

## 12 words and a key

The [recovery phrase](glossary.md#recovery-phrase) is 12 ordinary words from which the account keys are derived. The [private key](glossary.md#private-key) is the same thing in another form: a string of 64 characters. They are equivalent for signing in: either one is enough.

The app calls the phrase different names — "seed phrase", "mnemonic phrase", "secret phrase", "12 words". They are all the same thing.

## How to keep them

- **Write it down on paper** and put it where you keep documents. You can make two copies in different places.
- **Or save it in a password manager** with a strong master password.
- **Do not keep it** as a screenshot in your photos, in cloud notes, in email or in chats — that is where it is easiest to steal from.

The copy buttons in the app put the phrase on the clipboard, and after a minute the app clears it. Still, do not leave it on the clipboard for long: other programs can read it too.

## Where to see them again

- **In the settings.** **“Settings”** → the **“Private key”** tab → **“Reveal private key”**. The app warns that showing the key is dangerous, and after **“Yes, reveal”** it shows the **“Seed phrase”** and the **“Private key (hex)”**.
- **In the account list.** The account menu → **“Switch account”** → the key icon next to the account → **“Show seed phrase”**. This way you can see the phrase of any account saved on the device.

Before that, make sure nobody is near and the screen is not being recorded.

## If the account has no 12 words

If you signed in with a private key rather than a phrase, the app has no phrase: it cannot be derived from the key. Keep the key itself — it gets the account back just as well.

## Scammers

Nobody ever asks for the phrase or the key: not support, not moderators, not developers, not mini apps. Mini apps do not see the phrase or the key at all: they can only ask for a signature or a payment, and the app asks you every time.

Anyone who asks for your phrase "to verify", "to unlock" or "to return coins" is a scammer. If you have already entered your phrase on someone else's website, consider it stolen: move your coins to a new account right away — see [If you lost access](lost-access.md).

## See also

- [Protection on this device](device-protection.md)
- [If you lost access](lost-access.md)
- [Signing in](sign-in.md)
