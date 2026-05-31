# Аудит кода: оставшиеся работы

Дата актуализации: 2026-05-31
Скоуп: `src/`, `src-mobile/`, `index.html`
Конвенции проекта: `eslint.config.js`, `.stylelintrc.json`, `.prettierrc` (плюс правила в auto-memory Claude)
Стек: Vue 3.5 + TS, Pinia, Vue Query, vue3-styled-components, Vue Router 4, Vite 6

## Открытые риски

| # | Категория | Что не так | Приоритет |
|---|-----------|------------|-----------|
| 1 | God-объекты | `messenger-chat-store.ts` 1401, `post-card-comments.vue` 1198, `video-player.vue` 888, `matrix-service.ts` 451 | Средний |
| 2 | TS-качество | ~291 вхождений `any`/`as any` в коде (без тестов); `no-explicit-any: warn` включён, нужен план снижения до ~50 | Средний |
| 3 | Тесты | critical-модули вне блокчейна без тестов: `messenger/` (store, services), `video-player`, `mini-apps/actions/host-context-methods` | Средний |
| 4 | Inline `:style` | 27 vue-`:style` literal + 56 plain HTML `style="..."` — остаток one-off margin/padding/hex-color tweaks | Низкий |
| 5 | Остаточные deps-CVE | HIGH `node-fetch` (через `vue3-styled-components@1.2.1`), LOW elliptic (нет патча) | Средний |
| 6 | CSP-жёсткость | `style-src` всё ещё с `'unsafe-inline'` — нужен из-за vue3-styled-components | Низкий |
| 7 | i18n | мелкий остаток user-facing строк в `.ts` (relative-time, blockchain reg-ошибки, байт-юниты) | Низкий |

---

## 1. Гигантские компоненты — декомпозиция

| Файл | Строк | Что делать |
|------|-------|-----------|
| `b-components/messenger/store/messenger-chat-store.ts` | 1401 | Разнести по доменам (rooms, messages, presence, typing) |
| `b-components/content/post-card/components/post-card-comments/post-card-comments.vue` | 1198 | Compose: `use-comments-tree`, `use-reply-panel`, `use-comments-display` |
| `b-components/content/video-player/video-player.vue` | 888 | Вынести HLS, controls, analytics в composables (`use-video-hls` уже частично) |
| `b-components/messenger/services/matrix-service.ts` | 451 | Класс-фасад уже делегирует media/address-codec/mxc-resolver. Осталось отделить sync (event-loop, state restore), encryption (CryptoJS-обёртки + secrets) и transport (init/login/keepalive) — требует тестов |

---

## 2. TS-качество

~291 вхождений `: any` / `as any` в `src/**/*.{ts,vue}` (без тестов). Топ-должники: `messenger/store/messenger-chat-store.ts` (~35), `composables/use-feed.ts` (~17), `messenger/helpers.ts` (~13), `messenger/store/messenger-store.ts` (~12).

Когда счётчик опустится до ~50, поднять lint-правило с `warn` до `error`.

---

## 3. CSS / Styled-components

### 3.1. Inline `:style` — миграция остатков
27 vue-`:style` literal-объектов + 56 plain HTML `style="..."`. Мелкие one-off (margin/padding tweaks, hex-цвета в alert-плашках, RouterLink с inline style в block-explorer). Per-file работа. После каждой волны — `node scripts/check-inline-styles.mjs --update-baseline`.

### 3.2. Дублирование стилей
`SC_SectionTitle` (`font-size: 16px; font-weight: 600; color: rgb(33,33,33);`) повторяется в 5+ файлах: `wallets-page.styled.ts:70`, `pkoin-chart.styled.ts:10`, `mini-apps-grid.styled.ts:12`, `peers-page.styled.ts:55`. Вынести в `src/components/typography/` или `src/styles/shared.ts`.

### 3.3. Большие styled-файлы (>200 строк)
- `wallet-transfer.styled.ts` — 266
- `block-explorer-page.styled.ts` — 262
- `block-page.styled.ts` — 247
- `wallets-page.styled.ts` — 228
- `address-page.styled.ts` — 223
- `explorer-search.styled.ts` — 215
- `peers-page.styled.ts` — 212
- `search-page.styled.ts` — 210
- `tx-page.styled.ts` — 203

Большая часть — block-explorer и wallets. Вынести общие SC-токены (`SC_StatCard`, `SC_SectionTitle`, `SC_Table`) в `src/pages/block-explorer-page/components/shared/` и `src/pages/wallets-page/components/shared/`.

### 3.4. Дублирование брейкпоинтов (мягкое)
`BREAKPOINTS` в токенах, плюс `style.css` имеет свои `@media (max-width: 480px / 768px)`. Долгосрочно — генерация `@media` из токенов через PostCSS-плагин либо CI-проверка соответствия.

---

## 4. Тесты

Без тестов (тяжёлые — нужны моки matrix-sdk/Vue или предварительная декомпозиция):
- `messenger/store/messenger-chat-store` (god-объект 1401 — сначала разнести), `messenger/services/{pcrypto,encryption-service,group-encryption,media-*}`, `messenger/services/decryption-cache` (фабрика-замыкание — тестируема).
- `video-player.vue`.
- `mini-apps/actions/host-context-methods/*` (auth/rpc/content/chat/payments/media — фабрики с DI, тестируемы при моках роутера/auth-store/matrixService).
- `blockchain/core/keys/bip39-loader` (инфраструктурный lazy-load require/import).

Следующие кандидаты с лучшим ROI: `mini-apps/actions/host-context-methods/auth`, `messenger/services/decryption-cache`.

---

## 5. HTML / семантика / a11y

- Декоративные иконки в messenger-window/panel (closeIcon, arrowBackIcon) и audio-message (playIcon/pauseIcon) — навесить `aria-label` на родительские кнопки.
- `<article>` для `post-card` не реализовано (требует ревизии каскада `SC_PostCard`).
- `<footer>` для приложения — добавить когда появится контент.

---

## 6. Архитектурные риски

- `package.json` указывает `"vue-router": "^5.0.1"` — это alias, фактически используется API v4. Свериться, тот ли пакет в lockfile.
- `vue3-styled-components@1.2.1` — без релизов с мая 2023, тянет уязвимый `node-fetch`. Решение архитектурного уровня: заменить на `pinceau`, нативные CSS Modules или форкнуть.

---

## 7. blockchain/ — открытые наблюдения (не исправлено)

- `ws-service`: `reconnectAttempt` сбрасывается только при успешном `onopen` или явном `reconnect()`; `close()`/`destroy()` его не трогают. Если соединение никогда не открывается, backoff растёт до `RECONNECT_MAX_DELAY` и там залипает.
- `signTransactionInput`: параметр `options` по умолчанию `{ inputIndex: 0 }`, а `index = optIndex ?? inputIndex` → при вызове без `options` позиционный `inputIndex` игнорируется (всегда 0). Позиционный аргумент фактически мёртв — почистить сигнатуру.

---

## 8. mini-apps/

- **Remote registry без подписи манифестов.** [registry/remote-registry.ts:78-98](src/mini-apps/registry/remote-registry.ts#L78) — `rpc('getapps', ...)`, ответ ноды доверяется. По принципу decentralization лучше проверять `signature` от автора (on-chain pubkey).
- **`openExternalPayment` — stub.** Нужен парсер `ext`-хеша legacy-формата. Поднимать когда понадобится совместимость с конкретной миниаппой.
- **Fetch-tunnel HMAC.** Сейчас не подписывает запросы. Имеет смысл только при появлении внешнего proxy-релея (Tor-транспорт), где сервер должен убеждаться в идентичности отправителя.
- **`host-context-methods/*` без тестов** (auth/rpc/content/chat/payments/media — фабрики с DI).

---

## 9. Остаточные deps-CVE

2 уязвимости после `pnpm.overrides`:

| Severity | Пакет | Где | Что делать |
|---|---|---|---|
| HIGH | `node-fetch <2.6.7` (GHSA-r683-j2x4-v87g) | `vue3-styled-components@1.2.1 → glamor → fbjs → isomorphic-fetch → node-fetch` | Заменить `vue3-styled-components` (не обновлялся с мая 2023). Архитектурный сдвиг. В браузерной сборке node-fetch не активен — можно принять как accepted risk до миграции |
| LOW | `elliptic <=6.6.1` — рискованная криптопримитива (нет патча) | direct + транзит через bitcoin-libs | Патч не существует. Долгосрочно — миграция на elliptic 7.0+ или другую кривую |

### 9.1. Прочие риски цепочки поставок
- `bip39russian@1.0.7` — форк от единственного автора (grish2018), не мейнстрим. Единственный источник русского BIP39-словаря; стоит провести ручное ревью исходников и зафиксировать в `pnpm-lock.yaml`.
- `crypto-js@4.2.0` для AES — в новом коде использовать `crypto.subtle` (Web Crypto API).
- `miscreant@0.3.2` — без обновлений с 2017, помечен как legacy.

---

## 10. Производительность

### 10.1. Виртуализация
Нет `vue-virtual-scroller` / `@tanstack/vue-virtual` в deps. При этом:
- [post-card-comments.vue:161](src/b-components/content/post-card/components/post-card-comments/post-card-comments.vue#L161) — `v-for` по всем `visibleComments`.
- В мессенджере чат рендерит 100+ сообщений в DOM.

Внедрить виртуализацию для лент >50 элементов; начать с мессенджера (память + TTI).

### 10.2. Реактивность в god-файлах
- [video-player.vue](src/b-components/content/video-player/video-player.vue) — 6+ `computed` + 8+ `watch`/`watchEffect` в одном файле. Кандидаты на `throttle`/`debounce` (особенно прогресс-бар, time updates).
- [post-card-comments.vue](src/b-components/content/post-card/components/post-card-comments/post-card-comments.vue) — `getReplies()` вызывается из шаблона на каждый рендер; перевести в `computed` с мемоизацией.
- [messenger-chat-store.ts:82-95](src/b-components/messenger/store/messenger-chat-store.ts#L82) — секретный декрипт без debounce; на bulk-обновлениях ленты может стопорить.

---

## 11. i18n — остаток

Паттерн: `t('domain.key')` (`useI18n()` в компонентах; глобальный `t` из `@/i18n` в `.ts`); словари `src/locales/{ru,en}.ts`, симметрию ключей/плейсхолдеров страхует [`locales.test.ts`](src/locales/locales.test.ts).

Остаток user-facing строк в `.ts` (низкая частота/видимость):
- relative-time в `notification-formatter.ts` — свести к существующему `appMsg.time`.
- error-строки в `blockchain/{wallet-addresses,api/free-balance-api}.ts` (регистрация / доп. кошельки).
- байт-форматтеры (`Б/КБ/МБ`), `format-explorer.ts`.
- билингвальные тернарники в `changelog-view`/`whats-new-modal` (`language==='ru' ? … : …`) → перевести на `t()`.

---

## Шаги по убыванию ROI

**🔴 Срочно:**
1. **Заменить `vue3-styled-components`** — закроет последний HIGH `node-fetch` и позволит снять `'unsafe-inline'` со `style-src`. Архитектурное решение: `pinceau` / CSS Modules / форк.

**🟡 Защита и регулярная работа:**
2. **Тесты для критики (не-blockchain)** — `messenger/store` (после декомпозиции), `messenger/services/decryption-cache`, `video-player`, `mini-apps/actions/host-context-methods`.
3. **Декомпозиция god-объектов** — `messenger-chat-store` → доменные сторы; `post-card-comments` → подкомпоненты + composables; `video-player` → `use-media-session`, `use-progress-bar-interaction`; `matrix-service` → sync/encryption/transport.
4. **Inline `:style` → styled (доделать)** — остаток 27+56 mostly one-off margin/padding tweaks. Per-file работа.
5. **Виртуализация списков** — мессенджер чат и комментарии (>50 элементов).

**🟢 Точечная гигиена:**
6. **TS-чистка `any`** — основной долг в `messenger/`, `matrix-service.ts`. Цель — спустить с ~291 до ~50 и поднять lint до `error`.
7. **i18n-остаток** — добить `.ts`-строки из §11.
