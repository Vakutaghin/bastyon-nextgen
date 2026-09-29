---
keywords: [transfer, send PKOIN, fee, recipient, irreversible, transfer message]
---

# Transfers and fees

How to send PKOIN by name or address, who pays the fee and why a transfer cannot be undone.

## Sending

1. Open the [wallet](bastyon://wallets), the **“Transfers”** tab, **“Send”** mode.
2. **“Recipient (name or address)”**: start typing an account name and pick the person from the list — their login appears under the field. Or paste a whole address.
3. **“Amount (PKOIN)”**.
4. **“Message (optional)”** — up to 80 characters, for example what the transfer is for. It is written to the blockchain: the recipient and anyone who opens this transaction will see it. Do not put anything private there.
5. **“Fee”** — who pays it, see below.
6. Click **“Calculate fee and send”**.

Once the transfer goes to the network, its number (TXID) and the fee charged appear under the form. The balance updates when the network confirms the transfer, usually within a minute.

You can send only from the main wallet. To send PKOIN right in a conversation, see [Sending PKOIN in a chat](pkoin-in-chat.md).

## The fee

The network fee for a transfer is 0.00000001 PKOIN, like for any action. In the **“Fee”** field choose who pays it:

- **“Recipient pays”** — the default: the fee is taken from the amount, and the recipient gets slightly less. The amount must be larger than the fee, otherwise — **“Amount must be greater than the fee (recipient pays)”**;
- **“Sender pays”** — the recipient gets exactly the amount entered, and the fee is charged to you on top.

Sometimes the fee comes out a little higher: if the change that should return to you is less than 0.000007 PKOIN, the network does not accept such a crumb as a separate output, and it goes to the fee. How much was actually charged is shown in the message after sending.

## If a transfer does not go through

- **“This address belongs to another network. A Bastyon address starts with "P".”** — you pasted an address of another cryptocurrency.
- **“Invalid wallet address format”** — the address has a typo.
- **“Insufficient funds for transfer including the fee”** — the wallet has fewer coins than the amount plus the fee.

## A transfer is irreversible

A transfer cannot be cancelled, and the coins cannot be taken back by force: only the recipient can return them by sending them back. Check the address and the amount before you press the button.

If the app did not get an answer from the node in time, the transfer may still have gone through. Do not repeat it right away: wait a couple of minutes and look at the [transaction history](wallet-history.md) — see [Confirming actions](transactions.md).

## See also

- [Transaction history](wallet-history.md)
- [Sending PKOIN in a chat](pkoin-in-chat.md)
- [Tipping the author](tips.md)
