# Загрузка видео — чеклист реализации (порт из pocketnet.gui)

> Provenance: многоагентный разбор оригинального клиента `___original-repos/pocketnet.gui`
> (7 подсистем: выбор ноды/роя, auth-подпись, транспорт, препроцессинг, публикация, контракт нода-прокси,
> точки интеграции нового приложения) + предыдущее ревью текущего `video-uploader`. Каждый пункт помечен
> приоритетом **[must]/[should]/[nice]** и снабжён ссылками: `orig:` — файл:строки в оригинале, `new:` — seam в нашем коде.
> Дата: **2026-08-05**.

---

## 0. TL;DR — где мы сейчас и что нужно

**Что уже есть в новом приложении:** полный локальный пайплайн — выбор файла → анализ → транскод (Tauri native ffmpeg / ffmpeg.wasm) → сохранение blob в IndexedDB. Картинки грузятся ([image-upload-service.ts](../src/services/image-upload-service.ts)), mini-app `videos.*` — заглушки ([media.ts](../src/mini-apps/actions/media.ts)).

**Прогресс порта (сервисный слой `src/services/peertube/`):** ✅ **Фаза A** (выбор хоста, минимум) · ✅ **Фаза B** (blockChainAuth OAuth + кэш/refresh + channelId) · ✅ **Фаза C** (resumable-транспорт поверх `appFetch`: init/PUT-чанки/отмена/resume/retry/прогресс — 13 юнит-тестов). Всё покрыто на инъектируемом транспорте; **живой прогон под Tor/Tauri не делался** (§3). Осталось соединить транспорт с UI: пайплайн `use-upload-state.ts` по-прежнему завершается на IndexedDB ([use-upload-state.ts:199](../src/b-components/video-uploader/composables/use-upload-state.ts#L199)) — **сетевой загрузки из UI ещё нет** (это Фазы D/E: валидация/квота + мост в композер).

**Главные факты об архитектуре оригинала (это меняет всё):**

1. **Загрузка идёт НЕ через ноду.** Bastyon-нода (`proxy16/peertube`) делает только (а) выбор хоста и (б) проксирование чтения. Эндпоинта `/peertube/upload` не существует. Байты, авторизация, update/delete — **напрямую браузер → выбранный PeerTube-инстанс**. `orig:proxy16/peertube/index.js:479-508`
2. **Выбор хоста двухступенчатый.** `peertube/roys` → детерминированно выбрать «рой» (swarm) по блокчейн-адресу юзера → `peertube/best {roy,type:'upload'}` → `{host}`. Наш `image-upload-service` уже зовёт `peertube/best` — значит этот контракт на нашей ноде, скорее всего, есть. `orig:js/peertube.js:601-647`
3. **Авторизация — OAuth через блокчейн-подпись.** 3 шага прямо к инстансу: `GET oauth-clients/local` → `POST users/blockChainAuth` (подпись над nonce `date=…,exp=360,s=hex('peertube')`) → `POST users/token` → Bearer. Токен кэшируется `token_<address>_<host>`. Проверяет подпись кастомный PeerTube-плагин `blockChainAuth` (его кода в репо нет — целевой инстанс обязан его иметь). `orig:js/peertube.js:1254-1354`, `orig:js/user.js:55-96`
4. **Транспорт — PeerTube resumable (uploadx/Google), НЕ tus и НЕ обычный multipart.** Init (multipart, только метаданные) → `upload_id` из заголовка `Location` → PUT-чанки `application/octet-stream` с `Content-Range`. Каждый чанк кроме последнего — кратен 256 байтам. `orig:js/peertube.js:799-980`
5. **Результат — указатель `peertube://<host>/<uuid>`** (`/audio`, `/stream` — суффиксы), который кладётся в **`post.url`** обычного поста. Отдельной on-chain видео-сущности нет. `orig:js/peertube.js:151-158`
6. **Клиентский транскод НЕ обязателен для загрузки.** Оригинал на web/mobile грузит сырой файл, транскодит сам PeerTube; клиентский транскод — только Electron-десктоп и по настройке. Наш локальный ffmpeg — это опциональная оптимизация трафика, **не** предусловие. `orig:components/uploadpeertube/index.js:353-479`

**Самый рискованный момент интеграции:** оригинал грузит прямым `axios`, а нам обязателен `appFetch` (Tor / Tauri plugin-http CORS / dev vite-proxy). Значит resumable-протокол нужно строить **поверх `appFetch`**, а не готовым tus/uploadx-клиентом. См. §3 (открытые вопросы).

---

## 1. Контракт, который нужно воспроизвести (справочник)

**Нода (наш backend, `peertube/*`) — только discovery + read:**
- `peertube/roys {type,special}` → `{ royKey: bestHost }`
- `peertube/best {roy,type}` → `{ host }` (только host, без ip)
- `peertube/getHosts` → `[{ host:{host,ip} }, …]`; `peertube/getHostIp?host=` → ip-строка
- `peertube/video {url,fast}` / `peertube/videos {urls}` / `peertube/accountVideos` → сырой PeerTube JSON под `.data` (кэш + failover на ноде)
- Ответ всегда в конверте `{ data, code }`. `orig:proxy16/peertube/index.js:116-508`

**Прямо в инстанс (браузер → `https://{host}/api/v1/…`), с Bearer:**
- `GET oauth-clients/local` · `POST users/blockChainAuth` · `POST users/token` · `GET users/me` (channelId, quota) · `GET users/me/video-quota-used`
- `POST videos/upload-resumable` (init) · `PUT videos/upload-resumable?upload_id=` (чанк) · `DELETE …` (отмена) · `POST videos/upload` (legacy single-shot) · `PUT videos/:id` (update name/desc/thumb) · `DELETE videos/:id`

---

## 2. Чеклист по фазам

### Фаза A — Клиент выбора хоста (discovery)

- [~] **[must]** Выбор хоста для загрузки. ✅ **Минимум готов (2026-08-05):** [`resolvePeertubeHost('upload')`](../src/services/peertube/peertube-host.ts) через `peertube/best {type:'upload'}` (нода сама берёт randroykey), с ошибкой `peertube_no_host` при пустом пуле. **Осталось [should]:** полноценный двухступенчатый `roys → детерминированный рой по адресу (base58→cube-root→% roysAmount) → best`, чтобы держать юзера на одном swarm. `orig:js/peertube.js:601-647`
- [ ] **[should]** Резолв `host → ip` и выбор http/https. `getHostIp`/`getHosts`, кэш host↔ip; https по host по умолчанию, http по ip в ip-режиме. `orig:js/peertube.js:1498-1591`
- [ ] **[should]** Прокинуть `type` (`upload` / `importVideo` / `liveStream`) — у каждого свои веса ранжирования. Картинки через этот путь НЕ идут. `orig:proxy16/peertube/metricsList.js`
- [ ] **[nice]** Учитывать флаги `special`/`archived`/`old`/`cantuploading`; `special:true` только для platform.real/test-адресов. `orig:proxy16/peertube/roy.js:32-89`

### Фаза B — PeerTube-аутентификация (подпись → OAuth, пер-хост)

- [x] **[must]** ✅ **DONE.** 3-шаговый handshake прямо к инстансу: `oauth-clients/local` → `blockChainAuth` (x-www-form-urlencoded) → `users/token` (`grant_type=password`, `response_type=code`). [`authenticatePeertube`](../src/services/peertube/peertube-auth.ts). `orig:js/peertube.js:1254-1354`
- [x] **[must]** ✅ **DONE.** Блокчейн-подпись — переиспользован общий `generateApiSignature(keyPair, address, { data: 'peertube' })` (тот же `hexEncode`, `exp=360`, sha256, `v:1`, что RPC-auth). Обёртка [`buildPeertubeSignature`](../src/services/peertube/peertube-auth.ts). `orig:js/user.js:55-96`
- [x] **[must]** ✅ **DONE.** `Authorization: Bearer` шлётся в `getPeertubeChannel` (users/me) **и на всех upload-запросах** (init/PUT/DELETE в [peertube-upload.ts](../src/services/peertube/peertube-upload.ts)). `orig:js/peertube.js:400-403`
- [x] **[must]** ✅ **DONE.** Кэш токенов пер-user-пер-host (`token_<address>_<host>`), `expires_in` хранится АБСОЛЮТНЫМ epoch-дедлайном (`now + ttl - 60`). [`ensurePeertubeToken`/`load|savePeertubeToken`/`isAccessTokenValid`](../src/services/peertube/peertube-auth.ts). `orig:js/peertube.js:1227-1248`
- [x] **[must]** ✅ **DONE.** `channelId` + квоты из `GET users/me` ([`getPeertubeChannel`](../src/services/peertube/peertube-auth.ts)); реджект `peertube_no_channel`, если нет channelId или `videoQuotaDaily`. `orig:js/peertube.js:1197-1218`
- [~] **[should]** ✅ **refresh готов.** `grant_type=refresh_token` с откатом на полную авторизацию при сбое (`ensurePeertubeToken`). **Осталось:** разовый retry на `invalid_token` mid-request (пере-auth + повтор запроса) — транспорт получает готовый `accessToken`, поэтому re-auth логичнее на слое-оркестраторе `ensurePeertubeToken`+`uploadVideoResumable` (Фаза E-wiring), не внутри транспорта. `orig:js/peertube.js:528-552,1313`
- [ ] **[nice]** `isNewUser` из blockChainAuth — инстанс автосоздаёт аккаунт+канал при первой авторизации; учесть готовность канала для первой загрузки.

### Фаза C — Транспорт загрузки (resumable поверх appFetch)

> ✅ **Ядро готово (2026-08-06):** [`peertube-upload.ts`](../src/services/peertube/peertube-upload.ts) + [тесты](../src/services/peertube/peertube-upload.test.ts) (13 кейсов, все зелёные). Протокольная логика полностью реализована и юнит-покрыта на инъектируемом `fetchInstance`. **Живая проверка транспорта (§3) не делалась** — resumable под Tor/Tauri требует прогона на реальном инстансе.

- [x] **[must]** ✅ **DONE.** PeerTube resumable (uploadx). [`initResumableUpload`](../src/services/peertube/peertube-upload.ts) (multipart init только с метаданными + `X-Upload-Content-Length`/`X-Upload-Content-Type`, `upload_id` из `Location` через [`parseUploadId`](../src/services/peertube/peertube-upload.ts) — абсолютный/относительный/безсхемный) → [`uploadVideoResumable`](../src/services/peertube/peertube-upload.ts) PUT-цикл: тело `octet-stream`, `Content-Range: bytes s-e/total`; ветвление **308**=продолжать, **200**=готово (`video.uuid`/`isAudio`), **404**=реинит, **403/409/413/415/422**=жёсткая, **429/503**=временная (retry). `orig:js/peertube.js:799-980`, `js/video-uploader.js`
- [x] **[must]** ✅ **DONE.** Выравнивание чанка по 256 (все кроме последнего) гарантировано конструктивно (`alignChunkSize` округляет вниз до 256; чанк = `min(pos+size, total)`). Дефолт **2 МиБ** (кратно 256), НЕ legacy 256 Б. `orig:js/video-uploader.js:8`, `js/peertube.js:884-889`
- [x] **[must]** ✅ **DONE.** Весь трафик через `peertubeInstanceFetch` → **`appFetch`** (см. [peertube-instance.ts](../src/services/peertube/peertube-instance.ts), dev vite-proxy `/api/peertube/{host}/…`). ⚠️ Тело чанка — `ArrayBuffer` (совместимо с plugin-http), но **стриминг PUT + чтение `Location` под torFetch/Tauri вживую НЕ проверены** — открытый §3-риск. `new:`[fetch-strategies.ts:16](../src/helpers/api/fetch-strategies.ts#L16)
- [~] **[must]** Код читает `Location` (case-insensitive) и при `null` кидает `peertube_no_location` (диагностируемо). **Осталось серверное:** подтвердить `Access-Control-Expose-Headers: Location` на целевых инстансах/прокси (§3, не проверяемо из репо).
- [x] **[should]** ✅ **DONE.** Persist resume-state `{uploadHost,uploadId,resumeFrom,lastOperation}` (`resumableStorageKey` = host+address+videoKey), TTL 12ч, протухшее игнорируется → полный init. `orig:js/video-uploader.js:33-104`
- [x] **[should]** ✅ **DONE.** Прогресс (`bytesUploaded/total/percent`), отмена по `AbortSignal` (`DELETE …?upload_id=` best-effort + чистка state, кидает `cancelled:true`), retry с **экспонентой+cap** (не наивные 2s) и **таймаут 60с на чанк** через собственный AbortController, слинкованный с внешним signal. `orig:js/video-uploader.js:218-240`
- [x] **[should]** ✅ **DONE.** Истинный host на финале — из `video.videoCreated.url` (`extractTrueHost`, фолбэк на исходный host). `orig:js/peertube.js:915-926`
- [ ] **[nice]** Legacy single-shot (`POST videos/upload`) — только если целевые ноды не поддерживают resumable (в оригинале там ещё и баг `self.static`). Предпочитать resumable.

### Фаза D — Препроцессинг / валидация

> ✅ **Готово (2026-08-06):** [`peertube-validation.ts`](../src/services/peertube/peertube-validation.ts) (чистая валидация файла, без сети) + [`peertube-quota.ts`](../src/services/peertube/peertube-quota.ts) (проверка дневной квоты) + тесты (9+9 кейсов, все зелёные).

- [x] **[must]** ✅ **DONE (осознанно).** Локальный транскод НЕ обязателен: `validateVideoFile` проверяет пригодность **сырого** файла к прямой загрузке; PeerTube транскодит сам. IndexedDB-транскод — опциональная оптимизация трафика (Фаза G), не предусловие. `orig:components/uploadpeertube/index.js:353-479`
- [x] **[must]** ✅ **DONE.** Валидация MIME `video`/`audio` + сниффинг Matroska по magic `1A 45 DF A3` ([`isMatroska`](../src/services/peertube/peertube-validation.ts) — читает **только первые 4 байта**, не весь файл, как оригинал) и пере-обёртка в `File{type:'video/x-matroska'}`. Коды ошибок `video_not_selected`/`video_format_unsupported`/`video_too_large` (UI мапит в текст). `orig:index.js:285-319`
- [x] **[must]** ✅ **DONE + согласовано.** Потолок **4 ГиБ** (`MAX_VIDEO_SIZE_BYTES`) — для **прямой загрузки**. 500 МБ в [use-upload-state.ts:49](../src/b-components/video-uploader/composables/use-upload-state.ts#L49) — **другой контур** (лимит стейджинга транскода в IndexedDB, ограничен браузерным storage); менять его не нужно, он про транскод-путь, а не про upload. `orig:index.js:321`
- [x] **[must]** ✅ **DONE.** Дневная квота: [`checkDailyQuota`](../src/services/peertube/peertube-quota.ts) фетчит `users/me/video-quota-used` (`videoQuotaUsedDaily`), а `videoQuotaDaily`/`videoQuota` берёт из уже полученного канала (`getPeertubeChannel`, без второго `users/me`). Чистая оценка [`evaluateQuota`](../src/services/peertube/peertube-quota.ts): `size+usedDaily < dailyQuota` ИЛИ `dailyQuota<0` (безлимит); нет размера/квоты → пропуск (доверяем серверу). `QuotaExceededError` с остатком. `orig:js/peertube.js:1087-1144`
- [x] **[must]** ✅ **DONE.** Реджекты инстанса **413** (велик/квота) и **415** (формат) обрабатываются в [`initResumableUpload`](../src/services/peertube/peertube-upload.ts) (Фаза C) — коды `peertube_upload_too_large`/`peertube_upload_unsupported_type`. Клиентская проверка размера приём НЕ гарантирует — серверный реджект остаётся. `orig:js/peertube.js:845-871`
- [~] **[should]** Аудио: `validateVideoFile` уже возвращает `isAudio` (флаг для пропуска транскода и суффикса). **Осталось:** пробросить в UI-пропуск транскода и в суффикс `/audio` указателя — это Фаза E (генератор указателя) + G (гейт транскода). `orig:index.js:298-359`
- [ ] **[nice]** Если оставляем локальный транскод — воспроизвести пороги/цель оригинала (>720p/>2600k/>25fps → транскод; libx264+aac, scale -2:min(720,ih), fps min(25); если выход больше входа — грузить оригинал; вертикальное видео не транскодить). `orig:index.js:405-433`, `transcoding2.js:383-413`

### Фаза E — Публикация: указатель + привязка к посту

> ✅ **Сервисный слой готов (2026-08-06):** генератор указателя + оркестратор [`uploadVideoToPeertube`](../src/services/peertube/peertube-video-service.ts) (связывает A→D в один вызов) + мост в композере. Тесты: parser (7) + video-service (9), все зелёные. **Осталась UI-плумбинг:** вызвать сервис из video-uploader.vue (кнопка/прогресс) с живым keyPair — это UI-шаг, требует залогиненного аккаунта, вживую не проверялся.

- [x] **[must]** ✅ **DONE.** Генератор [`composePeerTubeUrl(host, uuid, {isAudio,isLive})`](../src/helpers/api/peertube-parser.ts) — пара к существующему `parsePeerTubeUrl` (round-trip покрыт тестом); суффиксы `/audio`,`/stream`. `orig:js/peertube.js:138-158`
- [x] **[must]** ✅ **DONE.** Указатель кладётся в **`post.url`** (не в images[]): мост `uploadedVideoUrl` в композере питает `post.url`; `operationType` (`video`/`audio`) уже выводится из url через `resolvePostOperationType` ([post-action.ts:97-124](../src/blockchain/core/actions/post-action.ts#L97)), валидация требует caption для видео/аудио. `orig:js/kit.js:1621-1645`
- [x] **[must]** ✅ **DONE.** Метаданные upload: `privacy:1`+`scheduleUpdate[updateAt]`+`channelId` задаются в `initResumableUpload` (Фаза C); `name` с фолбэками `params.name → file.name → PocketVideo:<ISO>` в оркестраторе. `nsfw`/`tags`/`language`/`category`/`commentsEnabled` НЕ шлём. `orig:js/peertube.js:758-796`
- [x] **[must]** ✅ **DONE.** Мост upload → composer: [`use-post-composer.ts`](../src/b-components/content/post-composer/use-post-composer.ts) — ref `uploadedVideoUrl` (+ `setUploadedVideoUrl`/`clearUploadedVideoUrl`) с приоритетом над авто-ссылкой из текста; питает `post.url` и `needsCaption`; чистится в `reset()`. **Осталось [UI]:** дёрнуть `setUploadedVideoUrl(pointer)` из аплоадера после `uploadVideoToPeertube`. `orig:uploadpeertube/index.js:196-237`
- [~] **[should]** Обложка: `UploadMetadata.thumbnailFile` уходит в оба поля `thumbnailfile`+`previewfile` init-формы ([peertube-upload.ts](../src/services/peertube/peertube-upload.ts) `buildInitFormData`), оркестратор прокидывает `params.thumbnailFile`. **Осталось:** dataURL→File конверсия на UI + опц. `PUT videos/:id` для отдельного апдейта обложки. `orig:js/peertube.js:722-756`
- [ ] **[should]** На публикации пушить name/description в PeerTube через `PUT videos/:id` (или решить: только on-chain). `orig:share/index.js:1108-1122`

### Фаза F — Кабинет / управление / воспроизведение

> ✅ **Сервис-примитивы готовы (2026-08-06):** [`peertube-videos.ts`](../src/services/peertube/peertube-videos.ts) + тесты (12 кейсов). UI «кабинета» (рендер, merge с локальным черновик-стором) — отдельный шаг, не делался.

- [~] **[should]** «Кабинет видео»: [`getMyAccountVideos`](../src/services/peertube/peertube-videos.ts) (GET users/me/videos, пагинация, Bearer) + [`findPostedVideos`](../src/services/peertube/peertube-videos.ts) (RPC `searchlinks` → Set опубликованных указателей). **Осталось [UI]:** merge с локальным `unpostedVideos[address]` + рендер кабинета. `orig:components/videoCabinet/index.js:121-217`
- [x] **[should]** ✅ **DONE.** Удаление видео на инстансе: [`deleteInstanceVideo`](../src/services/peertube/peertube-videos.ts) (DELETE videos/:id, Bearer, **404 идемпотентно** = уже удалено). Удаление поста (txid) — существующий blockchain-путь, отдельно. `orig:videoCabinet/index.js:1266-1360`
- [x] **[should]** ✅ **DONE.** Готовность транскодинга: [`checkTranscodingReady`](../src/services/peertube/peertube-videos.ts) через ноду `peertube/videos {urls,update}`, ready = `state.id ∉ {2,3}`; нет данных → false. `orig:js/peertube.js:160-174`
- [ ] **[nice]** Shareable embed-ссылка / эквивалент `embedVideo.php?host=&id=&s=<txid>`. `orig:post/index.js:923-929`
- [ ] **[nice]** Import-by-URL как альтернатива файлу: `POST videos/imports {targetUrl,channelId,privacy:1}` → тот же указатель. `orig:js/peertube.js:982-998`

### Фаза G — Починить существующий транскод/отмену (из прошлого ревью — предусловие)

> Строить загрузку поверх текущего транскодера рискованно: путь отмены сломан, синглтон «кирпичится».

- [x] **[must]** ✅ **DONE (2026-08-05).** Отмена транскода переведена на **пер-run AbortController** (gate читает захваченный контроллер, а не разделяемую ссылку) — отменённое видео больше не сохраняется, нет ложного error-состояния, нет cross-run загрязнения. `transcoder.destroy()` теперь сбрасывает `initPromise` → синглтон реинициализируется (не «кирпичится»). Тесты: [use-upload-state.test.ts](../src/b-components/video-uploader/composables/use-upload-state.test.ts), [transcoder/index.test.ts](../src/b-components/video-uploader/transcoder/index.test.ts). `new:`[use-upload-state.ts](../src/b-components/video-uploader/composables/use-upload-state.ts), [transcoder/index.ts](../src/b-components/video-uploader/transcoder/index.ts)
- [x] **[should]** ✅ **DONE.** Кнопка «Отмена» добавлена в состоянии `transcoding` ([upload-dropzone.vue](../src/b-components/video-uploader/components/upload-dropzone/upload-dropzone.vue), emit `cancel` → `cancelTranscoding`). i18n `videoUploader.cancel` уже существовал.
- [ ] **[should]** Tauri IPC: файл передаётся как `number[]` (`Array.from`) → OOM-риск; перейти на сырые байты/channel. `new:`[tauri-transcoder.ts:267](../src/b-components/video-uploader/transcoder/tauri-transcoder.ts#L267)
- [ ] **[nice]** Path-traversal defense-in-depth в Rust `save_temp_file` (`temp_dir.join(...file_name)`), двойное чтение метаданных, гейт dropzone по `isUploading`. `orig-new: src-tauri/src/lib.rs:39`, `use-upload-state.ts:65`

### Фаза H — Mini-app media

> ✅ **Частично подключено (2026-08-06):** [media.ts](../src/mini-apps/actions/media.ts) + host-методы [media-upload.ts](../src/mini-apps/actions/host-context-methods/media-upload.ts) + тесты.

- [x] **[should]** ✅ **`images.upload`** — `authorization:true`, делегирует `host.uploadImages` (→ [image-upload-service](../src/services/image-upload-service.ts)), лимит 10, возвращает `[{url}]`. `orig:index.js:930-963`
- [x] **[should]** ✅ **`videos.remove`** — `authorization:true`, `host.removeVideo(pointer)` → [`removeVideoByPointer`](../src/services/peertube/peertube-videos.ts) (parse → авторизация на host → DELETE videos/:id). `orig:index.js:1011-1024`
- [ ] **[should]** **`videos.opendialog`** — остаётся заглушкой: открывает UI-диалог загрузки, ждёт вычленения shared media-uploader'а из `video-uploader/` (UI-плумбинг Фазы E). `orig:index.js:966-1009`

---

## 3. Открытые вопросы — проверить ДО кодинга

- [x] **Через что грузит НАШ backend? — РАЗРЕШЕНО (2026-08-05).** Видео-shim'а НЕТ. `Action:'upload'` base64-эндпоинт существует **только для картинок** (`orig:js/image-uploader.js:74-77`, шлётся анонимно, без подписи/токена — кастомный эндпоинт на инстансе, не на ноде). Видео-путь оригинала (`js/peertube.js`, `js/video-uploader.js`) этот shim **не использует никогда** — только стандартный PeerTube resumable + полный blockChainAuth OAuth (Bearer, channelId). В новом приложении peertube-auth отсутствует полностью. base64 для больших видео нежизнеспособен. **Вывод: для видео нужен полный прямой путь — фазы A (discovery, `peertube/best` уже работает у картинок) + B (blockChainAuth OAuth) + C (resumable поверх appFetch). Обходного пути нет.**
- [ ] **Resumable поверх `appFetch`.** Протокольная логика реализована ([peertube-upload.ts](../src/services/peertube/peertube-upload.ts), юнит-тесты зелёные), но **вживую не гонялась**: `PUT` с `Content-Range` + тело `ArrayBuffer octet-stream` и чтение заголовка `Location` из `Response` — работают ли под torFetch и Tauri plugin-http? Если нет — нужен особый путь для Tauri (или channel-стриминг). **Остаётся самым рискованным техническим пунктом; проверять на реальном инстансе.**
- [ ] **CORS `Access-Control-Expose-Headers: Location`** на целевых инстансах/прокси (иначе resumable-init мёртв в браузере).
- [ ] **Плагин `blockChainAuth`** на целевых PeerTube-инстансах (кода в репо нет; без него подпись не мапится в аккаунт).
- [ ] **Клиентский транскод: оставляем?** Если backend-shim принимает сырой файл и PeerTube транскодит сам — наш локальный ffmpeg становится чисто опциональной экономией трафика; тогда фаза G из «предусловия» превращается в «опционально почистить».

---

## 4. Что переиспользуем как есть (reuse map)

- **Транскодер-синглтон** и `TranscodeResult` — [transcoder/index.ts](../src/b-components/video-uploader/transcoder/index.ts) (после фазы G).
- **IndexedDB-хранилище** как staging/retry-буфер загрузки — [transcoded-video-api.ts](../src/db/apis/transcoded-video-api.ts) (`getVideoBlob(id)` как источник байтов; добавить маркер `uploaded`/txid).
- **`appFetch`** — единственный допустимый транспорт: [fetch-strategies.ts](../src/helpers/api/fetch-strategies.ts).
- **Парсер указателя + детект типа поста** — [peertube-parser.ts](../src/helpers/api/peertube-parser.ts), [post-action.ts](../src/blockchain/core/actions/post-action.ts).
- **`needsCaption`** и submit-флоу композера — [use-post-composer.ts](../src/b-components/content/post-composer/use-post-composer.ts).
- **Паттерн host-resolution** — [image-upload-service.ts](../src/services/image-upload-service.ts) (`peertube/best`, dev vite-proxy, `normalizeImageUrl`).
- **Ключи для подписи** — auth-store/keys-store (P0-1 vault).

---

## 5. Рекомендуемый порядок

1. **§3 (открытые вопросы)** — сначала выяснить модель загрузки нашего backend (shim vs прямой). От этого зависит объём B/C.
2. **Фаза G** — починить отмену/синглтон транскодера (иначе всё поверх наследует баги).
3. **A → B → C** — discovery, auth, транспорт (или упрощённый shim, если он есть).
4. **D → E** — валидация + привязка к посту (мост в композер — ключевой UX).
5. **F → H** — кабинет, управление, mini-app.
