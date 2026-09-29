---
keywords: [sign up, registration, nickname, username, captcha, new account, starting coins, validation]
---

# Signing up

How to create an account: a nickname, a captcha, starting coins from the network and the recovery phrase.

Signing up needs neither an email nor a phone number. The app creates the account keys right on your device, and the network records only your nickname and address on the blockchain.

## Nickname

Click **“Sign up”** in the header (on a phone, in the menu behind the three-line button) and choose a **“Nickname”** — the name people will see you by:

- up to 20 characters: Latin letters, digits and the underscore `_`;
- Cyrillic letters are converted to Latin ones automatically: "Иван" becomes `Ivan`;
- the words "bastyon" and "pocketnet" cannot be used.

The app checks whether the name is free right away, as you type it. Upper and lower case are not told apart: if `ivan` is taken, `Ivan` will not do either. You can change the nickname later in your [profile](edit-profile.md).

The **“Email”** field can be left empty: an email is not linked to the account. Click **“Sign up”**.

## Captcha and starting coins

Every action on the network is a [transaction](glossary.md#transaction), and a transaction needs coins on the address. So the network sends a new account a little PKOIN — enough for the registration and the first actions.

To keep bots from taking these coins, the app will ask you to **“Enter the text from the image”**. If you cannot read the characters, click **“Refresh”** to get another image.

Coins are handed out to one IP address only a limited number of times: if five accounts have already been registered from it, the next one gets coins no sooner than 10 days after the previous one. What to do in that case is covered in [Sign-up does not finish](registration-problems.md).

## Blockchain check

Next the **“Account validation on the blockchain”** window opens: once the coins arrive, the app sends a transaction with your nickname to the network and waits for it to be confirmed. This usually takes up to 10 minutes.

You can close the window: the check goes on, and you can come back to it by clicking your avatar in the header. Until the registration is confirmed you cannot publish or rate yet.

- If the network rejected the registration, for example because someone took the name in the meantime, the app shows the reason. Pick another name: the account menu gets a **“Finish registration”** item. The retry uses the same keys and coins and does not ask for them again.
- If there is no confirmation within 30 minutes, the app tells you so. Check your connection and choose **“Finish registration”** in the account menu — it retries with the same keys. Do not start a new registration — see [Sign-up does not finish](registration-problems.md).

## Recovery phrase

Once the network confirms the registration, the **“Save your seed phrase”** window opens. It shows:

- **“Seed phrase”** — 12 words;
- **“Private key (hex)”** — the same thing as a 64-character string.

The phrase and the key are equivalent: either is enough to get the account back. Write the phrase down on paper or save it in a password manager. The **“Copy seed phrase”** and **“Copy private key”** buttons put them on the clipboard, and after a minute the app clears it.

> [!CAUTION]
> Only you see the phrase, and nobody can restore it. If you lose both the phrase and the device, the account is gone for good.

This window will not appear by itself again. You can see the phrase again in the settings, on the **“Private key”** tab — see [Recovery phrase and private key](recovery-phrase.md).

## First steps

After the phrase the app shows a short three-screen welcome: **“Set up your profile”** and **“Back up your seed phrase”** remind you of the essentials. Page through with **“Next”** or click **“Skip”**.

Next — [Your profile](edit-profile.md) and [Finding your way around](interface.md).

## See also

- [Recovery phrase and private key](recovery-phrase.md)
- [Sign-up does not finish](registration-problems.md)
- [Signing in](sign-in.md)
- [Your profile](edit-profile.md)
