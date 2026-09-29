---
keywords: [encryption, end-to-end encryption, encryption keys, chat security, keys have changed]
---

# Message encryption

Who can read your messages, what “the contact’s keys have changed” means, and what the server still sees.

## Private chats

A message is encrypted on your device before it is sent. Only ciphertext goes to the [Matrix](glossary.md#matrix) server, and only two people can read it: you and the other person.

The app derives the encryption keys from your account key — the same key your [recovery phrase](recovery-phrase.md) restores. The app writes the public part of the keys into your profile on the blockchain, and the other person’s app uses it to encrypt messages for you. Two things follow:

- sign in to your account on another device, and you can read your whole message history — nothing needs to be moved;
- whoever knows your recovery phrase or private key can read all your chats too. Keep the phrase as carefully as money.

The scheme is the same as in the previous Bastyon app, so messages between the two apps are encrypted as well.

## A contact without keys

If the other person’s profile has no keys, there is nothing to encrypt the message with, and the app says: **“This user has not published encryption keys yet, so the message cannot be encrypted for them. Ask them to open the app and try again.”** The message is never sent as plain text.

The keys appear in a profile when the person opens the previous Bastyon app or saves their profile in this one.

## The contact’s keys have changed

The keys derive from the account key and do not change on their own. So the app remembers a contact’s keys the first time it sees them and checks them every time it loads their profile. If they differ, you get the message “Encryption keys of … have changed — verify your contact”, and a warning with an **“Accept new keys”** button appears at the top of the chat.

Most likely the node the app gets profiles from swapped the keys — to put in its own and read the conversation. That is why, until you accept the new keys, the app keeps encrypting with the old ones: an intermediary reads nothing. But if the contact did change the keys, for example published them from another app, they cannot read your new messages until you accept.

What to do:

1. Ask the contact another way — by phone or in person — whether they did anything to their account.
2. If they confirm, press **“Accept new keys”**. If they do not confirm or do not answer, do not accept and carry on as before.

The remembered keys are kept on this device. After you sign out, the app remembers the contacts’ keys afresh.

## Group chats

Groups use a simpler scheme: messages are encrypted with a long-lived group key, and that key is encrypted separately for each member and stored in the chat itself. The scheme has a weakness: identical messages give identical ciphertext, so the server can see that the same text was sent again, although it cannot see the text. Private chats do not have this problem. The scheme is shared with the previous Bastyon app and can only change together with it.

## What the server sees

The Matrix server cannot read message text or file contents. But it does see:

- who talks to whom and which groups they are in — Matrix accounts match Bastyon addresses;
- when a message was sent and roughly how big it is;
- the names, types and sizes of files sent;
- reactions — which emoji on which message — which message you reply to, deletions, read receipts and “typing…”;
- the amount and number of a PKOIN transfer in a chat — they are visible on the blockchain anyway. The message attached to the transfer is encrypted;
- your IP address — unless [Tor](tor.md) is on.

## On the device

The app keeps decrypted messages on the device so that it does not decrypt the conversation again every time you open it. They are stored unencrypted, separately for each account, and are erased when you sign out of the account or press **“Clear cache”**. How to keep them away from others is covered in [Protection on this device](device-protection.md).

## See also

- [Privacy: what others can see](privacy.md)
- [What is stored on your device](local-data.md)
- [Messenger](messenger.md)
