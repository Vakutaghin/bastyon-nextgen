# Мини-приложения — что осталось

> Большая часть инфраструктуры закрыта: типы, bridge, registry, stores,
> permissions, 45 action handlers, UI (grid/каталог/frame/favorites),
> push-события, rate-limiter, ant-design permission-prompt, chat wire-up,
> `mobile.camera`, `psdk.userInfoLoad`. Wire-протокол с legacy-миниаппами
> работает (Barteron / Bastyon Docs и пр.).
>
> Опорная архитектура — в git-логе (искать `feat: miniapps`).
> Source-of-truth по wire-протоколу:
> [src/mini-apps/types/messages.ts](../src/mini-apps/types/messages.ts),
> [src/mini-apps/types/permissions.ts](../src/mini-apps/types/permissions.ts),
> [src/mini-apps/actions/_schema.ts](../src/mini-apps/actions/_schema.ts).
>
> Legacy-источник для сравнения — [pocketnet.gui MINIAPPS.md](../../___original-repos/pocketnet.gui/MINIAPPS.md).

> **Принцип**: не тащим legacy-классы из `pocketnet.gui` если в nextgen уже есть
> аналог. Каждый stub'овый action-хэндлер должен быть **тонкой обёрткой** над
> существующим composable / store / service. Если такого аналога в nextgen нет —
> создаём его как переиспользуемый модуль (не специфичный для миниапп).

---

## 1. Stub-handlers — превратить в реальные

### 1.1 `images.upload`

Нужно вычленить из [b-components/video-uploader/](../src/b-components/video-uploader/)
shared upload-flow (transcoder уже модульный — `./transcoder/`). Создать
`src/helpers/media-uploader.ts` с интерфейсом `{file, onProgress, onComplete}`,
использовать как из постов, так и из миниапп. Подключить в
[actions/media.ts](../src/mini-apps/actions/media.ts) вместо stub'а.

### 1.2 `videos.opendialog` / `videos.remove`

Peertube-загрузчика в nextgen нет. Остаются stub'ом до отдельного эпика.

### 1.3 `payment` / `ext` / `openExternalPayment` (5.5)

В nextgen есть [pages/wallets-page/wallet-transfer/wallet-transfer.vue](../src/pages/wallets-page/wallet-transfer/wallet-transfer.vue),
но это **страница**, не modal. Нужно либо превратить её в переиспользуемый
modal-компонент (с props `{address, amount, message}`), либо вынести
core-логику send'а в composable `useWalletTransfer()` и дёргать через
`modalStore`. Stub в
[host-context.ts:320-328](../src/mini-apps/actions/host-context.ts#L320-L328)
заменяется на `modalStore.open` + `await result`. `openExternalPayment` — та
же modal с флагом `external: true`.

### 1.4 `barteron.*` (5.9)

`brtAccount`/`brtOffer`/`Comment`/`UpvoteShare`/`Remove` в nextgen не
портированы. Если приоритет на standalone Barteron — нужен отдельный план
портирования barteron-схемы + tx-builder.

### 1.5 `registerForNotifications`

В deps нет ни `firebase` ни `@capacitor-firebase/messaging`. Требует отдельной
интеграции push-стека.

### 1.6 `openComplain`

Complaint-модалки в nextgen пока нет. Когда появится общая complaint-UI
(сейчас в legacy на странице поста), action-handler станет тонкой обёрткой.

### 1.7 Групповые matrix-комнаты в `chat.getOrCreateRoom`

Сейчас поддерживается только 1-на-1 (через `matrix-service.createDirectRoom`).
Для `users.length > 1` бросаем `chat_group_rooms_not_supported`. Когда
понадобятся группы — добавить `createGroupRoom(invitees, params)` в
[matrix-service.ts](../src/b-components/messenger/services/matrix-service.ts).

---

## 2. Push-события — доработки

- **Visibility-фильтр**: не пушить в скрытые iframe. Сейчас `bridge.pushAll`
  шлёт всем зарегистрированным connections. Будет иметь смысл когда добавим
  background-tab отслеживание в `appsStore`.
- **Debounce для `block`**: пока не требуется (pocketnet-блоки ~60s apart).
  Если столкнёмся со spike-нагрузкой — обернуть в `useDebounceFn`.

---

## 3. Этап 9. FETCH-туннель для alttransport (Tor)

Bridge принимает `FETCH_REQUEST`, но `onFetchRequest` не сконфигурирован →
отвечает `fetch_tunnel_not_configured`. У нас уже есть Tor-инфра:

- [helpers/tor/tor-websocket.ts](../src/helpers/tor/tor-websocket.ts) — реальный Tor-транспорт
- [stores/tor-store.ts](../src/stores/tor-store.ts) — `isReady` флаг

Нужно: `src/mini-apps/core/fetch-tunnel.ts` — fetch через тот же Tor-транспорт,
HMAC, allowlist хостов из манифеста аппа, per-app rate limit (через
[rate-limiter](../src/mini-apps/core/rate-limiter.ts)). В `bootMiniApps()` —
`bridge.start({onFetchRequest: tunnel.handle})` только если `useTorStore().isReady`.

---

## 4. Этап 10. Observability — доработки

- Devtools-panel в settings: live-фид сообщений per app.
- Метрики per app: `metrics[appId] = { rpcCount, errorRate, lastUsedAt }` —
  собираем в-памяти в `apps-store`, выводим в `mini-app-info-sheet.vue` (см. §6).

---

## 5. Этап 11. Новый SDK для будущих миниапп (`@bastyon/miniapp-sdk`)

Отдельный пакет, не блокирует nextgen master. Существующие миниаппы продолжают
тянуть legacy SDK с `bastyon.com/js/lib/apps/sdk.js`.

- Отдельный воркспейс/репо `packages/miniapp-sdk/`
- TS, ESM + UMD, public API = подмножество legacy `BastyonSdk`
- Без `Proxy` на `history.pushState` (заменить на явный `sdk.setRoute(path)`)
- AbortSignal-поддержка
- Публикация на npm

---

## 6. Этап 12. Compatibility tests

- `__tests__/compat.legacy.test.ts` — грузит реальный legacy `sdk.js` в jsdom-iframe,
  прогоняет каждый метод против нашего хоста
- Playwright e2e: Barteron / WPKOIN / Swipelux в реальном iframe против локального
  dev-host
- Регрессионный snapshot формы `postMessage` сообщений

---

## 7. Этап 13. Документация

- `src/mini-apps/README.md` — как добавить action / опубликовать миниаппу / тестировать локально
- `_DOCS/MINIAPPS_ARCHITECTURE.md` — финальная архитектура (как legacy MINIAPPS.md)
- `_DOCS/MINIAPPS_SECURITY.md` — модель угроз и что защищаем

---

## 8. Polish — отложенное в UI

- **`mini-app-info-sheet.vue`** — экран настроек установленной миниаппы (revoke
  permissions per item, размер кэша, кнопка «удалить», метрики из §4). Сейчас
  на странице миниаппы только лепесток-закрывашка.
- **Кнопка «📌 Закрепить»** в шапке `mini-app-frame.vue` — вызывает
  `appsStore.pinSession(appId)` (метод готов). Сейчас закрепить можно только
  через звёздочку в каталоге.
- **Tag-фильтр в каталоге** — поиск сейчас только текстовый. RemoteAppEntry уже
  содержит `tags` поле.
- **Infinite scroll** — сейчас кнопка «Загрузить ещё». IntersectionObserver
  заменит на автоподгрузку.

---

## 9. Открытые вопросы

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
- **Wallet-transfer как modal vs page** — превратить в reusable modal или
  вынести core в `useWalletTransfer()` composable? Влияет на UX как из миниаппы,
  так и из обычной отправки. Блокирует §1.3.

---

## Что НЕ делаем (out of scope для v1)

- Магазин-листинг с публикацией/модерацией приложений
- Платный листинг / встроенные рейтинги (legacy `openratingform`)
- Live-reload IDE для разработчиков миниапп
- Поддержка iOS WKWebView quirks (это для Capacitor — отдельный проход)
- Barteron action-handlers (отдельный эпик с портированием схемы)
- Push-нотификации через FCM (нет Firebase в deps)
