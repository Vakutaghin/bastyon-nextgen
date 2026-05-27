# Аудит: разделение крупных файлов

> Изначальная дата: 2026-05-27. Часть пунктов выполнена в последующих сессиях, ниже — только то, что **не сделано**.

Базовые конвенции проекта (`.cursorrules`):
- стили — в `styled.ts(x)` рядом с компонентом;
- сторы — `store.js` рядом или именованный в `/src/stores/`;
- сложная логика — в composable `use-*.ts` рядом с компонентом;
- именованные экспорты везде, где возможно.

---

## P0 — Критично (>900 строк)

### 1. `src/blockchain/lib/pocketnet/modules/psbt.js` — **1435 строк**
Часть legacy bitcoinjs-lib, два класса (`Psbt` + `PsbtTransaction`) и ~35 утилит в одном файле.

**Разбить:**
- `psbt.js` — только класс `Psbt` (~250 строк)
- `psbt-transaction.js` — класс `PsbtTransaction` (~60)
- `psbt-validators.js` — `checkFees`, `checkInputsForPartialSig`, `checkPartialSigSighashes`, `checkScriptForPubkey`, `checkTxEmpty`, `checkTxForDupeIns`, `checkTxInputCache`, `checkCache`
- `psbt-finalizers.js` — `getFinalScripts`, `prepareFinalScripts`, `canFinalize`, `isFinalized`
- `psbt-signers.js` — `getHashAndSighashType`, `getHashForSig`, `getSignersFromHD`, `validateSignaturesOfInput`
- `psbt-script-utils.js` — `getMeaningfulScript`, `classifyScript`, `pubkeyInScript`, `getScriptFromInput`, `getScriptFromUtxo`, `redeemFromFinalScriptSig`, `redeemFromFinalWitnessScript`, `checkInvalidP2WSH`
- `psbt-witness-utils.js` — `scriptWitnessToWitnessStack`, `witnessStackToScriptWitness`, `inputFinalizeGetAmts`
- `psbt-payment-utils.js` — `getPayment`, `getSortedSigs`, `getPsigsFromInputFinalScripts`

⚠️ Перед правками — тесты на криптографию.

---

### 2. `src/b-components/content/post-card/components/post-card-comments/post-card-comments.ts` — **1320 строк**
Монолит с 13 подсистем: загрузка, голосование, ответы, форма, @mentions, видимость, edit/delete, WS realtime.

**Разбить на composables рядом:**
- `use-comments-loader.ts` (~150) — загрузка, refresh, pagination
- `use-comments-scoring.ts` (~120) — голосование, валидация
- `use-comments-replies.ts` (~80) — expand/collapse ответов
- `use-comment-form.ts` (~200) — форма + @mentions
- `use-comment-visibility.ts` (~60) — скрытые по репутации
- `use-comment-edit-delete.ts` (~100) — inline-edit, удаление
- `use-comments-ws.ts` (~80) — WS подписка, reconcile
- `helpers/comments-computed.ts` (~100) — sort/filter/mention мемоизация
- `helpers/pending-comments.ts` (~40) — конвертация pending → GetComment

Основной `post-card-comments.ts` → ~350 строк (lifecycle, template logic).

---

### 3. `src/blockchain/lib/pocketnet/modules/transaction_builder.js` — **1163 строк**
Класс `TransactionBuilder` + 12 утилит.

**Разбить:**
- `transaction-builder.js` — публичный API (addInput, addOutput, sign, build)
- `transaction-builder-prep.js` — `expandInput`, `expandOutput`, `prepareInput`
- `transaction-builder-sign.js` — `getSigningData`, `checkSignArgs`, `trySign`, `canSign`
- `transaction-builder-helpers.js` — `fixMultisigOrder`, `signatureHashType`, `build`, `tfMessage`, `txIsString`, `txIsTransaction`

> **Не путать** с `src/blockchain/core/transactions/transaction-builder.ts` (459) — это новая TS-обёртка над legacy lib. Слои разные, объединять не нужно. Добавить комментарии-маркеры «legacy lib copy» / «wrapper».

⚠️ Перед правками — тесты на криптографию.

---

### 4. `src/b-components/messenger/store/messenger-chat-store.ts` — **~1300 строк**
Pinia store с зашитым кешем дешифровки и групповой криптографией. (Файл вырос после миграции методов из удалённого `store.ts` — старый пункт #7.)

**Вынести:**
- `messenger/services/decryption-cache.ts` — Map `decryptedTextCache`, `hydrateDecryptedCache`, `purgeDecryptedCache`, IDB save/load
- `messenger/services/group-encryption.ts` — `computeGroupUsershash`, `findCommonKeyStateEvent`, `decryptGroupCommonKey`, `isGroupEncryptedContent`, `collectPcryptoUsers` (helpers)

`tryDecrypt` и `mapEventToMessage` оставить в сторе как ядро.

---

### 5. `src/helpers/api/request.ts` — **944 строки**
Смесь 5 доменов: Tauri/Tor, fetch-обёртки, RPC, HTTP-auth, типизированные хелперы.

**Разбить:**
- `request-tor.ts` — Tauri-детект, Tor-fetch
- `request-debug.ts` — `TorDebugEntry`, `TorDebugStats`, `ensureDebug`, getters, константа `TOR_DEBUG_RECENT_LIMIT`
- `fetch-strategies.ts` — `appFetch`, `matrixFetch`, `getTauriFetch`, routing
- `rpc-errors.ts` — `isTimeout`, `isLogicError`
- `rpc-retry.ts` — `retryWithBackoff`, server failures из JSON
- `request-signing.ts` — auth store import, подпись HTTP-параметров
- `types/request.ts` — `TorFetchRequest/Response`, `RpcOptions`, `T_RpcRequestParams`, `RpcRequestConfig`, `HttpRequestOptions`, `HttpRequestParams`

⚠️ Аккуратно из-за Tor/Tauri ветвлений и множества импортёров.

---

## P1 — Серьёзно (500–800 строк)

| Файл | Строк | Что вынести |
|---|---|---|
| `src/b-components/video-uploader/video-uploader.ts` | 648 | `video-formatter.ts` (size/duration), `useVideoTranscoderInit`, `useUploadState`, `useVideoManager` |
| `src/mini-apps/actions/host-context.ts` | 600 | Подпапка `host-context-methods/`: `auth.ts`, `rpc.ts`, `content.ts`, `payments.ts`, `media.ts`, `chat.ts` + `host-constants.ts` (`ARCHIVED_PEERTUBE_SERVERS`) + `host-device-utils.ts` (`detectDevice`, `browserGeolocation`) |
| `src/b-components/messenger/components/chat-room/chat-room.ts` | 521 | Вынести `formatDuration` в `helpers.ts` (дедупликация avatar/address с header-user / account-switcher уже сделана) |
| `src/b-components/messenger/store/messenger-store.ts` | 522 | `helpers/room-helpers.ts` (`findExistingRoomByAddress`, `resolveMatrixHost`) |
| `src/b-components/content/video-player/composables/use-video-hls.ts` | 471 | `services/video-player/hls-initializer.ts` (3 ветки: blob/HLS.js/Safari) + `hls-error-recovery.ts` |
| `src/stores/notifications-store.ts` | 451 | Остался `enricher` (батчи fetch'ей `getRelatedContent` / `getRelatedUsers` / `getRelatedComments`) — вынести в `notifications-enricher.ts`. Types/constants/mappers уже сделаны. |

**Без действий (по аудиту):**
- `src/b-components/messenger/services/matrix-service.ts` (805) — однородный синглтон, оставить
- `src/types/rpc-responses/get-hierarchical-strip.ts` (667) — плоский тип RPC, оставить
- `src/blockchain/store/auth-store.ts` (603) — фасад Pinia, оставить
- `src/b-components/messenger/components/audio-message/audio-message.ts` (497) — PIXI-специфика, оставить. `barCount = 64` → consts.

---

## P2 — Желательно (300–400 строк)

| Файл | Строк | Что вынести |
|---|---|---|
| `src/composables/use-user-queries.ts` | 399 | Разделить на `use-user-profile.ts` + `use-wallet-queries.ts` |
| `src/mini-apps/store/apps-store.ts` | 352 | `apps-installer.ts`, `apps-permission-sync.ts` |
| `src/mini-apps/core/bridge.ts` | 333 | `bridge-listeners.ts`, `bridge-rpc.ts`, `bridge-fetch.ts` |
| `src/blockchain/core/addresses/address-generator.ts` | 331 | `address-hash-utils.ts` (`localHash160/256`, `toBase58Check`, `toBech32`) |
| `src/b-components/content/video-player/video-player-manager.ts` | 322 | Опционально — `types/video-player-instance.ts` |

**Без действий:**
- `src/b-components/messenger/services/pcrypto.ts` (349) — чистый сервис, оставить
- `src/b-components/header/header-notifications/styled.ts` (335) — один компонент, оставить
- `src/b-components/video-uploader/transcoder/tauri-transcoder.ts` (339) — один класс, оставить
- `src/blockchain/ws/ws-service.ts` (328) — оставить
- `src/blockchain/core/keys/key-validator.ts` (323) — оставить

---

## Сквозные находки (что осталось)

1. **Дублирование avatar/address** между header-user / account-switcher / chat-room — **исправлено** (общий `extractAvatarFromProfile` в `@/helpers/common/profile-avatar.ts`).
2. **Константы внутри компонентов:**
   - `QUICK_REACTION_EMOJIS` — **вынесено** в `messenger/store/consts.ts`.
   - `NOTIFICATIONS_*_KEY` — **вынесено** в `notifications-constants.ts`.
   - `ARCHIVED_PEERTUBE_SERVERS` (mini-apps/host-context) — **не сделано**, ждёт расщепления host-context.ts.
3. **Inline types** в больших файлах:
   - `NotificationItem*` — **вынесено** в `notifications-types.ts`.
   - `RpcOptions*` (request.ts), `HostContext` (host-context.ts) — **не сделано**, ждут соответствующих P0/P1 пунктов.
4. **Legacy `lib/pocketnet/modules/`** — это копия Pocketnet bitcoinjs-lib. Рефакторим **с маркером** «legacy lib copy» при работе над P0 #1/#3, чтобы не путать с новым `core/`-слоем.
5. **/src/components/ vs /src/b-components/** — НЕ дубликат: базовые UI vs бизнес-компоненты. Структура правильная, не трогать.
6. **types/rpc-responses/get-*.ts** на 480–667 строк — плоские схемы RPC, корректно держать в одном файле.

---

## Рекомендуемый порядок работ

1. **Безопасные мелочи P2** (use-user-queries, bridge, apps-store, address-generator) — низкий риск.
2. **P1 мегакомпоненты** (`video-uploader.ts`, `host-context.ts`, `use-video-hls.ts`) — средняя сложность, без крипто.
3. **P0-2 post-card-comments.ts** — крупный, но setup-style, без блокчейна.
4. **P0-4 messenger-chat-store.ts** — decryption-cache + group-encryption.
5. **P0-5 helpers/api/request.ts** — последний P0, требует осторожности из-за Tor/Tauri.
6. **Legacy bitcoinjs** (`psbt.js`, `transaction_builder.js`) — отдельной волной, с тестами на криптографию.

---

## Метрики (после серии работ)

- Удалён дубликат `messenger/store.ts` (−2915 строк), функциональность мигрирована в `store/` структуру.
- Разбито в подмодули: video-player/styled (1056→6 файлов), post-card-comments/styled (768→6), settings-page.styled (493→6), notifications-store (637→4), storage-manager (613→4), use-infinite-feed (508→3), use-star-rating (449→4).
- Извлечены чистые helpers из header-user.ts, register-modal.ts, account-switcher.ts, header-notifications.ts, peertube-url.ts, video-player.ts.
- Исправлен тихий баг: `account-switcher.getAvatarUrl` использовал старый домен `bastyon.com` вместо `pocketnet.app`. Теперь все три места идут через каноничный `resolveImageUrl`.
- Исправлен тихий баг: `SORT_FILTER_MAP` в `filters-store-consts.ts` имел перепутанные значения для id=3/4 (рейтинг ↔ комментарии). Поправлены и константы, и тест.
- Файлов >900 строк осталось: **5** (P0).
