# Аудит: разделение крупных файлов

> Все пункты аудита 2026-05-27 закрыты. Файл оставлен как справочник по «оставленным как есть» решениям.

## Оставленные как есть (по аудиту)

P1:
- `src/b-components/messenger/services/matrix-service.ts` (805) — однородный синглтон.
- `src/types/rpc-responses/get-hierarchical-strip.ts` (667) — плоский тип RPC.
- `src/blockchain/store/auth-store.ts` (603) — фасад Pinia.
- `src/b-components/messenger/components/audio-message/audio-message.ts` (497) — PIXI-специфика. `barCount = 64` → consts.
- `src/b-components/messenger/store/messenger-chat-store.ts` (1401) — ядро (`tryDecrypt`, `mapEventToMessage`, send-методы) не делится дальше per audit.

P2:
- `src/b-components/messenger/services/pcrypto.ts` (349) — чистый сервис.
- `src/b-components/header/header-notifications/styled.ts` (335) — один компонент.
- `src/b-components/video-uploader/transcoder/tauri-transcoder.ts` (339) — один класс.
- `src/blockchain/ws/ws-service.ts` (328).
- `src/blockchain/core/keys/key-validator.ts` (323).

Не дубликаты:
- `/src/components/` vs `/src/b-components/` — базовые UI vs бизнес-компоненты.
- `types/rpc-responses/get-*.ts` (480–667 строк) — плоские схемы RPC, корректно в одном файле.
