# v0.30.0 — Barteron saves offers, groups no longer get stuck sending

Barteron now publishes offers, profiles, reviews and ratings, and an offer can carry a video. Mini-apps accept payment by link and can share a post. Group messages no longer get stuck because of one member without encryption keys. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Services

- **Barteron saves offers.** Before, its editor could not save anything: a new offer, an edit, a deletion, the profile, a review and a rating all ended in a refusal. Now all of it is published as in the previous Bastyon, and offers still waiting for the network to confirm them show in the Barteron profile.
- **An offer can carry a video.** The upload window is the same as in the post editor: pick a file, progress, cancel, retry and cover. Barteron no longer calls every video “not found or removed”.
- **A cancelled payment no longer looks completed.** If you closed the payment window, Barteron’s safe deal said the transfer was done. Now the app learns it was cancelled.
- If you think over a payment for longer than 30 seconds, the mini-app no longer decides there is no answer. Before, the payment window stayed open meanwhile and could still send the payment.
- Barteron’s wallet shows the real balance, not 0.
- **Payment by link from a mini-app.** The window shows the shop, the items and when the link expires, and asks for an email or phone number when the shop needs one. Links that need a delivery quote are not accepted yet, so you do not pay without delivery.
- **“Share on Bastyon” opens the post editor** with the app’s text, images and link. Before, the button did nothing. Your own post draft stays untouched.
- **A mini-app can be reported** in a window with six reasons, as in the previous Bastyon. If the report server does not answer, the window says so.
- Links a mini-app shares lead to bastyon.com.
- Mini-apps learn when you change the theme or the language.

## Chats

- **Group messages no longer get stuck because of one member without encryption keys.** Before, one unregistered or deleted account, a bot, or a member whose profile had not loaded in time was enough for sending to fail with “this user has not published encryption keys”. In large groups, on a slow phone or over Tor this happened now and then. Groups now follow the previous Bastyon’s rules: public groups and groups of 50 members or more are not encrypted, so every client reads them; in a small private group a message is encrypted for the members who have keys.
- **Photos, voice messages and files in public and large groups** are sent the same way as text, unencrypted. Before, they were encrypted for each member separately: in groups of hundreds of people that did not work, and members without keys could not see them.
- If the other person’s profile in a direct chat did not load, the chat says the node did not respond instead of asking them to publish keys.
- An admin who removed a member from a group can keep writing. Before, the app then counted the admin as the one who left.

## Computer

- **Reloading a page no longer leaves a white window.** F5 or Ctrl+R on any page except the feed, for example inside Barteron, left the window white until the app was quit from the tray.
- **Links copied in the Windows app lead to bastyon.com.** Before, “Copy link” and “Share” on posts, comments and collections, in the Media studio and in the explorer gave an http://tauri.localhost/… address that nobody else could open.

## Android

- **Barteron can put your location into an offer** on Android 12 and newer. Before, location access was refused without asking; now the phone asks for permission.

## Appearance

- **Buttons, menus, navigation and the chat list no longer get highlighted** by dragging the mouse or a long press, as in an app rather than on a web page. Post text, messages, comments, profiles and addresses can be selected and copied as before, and so can input fields.
- On Android a tap no longer flashes grey.
