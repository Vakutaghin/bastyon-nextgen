---
keywords: [mesh, MeshCore, LoRa, radio, without internet, offline chat, companion, channel, hashtag channel, private channel]
---

# Chatting over radio (mesh)

How to connect a LoRa radio running MeshCore and chat through it with no internet or cell service — right in the messenger, next to your usual chats.

## What it is

A mesh network is made of radios that pass messages to each other along a chain. It needs no internet: a message travels through the air from radio to radio, through repeaters, over kilometres and further. Enthusiasts build such networks in and around cities, and people take them hiking or keep them for times when there is no signal.

Bastyon connects to your radio and shows the chats that go through it in the messenger, like ordinary chats, just marked with the network.

## What you need

- The desktop app: a radio can be connected only there.
- A LoRa radio with **MeshCore** firmware in its companion variant — for USB, Bluetooth or Wi-Fi. Common boards (Heltec, LilyGO, RAK and others) work. The firmware is installed with the MeshCore web flasher.
- To chat, there have to be other MeshCore nodes or repeaters nearby.

> [!NOTE]
> A radio keeps only one connection. If it is connected to the official app on a phone, Bastyon cannot connect to it — disconnect the phone first.

## Connect a radio

Account menu → **“Mesh networks”** → **“Connect a radio”**. Choose how:

- **USB** — plug the radio in with a cable and pick its port. If the port is missing, press **“Refresh”**. On Linux you need access to the port: add yourself to the `dialout` group and sign in again.
- **Bluetooth** — press **“Find radios”** and pick yours. If it is not listed, press **“Show all Bluetooth devices”**. The system may ask for a PIN: a radio without a screen usually uses `123456`, a radio with a screen shows it there.
- **Wi-Fi** — enter the radio address in your local network; MeshCore uses port `5000` by default.

> [!WARNING]
> Over Wi-Fi the app and the radio talk without encryption or a password. On a network you do not own, connect the radio over USB or Bluetooth.

The app remembers the last radio, so next time one **“Connect”** is enough. If the radio drops (the cable was pulled, the radio went out of Bluetooth range), the app tries to reconnect by itself.

## Contacts and announcements

Nodes learn about each other from announcements: a radio tells its neighbours its name and key. Nodes that announced themselves appear under “Contacts” on the Mesh networks page.

- **“Announce to neighbours”** — nodes that hear your radio directly will see you.
- **“Announce to the whole network”** — the announcement travels through repeaters. It takes more airtime, so use it sparingly.

If the radio adds nodes manually or its contact list is full, new nodes show up under “Discovered” — press **“Add”**. Without a contact, the radio cannot decrypt the node’s direct messages.

## Write a message

Press **“Message”** next to a contact — a chat opens in the messenger. New messages over the radio arrive in the messenger by themselves, with a sound and a notification, like ordinary ones.

Marks on your messages:

- `…` — the message is being sent;
- `✓` — the radio put it on the air;
- `✓✓` — the recipient’s radio confirmed receipt.

Without a confirmation, the app sends the message again, up to four attempts; the last one goes through the whole network in case the old path to the recipient is stale. If it never gets through, **“Retry”** appears.

## Long messages

A radio sends up to 160 bytes at a time. A Latin letter takes 1 byte, a Cyrillic one 2 and many others 3, so the limit in letters depends on the language. A counter next to the input shows what is left. A long message goes out in parts marked like “(1/3)”; a message that is too long cannot be sent — shorten it.

## Channels

Channels are the shared chats of the network. They are listed under “Channels” on the Mesh networks page; **“Open”** opens a channel in the messenger.

- **Public** — the network’s common channel: its key is known to everyone, anyone can read it.
- **“Hashtag channel”** — a topic channel like `#city`. Its key comes from its name, so it is public too: anyone who knows the name can read it.
- **“Private channel”** — for your own people. A random key is created; give it to the members in person (the **“Key”** button copies it) or paste a key someone gave you.

In a channel, the sender’s name is written by the sender’s radio and nobody checks it: anyone with the channel key can sign with someone else’s name.

## How private it is

Chats over radio are protected more weakly than [ordinary chats](chat-encryption.md):

- The radio itself encrypts and decrypts messages, not the app. The keys are stored on the radio, and anyone who connects to it can read them.
- MeshCore encrypts direct messages in a simple way: keys never change, and the authenticity check is short.
- Who writes to whom and when is visible on the air from the packets’ service fields.
- Public and hashtag channels are open to everyone.

That is why these chats have no Bastyon lock: the chat says how its messages are protected. For anything important, use ordinary chats when you have internet.

## Limitations

- The history lives only in the app: the radio hands a message over and forgets it. While the app is not connected, the radio keeps only the latest incoming messages in memory (usually 16) and loses them when switched off.
- Chats are tied to the account and to the radio: another account or another radio has its own.
- When you sign out, the history is deleted from the computer.
- For now, the MeshCore network is supported. Meshtastic and Reticulum are planned.

## See also

- [Chats](chats.md)
- [Chat encryption](chat-encryption.md)
- [Desktop app](desktop-app.md)
