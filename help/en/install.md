---
keywords: [install, download, macOS, Windows, Linux, Android, APK, iPhone]
---

# Installing the app

Where to download Bastyon NextGen for your computer and phone, and how to install it on macOS, Windows, Linux and Android.

## Which file to download

All versions are on the [releases page](https://github.com/Vakutaghin/bastyon-nextgen/releases) on GitHub. Open the latest release and pick the file for your system under Assets:

| System | File |
|---|---|
| macOS on Apple Silicon (M1 and newer) | `macOS-Bastyon-NextGen-…-Apple-Silicon.dmg` |
| macOS 10.15 or newer on Intel | `macOS-Bastyon-NextGen-…-Intel.dmg` |
| Windows 10 and 11 | `Windows-Bastyon-NextGen-…-x64.msi` |
| Linux, any distribution | `Linux-Bastyon-NextGen-…-x86_64.AppImage` |
| Linux based on Debian or Ubuntu | `Linux-Bastyon-NextGen-…-x86_64.deb` |
| Android 7 and newer | `Android-Bastyon-NextGen-….apk` |

You can see which processor your Mac has in Apple menu → "About This Mac": a line like "Apple M1" (M2, M3, M4) means Apple Silicon, "Intel Core" means Intel.

## macOS

1. Open the .dmg file and drag Bastyon NextGen into the Applications folder.
2. Launch the app. The first time, macOS blocks it: the app is not notarized by Apple.
3. Open System Settings → Privacy & Security, scroll down to the message about Bastyon NextGen and click "Open Anyway". The button stays there for about an hour after the launch attempt. On macOS 14 and earlier you can instead right-click the app and choose "Open".

If macOS says the app is damaged, run this in Terminal:

```
xattr -dr com.apple.quarantine "/Applications/Bastyon NextGen.app"
```

Later macOS will ask for access to the microphone and camera — it is needed for voice messages, [voice input](voice-input.md) and signing in with a QR code. Everything else works without it.

## Windows

Run the .msi file. SmartScreen may warn about an unknown publisher: click "More info" → "Run anyway".

## Linux

The AppImage works on any distribution. Make the file executable and run it:

```
chmod +x Linux-Bastyon-NextGen-*-x86_64.AppImage
./Linux-Bastyon-NextGen-*-x86_64.AppImage
```

The .deb package for Debian, Ubuntu and Linux Mint installs like this:

```
sudo apt install ./Linux-Bastyon-NextGen-*-x86_64.deb
```

The system tray icon needs the `libayatana-appindicator3-1` library: the .deb package suggests it by itself, and for the AppImage install it from your distribution's repository. Without it the app works, just without the icon.

## Android

1. Download the .apk file to your phone and open it.
2. Allow installing from this source — the phone offers the right setting itself.

> [!WARNING]
> A new Android version cannot be installed over the old one: the old one has to be removed first. Removing it also deletes the account keys from the phone. Before updating, make sure your recovery phrase is written down — see [Updates](updates.md).

## Without installing

Bastyon NextGen has no browser version at a public address yet, and there is no iPhone app. In any browser, including on an iPhone, you can use the previous Bastyon app at bastyon.com — with the same account.

## See also

- [Updates](updates.md)
- [Signing up](create-account.md)
- [The desktop app](desktop-app.md)
- [The phone app](mobile-app.md)
