---
keywords: [desktop app, tray, autostart, macOS, Windows, Linux, data folder]
---

# The desktop app

What only the desktop version can do: the tray, autostart, scale, Tor, IPFS — and where it keeps its data.

## Desktop only

- [Tor](tor.md) — hide your IP address from nodes and chat servers;
- sharing files over [IPFS](ipfs.md) and [My files](my-files.md);
- [voice input](voice-input.md) — speech recognition on the computer itself;
- [compressing a video](video-compression.md) before upload;
- interface scale — see [Language and appearance](appearance.md).

## The window and the tray

The app opens where you left it and at the same size.

The window’s close button does not quit the app, it hides the window. Tor, the IPFS module, video uploads and the chat keep working, and new messages come with notifications.

- **macOS.** The Dock icon brings the window back. To quit the app, press **Cmd+Q** or choose “Quit” in the Dock icon’s menu.
- **Windows and Linux.** The window hides to the tray. Clicking the tray icon brings the window back, and the right-click menu has **“Open Bastyon”** and **“Quit”**. You can also quit with **Ctrl+Q**. If there is no tray — this happens on Linux without appindicator — the close button quits the app, as before.

When the app quits, Tor and the IPFS module stop: your files are no longer served.

The app cannot run twice: launching it again just brings up the window that is already running, even a hidden one. [bastyon:// links](deep-links.md) arrive there too.

## Autostart

**“Settings”** → **“System”** → **“Launch at login”** — the app opens by itself after the computer starts. Handy if you share files over IPFS. If the system does not allow it, the app says **“The system refused to change the autostart setting”**.

## Microphone and camera

The microphone is needed for [voice input](voice-input.md) and [voice messages](voice-messages.md), the camera to [sign in with a QR code](sign-in.md). On macOS the system asks for permission the first time. If you refused, turn access on in System Settings → Privacy & Security → Microphone or Camera.

## Where the data lives

Everything the app keeps on the computer is in its data folder:

- macOS: `~/Library/Application Support/com.bastyon.app`
- Windows: `%APPDATA%\com.bastyon.app`
- Linux: `~/.local/share/com.bastyon.app`

The Tor and IPFS programs and the voice input models are there too. What exactly is stored and how to remove everything is in [What is stored on your device](local-data.md).

## See also

- [The app and settings](app.md)
- [Tor](tor.md)
- [The IPFS module](ipfs-module.md)
- [Keyboard shortcuts](keyboard-shortcuts.md)
