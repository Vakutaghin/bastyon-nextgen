---
keywords:
  - accessibility
  - keyboard
  - screen reader
  - TalkBack
  - VoiceOver
  - NVDA
  - contrast
  - high contrast
  - large text
  - font size
  - zoom
  - reduce motion
---

# Accessibility

How to use Bastyon NextGen with a keyboard, a screen reader, larger text and higher contrast.

## Keyboard <!-- #keyboard -->

- **Tab** and **Shift+Tab** move between buttons, links and fields. The first Tab shows **“Skip to content”** in the top left corner: Enter takes you straight to the page content, past the header and the left panel.
- **Enter** or **Space** press what is selected: the header icons (notifications, downloads, Tor, IPFS, theme, account menu), a chat row, an image in a post, a category in the left panel.
- **Menus** open with the same keys, and the first item is selected at once. The up and down arrows, Home and End move between items, Enter picks an item, Esc closes the menu and returns to its button.
- **Star rating**: Tab selects the row of stars, the left and right arrows pick a star (it fills in), Enter or Space rates. A rating cannot be changed later, so the arrows do not rate.
- **The phone menu** (the three-line button) closes with Esc.
- Gestures have alternatives: swipe to reply — **“Reply”** in the message menu; long press to select — **“Select”**.

Other shortcuts are in [Keyboard shortcuts](keyboard-shortcuts.md).

## Screen reader <!-- #screen-reader -->

The app works with TalkBack on Android, VoiceOver on macOS, NVDA and Narrator on Windows, and Orca on Linux.

- **Notifications** at the bottom of the screen (“Copied”, “Sent” and others) are read out by the screen reader. Errors are read at once, the rest when it finishes what it is saying.
- **When you go to another page**, its name is read.
- **The number on an icon** is part of the button's name: “Messages, unread: 3”.
- **Page areas** have names: the header, “Sections and filters”, the page content, “Recommendations and comments”, “Messages”. Screen reader commands can jump between them.
- Buttons that show an icon instead of text have names: “Search”, “Chat actions”, “Back”, “Play” and others.

## Text size and zoom <!-- #zoom -->

- **On a computer** — **“Settings”** → **“System”** → **“Interface scale”** or Ctrl with + or −, see [Language and appearance](appearance.md).
- **On an Android phone** the app follows the font size from the system settings.
- **On the website in a phone browser** you can pinch to zoom the page.

## Contrast and motion <!-- #contrast -->

- **“High contrast”** — **“Settings”** → **“General”**. Grey text and borders get darker (lighter in the dark theme), and the outline around what the keyboard selects becomes solid and easy to see. If the system asks for more contrast, it turns on without the setting.
- **The dark theme** is in the same place, under **“Theme”**.
- **“Animations”** — **“Settings”** → **“System”**. If the system asks to reduce motion, scrolling to the top of the page or to an anchor happens without the smooth animation.

## What does not work everywhere yet <!-- #limits -->

- New messages in the open chat are not read out by themselves — move through the list to hear them.
- The seek and volume sliders in videos work only with a mouse or touch for now; videos are controlled with the keys in [Keyboard shortcuts](keyboard-shortcuts.md).
- The image viewer's buttons (next, previous, close) cannot be reached with Tab yet; use the arrow keys to browse and Esc to close.

If something does not work with the keyboard or a screen reader, tell us through [Report a bug](report-bug.md).

## See also

- [Keyboard shortcuts](keyboard-shortcuts.md)
- [Language and appearance](appearance.md)
- [Settings](settings.md)
