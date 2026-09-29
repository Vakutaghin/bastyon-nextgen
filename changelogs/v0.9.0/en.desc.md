# v0.9.0 — Chats without the internet, the whole draft and instant mentions

An ordinary Bastyon chat now carries on over mesh networks when the internet goes down: over Reticulum, MeshCore or Meshtastic radios. Reticulum also arrived on Windows, and its chats got voice messages, NomadNet files and a network overview. Posts with images publish again, the post draft keeps everything, and mention suggestions appear at once.

## Posts

- **Posts with images publish again.** About two publications in three failed with "peertube_image_token_400": the image server the network picked did not let the shared upload account in. Now the app takes another server. If an image still fails to upload, you get a clear message instead of a code.
- **The draft keeps everything:** the text, tags, images, poll, title, visibility, language, publishing time, the article and an uploaded video. Closed the window — everything is there the next time. The draft is kept on this device, separately for each account, and is removed when you sign out.
- **The "Clear" button** next to "Publish" wipes the draft, asking first.
- **Mentions are suggested at once.** After "@" the people you follow and people from the feed appear, and letters narrow the list. From two letters on the app also searches the whole network; while it searches, the list says "Searching…". Before, the list took several seconds to appear, and it seemed there were no suggestions. Now it only has people whose name contains what you typed.

## Mesh networks: a Bastyon chat without the internet

- **One chat, several routes.** In an ordinary chat, "My mesh addresses" in the 📎 menu sends your Reticulum, MeshCore and Meshtastic addresses, signed with the account key. The other person's app checks the signatures and remembers the routes. With no internet or the chat server unreachable, messages go over a mesh network by themselves: over Reticulum with end-to-end encryption first, otherwise over a radio. Replies come to the same chat marked 📡, and the "Via the mesh" button sends that way even while online.
- **Reticulum on Windows** — over community hubs and the local network. An RNode over USB does not connect on Windows yet.
- **Voice messages in Reticulum chats:** the 🎤 button records in the Sideband format, and voice messages from Sideband and MeshChat play right in the chat.
- **Files from NomadNet nodes download:** you see how much has arrived, then the system asks where to save the file.
- **Network overview:** the "Network" card on the Reticulum tab shows a graph of your node's paths and a list of all of them.
- **More reliable:** an announce with a malformed key from the network no longer stops the Reticulum node. Big messages and attachments exchanged with Sideband and NomadNet reach "delivered", and the link to their nodes no longer drops after 15 seconds.
- As before, mesh networks were tested against software nodes, not yet with real radios. If something does not work, please report a bug.

## Android

- **The update from 0.8.0 installs over the old version**, without removing it. If the phone has 0.7.1 or an earlier version, you need to remove it one last time. Before removing it, make sure your recovery phrase is written down: the account keys are removed with the app.
