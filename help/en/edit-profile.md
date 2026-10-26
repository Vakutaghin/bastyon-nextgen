---
keywords: [edit profile, name, nickname, avatar, about, website, content language, change name, donation addresses, wallet, bitcoin]
---

# Your profile

How to change the name, avatar, description, website, content language and donation addresses in your profile.

## How to change it

1. Click your avatar in the header and choose **“Profile”**.
2. Click **“Edit profile”**.
3. Change what you need and click **“Save”** — the button is active when the profile has changes. Once the changes go to the network, **“Profile updated”** appears. You see the new name and avatar at once, others see them when the change gets into a block, usually in a minute.

## What you can change

- **“Avatar”** — **“Change avatar”** uploads a picture from your device, **“Remove”** removes it. The app shrinks the picture to 200 × 200 pixels and uploads it to the network’s image server while you wait: the button says **“Uploading avatar…”** meanwhile. JPG, PNG and WebP work; a HEIC photo (some phone cameras take them) won’t open, and the app says **“Couldn’t open the picture. Choose a JPG, PNG or WebP”**.
- **“Name”** — up to 20 characters: Latin letters, digits and `_`, without the words “bastyon” and “pocketnet”. The name must be free: the app notices a taken one before sending and says **“This name is already taken”**.
- **“About”** — a description; it is shown in the profile under the **“Information”** heading. Links in it become clickable.
- **“Website”** — a link to your website.
- **“Content language”** — the language you write in. Based on it, the network suggests you in **“Who to follow”** to readers of that language.
- **“Donation addresses”** — your wallets in other currencies: Bitcoin, Ethereum, USDT (ERC20 and TRC20), Litecoin, Monero, Bitcoin Cash, Dash, Ripple, Zcash, Ethereum Classic, Dogecoin. Choose the currency, paste the address into the **“Wallet address”** field and click **“Add”**. The app checks that the address looks like one of the chosen currency, and if not, it says so under the field. To remove an address, use the bin button in its row. Everyone can see the addresses: the **“Tip the author”** window shows them, see [Tipping the author](tips.md).

Changing the name does not change the account’s address, keys or coins: subscribers, posts and history stay with you. But links to your profile by the old name stop working — they point to the name, not the address.

This app does not change the profile cover yet, but it keeps the one you set in the previous Bastyon app. Donation addresses from the previous app show up in the form, and you can remove them or add more.

## Network limits

- The profile can be changed up to 10 times a day and no more than once a minute: **“You can change your profile up to 10 times a day. Please try again later.”**
- If the description is too long, the network refuses: **“The content exceeds the size limit.”** Shorten the text.
- Like any action, a profile change waits for the network’s confirmation — usually about a minute, see [Confirming actions](transactions.md).

## Everything is public

A profile is a blockchain record. Each change is a new transaction, and earlier versions of the name, description and avatar stay in the history: they can be found in the [block explorer](explorer.md). Do not put in your profile what you may later want to hide — see [Privacy: what others can see](privacy.md).

## See also

- [Profile](profile.md)
- [Privacy: what others can see](privacy.md)
- [Confirming actions](transactions.md)
