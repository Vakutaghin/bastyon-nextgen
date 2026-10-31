# v0.24.1 — Covers in Media Studio and replies on the phone

Fixes after 0.24.0. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Fixes

- **The cover in the Media Studio list.** If you uploaded a video on the Media Studio page, the list showed the frame the video server picked itself, or an empty spot, instead of the cover you chose, until the page was refreshed. The server got the cover right; the list was read before the cover arrived. Now the list refreshes once the cover is saved and shows it.
- **Comment replies on the phone.** The buttons under a comment no longer break onto two lines, and the counts sit next to the thumbs. Replies run along a thin thread line with small avatars instead of a nested card, and “Replies (N)” has its own line. The reply field now spans almost the whole screen width, with the emoji, cancel and send buttons below it.
