# v0.13.5 — Coins from the previous “Wallet”, names in notifications, a groups filter

Additional wallets are again the same as the “Wallet” in the previous Bastyon app, and the coins on them show up again. Notifications show names instead of addresses, the messenger has a groups filter, and the app installs on phones with 32-bit Android and starts from the AppImage on Fedora. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Wallet

- **Coins from the previous app’s “Wallet” show up again.** Since 0.3.0 this app derived **“Additional wallets”** from the recovery phrase instead of the account key, as the previous Bastyon app does. The addresses came out different, and coins kept in the previous app’s “Wallet” disappeared from the balance here. Now these are the same ten addresses again, and their coins count towards the total balance.
- **Addresses from earlier versions are not lost.** If an address that versions 0.3.0 to 0.13.4 gave out has coins on it, it is in the table too, labelled **“Address from an earlier version of this app”**.
- The app cannot spend from additional wallets yet; they are view-only. These coins can be spent in the previous Bastyon app.

## Notifications

- **A name instead of an address.** Almost all notifications come with only the sender’s address, and the app showed the address even after it had loaded the profile. Now you see the name and the avatar. Notifications that arrive while the list is open get the name at once too, not after you open the list again.
- **While the name and the avatar load,** a grey line and a grey circle stand in their place.

## Messenger

- **A groups filter.** Above the chat list there are now **“All”**, **“Personal”**, **“Groups”** and **“Channels”**, in the big messenger and in the widget. The last three turn on and off like checkboxes, in any combination, and with all three on it is **“All”** again. The former **“Chats”** choice becomes **“Personal”** and **“Groups”**.

## Profile

- **A new avatar does not revert to the old one.** Until the profile edit transaction is in a block (usually about a minute), the node returns the previous profile. On the next request the app showed the old avatar and name, and it looked as if the avatar had not changed. Now the new avatar and name stay until the transaction is confirmed.
- **A picture that cannot be opened is reported at once.** If you choose a file for the avatar that the app cannot open (a HEIC from a phone camera, for example), you see **“Couldn’t open the picture. Choose a JPG, PNG or WebP”**.

## Installation

- **The APK installs on phones with 32-bit Android.** Since 0.8.0 the APK had only the 64-bit part, and phones with a 64-bit processor but 32-bit Android (Redmi 9A and other budget phones) said the app was not compatible with the device. Now the APK has both.
- **The AppImage starts on Fedora.** The AppImage carried the Wayland graphics libraries from Ubuntu 22.04. On Fedora with a new Mesa they clashed with the system ones, and the window stayed blank. Now they are left out of the AppImage, and the system ones are used.
- **Installers come first in the release’s file list.** GitHub shows only the first ten files, and the Windows installer was hidden under “Show all”. Service files that the app downloads itself now start with `_` and sit at the end of the list.

## Other

- **The IPFS icon is a globe.** The header shows a globe instead of a check mark: grey while the module is off, green while it runs.
- **The mini-app close button is fully visible.** At the top right only a narrow strip peeked out from the edge, and the cross was cut off. Now the cross is always visible, and the **“Close”** label slides out on hover.
