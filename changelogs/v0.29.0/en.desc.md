# v0.29.0 — vertical videos, pull to refresh and voice messages that resume

Vertical videos are no longer squeezed into a strip, the feed refreshes when you pull it down, and voice messages show their length at once and remember where you stopped them. Chats open without the input lagging, and on Android they no longer lose the connection after the app was in the background. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Feed and video

- **Pull the feed down from the very top to refresh it** — on a phone or a touch screen. A circle appears under the header; let go once it turns blue.
- **Vertical videos keep their shape.** The player used to be 16:9 always, and a vertical video played as a narrow strip in the middle. Now the frame follows the video: full width on a phone, between the header and the bottom bar, and at most 600 points tall on a computer. Channel covers in the messenger and cards in the “Video” section show a vertical frame whole too, not a cropped strip.
- **A YouTube link next to the post’s own images or video** shows as a neat card, like a link to any site. Before, a large player was added under the images as well. A post with only the link still shows the player.

## Search

- **An account’s address or public key finds the account** — in the header search, on the search page and in the people search in chats.

## Services

- **All mini apps are shown, not just the first twenty.** After “Load more”, the newer ones appear as well — Vakka VPN, Bastyon Freelance, “Погодавдо-метр”.

## Chats

- **Voice messages show their length at once**, before the file has loaded, and from the moment you press “Play” — how much has played. Pausing, playing another voice message or going to another chat leaves the message where it stopped, and it goes on from there. Once played to the end, it shows its length again and starts over. Voice messages from the old Bastyon show their length once the file has loaded: it does not send it.
- **Typing no longer lags while a chat with a long history opens.** The latest messages are drawn at once and earlier ones as you scroll up, and what is on screen does not move.
- **Messages show while the history is loading.** Before, “Loading messages” covered the chat, and whatever you sent meanwhile seemed to vanish. Now it sits at the bottom, by the input, with a clock until it is sent.
- Messages written while the app is still connecting to chats go out in order instead of failing with “Room not found”.

## Android

- **Chats keep their connection after the background.** If the phone network silently dropped the connection while the app was minimized, a new message arrived a minute and a half after you came back, and your own messages hung while sending. Now it takes a couple of seconds.
- The red sync error banner no longer flashes on a short drop: it shows only if the error lasts longer than 8 seconds. Until then the messenger header says “No connection, reconnecting…”.
