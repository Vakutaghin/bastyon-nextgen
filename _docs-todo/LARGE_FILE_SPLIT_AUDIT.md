# Large-file split audit

_Дата: 2026-08-08 · Метод: по агенту на каждый код-файл ≥ 410 строк (читает файл целиком, предлагает разбивку с учётом конвенций проекта), затем адверсариальный синтез с отсевом «резать ради строк». 22 файла._

## Главный вывод

Проблема почти нигде не в размере как таковом. Настоящая ценность разбиения — в том, что оно **вскрывает дублирование, мёртвый код и непокрытую тестами blockchain/security-логику**. Самые ценные пункты — не самые большие файлы, а те, где split заодно чинит дубликат/баг или разблокирует юнит-тесты для критичной логики.

Из 22 файлов: ~15 имеют реальный шов (тестируемость / переиспользование / фикс), 4–5 — выравнивание под конвенцию с умеренной пользой, 2 (`peertube-upload`, `video-player`) — почти «split ради строк» (см. «Что НЕ резать»).

**Исключены из аудита** как неприменимые к «логическому разбиению»: словари локалей `ru.ts`/`en.ts` (1585), типы RPC-ответов `get-hierarchical-strip.ts` (667) / `get-top-feed.ts` (480), данные `emoji-list.ts` (613), контент `info-pages.ts` (553). Их при желании можно резать по доменам, но это другой класс задачи.

---

## Quick wins — сделать первыми (низкий риск, часть чинит реальные баги)

| Файл | Действие | Почему важно |
|------|----------|--------------|
| `composables/use-feed.ts` | Удалить пере-инлайненные `safeDecode`/`normalizeImages`, подключить `use-feed-helpers` | **Фикс бага**: у инлайн-копии дрейф `+`→`%20` / `item.src` vs протестированная версия. Проверить против `use-feed-helpers.test.ts` |
| `content/post-card/post-card.vue` | Удалить мёртвые `handleLike/handleComment/handleShare/getInitial` (за `void`) | Чистое вычитание. `handleRatingChange` (пустой) **не трогать** — комментарий несущий |
| `messenger/.../message-item.vue` | Удалить мёртвый `onAudioError` (~85 строк, только `void`-ссылка) | −85 строк без риска |
| `wallets-page/wallet-transfer/wallet-transfer.vue` | Подключить уже отгруженные, но неиспользуемые `helpers.ts`/`consts.ts` | Убирает дубли (`looksLikeAddress`, debounce, regex, error-строки) |
| `video-player/composables/use-video-hls.ts` | Вынести чистый `resolvePlayerErrorMessage` в `helpers` | ~20 строк, тестируемо, 0 влияния на потребителей |
| `header/header-notifications/header-notifications.vue` | Вынести классификатор ссылок (open-redirect guard, P1-5) в чистый хелпер | **Делает security-логику юнит-тестируемой** без монтирования компонента |
| `messenger/services/matrix-service.ts` | Вынести content-builder'ы в `messaging.ts` (по образцу `media-sender.ts`, `client` первым аргументом) | Публичный API не меняется, 0 churn |

---

## Приоритизированный бэклог разбиений (высокий ROI сверху)

| # | Файл | LOC | Eff | Что извлечь |
|---|------|-----|-----|-------------|
| 1 | `blockchain/core/transactions/transaction-builder.ts` | 446 | M | `btc17-loader` + `build-content-transaction` + `build-transfer-transaction`, сам файл — barrel (18 call-site'ов и тесты не меняются). Blockchain-critical, чистый DAG |
| 2 | `blockchain/store/auth-store.ts` | 715 | M | Только `_restoreSessionImpl` + in-flight dedup → `restore-session.ts` (~145 строк boot-логики). Фасад-прокси **не трогать** |
| 3 | `blockchain/storage/vault/crypto-vault.ts` | 610 | M | Два чистых localStorage-адаптера: `vault-envelope-store` + `vault-attempts`. Security-critical, тестируемо |
| 4 | `messenger/.../message-item.vue` | 517 | M | После удаления мёртвого кода — плавающий reaction-picker (~180 строк DOM/lifecycle) → `use-reaction-picker` |
| 5 | `header/register-modal/register-modal.vue` | 465 | M | Vue-free `sendTransactionInBackground` (~88) в хелпер + abort/resume-машина в `use-registration-flow`. Впервые делает tx-путь тестируемым |
| 6 | `stores/notifications-store.ts` | 422 | M | 148-строчный `init` (fetch+retry+timeout) → чистый `fetchMissedNotifications`; settings-I/O → `notifications-settings` |
| 7 | `wallets-page/wallet-transfer/wallet-transfer.vue` | 452 | M | Send/receive → composables (`use-receiver-search` / `use-send-transfer` / `use-receive-address`) |
| 8 | `wallets-page/wallets-page.vue` | 543 | M | Вкладку «Балансы» сделать саб-компонентом (как все соседние вкладки) + `use-wallet-balances` + чистый `parse-tx-unspent` |
| 9 | `messenger/store/messenger-store.ts` | 703 | M | `mapRoomToDialog` (~150) и блок Matrix-listeners (~115) как фабрики (паттерн уже доказан в `messenger-chat-store`) |
| 10 | `.../post-card-comments/composables/use-comment-form.ts` | 454 | M | `@mention`-автокомплит + оптимистичный `sendReply` + draft-storage |
| 11 | `content/post-card/post-card.vue` | 545 | M | После мёртвого кода/дублей — `use-post-delete` / `use-post-media` / `use-post-share` + `post-card.types.ts` |
| 12 | `content/post-composer/use-post-composer.ts` | 416 | M | tags / poll / video-url бандлы + чистый draft-хелпер; ядро mode/publish оставить |
| 13 | `profile/profile-sidebar/profile-sidebar.vue` | 420 | M | relations-actions (subscribe/bell/block+toasts) → composable; escape+linkify → чистый хелпер |
| 14 | `.../post-card-comments/post-card-comments.vue` | 704 | M | Уже хорошо скомпонован (7 composables). Только deep-link, menu-actions, display-formatters. `sortedComments` **не трогать** (getter-proxy hack) |

---

## Сквозные паттерны (системное, не про размер)

1. **Пере-инлайненные хелперы/константы, которые уже были вынесены и покрыты тестами** — доминирующий смелл, и он прячет баги:
   - `use-feed.ts` → `safeDecode`/`normalizeImages` (drift `+`→`%20` / `item.src`)
   - `post-card.vue` → `decodeUrlEncoded`/`calculateAverageRating` (есть в sibling `helpers.ts`)
   - `wallet-transfer.vue` → `looksLikeAddress` + значения из `consts.ts`
   - `notifications-store.ts` → `isRetryableError` + `MAX_RETRIES`/`BATCH_LIMIT`
   - `message-item.vue` → константы из `consts.ts`
2. **Мёртвый код за `void`-подавлением** — `post-card.vue`, `message-item.vue`. Удалять до любого разбиения (чистое вычитание, ~0 риска).
3. **Vue-free blockchain/tx-логика зашита в `.vue`-скрипты** → невозможно юнит-тестировать (`register-modal` `sendTransactionInBackground`, `wallet-transfer` `doSend`, `post-card` media/delete). Лечение везде: «передавать `authStore`/keys/address аргументами, а не импортировать стор».
4. **Чистые localStorage-адаптеры вплавлены в реактивных владельцев** (5 файлов: crypto-vault, peertube-upload, use-post-composer, use-comment-form, notifications-store) — единый паттерн «persistence adapter».
5. **Оптимистичный lifecycle сообщения** (`addPending → temp push → send → replacePendingId/rollback + revokeObjectURL`) переписан на каждом call-site (use-comment-form, use-media-sending ×4, messenger-сторы) — кандидат на общий примитив (отдельный follow-up).
6. **Тройной параллельный `AdaptedPost`**: `use-feed.ts` ⟂ `helpers/common/post-mapper.ts` — извлекать типы в отдельный файл **только вместе с назначением одного канонического контракта**, иначе дрейф усилится.
7. **`$el`/template-ref plumbing** — повторяющийся хазард почти в каждом UI-split (reaction-picker, mention-menu, video quality-menu, chat-composer, styled-refs video-player). Любой composable, владеющий DOM-ref'ами, должен держать `asElement`/`getScrollParent`-резолвинг приватным и ре-экспонировать focus/refs через return или `defineExpose`.

---

## ⚠️ Что НЕ резать (over-eager — сэкономит время)

- **`peertube-upload.ts`** (501) — самый явный «split ради строк». Уже хорошо скомпонован с DI (`fetchInstance`/`now`/`sleep`), экспортируемые юниты дают полную тестируемость без разбиения. Максимум — вынести resume-state localStorage-блок.
- **`video-player.vue`** (763) — уже делегирует в 13 composables; остаток — неотъемлемая оркестрация с init-order coupling (`let`-late-binding `setupVideoEventListeners`/`refreshMetadata`). Только `use-video-chapters` (30 строк, чистое) проходит планку. Template дробить нельзя (~40 пропсов drilling; styled-refs).
- **`chat-room.vue`** — реален только `chat-composer`; четыре микро-composable по 18–30 строк (`use-reply-to`/`use-pkoin-transfer`/`use-typing-notifier`/`use-message-search`) — переизмельчение, вредит навигации.
- **`use-media-sending.ts`** — не concern-split, а DRY: вынести общий `progress`/`preflight`/optimistic-push/`cleanup`. По типам медиа **не** дробить (продублирует boilerplate).
- **`matrix-service.ts` `rooms.ts`** (70 строк / 3 функции) — второй файл ради трёх room-хелперов = consistency theater; либо в `messaging.ts`, либо оставить инлайн. `messaging.ts` — оправдан.
- **`use-post-composer.ts` `use-post-video`** (40 строк) — включать только если video-url логика реально вырастет.

---

## Баги/долги, вскрытые аудитом (проверить и завести отдельно)

- **`use-feed.ts` normalizeImages/safeDecode drift** — инлайн-копия обрабатывает `+`→`%20` и `item.src` иначе, чем протестированный `use-feed-helpers`. Реальный расхождение поведения на постах с `+` в URL.
- **Тройной `AdaptedPost`** — `use-feed.ts`, `helpers/common/post-mapper.ts` (+ ранее styled). Нужен один канонический контракт, иначе любое извлечение типов усилит дрейф.
- **Мёртвый код** — `post-card.vue` (`handleLike/handleComment/handleShare/getInitial`), `message-item.vue` (`onAudioError`, ~85 строк). Оба спрятаны за `void`.
- **Orphaned legacy** — упомянут `notifications-store` legacy-вариант `isRetryableError`; при консолидации учесть разницу (`e.error` nested vs `e.status/statusCode`).

---

## Приложение: по-файловый разбор (риски извлечения)

Ключевые риски, которые агенты пометили при чтении реального кода (учитывать при исполнении):

- **transaction-builder.ts** — module-level singletons (`pocketnetBitcoin`/`pocketnetBitcoinLib`) переносить целиком в `btc17-loader` и отдавать через accessor; оба builder'а тянут `pocketnetBitcoinLib.payments/.crypto` напрямую. Barrel сохраняет 18 call-site'ов.
- **auth-store.ts** — Options-API: `restoreSessionImpl` берёт store instance, `this`-типизацию тянуть аккуратно; `restoreInFlight` перенести в хелпер (dedup-контракт). Cross-store уже через dynamic import — цикла нет.
- **crypto-vault.ts** — `getAttemptState` публичный (нужен re-export); `ls()`/`lsRemove()` делят core и адаптеры — примитив `ls` экспортировать из envelope-store.
- **message-item.vue** — `reactionTriggerRef`/`reactionPickerRef` + `asElement`/`$el` переносить в `use-reaction-picker` вместе; listener'ы регистрировать синхронно в setup (иначе утечка document/scroll-слушателей).
- **register-modal.vue** — composable зовёт `useI18n()`/`useAuthStore()` в setup, `t()`-ошибки держит внутри; `sendTransactionInBackground` принимает `authStore`/keyPair аргументами (тестируемость).
- **notifications-store.ts** — извлечённые хелперы чистые (address/block → value); стор переприсваивает `this.items`/`this.lastBlock`; консолидация `_isTimeoutError`↔legacy `isRetryableError` — осознанно (разные поля).
- **wallet-transfer.vue** / **wallets-page.vue** — возвращать refs, не unwrap (реактивность); `walletListVersion`/`receiverAddress` — общий ref, owned родителем/composable; таймеры (debounce/copied-reset) чистить в owner.
- **messenger-store.ts** — фабрики принимают store INSTANCES (не `storeToRefs`), не зовут `useMessenger*Store()` сами (цикл); `registerMatrixListeners` замыкает `loadDialogs`/`scheduleLoadDialogs` — прокинуть callback'ами.
- **use-comment-form.ts** — `handleReplyKeydown` смешивает submit и mention-навигацию → разделить (`handleMentionKeydown` из mention-composable, orchestrator сперва пробует submit).
- **use-video-hls.ts** — `onBeforeUnmount` click-outside в `useVideoQualityMenu` (safe, вызывается синхронно в setup); `initPlayer` пишет `currentQualityLevel` на `LEVEL_SWITCHED` через возвращённый ref+fn.
- **use-post-composer.ts** — `videoUrl` computed зависит от `message`+`articleMode` → передавать refs; orchestrator агрегирует value+reset каждого суб-composable.
- **use-media-sending.ts** — хелперы мутируют ТОТ ЖЕ реактивный `messages` (push/splice/find), не копию; revoke object-URL оставить в caller после await.
