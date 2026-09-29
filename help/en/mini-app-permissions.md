---
keywords: [permissions, access, revoke, data signing, geolocation, app permissions]
---

# Mini app permissions

What a mini app can ask for, what the risks are, and how to revoke a permission.

## A permission request

When an app needs something, Bastyon asks: “… requests access: …”, with an explanation of what that means. Answer **“Allow”** or **“Deny”**.

The answer is remembered: next time the app does not ask but gets the same decision. If you change your mind, change it in the settings, see below.

## Kinds of permissions

- **“Account”** — your account address. The app learns who you are on Bastyon.
- **“Signed requests”** — the app talks to its own server on your behalf, and the server can check that it really is you.
- **“Data signing”** — signing something with your account key. Asked every time, and the window shows exactly what will be signed. A signature can be passed off as your consent or action — sign only what you understand.
- **“Payments”** — opening a payment window. You still confirm every payment separately, see [Payments in mini apps](mini-app-payments.md).
- **“Chat”** — creating rooms and writing chat messages on your behalf.
- **“Geolocation”** — the device’s coordinates. Valid while the app is open; next time it asks again.
- **“External links”** — opening links in the system browser.
- **“Separate wallet address”** — one of your additional addresses, see [Balances and addresses](wallet-addresses.md). The app can link your activity to that address.
- **“Notifications”** — sending notifications to the device.
- **“Messages”** and **“Camera”** are granted without asking, as in the previous Bastyon app. Access to the device camera itself is still asked by the system.

Some apps that come with Bastyon get part of their permissions right away: Barteron and PKOIN Exchange get **“Account”** and **“Chat”**. These can be revoked too.

## Revoking

**“Settings”** → **“App permissions”** tab. It lists every app you allowed or denied something, with the date of each decision.

- **“Revoke”** — remove one permission;
- **“Revoke all”** — remove all of an app’s permissions.

A revoked app asks again when it needs the permission. A refusal is marked **“denied”** in the list: revoke it, and the app can ask once more.

## See also

- [Mini apps](mini-apps.md)
- [Payments in mini apps](mini-app-payments.md)
- [Privacy: what others can see](privacy.md)
