---
keywords: [payment, pay, mini app, payment confirmation, pay in an app]
---

# Payments in mini apps

How a mini app asks for a payment in PKOIN, and what to check before you confirm.

## The payment window

When an app asks you to pay, Bastyon opens its own window — **“Payment confirmation”**. It shows:

- “Requested by: …” — which app asks for the payment;
- the recipients’ addresses and how much each gets — there can be several recipients;
- **“Total:”** — the total amount;
- the network fee, 0.00000001 PKOIN, and who pays it: **“sender pays”** — it is taken from you on top, **“receiver pays”** — it is deducted from what the recipients get. The app decides;
- the payment message, if the app passed one. It is written to the blockchain, and anyone can see it. It holds 80 Latin letters or 40 Cyrillic ones; anything longer is cut, and the window shows what will actually be sent.

**“Confirm”** — the coins leave your main wallet, and the app gets the transaction number. **“Cancel”** — no payment is made, and the app learns that you declined.

## Before you confirm

- Without this window an app cannot pay: the **“Payments”** permission only lets it open the window, and you confirm every payment yourself.
- Check the amount and the recipients. A payment cannot be undone, like any transfer — only the recipient can send the coins back. See [Transfers and fees](send-pkoin.md).
- If you do not recognise the app or the amount, press **“Cancel”**.

If you do not have enough coins, the window shows **“Insufficient funds for the payment including the fee”**. A completed payment appears in the [transaction history](wallet-history.md) as a regular transfer.

## See also

- [Mini app permissions](mini-app-permissions.md)
- [Transfers and fees](send-pkoin.md)
