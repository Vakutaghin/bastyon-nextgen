# v0.19.0 — Transfers go through again, nodes on a world map

PKOIN transfers reach the network again. The blockchain explorer now shows the nodes on a world map, each in its city. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Transfers

- **“Network rejected the transaction: -26”.** A PKOIN transfer went out with a fee of one satoshi, and the network does not accept a money transfer with such a fee. This hit the wallet, transfers in chat, tips to authors, paid subscriptions and payments in mini apps. Now the fee follows the size of the transfer; usually it is 0.00001 PKOIN.
- **A clear reason for a reject.** If the network still rejects a transfer, the app says why — the fee is too low, the amount is too small, “not yet” — instead of a bare code.

## Node map

- **“Map”** — next to “Rings” and “Free” on the “Network” tab: an OpenStreetMap world map, light or dark to match the app theme. Each node sits in its city, lines are the connections between nodes. The app finds the city on the device: the first time it downloads the city table (about 4 MB); node addresses never leave the device.
- **The legend is a filter.** The legend moved to the top, and each line is a checkbox: hide a group of nodes, the connections, proxy pools or the app’s requests.
- **Trackpad pinch** zooms the diagram and the map on a Mac too.

## Fixes

- **“Registration — not in the blockchain yet”.** A new account, transfers and subscriptions stayed in the hourglass for an hour after they were in a block and were then marked as failed. Now they leave the hourglass as soon as the transaction is in a block. The hourglass on the avatar no longer goes out early because of a network error.
- **Empty chat list.** Instead of a blank space — “No chats yet” and how to start a conversation.
- **Video views.** The player reports a view to the video server every 30 seconds, as the earlier Bastyon app did, and no longer gives up after a single server error.
- **“Online”.** The app no longer tells the chat server that you are online — as the earlier app did not.
