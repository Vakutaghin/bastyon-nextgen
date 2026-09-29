---
keywords: [rejection, publishing error, limit, insufficient funds, transaction rejected, network rejected]
---

# The network rejected an action

Why a post is not published, a rating is not set or a transfer does not go through, and what to do in each case.

Every action in Bastyon is a [transaction](glossary.md#transaction), and the nodes check it against the network’s rules. If a rule is broken, the node rejects it, and the app shows the reason. The most common ones are below.

## Limits

- “You have reached your post limit for the last 24 hours.”, and the same for ratings, comments, comment ratings and reports. How much of what you can do and when a limit resets is on the **“Limits”** page — see [Account status and limits](limits.md).
- **“You can change your profile up to 10 times a day. Please try again later.”**
- **“A post can be edited up to 5 times (an article up to 10) and only within 30 days of publishing.”**
- **“A comment can be edited up to 4 times and only within 30 days.”**

## Too fast

- **“Too many actions in a row. Wait a little and try again.”**
- **“Wait until the network confirms your previous transaction, then try again.”** — the previous action is not in a block yet; that usually takes a minute.
- **“You can edit only once per blockchain block. Wait a minute and try again.”** and **“The comment cannot be edited yet. Wait a minute and try again.”**

## Repeats and contradictions

- **“You have already rated this.”**, **“You have already rated this comment.”**, **“You are already subscribed to this user.”**, **“You have already reported this.”** — this is already done: the action was recorded earlier, perhaps from another device.
- **“You cannot rate your own post.”**, **“You cannot report your own content.”** — not allowed with your own content.
- **“Not possible: you have blocked this person or they have blocked you.”** — see [Blocking](blocking.md).
- **“The comment you are replying to has been deleted.”** and **“Not found: it may have been deleted.”**

## Reputation and the account

- **“Your reputation does not allow negative ratings yet.”** and **“Your reputation does not allow reports yet.”** — these rights come with experience, see [Reputation](reputation.md).
- **“Your account is not activated yet. Wait until the network confirms your registration.”** — right after signing up, see [Sign-up does not finish](registration-problems.md).
- **“Your account has been blocked after user complaints or a jury decision.”** — see [Moderation and rules](moderation.md).

## Money

- **“Not enough funds to pay the fee”** — every action has a fee of 0.00000001 PKOIN, and the wallet is at zero. See [How to get PKOIN](how-to-buy-pkoin.md).
- **“Insufficient funds for transfer including the fee”** — the wallet holds less than the transfer amount plus the fee.

If the node did not answer in time, the action may still have reached the network. Do not repeat it right away — especially a transfer: wait a couple of minutes and check, see [Confirming actions](transactions.md).

## Too big

**“This post is too long. Please split it into several.”** or **“The content exceeds the size limit.”** — shorten the text or split the post into parts.

## Anything else

If the reason is unfamiliar, the app shows “The network rejected the action (code …).”. Note the code and write to the developers — see [Reporting a bug](report-bug.md).

## See also

- [Account status and limits](limits.md)
- [Confirming actions](transactions.md)
- [Reputation](reputation.md)
