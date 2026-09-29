---
keywords: [visibility, subscribers only, registered users only, paid subscribers, post language, scheduled post]
---

# Visibility, language and publishing time

Whom to show a post to, which language it is in and how to schedule it for later.

The settings are at the bottom of the new post window.

## Visibility

In the **“Visibility”** field, choose who the post is open to:

- **“Everyone”** — everybody, including guests without an account;
- **“Subscribers”** — only people who follow you;
- **“Registered”** — everyone who is signed in;
- **“Paid subscribers”** — only people who took out a paid subscription to you. This option appears if you have set a subscription price; for now that can only be done in the previous Bastyon app.

Everyone else sees a note instead of the post, for example: "The author opened this post to subscribers only". You see a label over such a post — **“For subscribers”** and the like.

> [!IMPORTANT]
> Visibility is not encryption. The post's text sits on the blockchain in the open, and the apps are what hide it. Anyone who looks at the record in the [block explorer](explorer.md) or in an app that does not check visibility will read the post. Do not publish anything this way that must stay secret.

A [trial account](glossary.md#trial-account) has no choice: **“Trial accounts can only post for everyone”**.

<details>
<summary>Paid subscribers in this app</summary>

This app cannot check a paid subscription yet, so a post "for paid subscribers" is visible in it only to the author. Subscribers can read it in the previous Bastyon app.

</details>

## Language

**“Language”** — the language the post is in. It decides which language's feed the post goes to: readers see the feed in the language of their interface. By default it is your interface language. Change it if you write in another language.

## Scheduled publishing

**“Schedule post”** — pick a day, then the hour and minute. You cannot pick a time in the past. A hint appears under the field: **“The post will be published at the chosen time”**. An empty field means **“Right away”**; the cross in the field cancels the scheduling.

When you click **“Publish”**, the transaction goes to the network right away, but the network records it on the blockchain only at the chosen time. Until then nobody sees the post, and it appears in your profile feed when the time comes. You cannot change the time of a post that has already been sent.

## See also

- [The post editor](post-composer.md)
- [Account status and limits](limits.md)
- [Subscriptions](subscriptions.md)
