# v0.9.9 — Chat retries decryption, a paid subscription asks to confirm

Chat messages that didn’t decrypt on the first try now decrypt by themselves, and a delivered message no longer stays marked “Not sent”. Paying for a paid subscription now needs a confirming tick. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package).

## Chats

- **“*** Encrypted Message ***” no longer gets stuck.** If a message didn’t decrypt on the first try — a node didn’t answer in time, encryption wasn’t ready yet, or the group key arrived after the message — it stayed a placeholder until you reopened the chat. Now the app tries again by itself: after a few seconds, then less often. And at once, as soon as the group key arrives or the connection comes back.
- **Delivered means sent.** If the connection broke after the server had already taken a message, it stayed marked “Not sent” for good, though the other person got it. Now the mark goes away as soon as the server confirms the message.
- **Retry without a duplicate.** The “Retry” button on an unsent message sent it again. If the first one had in fact arrived, the other person got two identical messages. Now the server recognises the retry and creates no second message.
- **The “Hide this person’s messages?” window** is narrower and no longer jitters on a narrow screen trying to fit its width.

## Paid subscriptions

- **A confirming tick.** The payment window has a tick “I confirm sending N PKOIN to …”: without it the “Pay” button doesn’t press, so a stray click sends no money. Changing the term clears the tick — another term has another amount.
- **The price on a second line.** On the “Paid subscription” button on the author’s page and the “Subscribe” button on a post, the monthly amount (or the date it is paid until) now sits on a second line under the name.
