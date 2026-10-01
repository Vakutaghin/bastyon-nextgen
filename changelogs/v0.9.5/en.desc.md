# v0.9.5 — Starts where it would not open before

Versions 0.9.0–0.9.4 for Apple Silicon Macs did not start on a Mac without Homebrew. On Windows without the Visual C++ package the app did not open either. Both are fixed. The app also works on macOS 10.15 now and wherever the built-in web engine is old. If your computer has 0.9.4, the “Update” button installs this version (except the .deb package).

## Desktop

- **Apple Silicon Macs.** Versions 0.9.0–0.9.4 quit right after launch on a Mac without Homebrew: the app looked for one of its libraries. Now it needs only what macOS has. If earlier versions did not open for you, install this one by hand from the release page on GitHub.
- **Windows without the Visual C++ package.** The app did not start, and Windows said MSVCP140.dll was not found. Everything it needs is inside the app now; the Microsoft Visual C++ Redistributable package is not needed.
- **macOS 10.15.** On Intel Macs with macOS 10.15 the app window stayed blank. The app now works with Safari 15, the last version for 10.15. You can update Safari in System Preferences → Software Update.
- **Windows 8.1** is not officially supported, but the app may work on it if system updates and Microsoft Edge WebView2 are installed.

## Old web engines

- **Chats on old engines.** On engines older than Safari 17.4 and Chrome 119, pictures and files were not sent to a chat, and after a dropped connection chats stopped updating until a restart. This happened on macOS 11, Windows 8.1 and Android with an old Android System WebView. Fixed.
- **If the engine is too old,** you see a “The app could not start” screen instead of a blank window, with what to update: Safari, Android System WebView or Microsoft Edge WebView2.

## Help

- “Installing the app” says what to do if the app does not start: on macOS 10.15, on Windows with the MSVCP140.dll error, and on Android.
