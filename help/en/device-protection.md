---
keywords: [passphrase, encryption, storage, vault, unlock, 12-word check, backup]
---

# Protection on this device

How the app keeps your keys on a computer or phone, why to set a passphrase and how to check your backup.

So that you do not have to type the phrase at every launch, the app keeps it on the device — but only encrypted. How well depends on the protection level. The **“Wallet security”** block controls it: **“Settings”** → the **“Private key”** tab.

## Protection levels

- **“This device only”** — the default. The phrase is encrypted with a key that sits in the app's protected storage, separately from it. Someone who copies the app's files cannot read the phrase, but on the device itself the app opens without a password.
- **“Passphrase protected”** — the phrase is encrypted with a password only you know. The app asks for it at every launch and never stores it.
- **“No encryption at rest”** — protected storage is not available in this environment, for example in a browser with restrictions. Encryption is limited then, so your written-down phrase remains the main protection.

## Passphrase

A [passphrase](glossary.md#passphrase) protects the keys if the device falls into someone else's hands or someone opens its backup.

1. Click **“Set a passphrase”**.
2. First the app asks you to confirm that your 12 words are written down: without them a forgotten password cannot be recovered.
3. Enter a password of at least 8 characters and repeat it.

From now on the app asks for the password at every launch. To remove the protection — **“Remove passphrase”**; you need to enter the current one.

> [!WARNING]
> A passphrase cannot be recovered: it is not stored anywhere. If you forget it, the only way back is your 12 words.

## Unlocking

At launch the app shows the **“Unlock your wallet”** window. The first three mistakes cost nothing; after that the app asks you to wait: 5 seconds, then 15, 30 and a minute for each further attempt.

If the password is forgotten — **“Forgot your passphrase?”** → **“Restore with your 12-word recovery phrase”**. The accounts saved on this device are removed, and you sign in again with the phrase. Coins and posts are not affected: they are on the blockchain.

## Checking your backup

The **“Recovery backup”** block shows when you last checked your written copy of the phrase. Click **“Verify 12 words”** and enter the three words at the positions the app names. If the account has no phrase because you signed in with a key, the app asks for the last 6 characters of the key.

While there has been no check or it is older than 90 days, the app reminds you once a week: **“Verify your recovery backup”**. Click the reminder to open the right settings tab.

<details>
<summary>How the encryption works</summary>

- Saved phrases and keys are encrypted with a random 32-byte secret.
- At the "This device only" level the secret itself is encrypted with a non-extractable AES-GCM key kept in the app's storage: in IndexedDB in the browser and on a computer, in the app's private data on Android. Not even the app's code can read this key; it can only decrypt with it.
- With a passphrase, the secret is encrypted with a key derived from the password (PBKDF2, 600,000 iterations). The password is not stored anywhere.
- The recovery phrase never leaves the device: only signed transactions go to the network.

</details>

## See also

- [Recovery phrase and private key](recovery-phrase.md)
- [If you lost access](lost-access.md)
- [What is stored on your device](local-data.md)
