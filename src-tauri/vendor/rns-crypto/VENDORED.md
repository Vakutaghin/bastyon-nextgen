# rns-crypto 0.1.8 с правкой

Исходник — `rns-crypto` 0.1.8 с crates.io (https://github.com/lelloman/rns-rs), лицензия — `LICENSE`
рядом. Подменяет версию с crates.io через `[patch.crates-io]` в `src-tauri/Cargo.toml`; версия та
же, потому что lxmf-rs закреплён на ней.

## Правка

**Ключ Ed25519 из сети не роняет узел** (`src/ed25519/mod.rs`, помечено `Bastyon`).

- В 0.1.8 `Ed25519PublicKey::from_bytes` делал `expect` на байтах, которые не являются точкой
  кривой. Так бывает примерно у половины случайных 32 байт.
- Ключ приходит из сети: rns-core проверяет announce через `Identity::from_public_key`
  (`announce.rs`, `validate`), то же при LINKIDENTIFY. Поэтому один announce с таким ключом
  ронял поток драйвера или проверки announce, и узел молча переставал работать — удалённый
  отказ в обслуживании.
- Теперь такой ключ не проходит ни одну проверку подписи: announce отбрасывается как
  неподписанный, как у Python RNS.

Сборка:

- `Cargo.toml` переписан: без тестов, бенчмарков и ESP-IDF.
- `build.rs` не нужен: версия из git нигде не используется.
- Предупреждения апстрима отключены (`[lints]`).

Проверка — тест `invalid_public_key_never_verifies` в `src/ed25519/mod.rs`:
`CARGO_TARGET_DIR=../../target cargo test --lib` из `src-tauri/vendor/rns-crypto`.
