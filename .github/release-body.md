## Какой файл скачать

| Система | Файл |
| --- | --- |
| macOS на Apple Silicon (M1 и новее) | `macOS-Bastyon-NextGen-__VERSION__-Apple-Silicon.dmg` |
| macOS на Intel | `macOS-Bastyon-NextGen-__VERSION__-Intel.dmg` |
| Windows 10 и 11 | `Windows-Bastyon-NextGen-__VERSION__-x64.msi` |
| Linux, любой дистрибутив | `Linux-Bastyon-NextGen-__VERSION__-x86_64.AppImage` |
| Linux на базе Debian или Ubuntu | `Linux-Bastyon-NextGen-__VERSION__-x86_64.deb` |
| Android 7 и новее | `Android-Bastyon-NextGen-__VERSION__.apk` |

Не знаете, какой процессор у вашего Mac: меню Apple → «Об этом Mac». Строка вида «Apple M1/M2/M3/M4» означает Apple Silicon, «Intel Core» — Intel.

### Как установить

**macOS.** Откройте .dmg и перетащите приложение в «Программы». Приложение не нотаризовано в Apple, поэтому первый запуск macOS заблокирует. Откройте «Системные настройки» → «Конфиденциальность и безопасность», прокрутите до сообщения «Файл „Bastyon NextGen“ заблокирован для защиты Вашего Mac», нажмите «Все равно открыть» и подтвердите паролем. Кнопка видна около часа после попытки запуска. На macOS 14 и старше вместо этого можно нажать на приложение правой кнопкой и выбрать «Открыть». Если macOS пишет, что приложение повреждено, выполните в Терминале:

```
xattr -dr com.apple.quarantine "/Applications/Bastyon NextGen.app"
```

**Windows.** Запустите .msi. SmartScreen предупредит о неизвестном издателе: «Подробнее» → «Выполнить в любом случае».

**Linux.** AppImage сделайте исполняемым и запустите:

```
chmod +x Linux-Bastyon-NextGen-__VERSION__-x86_64.AppImage
./Linux-Bastyon-NextGen-__VERSION__-x86_64.AppImage
```

Пакет .deb ставится так:

```
sudo apt install ./Linux-Bastyon-NextGen-__VERSION__-x86_64.deb
```

**Android.** Понадобится разрешить установку из этого источника. APK подписан отладочным ключом, поэтому поверх предыдущей версии он не встанет: сначала удалите старую, потом поставьте новую.

### Об обновлениях

Начиная с версии 0.3.0 приложение само раз в сутки проверяет релизы здесь и предлагает перейти за новой версией. На десктопе новая версия ставится поверх старой, на Android — с удалением предыдущей.

---

## Which file to download

| System | File |
| --- | --- |
| macOS on Apple Silicon (M1 and newer) | `macOS-Bastyon-NextGen-__VERSION__-Apple-Silicon.dmg` |
| macOS on Intel | `macOS-Bastyon-NextGen-__VERSION__-Intel.dmg` |
| Windows 10 and 11 | `Windows-Bastyon-NextGen-__VERSION__-x64.msi` |
| Linux, any distribution | `Linux-Bastyon-NextGen-__VERSION__-x86_64.AppImage` |
| Linux based on Debian or Ubuntu | `Linux-Bastyon-NextGen-__VERSION__-x86_64.deb` |
| Android 7 and newer | `Android-Bastyon-NextGen-__VERSION__.apk` |

Not sure which processor your Mac has: Apple menu → "About This Mac". A line like "Apple M1/M2/M3/M4" means Apple Silicon, "Intel Core" means Intel.

### How to install

**macOS.** Open the .dmg and drag the app into Applications. The app is not notarized by Apple, so macOS blocks the first launch. Open System Settings → Privacy & Security, scroll down to "“Bastyon NextGen” was blocked to protect your Mac", click "Open Anyway" and confirm with your password. The button stays there for about an hour after the launch attempt. On macOS 14 and earlier you can instead right-click the app and choose "Open". If macOS says the app is damaged, run in Terminal:

```
xattr -dr com.apple.quarantine "/Applications/Bastyon NextGen.app"
```

**Windows.** Run the .msi. SmartScreen will warn about an unknown publisher: "More info" → "Run anyway".

**Linux.** Make the AppImage executable and run it:

```
chmod +x Linux-Bastyon-NextGen-__VERSION__-x86_64.AppImage
./Linux-Bastyon-NextGen-__VERSION__-x86_64.AppImage
```

The .deb package installs like this:

```
sudo apt install ./Linux-Bastyon-NextGen-__VERSION__-x86_64.deb
```

**Android.** You will need to allow installation from this source. The APK is signed with a debug key, so it will not install over a previous version: remove the old one first, then install the new one.

### About updates

Starting with 0.3.0 the app checks the releases here once a day and offers to come and get a newer version. On desktop a new version installs over the old one; on Android the previous one has to be removed first.
