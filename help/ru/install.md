---
keywords: [установка, скачать, macOS, Windows, Linux, Android, APK, iPhone]
platforms: [desktop, mobile]
code: [.github/release-body.md, src-tauri/tauri.conf.json]
---

# Установка приложения

Где скачать Bastyon NextGen для компьютера и телефона и как установить его на macOS, Windows, Linux и Android.

## Какой файл скачать

Все версии лежат на [странице релизов](https://github.com/Vakutaghin/bastyon-nextgen/releases) на GitHub. Откройте последний релиз и в разделе Assets выберите файл для своей системы:

| Система | Файл |
|---|---|
| macOS на Apple Silicon (M1 и новее) | `macOS-Bastyon-NextGen-…-Apple-Silicon.dmg` |
| macOS 10.15 и новее на Intel | `macOS-Bastyon-NextGen-…-Intel.dmg` |
| Windows 10 и 11 | `Windows-Bastyon-NextGen-…-x64.msi` |
| Linux, любой дистрибутив | `Linux-Bastyon-NextGen-…-x86_64.AppImage` |
| Linux на базе Debian или Ubuntu | `Linux-Bastyon-NextGen-…-x86_64.deb` |
| Android 7 и новее | `Android-Bastyon-NextGen-….apk` |

Какой процессор у вашего Mac, видно в меню Apple → «Об этом Mac»: строка «Apple M1» (M2, M3, M4) означает Apple Silicon, «Intel Core» — Intel.

## macOS

1. Откройте файл .dmg и перетащите Bastyon NextGen в папку «Программы».
2. Запустите приложение. В первый раз macOS его заблокирует: приложение не нотаризовано в Apple.
3. Откройте «Системные настройки» → «Конфиденциальность и безопасность», прокрутите до сообщения о Bastyon NextGen и нажмите «Всё равно открыть». Кнопка видна около часа после попытки запуска. На macOS 14 и старше вместо этого можно нажать на приложение правой кнопкой и выбрать «Открыть».

Если macOS пишет, что приложение повреждено, выполните в Терминале:

```
xattr -dr com.apple.quarantine "/Applications/Bastyon NextGen.app"
```

Позже macOS спросит доступ к микрофону и камере — он нужен для голосовых сообщений, [голосового ввода](voice-input.md) и входа по QR-коду. Без него остальное работает.

## Windows

Запустите файл .msi. Фильтр SmartScreen может предупредить о неизвестном издателе: нажмите «Подробнее» → «Выполнить в любом случае».

## Linux

AppImage работает в любом дистрибутиве. Сделайте файл исполняемым и запустите:

```
chmod +x Linux-Bastyon-NextGen-*-x86_64.AppImage
./Linux-Bastyon-NextGen-*-x86_64.AppImage
```

Пакет .deb для Debian, Ubuntu и Linux Mint ставится так:

```
sudo apt install ./Linux-Bastyon-NextGen-*-x86_64.deb
```

Для значка в системном трее нужна библиотека `libayatana-appindicator3-1`: пакет .deb предлагает её сам, для AppImage поставьте её из репозитория дистрибутива. Без неё приложение работает, но без значка.

## Android

1. Скачайте файл .apk на телефон и откройте его.
2. Разрешите установку из этого источника — телефон сам предложит нужную настройку.

> [!WARNING]
> Новую версию для Android нельзя поставить поверх старой: сначала старую нужно удалить. Вместе с ней с телефона удалятся ключи аккаунтов. Перед обновлением убедитесь, что фраза восстановления записана, — см. [Обновления](updates.md).

## Без установки

У Bastyon NextGen пока нет версии в браузере с общим адресом, а приложения для iPhone нет. В любом браузере, в том числе на iPhone, можно пользоваться прежним приложением Bastyon на сайте bastyon.com — с тем же аккаунтом.

## См. также

- [Обновления](updates.md)
- [Регистрация](create-account.md)
- [Приложение для компьютера](desktop-app.md)
- [Приложение для телефона](mobile-app.md)
