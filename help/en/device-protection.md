---
keywords: [PIN, unlock pattern, app lock, auto-lock, sign-in code, passphrase, encryption, storage, vault, unlock, 12-word check, backup]
---

# Protection on this device

A PIN or unlock pattern for the app, how the app keeps your keys on a computer or phone, why to set a passphrase and how to check your backup.

So that you do not have to type the phrase at every launch, the app keeps it on the device — but only encrypted. How well depends on the protection level. The **“Wallet security”** block controls it: **“Settings”** → the **“Security”** tab.

## PIN and unlock pattern

A PIN or an unlock pattern keeps the app closed to whoever is holding your phone or computer. You set them in the **“App sign-in”** block on the same tab:

- **“Set a PIN”** — 4 or 6 digits;
- **“Set an unlock pattern”** — a line through the dots of a 3×3 grid, at least four, as on Android. A line that passes over the dot in the middle connects it too.

You enter the code twice. The app asks for it:

- at every launch;
- after a break — choose it under **“Lock”**: from **“Right after minimizing”** to **“After 1 hour”**, or **“Only at launch”**. Time counts while the app is not in use: minimized, or open but untouched. While a video plays on screen, the app stays open. Right after you turn the code on, it is a minute on a phone and 15 minutes on a computer;
- when you lock it yourself: **“Lock”** in the account menu, **“Lock now”** in the settings, or Ctrl+L, Cmd+L on a Mac.

The code is also needed to reveal the recovery phrase or the key, to **“Change code”** and to **“Turn off”** the code.

PIN digits can be typed on a computer keyboard too. Four mistakes in a row cost nothing; after that the app asks you to wait: 30 seconds, a minute, two, and five minutes for each further attempt.

While a code is set, Android does not show your chats in the recent apps list: there is a blank window instead of a screenshot.

If your keys are protected with a passphrase, the app asks for it at launch and for the code only after a break.

### If you forgot the code

On the code screen, tap **“Forgot your PIN?”** or **“Forgot your pattern?”**, enter the 12 words or the private key of any account saved on this device and tap **“Remove code”**. The code is removed; your accounts and chats stay. Set a new code in the settings.

If you have no backup — **“No backup? Sign out of all accounts”**. The accounts are removed from the device together with their chats; you can sign in again only with the 12 words or the key. Coins and posts stay on the blockchain.

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
- The PIN and the unlock pattern are not stored anywhere. The app keeps their HMAC-SHA256 signature made with a key derived from the vault secret: the code cannot be guessed from copied files without opening the vault. The code does not re-encrypt the keys: a short code is brute-forced in seconds, so such encryption would be false protection. A passphrase is what protects against copied files.

</details>

## See also

- [Recovery phrase and private key](recovery-phrase.md)
- [If you lost access](lost-access.md)
- [What is stored on your device](local-data.md)
