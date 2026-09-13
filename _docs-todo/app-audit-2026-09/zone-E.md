## Зона: E — messenger (Matrix, pcrypto)

### Находки
- **E1 · 🔴 критично · logic / ux-claim** — Входящие/сохранённые `m.image`/`m.video`/`m.file` и PKOIN-транзакции маппятся как текст; вместо картинки показывается 64-hex ключ медиа
  - Файл: `src/b-components/messenger/store/messenger-chat-store/use-message-mapping.ts:55-68` (только `m.audio` даёт `type='audio'`), `helpers.ts:108-126`; мёртвые потребители: `image-message.vue`, `video-message.vue`, `file-message.vue`, `transaction-message.vue`, `chat-list-item.vue:110-125`.
  - Суть: при консолидации стора (коммит `fb599f9`) из `mapEventToMessage` выпали ветки `m.image`/`m.video`/`pocketnet_transaction`/`m.file` (в удалённом `store.ts` были на 978-1100). `type` бывает только `'text'|'audio'`; типы image/video/file/transaction присваиваются лишь оптимистичным локальным сообщениям, которые после отправки удаляются.
  - Сценарий: собеседник шлёт фото → `hasSecrets` → `tryDecrypt` → `pcrypto.decryptEvent` возвращает hex-секрет медиа → `JSON.parse` падает → `text = decrypted` → в чате и превью диалога строка `a3f9…` (64 hex). Отправитель после аплоада видит то же. `m.file` без secrets — сырой JSON body. PKOIN-карточка не рендерится. Hex-ключ персистится в `decryptedMessages`.
  - Фикс: вернуть в `mapEventToMessage` маппинг `m.image`/`m.video`/`m.file` (url/info/name/posterUrl, парсинг JSON body для legacy `m.file`) и `pocketnet_transaction` → `type='transaction'`; в `tryDecrypt` не трактовать медиа-секрет как текст; юнит-тест на `mapEventToMessage` для каждого msgtype.
  - Уверенность: high — сверено с `git show fb599f9^:src/b-components/messenger/store.ts`.

- **E2 · 🟠 высоко · security / data** — Открытый текст всех расшифрованных сообщений хранится в IndexedDB без шифрования и не удаляется при выходе/удалении аккаунта; sync-БД matrix тоже остаётся
  - Файл: `services/decryption-cache.ts:75-88`, `src/db/apis/decrypted-messages-api.ts:27-39`, `auth-store.ts:322-360` (`signOut`), `:503-531` (`removeAccount`), `matrix-service.ts:400-415` (`store.destroy()` = только `db.close()`).
  - Суть: `purgeDecryptedCache`/`clearDecryptedForUser` не вызываются нигде; `signOut` чистит LS и сейф, но не Dexie-таблицу и не `bastyon-matrix-sync:<userId>`.
  - Сценарий: «Выйти» на общем устройстве → в IndexedDB остаются все расшифрованные DM и таймлайны комнат.
  - Фикс: в `signOut`/`removeAccount` вызывать `clearDecryptedForUser(matrixUserId)` и `indexedDB.deleteDatabase(getStoreDbName(userId))`; либо шифровать кэш ключом из сейфа + TTL/лимит.
  - Уверенность: high.

- **E3 · 🟠 высоко · logic / privacy** — Голосовое сообщение, записываемое в момент смены чата, отправляется в ДРУГОЙ (новый активный) чат
  - Файл: `chat-room/use-voice-recording.ts:165-184` (`onBeforeUnmount` → `mediaRecorder.stop()` без `isCancelling = true`), `:90-116`, `chat-room.vue:409-413` (колбэк читает `store.activeChatId` в момент вызова), `messenger-panel.vue:35` / `messenger-wrapper.vue:37` (`:key="activeChatId"`).
  - Сценарий: держу микрофон в чате с A, кликаю диалог B → ChatRoom(A) размонтируется → `stop()` → `onstop` → `sendAudio(store.activeChatId /* = B */)` → запись для A улетает B.
  - Фикс: в `onBeforeUnmount` ставить `isCancelling.value = true`, либо захватывать `chatId` при `startRecording`.
  - Уверенность: high.

- **E4 · 🟠 высоко · security / privacy** — Глобальный `paste`-листенер чата активен, пока виджет скрыт: картинка, вставленная в редактор поста/комментария, отправляется собеседнику
  - Файл: `chat-room/use-paste-drop.ts:116` (`document.addEventListener('paste')`), `chat-room.vue:446-450`, `messenger-wrapper.vue:13-56` + `messenger-window/styled.ts:22-24` (окно прячется через opacity/pointer-events, ChatRoom смонтирован), `messenger-wrapper.vue:176-179`, `messenger-store.ts:486-500` (закрытие не сбрасывает `activeChatId`).
  - Сценарий: desktop, открыл чат с A, свернул виджет → Ctrl+V скриншот в композер поста → `preventDefault` + `sendImage(activeChatId, file)` → скриншот уходит A без визуального признака.
  - Фикс: слушать `paste` только на поле ввода чата (или проверять `activeElement` внутри контейнера) и снимать листенер/сбрасывать `activeChatId` при закрытии виджета.
  - Уверенность: high.

- **E5 · 🟠 высоко · logic** — Свёрнутый виджет с открытым чатом «глотает» новые сообщения: ни звука, ни бейджа, ни уведомления, но собеседнику уходит read-receipt
  - Файл: `messenger-store.ts:192-197` (unread=0 для `activeChatId`), `:363-384`, `:386-409` (`setRoomReadMarkers` для активной комнаты независимо от `isOpen`), `messenger-wrapper.vue:176-179`, `messenger-store.ts:486-500`.
  - Фикс: при `closeWidget`/`toggleMessenger(false)` сбрасывать `activeChatId`; read markers и гашение нотификаций только при `uiStore.isOpen && document.visibilityState === 'visible'`.
  - Уверенность: high.

- **E6 · 🟠 высоко · logic / money** — PKOIN-донат: если Matrix-сообщение после успешного broadcast'а не отправилось, модалка показывает ошибку и разрешает повторную отправку → двойной перевод
  - Файл: `use-message-sending.ts:283-301` (`sendTransactionWithMessage` → `sendPkoinTransaction` в одном try, `throw e`), `pkoin-transfer-modal.vue:147-170`.
  - Сценарий: tx ушла (txid получен) → `sendPkoinTransaction` падает (M_LIMIT_EXCEEDED / сеть) → `submitError` → «Отправить» ещё раз → вторая tx.
  - Фикс: разделить фазы: после `txid` хранить его в состоянии; ошибку Matrix показывать как «перевод выполнен, не удалось отправить сообщение» с кнопкой «повторить сообщение».
  - Уверенность: high.

- **E7 · 🟡 средне · security / privacy** — OG-превью ссылок из E2E-сообщений автоматически запрашиваются у homeserver'а (`/preview_url`), `og:image` c произвольного http(s) грузится напрямую
  - Файл: `link-preview/use-link-preview.ts:73-79` (`client.getUrlPreview`), `:34-42`, `message-item.vue:50,242`.
  - Сценарий: A шлёт B `https://attacker.tld/x?id=B` → homeserver + attacker.tld узнают, что B открыл чат и когда; в Tor-режиме — мимо Tor.
  - Фикс: превью только по явной настройке (по умолчанию выкл. для зашифрованных); `og:image` только `mxc://`.
  - Уверенность: high.

- **E8 · 🟡 средне · security** — Абсолютные URL медиа из контента отправителя (`content.url`, `info.httpUrl`, сервер в `mxc://`) фетчатся/загружаются автоматически без проверки хоста
  - Файл: `use-message-mapping.ts:28-44` (`resolveAudioUrl`), `audio-message/use-audio-playback.ts:61-66` (`matrixFetch(url)` при монтировании), `use-media-transfer.ts:91-94`, `image-message.vue:104-107`, `mxc-resolver.ts:28-35` (`https://${server}` из mxc отправителя).
  - Сценарий: `m.audio` с `url: "https://attacker.tld/t?u=<victim>"` → у получателя при открытии чата запрос уходит (в Tor — через `torFetch` на любой хост).
  - Фикс: принимать только `mxc://` и строить http через `mxcUrlToHttp` своего homeserver'а; для legacy `httpUrl` проверять host ∈ allowlist.
  - Уверенность: high/medium.

- **E9 · 🟡 средне · ux-claim / logic** — Неудачная отправка текста молча теряется: `status` всегда `'sent'`, ошибка только в консоли, поле ввода уже очищено
  - Файл: `use-message-sending.ts:160-166`, `use-message-mapping.ts:196` (`status: 'sent'`), `use-chat-input.ts:40-47`.
  - Фикс: пробрасывать ошибку в UI, возвращать текст в поле; читать `event.status` (`Room.localEchoUpdated`) → `'sending'|'failed'`.
  - Уверенность: high.

- **E10 · 🟡 средне · race** — Сообщение, пришедшее во время `loadMessages`, выпадает из ленты (но read-receipt уже отправлен)
  - Файл: `use-message-loading.ts:44-58`, `messenger-store.ts:386-409`.
  - Фикс: после `Promise.all` мержить накопленные id, либо буферизовать live-события во время загрузки.
  - Уверенность: high.

- **E11 · 🟡 средне · logic / leak** — После неудачного логина Matrix листенеры копятся в `eventQueue`; при последующем успешном входе хендлеры дублируются (2× звук, 2× уведомление, 2× read markers); провал входа не показывается (вечный «Загрузка диалогов»)
  - Файл: `messenger-store.ts:314-321,423-435`, `matrix-service.ts:152-158`, `:400-415`, `messenger-panel.vue:16`, `messenger-wrapper.vue:24-33`.
  - Фикс: регистрировать листенеры один раз; в `login()`-fail чистить очередь; `uiStore.syncError` при провале.
  - Уверенность: high.

- **E12 · 🟡 средне · logic** — Баннер «Ошибка синхронизации» не гаснет после восстановления связи (`syncError` сбрасывается только на `PREPARED`)
  - Файл: `messenger-store.ts:423-432`, `messenger-panel.vue:8-15`.
  - Фикс: сбрасывать на `SYNCING`/`CATCHUP`/`PREPARED`.

- **E13 · 🟡 средне · ux-claim** — Отправка собеседнику без опубликованных ключей мессенджера (`profile.k`) «успешна», но нечитаема для него
  - Файл: `group-encryption.ts:193-199`, `use-message-sending.ts:123-133`, `pcrypto.ts:360-384`.
  - Фикс: перед отправкой требовать партнёра в `users`; иначе понятная ошибка (как legacy).
  - Уверенность: high.

- **E14 · 🟡 средне · logic** — `findExistingRoomByAddress` считает «DM с адресом» любую комнату, где адрес — первый чужой участник (в т.ч. группы); «Начать чат» без защиты от дабл-клика
  - Файл: `room-helpers.ts:19-48`, `messenger-store.ts:533-535, 594-597`, `chat-room.vue:418-429`.
  - Фикс: фильтр по `isTetatetchat`/`m.direct`/участников == 2; in-flight флаг.

- **E15 · 🟡 средне · data / ux** — OS-уведомление о новом сообщении показывает шифротекст (base64 JSON AES-SIV / hex)
  - Файл: `messenger-store.ts:377-383`, `use-browser-notifications.ts:74-77`.
  - Фикс: нейтральный текст или расшифровка через `mapEventToMessage`; имя из `profileCache`.

- **E16 · ⚪ низко · leak** — Blob-URL расшифрованного медиа не ревокаются и не чистятся при логауте; local-echo `~`-id мусорит IDB-кэш и лишает свежие сообщения действий
  - Файл: `use-media-transfer.ts:14,100-101`, `messenger-chat-store.ts:56-64`, `use-message-decryption.ts:182-185`, `messenger-store.ts:387-391`, `message-item.vue:245,269-275`.
  - Фикс: `revokeObjectURL` + очистка в `reset()`; `Room.localEchoUpdated` → обновлять id/status; не персистить id без `$`.

- **E17 · ⚪ низко · leak / resource** — По одному `PIXI.Application` (WebGL-контекст) на каждое аудио-сообщение; полный download+decrypt+decode при монтировании
  - Файл: `use-pixi-waveform.ts:163-178`, `audio-message.vue:98-102`.
  - Фикс: shared renderer или 2D canvas; ленивая загрузка.

- **E18 · ⚪ низко · security** — Matrix-сессия никогда не отзывается: каждый запуск создаёт новый device с вечным access token; logout без `client.logout()`
  - Файл: `matrix-service.ts:63-102, 400-415`, `matrix-service/auth.ts:79-87`.
  - Фикс: `client.logout()` при `signOut`/`removeAccount`; хранить `device_id`.

### Несостыковки между модулями
- **E19 · 🟡 средне · consistency** — Три определения «личного чата», и комнаты, созданные nextgen, не проходят ни своё `isTetatetchat`, ни legacy-поиск
  - Файл: `matrix-service.ts:233-250` (`createDirectRoom` без `room_alias_name`), `helpers.ts:157-182`, `messenger-store.ts:85-89`, `use-read-receipts.ts:36`, `use-block-user.ts:28-40`, `use-message-sending.ts:30-37,154-157`, `chat-room.vue:454-458`; legacy `bastyon-chat/src/application/index.js:614-680`.
  - Сценарий: nextgen создаёт DM → нет alias `#<tetatetid>` → текст идёт групповым протоколом, кнопка «Отправить PKOIN» скрыта; у legacy-собеседника комната выглядит группой, «Написать» создаёт вторую.
  - Фикс: `room_alias_name: tetatetid(hexMe, hexPartner)` + `name` + `initial_state` как в legacy; один хелпер «direct».
  - Уверенность: high.

- **E20 · 🟡 средне · consistency** — post-embed использует `adaptPostData` из `post-mapper.ts`, который не URL-декодирует `c`/`m`
  - Файл: `post-embed/use-post-by-txid.ts:6,62`, `post-mapper.ts:85-86` vs `use-feed.ts:196-197`, `post-embed.vue:51-52, 140-143`.
  - Сценарий: ссылка на пост с кириллицей → карточка показывает `%D0%9F…`, snippet не режет HTML, модалка с тем же мусором.
  - Фикс: единый `adaptPostData` с `safeDecode`, удалить дубликат.

- **E21 · 🟡 средне · consistency** — Два несвязанных чёрных списка: matrix `m.ignored_user_list` в чате и on-chain blacklist в профиле
  - Файл: `chat-room/use-block-user.ts:1-8,54-71`, `user-relations-store.ts:59-66,152-167`.
  - Фикс: при on-chain блокировке вызывать `setIgnoredUsers` и/или фильтровать диалоги по `isBlocked`; в чате переименовать кнопку.

- **E22 · ⚪ низко · consistency** — AES-константы в трёх местах (`store/consts.ts:30-39`, `media-encrypt.ts:10-12`, `media-decrypt.ts:13-15`); `hexToAddress` дважды; два `formatMessageTime`; строки без i18n (`use-audio-playback.ts:63,128,144`, `use-partner-info.ts:86,125`, `message-item.vue:26`, `messenger-panel.vue:14`, `messenger-window.vue:24`).

### Проверено — ОК
- `v-html` в message-item: `seg.html` только через `escapeHtml`, схемы ссылок ограничены regex; `bastyon-link.ts` валидирует txid.
- i18n: все 86 статических ключей мессенджера есть в ru/en.
- Математика PKOIN-доната идентична wallet-transfer («комиссию платит отправитель»).
- DM-путь pcrypto: AES-SIV со случайным nonce — аутентифицирован.
- Пароль Matrix = SHA256(SHA256(privKeyHex)); access token только в памяти; sync-БД per-user; кэш ключуется `[userId+eventId]`.
- Ключи мессенджера = BIP32 `m/33'/0'/0'/i'` как в legacy; публикация `k` есть.
- Голосовая запись: треки останавливаются (кроме E3); typing троттл; листенеры снимаются.
- Аудио-плеер: objectURL/AudioContext/PIXI чистятся на unmount.
- Реакции/редакции обрабатываются; лимиты вложений совпадают с legacy.
- Tor: matrix через `matrixFetch` → `torFetch`.
