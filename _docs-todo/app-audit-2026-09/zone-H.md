## Зона: H — cross-cutting platform (i18n, IndexedDB, error/log, Tauri+Tor, Capacitor, build/PWA/CI)

### Находки
- **H1 · 🟠 высоко · security / ux-claim** — «Весь трафик через Tor» — но `<img>`, HLS-видео, iframe идут мимо Tor (= B3)
  - Файл: `src/locales/en.ts:175` / `ru.ts:179` (`header.torEnableContent`), `fetch-strategies.ts:16-29`, `src-tauri/tauri.conf.json` (нет `proxyUrl`), `lib.rs` (нет `WebviewWindowBuilder::proxy_url`)
  - Фикс: `proxyUrl: socks5://127.0.0.1:<socks_port>` окну (Tauri 2 `WebviewWindowBuilder::proxy_url`, требует пересоздания окна после старта Tor), либо переписать текст диалога и блокировать медиа/iframe в Tor-режиме.

- **H2 · 🟠 высоко · security** — ControlPort Tor открыт без аутентификации
  - Файл: `src-tauri/src/tor/config.rs:19,41`
  - Суть: torrc содержит `ControlPort 127.0.0.1:<port>` + `CookieAuthentication 0` без `HashedControlPassword`. Апп контрол-порт не использует. Любой локальный процесс делает `AUTHENTICATE` с пустым паролем и получает `SETEVENTS STREAM`/`GETINFO` (все хосты назначения → деанонимизация), `SETCONF`.
  - Фикс: `ControlPort 0` — код его не использует; если нужен — `CookieAuthentication 1` + `CookieAuthFile` 0600.
  - Уверенность: high.

- **H3 · 🟠 высоко · logic** — `TorWebSocket` никогда не переходит в OPEN: событие `tor:ws:<id>:open` эмитится до регистрации JS-слушателя
  - Файл: `src-tauri/src/tor/ws.rs:94,99,121` (emit `open` внутри `spawn_ws_loops` синхронно, ДО возврата `id`), `src/helpers/tor/tor-websocket.ts:124-141` (`listen(...)` после `await invoke('tor_ws_connect')`)
  - Суть: Tauri доставляет события только зарегистрированным слушателям (`tauri-2.10.2/src/event/listener.rs::emit_js_filter`, буфера нет). `open` теряется всегда → CONNECTING → `send()` бросает, входящие дропаются.
  - Сценарий: Tor ready → `ws-service.connect()` → «[WS] Connect timeout, forcing reconnect» → бесконечный реконнект; realtime в Tor-режиме не работает никогда.
  - Фикс: в `ws.rs` возвращать `id` до запуска циклов и эмитить `open` отложенно (или JS генерирует id и подписывается до `tor_ws_connect`).
  - Уверенность: high.

- **H4 · 🟠 высоко · consistency** — В production-сборке Tauri действуют ДВЕ CSP (meta из `index.html` + заголовок из `tauri.conf.json`), их пересечение блокирует iframe удалённых мини-аппов
  - Файл: `index.html:22` (`frame-src 'self' https:`), `src-tauri/tauri.conf.json:29` (`frame-src 'self' http://127.0.0.1:* https://*.youtube.com …` — без `https:`), `mini-app-frame.vue:108-116`
  - Суть: Tauri не удаляет `<meta http-equiv=CSP>` (`tauri-utils/html.rs::inject_csp` только добавляет). Браузер требует выполнения всех политик. `frame-src` для `https://tetris.amurkupon.ru` запрещён заголовком. В `tauri dev` работает (Vite), в бандле — нет. Аналогично `http://127.0.0.1:*` из конфига режется meta (IPFS-viewer).
  - Сценарий: production бандл → любая мини-аппа → спиннер до `miniapps.notResponding` через 45 с.
  - Фикс: один источник CSP — убрать meta при `VITE_TAURI` (transformIndexHtml) либо синхронизировать директивы.
  - Уверенность: medium-high (живой прод-бандл никто не проверял).

- **H5 · 🟠 высоко · ux-claim** — В Tauri (macOS/Linux) `window.open(_,'_blank')` и `<a target="_blank">` — no-op: нет `tauri-plugin-opener`/`shell` и не задан `on_new_window`
  - Файл: `lib.rs:581-585`, `Cargo.toml`, `host-context-methods/content.ts:33-38`, `post-share-menu.vue:107`, `header-notifications.vue:399`, `download-media.ts:45`, `profile-sidebar.vue:108`, `message-item/helpers.ts:28`, `text-formatter.ts:120`, `changelog/markdown.ts:29`
  - Суть: `new_window_handler` по умолчанию `None` → wry возвращает `nil` → WebKit отменяет навигацию; webkitgtk — то же. На Windows откроет голое popup-окно.
  - Сценарий: десктоп → «Поделиться → Twitter», ссылка в посте/чате, `externallink` из мини-аппы, сайт пользователя → ничего.
  - Фикс: `tauri-plugin-opener` + `opener:allow-open-url` и централизованный `openExternal(url)`; `on_new_window` → Deny + opener.
  - Уверенность: high.

- **H6 · 🟠 высоко · logic / security** — В release регистрируются ОС-глобальные хоткеи F12 и Ctrl+Shift+I, открывающие devtools Bastyon из любого приложения
  - Файл: `lib.rs:694-701` (вне `#[cfg(debug_assertions)]`), `:604-613`; в debug ещё глобальный Cmd/Ctrl+R (`:682`)
  - Сценарий: Windows, Bastyon свёрнут, Ctrl+Shift+I в Chrome → DevTools Chrome не открывается, всплывает инспектор Bastyon.
  - Фикс: снять глобальную регистрацию в release; devtools через локальный `keydown` в webview.
  - Уверенность: high.

- **H7 · 🟠 высоко · build** — Release-workflow сломан: `npm ci` против устаревшего `package-lock.json`; авторитетный lock — `pnpm-lock.yaml`
  - Файл: `.github/workflows/release.yml:77,121`, `package-lock.json` (24.05), `pnpm-lock.yaml` (06.08), `package.json` (`pnpm.overrides`)
  - Суть: в `package-lock.json` нет 16 зависимостей (`vue-i18n`, `zod`, `xss`, `jsqr`, `@editorjs/*`, `@ffmpeg/*`, `vite-plugin-pwa`…) и 7 расходятся по версиям. `npm ci` падает. `pnpm.overrides` (security-пины) npm игнорирует.
  - Фикс: удалить `package-lock.json`, `pnpm/action-setup` + `pnpm install --frozen-lockfile`.
  - Уверенность: high.

- **H8 · 🟠 высоко · consistency** — В десктопе без Tor `appFetch` → plugin-http, allowlist только `*.pocketnet.app`/matrix/127.0.0.1/dweb.link: CoinGecko, бэкенды мини-аппов и PeerTube-инстансы вне pocketnet.app отклоняются
  - Файл: `src-tauri/capabilities/default.json:17-29`, `fetch-strategies.ts:24-28`, `pkoin-chart.vue:110,158`, `fetch-tunnel.ts:72`, `mini-apps/actions/account.ts:130`, `peertube-instance.ts:27,48`
  - Сценарий: десктоп, Tor выкл → график PKOIN всегда «ошибка загрузки»; мини-аппа `authFetch` → `url not allowed…`; PeerTube `*.nohost.me` → ошибка (medium).
  - Фикс: расширить allowlist (`https://api.coingecko.com/**`, `https://**` для PeerTube/мини-аппов) или fallback на браузерный fetch при scope-ошибке.
  - Уверенность: high/medium.

- **H9 · 🟡 средне · security** — После `signOut`/`removeAccount` в IndexedDB остаются расшифрованные E2E-сообщения и Matrix sync-кэш (= E2)
  - Фикс: `purgeDecryptedCache()`, `notificationsAPI.deleteAllByAddress`, `indexedDB.deleteDatabase(getStoreDbName(userId))`.

- **H10 · 🟡 средне · security** — Tor fail-open (= B2): `process.rs:66-70` любая строка с `[err]`/`could not bind` → Failed → тумблер «вкл», торификация тихо отключена.

- **H11 · 🟡 средне · i18n** — Ключи `comments.blocked`/`comments.unblocked` отсутствуют в обоих словарях → тосты показывают сырой ключ
  - Файл: `use-profile-relations-actions.ts:47,50`, `blacklist-tab.vue:89`; в словарях есть `commentsMsg.blockSuccess`/`unblockSuccess`
  - Фикс: заменить ключи; добавить в `locales.test.ts` проверку литеральных ключей из кода (скрипт `zone-h/i18n-usage.js` готов).
  - Уверенность: high.

- **H12 · 🟡 средне · race / leak** — `tor_start` не защищён от `Installing`; `tor_stop` не отменяет установку; `Failed` с живым процессом порождает второго `tor`; тихая смерть процесса не сбрасывает `Ready`
  - Файл: `src-tauri/src/tor/mod.rs:145, 187-190`, `process.rs:55-118, 124-134`
  - Сценарий 1: `Installing` → тумблер выкл/вкл → две записи в один `archive_path` → `SHA256 mismatch`. 2: `[err]` при живом процессе → `Failed` → второй `tor`, первый сирота. 3: `tor` убит извне → статус `Ready`, всё падает, UI «Connected».
  - Фикс: включить `Installing` в guard; cancellation-token для инсталлера; убивать существующего child; `child.try_wait()` → `Off/Failed`; `blocking_write()`.
  - Уверенность: high/medium.

- **H13 · 🟡 средне · leak** — Rust `ws_map`/writer-таск/сокет не освобождаются при закрытии WS со стороны сервера
  - Файл: `src-tauri/src/tor/ws.rs:102,139-166,168-215`, `tor-websocket.ts:174-181, 99`
  - Фикс: в reader-таске по выходу `map.remove(&id)`; в JS `_onClose` → `invoke('tor_ws_close')`.

- **H14 · 🟡 средне · logic** — Если Dexie `open()` завершился ошибкой, приложение монтируется, но стор-слои не деградируют: каждые 30 с тост «Что-то пошло не так»
  - Файл: `main.ts:150-156, 112`, `notifications-store.ts:93-97`, `favorites-api.ts`, `post-card-header.vue:216-218,286-296`, `use-error-boundary.ts:87-89`
  - Сценарий: `VersionError` после отката билда / `InvalidStateError` (Firefox приватный) → тост каждые 30 с + на каждую карточку поста.
  - Фикс: флаг `dbUnavailable`; best-effort обёртки в API; не показывать тост для `VersionError`/`InvalidStateError`.
  - Уверенность: medium-high.

- **H15 · 🟡 средне · consistency (i18n)** — Пользовательские строки на русском мимо i18n
  - Файл: `star-rating-errors.ts:82-102` (5 тостов), `post-card-comments/helpers.ts:22-27`, `use-audio-playback.ts:63,128,144`, `use-partner-info.ts:86,125`, `use-search-navigation.ts:99` («Пост»), `use-feed.ts:185` и `post-mapper.ts:81` («Неизвестный автор»), `post-title-resolver.ts:53`, `transcoder/index.ts:105,126,133`, `wasm-transcoder.ts:109,185`, `free-balance-api.ts:150`, `tx-type-labels.ts:67`, `notification-toasts.ts:83` («От: …»), `use-comments-loader.ts:42`. Полный список — `zone-h/cyrillic-ui.txt`.
  - Фикс: перенести в `commentsMsg.*`/`appMsg.*`.

- **H16 · ⚪ низко · build** — Типизация: `.vue` не проверяются вообще; `miscreant` даёт 69 ошибок в node_modules; `RouteMeta.embed` не объявлен; lint не покрывает `src-mobile`
  - Файл: `tsconfig.json:24`, `node_modules/miscreant/package.json:7` (`"types": "src/index.ts"`), `src/types/router-meta.d.ts`, `package.json` lint, `vitest.config.ts:34` (exclude `src/main.js`)
  - Фикс: `vue-tsc --noEmit`; `paths: {"miscreant": ["node_modules/miscreant/release/index.d.ts"]}`; `embed?: boolean`; `eslint src/ src-mobile/`.

- **H17 · ⚪ низко · build/PWA** — `navigateFallbackDenylist` исключает `/app/*`, хотя `/app/:appId` — SPA-маршрут
  - Файл: `vite.config.js:135-136`, `router/index.ts:117`
  - Фикс: убрать `/^\/app\//` из denylist.

### Несостыковки между модулями
- **H18 · 🟡 средне · consistency / data** — Два источника истины для языка (= A19): `i18n/index.ts:20-38,54-66` (LS), `use-locale.ts` → `header-logo.vue:41,98-103`, `ui-store.ts:9-16,151-175` (IDB), `main.ts:91-93`, `general-tab.vue:55-64`. Для локали `de`: i18n стартует с `ru`, ui-store переключит на `en` — мигание.
  - Фикс: ui-store — владелец; `detectInitialLocale` и `detectDefaultLanguage` свести к одной функции.

- **H19 · ⚪ низко · consistency / data** — Таблица `favorites` не привязана к аккаунту (в отличие от `notifications`, `postRatingsPending`, `decryptedMessages`)
  - Файл: `src/db/database.ts:23,35`, `favorites-api.ts`, `post-card-header.vue:216-218,286-296`, `use-infinite-feed-fetchers.ts:44`
  - Фикс: v3 схемы `favorites: '[address+id], address, addedAt'` с миграцией, или задокументировать «на устройство».

- **H20 · ⚪ низко · consistency** — Capabilities не совпадают с вызовами: `use-video-fullscreen.ts:64,98` требует `core:window:allow-set-fullscreen` (нет → всегда catch, шаг мёртв); `global-shortcut:allow-*` и `core:webview:allow-set-webview-zoom` выданы webview, но не используются (лишняя поверхность).
  - Фикс: добавить `allow-set-fullscreen`, убрать неиспользуемые.

### Проверено — ОК
- i18n: ru/en симметричны (1436/1436), 0 расхождений плейсхолдеров; все 9 динамических ключей покрыты; 130 `*Key`-пропсов существуют; 97 вызовов `t(key,{…})` — параметры совпадают; `locales.test.ts` 5/5. 140 ключей не используются (`unused-keys.txt`).
- Dexie: v1→v2 корректна; vault в отдельной raw-IDB `bastyon-vault`; `settings`-мапы ключуются по адресу.
- use-error-boundary: дедуп, в проде без стеков; silence-console глушит только log/debug; request-debug только URL/тайминги.
- Tor installer: URL pinned на archive.torproject.org HTTPS, SHA256 сверяется; tar/zip защищены от traversal; SOCKS/Control только 127.0.0.1; `__OwningControllerProcess`; ws.rs всегда через SOCKS (fail-closed) с rustls; `tor_set_bridges` без инъекций.
- Tauri: `save()` добавляет путь в fs-scope; assetProtocol scope ограничен; все `invoke()` существуют; deep-link не заявлен.
- Mobile: `allowBackup=false`; провайдеры `exported=false`; cleartext не нужен; iOS usage-descriptions есть; ATS без исключений.
- Build/PWA: SW не регистрируется в Tauri; HLS-кэш ограничен; check-inline-styles ok (vueBind=12, plain=0), check-breakpoints ok; husky pre-commit гоняет lint-staged + чеки; CSP meta для веба строгая; release.yml permissions минимальные.
