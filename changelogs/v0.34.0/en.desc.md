# v0.34.0 — working offline, accessibility, photos without location

Without a network the app now shows a saved feed, nicknames and avatars, and everything loads by itself once the connection is back. It is easier to use with a keyboard and a screen reader, and there is a high contrast mode. Photos in chats and posts no longer carry the place where they were taken. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Offline

- **A saved feed.** The first page of the last six feeds is kept on the device. Without a network, or when the Bastyon network does not answer, the feed shows it with a note saying when it was saved. Once the connection is back, the fresh page replaces it by itself.
- **Nicknames and avatars survive a restart.** The chat list, comments and notifications show names and avatars at once instead of short addresses, even offline. Up to 3,000 names and 800 small avatars are kept on the device; the oldest make room for new ones.
- **Offline, the app stops knocking.** A start without a network used to send hundreds of requests and say “All RPC servers failed”. Now it simply says “No network connection. It will load once the connection is back”, and when the network returns, the feed, profile, notifications and chats load by themselves.
- **Connected, but no internet** — guest Wi-Fi before signing in, or a block. Every request used to wait 30 seconds on every server. Now the app quickly says the Bastyon network is not responding, keeps checking by itself and loads as soon as a server answers.
- **The website opens offline** if you have visited it in this browser before.
- Saved feeds, names and avatars are erased on sign-out, when an account is removed, and by “Clear saved data”.

## Accessibility

Nothing changes in how the app looks or works by mouse and touch.

- **Keyboard.** The first Tab shows a “Skip to content” link. Header buttons, the account menu, categories, post images and chat rows respond to Enter and Space. Menus are walked with the arrows, and Esc closes them and returns focus to the button. Star rating: the arrows pick a star, Enter or Space rates.
- **Screen readers** name icon buttons, search and input fields, switches in settings and unread counts (“Chats, unread: 3”). Toasts and the page name after moving to another page are read aloud.
- **“High contrast”** in Settings → General: darker grey text, borders and status colours, and a more visible outline around what the keyboard selected. It also turns on by itself when the system asks for more contrast. When the system reduces motion, smooth scrolling is off.
- **The phone menu** no longer catches Tab while closed, and Esc closes it when open.
- **The website can be pinch-zoomed in a phone browser.** In the apps, the Android font size and the interface scale do this job.
- Help has a new “Accessibility” article.

## Chats

- **A resent message no longer arrives twice for everyone.** When a message reached the server but the answer was lost, it showed “not sent”, and sending it again made a copy for everyone. Now the server recognises the message and there is no copy — attachments and restarts included.
- **Photos go to a chat without their location.** Encryption does not hide what is inside a file from the person you chat with: a phone photo carried GPS coordinates, the phone model and the time. JPEG and PNG are now cleaned of them without re-compression, and a rotated photo does not end up on its side.
- **A stuck “Updating…” restarts by itself.** On Android the chat list sometimes stayed on “Updating…” for minutes. Now a stuck request is sent again after a minute. A sync journal — only times, response codes and sizes — is added to the app details for support.
- **A chat left open when the app is minimized on Android** no longer marks messages arriving in the first seconds as read: they come with a sound and count as unread.
- Blocking someone applies only to their chat. If you open another chat before the server answers, that one no longer looks blocked.

## Pictures in posts

- **Transparency survives.** Every picture except GIF used to become a JPEG, and a transparent PNG got a black background. Now it stays PNG, and one heavier than 2 MB goes as JPEG on a white background.
- **A small JPEG is not squeezed again.** A picture that already fits goes as is, if it is not heavier than the re-compressed one. An animated PNG also goes as is, like GIF.
- **The location and other data inside the file are not uploaded:** coordinates, phone model and comments are cut out. The colour profile stays.
- This covers pictures in posts and articles, collection covers and avatars.

## Phone

- **Toasts show at the top, under the header.** At the bottom they covered the chat input and the bottom buttons. On a computer they stay at the bottom left.
- **A minimized app on Android no longer polls the network for a screen nobody sees:** notifications, ratings, transactions and reconnects wait until you come back and then catch up at once. The unread chats counter on the icon works as before.

## Fixes

- **Accounts no longer vanish at startup.** If an unfinished registration was left on the device and the accounts list could not be read, the app erased the keys of all other accounts. Now it touches nothing in that case.
- **A too small donation is not sent.** The author could receive a tiny fraction of the amount, and with several small coins the fee ate it all. Such an amount is now refused before sending.
- An article with broken data no longer breaks its post card.
- New posts from people you follow show up at the top of the feed right after signing in, not only after a refresh.
- The mark of seen notifications is no longer lost when switching accounts.
- Downloaded videos on the website: when a video is downloading in another tab, “Pause”, “Cancel download” and “Delete all” now say it can be stopped only there. They used to do nothing without a word.
