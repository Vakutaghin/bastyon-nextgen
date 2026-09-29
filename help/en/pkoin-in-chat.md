---
keywords: [chat transfer, send PKOIN, money in chat, pay a contact]
---

# Sending PKOIN in a chat

How to send coins to someone straight from the conversation, and what to do if the transfer went through but the message did not.

## Sending

Transfers work only in private chats: group chats do not have this item.

1. Press **“Attach”** — the paper clip to the left of the input field — and choose **“Send PKOIN”**.
2. The **“Recipient”** field already holds the other person’s address — no need to change it.
3. **“Amount (PKOIN)”** — a dot or a comma both work.
4. **“Message (optional)”** — up to 200 characters, for example what the transfer is for.
5. Press **“Send”**.

The coins come from your main wallet. You pay the network fee of 0.00000001 PKOIN: the other person receives exactly the amount you entered. If you do not have enough coins, the app says **“Insufficient funds for the transfer including the fee”**.

A transfer cannot be undone, like any transfer on the network — see [Transfers and fees](send-pkoin.md).

## Who sees the message

Only you and the other person see the message attached to the transfer: it goes to the chat encrypted, like any other message, and is not written to the blockchain. That is the difference from a transfer made in the [wallet](send-pkoin.md), where the message is written to the blockchain and anyone can read it.

The transfer itself — amount, addresses and time — is visible on the blockchain to everyone, like any transaction.

## The transfer card

After sending, a card appears in the conversation: **“PKOIN transfer”** on your side, **“PKOIN received”** on theirs. It shows the amount, the message, the start of the transaction number and a **“View in explorer”** button, which opens the transfer in the [block explorer](explorer.md).

The card is sent by the sender, and it can be faked. Before, say, handing over goods, make sure the coins arrived: press **“View in explorer”** or look at the wallet’s [transaction history](wallet-history.md).

If the other person uses the previous Bastyon app or forta.chat, they see a line like “💎 1.5 PKOIN · For coffee” instead of a card. A transfer from the previous app arrives as a `bastyon://i?stx=…` link — click it, and the transfer opens in the explorer.

## Transfer sent, message not

The transfer and the message about it go out one after the other: first the coins to the blockchain, then the card to the chat. If the chat connection drops, the app says: “The transfer was sent (tx …), but the chat message was not delivered. Retry the message — no second transfer is needed.”

Press **“Retry message”**: only the card goes out, and the coins are not taken a second time. If you close the window, the transfer still stands — you can see it in the [transaction history](wallet-history.md).

## See also

- [Transfers and fees](send-pkoin.md)
- [Tipping the author](tips.md)
- [Message encryption](chat-encryption.md)
