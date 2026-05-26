# Мини-приложения — что осталось

> Этапы 1–5 (типы, bridge, registry, stores, permissions, **все** 45 action handlers)
> и большая часть этапа 7 (UI: grid с поиском/каталогом/пагинацией, frame с лепестком
> закрытия, full-screen режим, favorites через звёздочки в сайдбаре) — **закрыты**.
> Wire-протокол с legacy-миниаппами работает (Barteron / Bastyon Docs / прочие
> успешно проходят `appinfo` → `loaded`, ответы на RPC, push-события setup'а).
>
> Опорная архитектурная история живёт в git-логе (искать `feat: miniapps`).
> Source-of-truth по wire-протоколу — в исходниках:
> [src/mini-apps/types/messages.ts](../src/mini-apps/types/messages.ts),
> [src/mini-apps/types/permissions.ts](../src/mini-apps/types/permissions.ts),
> [src/mini-apps/actions/_schema.ts](../src/mini-apps/actions/_schema.ts).
>
> Legacy-источник для сравнения — [pocketnet.gui MINIAPPS.md](../../___original-repos/pocketnet.gui/MINIAPPS.md).

---

## 1. Action handlers — оставшиеся

### 1.1 5.8 media (этап ⏳)

Действия: `images.upload`, `videos.opendialog`, `videos.remove`, `mobile.camera`.

- `mobile.camera` — заглушка-кейс: вернуть `{rejected: 'not_implemented'}` пока
  Capacitor Camera plugin не подключён к miniapp-флоу.
- `images.upload` — нужна интеграция с image-pipeline nextgen
  ([src/b-components/video-uploader/](../src/b-components/video-uploader/)
  есть, но это для постов; для миниапп нужен отдельный flow).
- `videos.opendialog`, `videos.remove` — связь с peertube-загрузчиком, его
  ещё нет в nextgen.

Где зашить: новый файл `src/mini-apps/actions/media.ts`, добавить в
[ui/use-mini-app-bridge.ts](../src/mini-apps/ui/use-mini-app-bridge.ts).

### 1.2 5.11 psdk (этап ⏳)

Один метод — `psdk.userInfoLoad(addresses, light, update)`. Возвращает массив
профилей пользователей по адресам. Legacy: `app.platform.psdk.userInfo.load(...)`.

В nextgen есть [composables/use-user-queries.ts](../src/composables/use-user-queries.ts)
с `useUserState`/`useUserProfile` — нужно соорудить функцию которая принимает массив
адресов и возвращает массив профилей (через RPC `getuserprofile`).

### 1.3 Stub-handlers — превратить в реальные

Сейчас возвращают `{rejected: 'not_implemented'}` или throw:

- `payment` / `ext` (5.5) — ждёт wallet UI nextgen
- `chat.getOrCreateRoom` / `chat.send` (5.7) — нужна Matrix-обёртка для миниапп
- `barteron.account` / `barteron.offer` / `barteron.removeOffer` / `barteron.comment`
  / `barteron.vote` (5.9) — нужны портированные классы `brtAccount`/`brtOffer`/
  `Comment`/`UpvoteShare`/`Remove` и tx-builder для barteron-схемы
- `registerForNotifications` — нужен Firebase token registration
- `openComplain` — нужен complain modal в host
- `openExternalPayment` — то же что payment

---

## 2. Этап 6. Push-события (host → iframe)

Bridge.push() работает, но **источники** не подключены. Миниаппы не получат
от хоста:

- `theme.changed` — при смене темы в ui-store
- `locale.changed` — при смене языка
- `keyboard` — при появлении/скрытии клавиатуры (Capacitor)
- `block` / `state` / `balance` / `action` — из `@/blockchain/ws`
- `changestate` — синхронизация роутинга

Где зашить: `src/mini-apps/events/sources.ts` (новый файл). В нём watch'еры
на сторы, при изменении дёргают `miniAppsBridge.pushAll(key, data)`.

Plus visibility-фильтр (не пушить в скрытые iframe) и debounce для `block`.

---

## 3. Этап 8. Rate limiting + квоты

Не реализовано. Действия имеют поле `rateLimitClass`, но bridge его не учитывает.

Нужно: `src/mini-apps/core/rate-limiter.ts` — token bucket per `(appId, rateLimitClass)`.
Превышение → `error: { message: 'rate_limit_exceeded', retryAfter: <ms> }`.

---

## 4. Этап 9. FETCH-туннель для alttransport (Tor)

Bridge принимает `FETCH_REQUEST`, но `onFetchRequest` не сконфигурирован →
отвечает `fetch_tunnel_not_configured`. Нужно:

- `src/mini-apps/core/service-worker-tunnel.ts` — реализация туннеля с HMAC,
  allowlist хостов, per-app rate limit
- В `bootMiniApps()` передать в `bridge.start({onFetchRequest})`

Только когда у хоста есть Tor (`useTorStore().isReady`).

---

## 5. Этап 10. Observability

- Структурированное логирование RPC (через `services/logger`) — есть, но без аггрегации
- Devtools-panel в settings: live-фид сообщений per app — не сделано
- Метрики per app: `metrics[appId] = { rpcCount, errorRate, lastUsedAt }` — не собираем

---

## 6. Этап 11. Новый SDK для будущих миниапп (`@bastyon/miniapp-sdk`)

Отдельный пакет, не блокирует nextgen master. Существующие миниаппы продолжают
тянуть legacy SDK с `bastyon.com/js/lib/apps/sdk.js`.

- Отдельный воркспейс/репо `packages/miniapp-sdk/`
- TS, ESM + UMD, public API = подмножество legacy `BastyonSdk`
- Без `Proxy` на `history.pushState` (заменить на явный `sdk.setRoute(path)`)
- AbortSignal-поддержка
- Публикация на npm

---

## 7. Этап 12. Compatibility tests

- `__tests__/compat.legacy.test.ts` — грузит реальный legacy `sdk.js` в jsdom-iframe,
  прогоняет каждый метод против нашего хоста
- Playwright e2e: Barteron / WPKOIN / Swipelux в реальном iframe против локального
  dev-host
- Регрессионный snapshot формы `postMessage` сообщений

---

## 8. Этап 13. Документация

- `src/mini-apps/README.md` — как добавить action / опубликовать миниаппу / тестировать локально
- `_DOCS/MINIAPPS_ARCHITECTURE.md` — финальная архитектура (как legacy MINIAPPS.md)
- `_DOCS/MINIAPPS_SECURITY.md` — модель угроз и что защищаем

---

## 9. Polish — отложенное в UI

- **`mini-app-info-sheet.vue`** — экран настроек установленной миниаппы (revoke
  permissions per item, размер кэша, кнопка «удалить»). Сейчас на странице
  миниаппы только лепесток-закрывашка.
- **`permission-prompt.vue`** — заменить `window.confirm` на ant-design modal
  с описанием permission'а из i18n (`permissions_name_account` и т.п.).
- **Кнопка «📌 Закрепить»** в шапке `mini-app-frame.vue` — вызывает
  `appsStore.pinSession(appId)` (метод готов). Сейчас закрепить можно только
  через звёздочку в каталоге.
- **Tag-фильтр в каталоге** — поиск сейчас только текстовый. RemoteAppEntry уже
  содержит `tags` поле.
- **Infinite scroll** — сейчас кнопка «Загрузить ещё». IntersectionObserver
  заменит на автоподгрузку.

---

## 10. Открытые вопросы

- **Migration legacy localStorage** (`apps_<address>`, `app_<id>`) — у nextgen-юзеров
  нет legacy-state, реализовывать имеет смысл только если будет dual-stack запуск.
- **Curated remote registry с подписью** — сейчас опираемся на on-chain (RPC
  `getapps` отдаёт транзакции type=221 с подписанными авторами). Дополнительный
  signed-JSON курации от pocketnet team не реализован. Нужно решать с командой
  есть ли смысл при on-chain источнике.
- **AbortSignal end-to-end в RPC-слой** — `getByPRC` его не принимает. Bridge
  таймаут останавливает наше ожидание, но fetch к ноде живёт до конца.
- **`@bastyon/miniapp-sdk` publish strategy** — куда хостить (npm-org? CDN?
  публиковать с релизами nextgen?).

---

## Что НЕ делаем (out of scope для v1)

- Магазин-листинг с публикацией/модерацией приложений
- Платный листинг / встроенные рейтинги (legacy `openratingform`)
- Live-reload IDE для разработчиков миниапп
- Поддержка iOS WKWebView quirks (это для Capacitor — отдельный проход)
