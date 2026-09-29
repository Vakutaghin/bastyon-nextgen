# rns-net 0.5.10 с правками

Исходник — `rns-net` 0.5.10 с crates.io (https://github.com/lelloman/rns-rs), лицензия — `LICENSE`
рядом. Подменяет версию с crates.io через `[patch.crates-io]` в `src-tauri/Cargo.toml`.

Почему не обновиться: lxmf-rs (коммит `e84fe34`) закреплён ровно на rns-net 0.5.10, а в 0.7
исправлено то, без чего не работают ресурсы с Python RNS. Эти исправления перенесены сюда.
Когда lxmf-rs выйдет на новом rns-net, копию можно удалить вместе с `[patch.crates-io]`.

Каждое место правки помечено комментарием `Bastyon`.

## Правки

1. **Доказательство ресурса — PROOF-пакет с открытыми данными** (`src/common/link_manager.rs`:
   `process_resource_actions`, `SendProof`; приём — `handle_local_delivery`). Так его шлёт и ждёт
   Python RNS. В 0.5.10 доказательство уходило шифрованным DATA-пакетом: Python его не видел,
   ресурс у него не завершался. Из-за этого следующий ресурс на том же Link вставал в очередь
   навсегда, а отправитель большого сообщения не узнавал о доставке. Приём шифрованного DATA
   оставлен для узлов на 0.5.10.
2. **Keepalive как у Python** (`tick`, приём `CONTEXT_KEEPALIVE`). Инициатор шлёт `0xFF`,
   отвечающая сторона отвечает `0xFE`. В 0.5.10 обе стороны слали пустой пакет, а Python
   выбрасывает его как битый кадр. Без входящего трафика Python закрывал Link через ~15 с
   на быстрой связи.
3. **Ответ-файл** (`handle_resource_part`, `handle_response_resource`). NomadNet отдаёт
   `/file/…` ресурсом с метаданными `{"name": …}`, а данные идут сырыми байтами, не msgpack
   `[request_id, ответ]`. В 0.5.10 такой ответ молча выбрасывался. Теперь его опознаёт
   request_id из объявления ресурса, и ответ отдаётся как msgpack Bin, как в 0.7.

4. **Windows.** В апстриме rns-net собирался только под unix. Теперь:
   - последовательный порт (`serial.rs`, RNode, KISS, Serial) — только unix: к признакам
     `iface-*` добавлено `unix`;
   - опции TCP (`interface/tcp.rs`) на Windows ставятся через socket2 — NODELAY и keepalive 5 с /
     2 с; счётчик проб и TCP_USER_TIMEOUT Windows не даёт настроить;
   - AutoInterface (`interface/auto.rs`): список адаптеров — через `GetAdaptersAddresses`, а не
     `getifaddrs`, берутся поднятые, не петля и не туннель, с адресом fe80::/10; интерфейс
     multicast — через socket2 на всех платформах;
   - bzip2 — на чистом Rust (`libbz2-rs-sys`), чтобы сборке не нужен был C-тулчейн (Windows,
     Android).

   Проверено: `cargo check`/`clippy -p bastyon-rns --target x86_64-pc-windows-msvc` проходят.
   На самой Windows не запускалось — это проверит релизная сборка в CI и `MANUAL_CHECKS.md`.

Сборка:

- `Cargo.toml` переписан: без примеров, бенчмарков и интеграционных тестов;
  `rns-core`/`rns-crypto` закреплены на версиях, под которые собран lxmf-rs.
- Предупреждения апстрима отключены (`[lints]`).
- `build.rs` не нужен: версия из git нигде не используется.

## Проверка

- Сверка с Python RNS 1.5.4 + LXMF 1.1.1 — игнорируемые тесты `interop` в
  `crates/bastyon-rns` (рецепт — в комментарии к модулю):
  - файлы NomadNet;
  - большие вложения в обе стороны со статусом «доставлено».
- Собственные тесты rns-net: `CARGO_TARGET_DIR=../../target cargo test --lib` из
  `src-tauri/vendor/rns-net`.
  - В апстриме они собирались только под Linux; две правки для macOS (импорт в `driver.rs`
    и `_port` в тесте `local.rs`) помечены `Bastyon`.
  - Новые тесты на правки 1 и 2: `test_resource_proof_is_plain_proof_packet` и
    `test_keepalive_probe_and_reply_match_python`.
  - На macOS падают пять платформенных тестов, они не зависят от правок: `tcp::socket_options`
    (TCP_NODELAY = 4), три `tcp_server` и `serial::config_baud_rates`.
