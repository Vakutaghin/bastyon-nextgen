# v0.5.0 — A new look and what the testers wrote about

The whole app now wears the Nuxt UI look, and the release fixes what the first testers ran into: registration, a tray icon, the black window on Linux and the "damaged" app on macOS.

## A new look

- A new palette, the Geist font with Cyrillic, Lucide icons, clean borders, focus rings and overlays that fade in — in both the light and the dark theme.
- The light theme's accent is blue: white text on green buttons was hard to read. The dark theme stays green.
- Dropdowns — comment sorting, a post's language and visibility, the profile language, the transfer fee — follow the app's style instead of the system one.
- Empty sections show an icon and a caption. The Share menu has the real brand logos, with the X logo for Twitter.
- Player: the volume slider is visible in the dark theme, and the hotkeys panel follows the theme.

## Registration

- **A taken name shows up while you type it**, before the captcha rather than after it.
- **Retrying after the network refuses works.** A failed registration used to need a restart, and the retry ran into "iplimit". Now it reuses the same keys and does not ask for coins twice, and an unfinished registration can be resumed from the account menu: "Finish registration".
- When the network gives no coins to your IP, the app explains what to do instead of a bare "iplimit".
- Until the registration is confirmed, comments under posts are visible; the list used to be empty.

## Desktop

- **A tray icon** on Windows and Linux: its menu brings the window back or quits the app together with Tor and IPFS.
- **Linux:** the app no longer opens as a black window. That happened with NVIDIA graphics and in virtual machines, Linux Mint among others.
- **macOS:** the downloaded app is no longer "damaged". On first launch macOS asks you to allow it — the install instructions say how.
- The installers got smaller: an unused video encoder is gone from them. The macOS image, for one, is 13 MB instead of 21.

## Comments

- Line breaks survive sending, replies included.
- A long author name no longer stretches the row on phones.

## Settings

The old client's settings are back: embedded players, autoplay, link previews, the default comment order, turning the messenger off, animations, interface scale, launch at login and clearing the cache. The empty "Wallets" and "Accounts" tabs are gone: both live in their own places.

## Fixes

- A video continues from where it stopped again: 0.4.0 did not restore the position.
- Signing in with a private key in WIF form works. A copied key or 12-word phrase is wiped from the clipboard after a minute, if the app's window is still active.
- Posts, comments and ratings are no longer published twice when a node answers slowly.
- "New captcha" shows a captcha you can solve.
- Dates and all texts follow the interface language.
- The explorer opens a block by its number, and clicking around the page no longer throws errors.
- Enter in the tag field adds the typed tag rather than the first suggestion. A new profile name follows the same rules as at registration.
