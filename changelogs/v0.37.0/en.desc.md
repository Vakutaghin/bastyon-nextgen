# v0.37.0 — buying PKOIN in the wallet, images in comments

The wallet “Buy/Sell” tab now gathers everything you need to buy or sell PKOIN. Comments can carry images, and long comments are folded so they do not stretch the discussion. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Wallet: buy and sell PKOIN

- **A calculator next to the rate chart:** how much PKOIN is in dollars and back, at the CoinGecko rate. Sellers set their own rates, and the tab reminds you of that.
- **Your receiving address** right on the tab, with a QR code and a copy button.
- **Exchanges:** Tapbit and DigiFinex, the PKOIN/USDT pair. Trading volume there is small.
- **Sellers:** the PKOIN Exchange mini-app and #pkoin_commerce offers in search. Next to them is a warning: there is no deposit or intermediary, a transfer cannot be undone, check that the money has reached your account.
- The **“Buy or sell PKOIN →”** link under the balances leads to the tab. On the phone the row of wallet tabs scrolls sideways and no longer makes the page wider than the screen.

## Comments

- **Images in comments and replies:** the “Attach an image” button next to the field or a paste from the clipboard, up to 10 images. Large ones are scaled down to 1920×1080, and shooting details such as the location are removed. A comment may consist of images only, and under a post in the feed the images show in the latest comment too. The old Bastyon shows them as well.
- The network accepts a comment of up to 2000 bytes, image addresses included. If the text with the images does not fit, the app says so before sending.
- **Long comments are folded:** past 10 lines you see the first six, “Show full” unfolds the text and “Collapse” folds it back. A comment you opened by a link is shown in full.

## Fixes

- **Video upload** no longer fails because of the title: the video server accepts 3 to 120 characters, so a long title is cut and a too short one is replaced with the file name. If an upload still fails, the error names the reason the server gave.
- **Android: “Save” puts the file in Downloads,** in the Download/Bastyon folder, instead of opening the Share sheet, where saving was impossible. This covers downloaded videos, files, voice messages and images from chats, and IPFS files. On Android 7–9 the system “Save as” window opens.
- **The chat list remembers its scroll:** open a chat and come back, and the list and the search results are where you left them.
- A selected tag in the sidebar no longer breaks the header, whose icons used to stack down the page.
- Windows, menus, tooltips, notifications and the calendar are now our own, without the Ant Design library. They look and work the same, and the app's first load is smaller.
