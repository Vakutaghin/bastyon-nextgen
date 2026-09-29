---
keywords: [mesh, Meshtastic, MeshCore, LoRa, radio, without internet, offline chat, companion, region, preset, LongFast, node, node key, channel, channel link, hashtag channel, private channel]
---

# Chatting over radio (mesh)

How to connect a Meshtastic or MeshCore LoRa radio and chat through it with no internet or cell service — right in the messenger, next to your usual chats.

## What it is

A mesh network is made of radios that pass messages to each other along a chain. It needs no internet: a message travels through the air from radio to radio, over kilometres and further. Enthusiasts build such networks in and around cities, and people take them hiking or keep them for times when there is no signal.

Bastyon connects to your radio and shows the chats that go through it in the messenger, like ordinary chats, just marked with the network. Two networks are supported:

- **Meshtastic** — the most widespread one. Nodes pass each other's messages on, and direct messages are encrypted with node keys.
- **MeshCore** — messages travel through repeaters along a discovered path instead of going to everyone.

These are different networks: Meshtastic and MeshCore radios cannot hear each other. You can connect one radio of each network at the same time.

## What you need

- The desktop or Android app: a radio can be connected only there (not in a browser or on an iPhone).
- A LoRa radio with the firmware of the network you want. Common boards (Heltec, LilyGO, RAK and others) work; the firmware is installed with each project's web flasher.
  - **Meshtastic** — firmware 2.5 or newer (2.7 is best).
  - **MeshCore** — the companion firmware (USB, Bluetooth or Wi-Fi).
- To chat, there have to be other nodes of the same network nearby.

> [!NOTE]
> A radio keeps only one connection. If it is connected to the official app on a phone, Bastyon cannot connect to it — disconnect the phone first.

## Connect a radio

Account menu → **Mesh networks**. Pick the network tab — **Meshtastic** or **MeshCore** — and a way to connect:

- **USB** — plug the radio in with a cable and choose its port. If the port is missing, click **Refresh**. On Linux you need access to the port: add yourself to the `dialout` group and log in again.
- **Bluetooth** — click **Find radios** and pick yours. If it is not in the list, click **Show all Bluetooth devices**. The system may ask for a PIN: on radios without a screen it is usually `123456`; radios with a screen show it there.
- **Wi-Fi** — enter the radio's address on your local network. The default port is `4403` for Meshtastic and `5000` for MeshCore.

> [!WARNING]
> Over Wi-Fi the app and the radio talk without encryption or a password. On a network that is not yours, connect the radio over USB or Bluetooth.

On Android a radio connects the same ways: over Bluetooth, over USB through an OTG adapter (the system asks for permission to use the device) and over Wi-Fi. While a radio is connected, a "Radio connected" notification stays in the shade — this keeps Android from putting the app to sleep, so messages arrive even when it is in the background, and the phone notifies you of new ones. Disconnect the radio and the notification goes away.

The app remembers the last radio of each network, so next time one **Connect** button is enough. If the connection drops (the cable is pulled, the radio restarts or goes out of Bluetooth range), the app reconnects by itself.

## Meshtastic

### First setup: region and preset

A new Meshtastic radio stays silent until a **region** is chosen: it defines the frequencies and power allowed in your country. Without a region the page shows a warning. Choose your country in **Region** and click **Apply** — the radio restarts and reconnects.

The **preset** sets speed and range. Everyone you want to talk to must use the same one, usually `LongFast`.

The node name is changed there too: other nodes see the long name, and radio screens show the short one (up to 4 characters). The radio also restarts after a name change.

### Nodes and keys

The **Nodes** list shows everyone your radio has heard: the name, how many hops away the node is, when it was heard and its battery. Nodes marked "via the internet (MQTT)" came through an internet gateway, not over the radio.

Direct messages in Meshtastic are encrypted with the recipient's key, and the radio will not send one without it. A node shares its key itself, in its announcements (every few hours). If a node has no key yet (marked **no key**):

- the app asks the node for it when you send;
- you can click **Request key** on the page.

> [!NOTE]
> The firmware answers such requests from the same node at most once every 12 hours. If there is no answer, the key comes with the node's next announcement. The app remembers keys it has already seen and hands them to the radio when the radio has forgotten them.

### Meshtastic channels

- **Primary channel** (usually named after the preset, for example `LongFast`) — the shared channel of the network. Its key is known to everyone, so anyone can read it.
- **Private channel** — for your people. Enter a name and click **Create**: a random key is made. The **Link** button copies an invitation link `meshtastic.org/e/#…` that official Meshtastic apps understand too.
- **Add by link** — paste a channel link someone gave you.

A radio holds up to eight channels, the primary one included.

## MeshCore

### Contacts and announcements

MeshCore nodes learn about each other from announcements: a radio tells its neighbours its name and key. Nodes that announced themselves appear in **Contacts**.

- **Announce to neighbours** — nodes that hear your radio directly will see you.
- **Announce to the whole network** — the announcement goes through repeaters. It takes more airtime, so do not overuse it.

If the radio adds nodes manually or its contact list is full, new nodes appear under "Discovered" — click **Add**. Without a contact, the radio cannot decrypt that node's direct messages.

### MeshCore channels

- **Public** — the shared channel of the network: its key is known to everyone.
- **Hashtag channel** — a topic channel like `#city`. Its key is derived from the name, so it is open too.
- **Private channel** — the key is random; give it to members in person (the **Key** button copies it) or paste a key you were given.

## Writing

Click **Message** next to a node or contact, or **Open** next to a channel: the chat opens in the messenger. New messages over the radio arrive in the messenger by themselves, with a sound and a notification, like ordinary ones.

Marks on your messages:

- `…` — the message is being sent;
- `✓` — the radio sent it into the air;
- `✓✓` — in a direct chat: the recipient's radio confirmed delivery; in a Meshtastic channel: the message was heard and passed on.

An undelivered message is repeated automatically: by the radio in Meshtastic, and by the app in MeshCore, up to four attempts with the last one across the whole network. If it never gets through, **Retry** appears.

In Meshtastic you can reply to a message and react to it: the reply and the reaction go over the radio and show up in the official apps. MeshCore has neither.

## Long messages

A radio sends up to 200 bytes at a time in Meshtastic and up to 160 in MeshCore (in a MeshCore channel your name counts too). A Latin letter takes 1 byte, a Cyrillic one 2. The counter next to the input shows what is left. A long message goes out in parts marked like "(1/3)"; one that is too long cannot be sent — shorten it.

Meshtastic accepts at most one message every 2 seconds from the app, so parts of a long message go out with a short pause.

## How private it is

Chats over radio are less protected than [ordinary chats](chat-encryption.md):

- The radio itself encrypts and decrypts messages, not the app. The keys live on the radio, and anyone who connects to it can read them.
- Meshtastic direct messages are encrypted with node keys — sturdier than MeshCore, whose encryption is simple, with no key rotation and a short authenticity check.
- Who writes to whom and when can be seen in the air from the packet headers.
- The Meshtastic primary channel and the MeshCore Public and hashtag channels are open to everyone.
- Nobody checks the sender's name in a channel.

That is why these chats have no Bastyon lock: the chat says how the messages are protected. For anything important, use ordinary chats when there is internet.

## Limitations

- History is kept only in the app: the radio hands a message over and forgets it. While the app is not connected, the radio keeps only the latest incoming messages (up to 32 for Meshtastic, usually 16 for MeshCore) and loses them when switched off.
- Chats are tied to the account and to the radio: another account or another radio has its own.
- Signing out deletes this history from the computer.
- Reticulum is not supported yet — it is planned.

## See also

- [Chats](chats.md)
- [Chat encryption](chat-encryption.md)
- [Desktop app](desktop-app.md)
