---
keywords: [payment, pay, mini app, payment confirmation, pay in an app, payment link]
---

# Payments in mini apps

How a mini app asks for a payment in PKOIN, including by a shop link, and what to check before you confirm.

## The payment window

When an app asks you to pay, Bastyon opens its own window — **“Payment confirmation”**. It shows:

- “Requested by: …” — which app asks for the payment;
- the recipients’ addresses and how much each gets — there can be several recipients;
- **“Total:”** — the total amount;
- the [network fee](glossary.md#fee) and who pays it: **“sender pays”** — it is taken from you on top, **“receiver pays”** — it is deducted from what the recipients get, in equal shares. The app decides. A transfer fee depends on the size of the transaction: 2000 satoshi (0.00002 PKOIN) per kilobyte, but at least 0.00001 PKOIN — which is what a usual payment costs. The window shows an estimate: if the payment has to gather many small incoming amounts in your wallet, the transaction is larger and the fee charged when sending is slightly higher;
- the payment message, if the app passed one. It is written to the blockchain, and anyone can see it. It holds 80 Latin letters or 40 Cyrillic ones; anything longer is cut, and the window shows what will actually be sent.

**“Confirm”** — the coins leave your main wallet, and the app gets the transaction number. **“Cancel”** — no payment is made, and the app learns that you declined.

## Payment by a shop link

A mini app can open a payment by a shop link. The window is the same — **“Payment confirmation”** — but it also shows:

- the shop and its site, the description and the items with prices;
- until when the link is valid — “The link is valid until …”. If it expires while the window is open, **“The link has expired and can no longer be paid”** appears and **“Confirm”** can no longer be pressed;
- the **“Email for the shop”** or **“Phone for the shop”** fields, if the shop needs a way to contact you: until the field is filled in, **“Confirm”** cannot be pressed;
- what the shop learns after payment: the transaction number, and sometimes your address too — the window says so plainly.

With such a link you pay the fee, on top. Bastyon puts a code from the link into the payment message, by which the shop finds the payment on the network. If the shop does not confirm receiving the payment, Bastyon tells you; the payment itself is not cancelled by that — the transaction is in your wallet.

Links that need a delivery quote are not accepted yet, so that you do not pay without delivery: the window does not open for such a link. Nor does it open for a link that has already expired.

## Before you confirm

- Without this window an app cannot pay: the **“Payments”** permission only lets it open the window, and you confirm every payment yourself.
- Check the amount and the recipients. A payment cannot be undone, like any transfer — only the recipient can send the coins back. See [Transfers and fees](send-pkoin.md).
- If you do not recognise the app or the amount, press **“Cancel”**.

If you do not have enough coins, the window shows **“Insufficient funds for the payment including the fee”**. A completed payment appears in the [transaction history](wallet-history.md) as a regular transfer.

## See also

- [Mini app permissions](mini-app-permissions.md)
- [Transfers and fees](send-pkoin.md)
