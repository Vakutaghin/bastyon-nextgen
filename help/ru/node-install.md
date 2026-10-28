---
keywords: [установка ноды, pocketcoind, deb, Docker, docker-compose, Windows, pocketnetcore, релиз, Ubuntu, Debian]
---

# Установка ноды

Как поставить Pocketnet Core: пакетом на Linux, в Docker или установщиком на Windows.

Официальная инструкция команды — [Full Node Guide](https://docs.bastyon.com/ru/guide/full-node/index_ru.html) на docs.bastyon.com. Здесь — то же самое с поправками на то, что изменилось и на чём спотыкаются операторы.

## Что скачать

Все версии — на [странице релизов pocketnet.core](https://github.com/pocketnetteam/pocketnet.core/releases). В каждом релизе:

| Файл | Что это |
|---|---|
| `pocketnetcore_<версия>_linux_x64_setup.deb` | пакет для Debian и Ubuntu: нода, `pocketcoin-cli` и кошелёк с окном `pocketcoin-qt` |
| `pocketnetcore_<версия>_linux_x64.tar.gz` | те же программы архивом, для других дистрибутивов |
| `pocketnetcore_<версия>_win_x64_setup.exe` | установщик для Windows |
| `…_daemon.bin` | только сама нода, один файл — их скачивает прежнее приложение Bastyon |

Сборки — только для 64-битных процессоров x86 (Intel и AMD); для ARM — Raspberry Pi, серверов на Ampere — ноду можно лишь собрать из исходников.

Для macOS последняя готовая сборка — 0.22.20, и она падает на блоке 3 806 251, см. [Правила сети и обновления](blockchain-rules.md#сбой-28-апреля-2026-года). Сборку 0.22.21 для macOS обещали выпустить позже. Пока её нет, на Mac ноду собирают из исходников или запускают в Docker; на Mac с Apple Silicon Docker запускает образ в эмуляции x86, и для постоянной работы это медленно.

## Linux: пакет .deb

Подходит для Ubuntu 20.04 и новее и Debian 11 и новее: программе нужна glibc 2.29. На Debian 13 есть сообщения, что нода из пакета зависает после запуска; если столкнулись — возьмите Docker.

1. Заведите отдельного пользователя для ноды — так она не получит лишних прав:

   ```
   sudo adduser --disabled-password pocketcoin
   ```

2. Скачайте пакет со страницы релизов и поставьте:

   ```
   sudo dpkg -i pocketnetcore_*_linux_x64_setup.deb
   ```

   Программы ставятся в `/usr/local/bin`: `pocketcoind` — нода, `pocketcoin-cli` — команды для неё, `pocketcoin-qt` — кошелёк с окном.

3. Создайте папку данных от имени этого пользователя и в ней настройки `pocketcoin.conf`, см. [Настройка pocketcoin.conf](node-config.md):

   ```
   sudo -u pocketcoin mkdir -p /home/pocketcoin/.pocketcoin
   sudo -u pocketcoin nano /home/pocketcoin/.pocketcoin/pocketcoin.conf
   ```

4. Пока нода не запущена, разверните [снапшот](node-sync.md) — иначе она будет синхронизироваться с нуля несколько дней.
5. Запустите ноду службой systemd — пример в статье [Обслуживание ноды](node-maintenance.md#автозапуск) — или для проверки вручную:

   ```
   sudo -u pocketcoin pocketcoind -datadir=/home/pocketcoin/.pocketcoin -daemon
   ```

6. Проверьте, что она работает:

   ```
   sudo -u pocketcoin pocketcoin-cli -datadir=/home/pocketcoin/.pocketcoin getblockchaininfo
   ```

   Пока нода загружает базу, она отвечает «Loading block index…» или «Verifying blocks…» — подождите несколько минут.

## Docker

Официальный образ — `pocketnetteam/pocketnet.core` на Docker Hub, у каждого релиза свой тег, например `0.22.21`. Внутри контейнера нода работает от пользователя `pocketcore` с UID 1000 и хранит данные в `/home/pocketcore/.pocketcoin`.

Пример `docker-compose.yml` на основе README ноды:

```
services:
  pocketnet.core:
    container_name: pocketnet.core
    image: pocketnetteam/pocketnet.core:0.22.21
    restart: unless-stopped
    # Дать ноде спокойно закрыть базы при остановке
    stop_grace_period: 10m
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
    volumes:
      - /srv/pocketcoin:/home/pocketcore/.pocketcoin
    ports:
      - 37070:37070
      # Управление нодой — только с этого сервера
      - 127.0.0.1:37071:37071
      # Публичный API и WebSocket, обычные и по TLS — для публичной ноды
      - 38081:38081
      - 38881:38881
      - 8087:8087
      - 8887:8887
    logging:
      driver: local
      options:
        max-size: 10m
        max-file: "3"
```

Папке данных на сервере нужен владелец с UID 1000, иначе нода в контейнере не сможет в неё писать и остановится с ошибкой `Failed saving settings file`:

```
sudo mkdir -p /srv/pocketcoin
sudo chown -R 1000:1000 /srv/pocketcoin
```

Запуск — `docker compose up -d`, команды ноде — `docker exec -it pocketnet.core pocketcoin-cli getblockchaininfo`.

> [!WARNING]
> В README ноды порт 37071 опубликован как `37071:37071`. Так он открыт всему интернету, и сетевой экран `ufw` этого не остановит: Docker обходит его правила. Публикуйте его только на `127.0.0.1` или не публикуйте вовсе — `docker exec` работает и без него.

Версию образа указывайте явно, а не `latest`: так обновление происходит, когда вы этого хотите, см. [Обслуживание ноды](node-maintenance.md#обновление).

## Windows

Запустите `pocketnetcore_<версия>_win_x64_setup.exe` и пройдите установщик. Сверьте контрольную сумму файла с указанной в релизе: команда просит скачивать ноду только со своей страницы на GitHub. При первом запуске кошелёк с окном спросит, где хранить блокчейн; по умолчанию это `%APPDATA%\Pocketcoin`. Положите туда же [снапшот](node-sync.md) до первого запуска.

Добавьте папку данных в исключения Защитника Windows: иначе он держит файлы базы открытыми, и нода падает с ошибкой файловой системы.

Windows-компьютер для ноды должен работать круглосуточно и не засыпать: в настройках электропитания выключите сон, а обновления Windows настройте так, чтобы они не перезагружали компьютер без спроса.

## Прежнее приложение Bastyon

В прежнем приложении Bastyon для компьютера (Windows и Linux) есть раздел «Нода» — в официальной документации он называется Easy Node. Приложение само скачивает ноду и снапшот, показывает синхронизацию и стейкинг, позволяет внести и вывести монеты. Папку данных выбирайте на SSD и с путём только из латинских букв. Это самый простой путь для домашнего компьютера, но нода работает, только пока открыто приложение. В Bastyon NextGen такого раздела нет.

## Из исходников

Инструкции для Linux, macOS и Windows — в папке [doc](https://github.com/pocketnetteam/pocketnet.core/tree/master/doc) репозитория: `build-unix.md`, `build-osx.md`, `build-windows.md`.

## См. также

- [Первая синхронизация и снапшот](node-sync.md)
- [Настройка pocketcoin.conf](node-config.md)
- [Стейкинг на своей ноде](node-staking.md)
