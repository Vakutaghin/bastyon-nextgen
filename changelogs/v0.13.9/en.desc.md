# v0.13.9 — Post status without a restart, profile and notifications on the phone, video on Ubuntu

The “not published” mark leaves a post as soon as it makes it into a block — no need to restart the app. On the phone, the profile shows everything the side column shows on the computer, notifications open full screen, and voice input now works in the Android app. The messenger shows chat invitations and explains where messages went. Video now plays on Ubuntu from the .deb package. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Posts

- **Post status right away.** The “Not yet published to the blockchain” mark on a new post went away only on a server notification. If the notification was lost — the phone was in the background, the connection blinked — the mark stayed until a restart. Now the app asks the node itself every 20 seconds, on every new block, after the connection comes back and when you return to the app. Once the post is in a block, you get **“Post published on the blockchain”**.
- **“Post sent to the network”** is now the message after publishing. It used to say “published” while the post was still waiting for a block.
- **A post no longer vanishes.** After 10 minutes of waiting a post silently disappeared from the profile. Now the wait survives a restart, and a post that has not made it into a block within an hour stays in the profile marked **“Did not make it into the blockchain”**, with its text: copy it and publish again, or press **“Remove”**. A comment that did not make it into a block no longer vanishes either and is marked as an error.
- **A scheduled post** shows when it goes out: “Will be published” and the date.

## Phone

- **Profile.** The top of the page has reputation, subscribers and subscriptions (a tap opens the lists), the first lines of the about text, the bell next to **“Subscribe”**, the paid subscription and, on your own page, **“Edit profile”**, which the phone did not have. **“Details”** opens the rest from the bottom: the full about text, the address, **“On blockchain”**, the site, the number of posts, the registration date and blocking.
- **Notifications** open full screen instead of a dropdown that ran off the edge.
- **A post from the feed.** Tapping the post time opens it in a window, and the window has **“Open as a page”**. The window closes when you move on — it used to stay over the new page.
- **The header** slides away with the scroll and comes back when you scroll up.
- **Above the keyboard** there is no empty strip anymore: the bottom bar hides.
- **A new post** has no extra frames or paddings, the edit and repost window is full screen, and tag suggestions stay open after a pick.
- **Voice input on Android** — the same on-device recognition as on the computer. The **“Fast”** and **“Accurate”** models download once, and the recording is not sent anywhere.
- **“Save”** in the profile window no longer lights up by itself when the profile reloads while the window is open.

## Messenger

- **Chat invitations** show in the list: “Invitation to chat”, in a group — who invited you, and the time. There used to be an empty row instead.
- **A new chat is created by the first message**, not by the **“Start chat”** button: a click left the other person an empty invitation.
- **Where messages went.** A deleted message stays as a line “You deleted a message” or “… deleted a message” with the time instead of silently vanishing. The start of a conversation says who created the chat and when, from which date the server deleted old messages, and how long it keeps them. If the history fails to load, there is an explanation and a “Retry” button instead of an empty chat. A message that could not be decrypted says so.
- **A chat no longer opens empty** when the end of its history is only service events.

## Computer

- **Video on Ubuntu.** The app from the .deb package plays video through the system, and a standard Ubuntu installation has no decoder for H.264, which videos are stored in — so only the texts showed. Now the package installs the decoder (gstreamer1.0-libav) itself. If it is still missing, the player says which package is needed and shows the command with a **“Copy command”** button.
