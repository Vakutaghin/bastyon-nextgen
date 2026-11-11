---
keywords: [attachment, send photo, send file, send video, file size, download]
---

# Photos, videos and files in chat

What you can send in a chat, how large it can be, and how to send a big file.

## Attaching

Press **“Attach”** — the paper clip to the left of the input field:

- **“Photo”** — pictures, several at once if you like;
- **“File”** — any file, videos included, and a picture at its original size, see below;
- **“File via IPFS”** — for big files, in the desktop app, see below;
- **“Send PKOIN”** — a transfer right in the conversation, see [Sending PKOIN in a chat](pkoin-in-chat.md).

You can also drag files anywhere onto an open chat or paste them from the clipboard into the message field.

While a file uploads, it shows how many percent have been sent. The recipient sees pictures and videos right in the conversation, and a file gets a **“Download”** button. A picture opens full screen, and the **“Download image”** button at the top left saves it. A voice message or a video is saved with **“Download”** in the message’s “⋯” menu. On a computer the app asks where to save the file, on a phone the system “Share” sheet opens.

## What the app does to photos <!-- #photos -->

A phone photo weighs several megabytes, and everyone in the chat would download all of it just to see it in the conversation. So the app shrinks a photo longer than 2048 pixels on its long side to 2048 — enough for a full phone screen. A heavy smaller JPEG is saved again, a light one goes as is. A PNG stays PNG, GIFs and animations go as they are.

The photo loses its metadata: the phone model, the date and the coordinates of where it was taken. Encryption does not hide them from the person you chat with — they would open the photo along with them.

To send the original without shrinking, use **“Attach”** → **“File”**. It arrives as a file with a **“Download”** button, also without metadata. A picture dragged onto the chat or pasted from the clipboard goes as a photo.

## Size limit

- a picture via **“Photo”** — up to 100 MB;
- a file, a video or a picture via **“File”** — up to 25 MB.

The chat server will not accept anything larger, and the app tells you straight away. A big file can go through IPFS: in the desktop app, **“Attach”** → **“File via IPFS”**, see [Files over IPFS in chat](ipfs-in-chat.md).

## Encrypted attachments

Photos, videos, files and voice messages are encrypted on your device before they are sent: each file has its own random key, and that key is encrypted for the chat members. The server stores only the encrypted file, and only the people it was sent to can open it. The exception is public groups and groups of 50 members or more: there attachments, like text, go unencrypted, and the group header says “not encrypted”. More in [Message encryption](chat-encryption.md#group-chats).

## See also

- [Files over IPFS in chat](ipfs-in-chat.md)
- [Messages](messages.md)
- [Message encryption](chat-encryption.md)
