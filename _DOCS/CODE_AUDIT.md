# Аудит кода: оставшиеся работы

Дата актуализации: 2026-05-29
Скоуп: `src/`, `src-mobile/`, `index.html`
Конвенции проекта: `eslint.config.js`, `.stylelintrc.json`, `.prettierrc` (плюс правила в auto-memory Claude)
Стек: Vue 3.5 + TS, Pinia, Vue Query, vue3-styled-components, Vue Router 4, Vite 6

## Открытые риски

| # | Категория | Что не так | Приоритет |
|---|-----------|------------|-----------|
| 1 | God-объекты | `messenger-chat-store.ts` 1401, `post-card-comments.vue` 1198, `video-player.vue` 888, `matrix-service.ts` 451 (после частичного разноса — нужно sync/encryption/transport) | Средний |
| 2 | TS-качество | 333 вхождений `any`/`as any` в коде (без тестов); `no-explicit-any: warn` уже включён, нужен план снижения до ~50 | Средний |
| 3 | i18n | Инфраструктура подключена; словари `ru.ts`/`en.ts` пока ~30 ключей, UI-строки компонентов почти не вынесены | Средний |
| 4 | Тесты | ~11% покрытие (84 теста на 753 исходных файла); critical-модули (`blockchain/`, `messenger/`, `video-player`, `mini-apps/`) почти без тестов | Средний |
| 5 | Inline `:style` (миграция) | 27 vue-`:style` literal + 56 plain HTML `style="..."`. Регрессии заблокированы baseline-скриптом; остаток — мелкие one-off | Низкий |
| 6 | Остаточные deps-CVE | 2 уязвимости: HIGH `node-fetch` (через `vue3-styled-components@1.2.1`, заброшенная либа), LOW elliptic (нет патча) | Средний |
| 7 | CSP-жёсткость | `style-src` всё ещё с `'unsafe-inline'` — нужен из-за vue3-styled-components. Снять можно только после замены либы | Низкий |

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

333 вхождения `: any` / `as any` в `src/**/*.{ts,vue}` (без тестов). `@typescript-eslint/no-explicit-any: warn` уже включён — теперь нужна постепенная чистка. Основной долг — `messenger/`, `matrix-service.ts`.

Когда счётчик опустится до ~50, поднять lint-правило с `warn` до `error`.

---

## 3. CSS / Styled-components

### 3.1. Inline `:style` — миграция остатков
27 vue-`:style` literal-объектов + 56 plain HTML `style="..."`. Регрессии блокирует `scripts/check-inline-styles.mjs` (baseline в pre-commit), новый код через lint-warn `vue/no-restricted-syntax`.

Остаток — мелкие one-off (margin/padding tweaks, hex-цвета в alert-плашках, RouterLink с inline style в block-explorer). Per-file работа. После каждой волны — `node scripts/check-inline-styles.mjs --update-baseline`.

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

### 3.4. Keyframes — дубли
Похожие keyframes в разных файлах: `@keyframes pulse` (`mini-app-frame.styled.ts:57`), `@keyframes live-pulse` (`block-explorer-page.styled.ts:77`), а также 5+ дублей `@keyframes spin` в messenger-компонентах. Завести `src/styles/keyframes.ts` с общими анимациями.

### 3.5. Дублирование брейкпоинтов (мягкое)
`BREAKPOINTS` в токенах, плюс `style.css` имеет свои `@media (max-width: 480px / 768px)`. Значения зафиксированы комментариями `BREAKPOINTS.TABLET/MOBILE`, но формально не связаны. Долгосрочно — генерация `@media` из токенов через PostCSS-плагин либо CI-проверка соответствия.

---

## 4. i18n: вынос строк UI

Инфраструктура подключена (`vue-i18n@11`, `src/i18n/`, `src/locales/{ru,en}.ts`, composable `use-locale.ts`, router `meta.titleKey`).

Состояние словарей: `ru.ts` 34 строки, `en.ts` 30 строк — пока только router titles, считай нулевое покрытие компонентов.

Осталось:
- Пройти по компонентам и заменить захардкоженные русские строки на `t('...')`.
- Добавить ключи в `src/locales/{ru,en}.ts` для компонентов, форм, тостов, label'ов.
- Обновить language switcher в [header-logo.vue:89](src/b-components/header/header-logo/header-logo.vue#L89) — сейчас мутирует локальный `logoData.value.currentLanguage`, а должен дёргать `useLocale().setLocale()` (TODO висит в коде).

---

## 5. Тесты

- 84 теста на 753 исходных файла (~11%). Источник растёт быстрее, чем тесты.
- Покрыты в основном сторы и helpers. Composables и UI-компоненты — почти нет.
- Критичные модули без тестов: `blockchain/` (api, ws, signatures, addresses, transactions), `messenger/`, `video-player`, `mini-apps/actions`.
- Начать с `blockchain/api/request-signer` и `blockchain/ws/ws-service` (reconnect + auth) — там самая высокая цена бага.

---

## 6. HTML / семантика / a11y

- Inconsistent `alt=""` для смысловых изображений — нужно пройти отдельно.
- `<article>` для `post-card` не реализовано (требует ревизии каскада `SC_PostCard`).
- `<footer>` для приложения — добавить когда появится контент.

---

## 7. Архитектурные риски

- `register-modal.vue` и серия `setTimeout` — корректная очистка не везде проверена, особенно при ранней размонтировке (используется `withDefaults` + локальный `nicknameTimer` без cleanup в `onUnmounted`).
- `package.json` указывает `"vue-router": "^5.0.1"` — это alias, фактически используется API v4. Свериться, тот ли пакет в lockfile.
- `vue3-styled-components@1.2.1` — без релизов с мая 2023, тянет уязвимый `node-fetch`. Решение архитектурного уровня: заменить на `pinceau`, нативные CSS Modules или форкнуть.

---

## 8. blockchain/

11 .test.ts на 59 ts-файлов (~18%), 78 вхождений `any` в модуле.

### 8.1. Тесты
Покрыто: constants/, utils/, storage/encryption, key-generation, auth-store.
Не покрыто: `api/` (request-signer, captcha-api, proxy-with-wallet, registration-status), `ws/`, `core/signatures/`, `core/addresses/`, `core/transactions/`. Начать с request-signer и ws-service (reconnect + auth).

---

## 9. mini-apps/

### 9.1. Открытые проблемы
- **Remote registry без подписи манифестов.** [registry/remote-registry.ts:78-98](src/mini-apps/registry/remote-registry.ts#L78) — `rpc('getapps', ...)`, ответ ноды доверяется. По принципу decentralization лучше проверять `signature` от автора (on-chain pubkey).
- **`openExternalPayment` — stub.** Нужен парсер `ext`-хеша legacy-формата. Поднимать когда понадобится совместимость с конкретной миниаппой.
- **Fetch-tunnel HMAC.** Сейчас не подписывает запросы. Имеет смысл только при появлении внешнего proxy-релея (Tor-транспорт), где сервер должен убеждаться в идентичности отправителя.

### 9.2. Тесты
27 *.test.ts. Покрыты: bridge, origin-guard, permission-resolver, apps-store, permissions-store, manifest-loader (частично — не тестируются JSON-bomb лимиты), fetch-tunnel, payment-modal-controller. `actions/` ~39% — media/rpc слабо.

---

## 10. Остаточные deps-CVE

2 уязвимости после `pnpm.overrides`:

| Severity | Пакет | Где | Что делать |
|---|---|---|---|
| HIGH | `node-fetch <2.6.7` (GHSA-r683-j2x4-v87g) | `vue3-styled-components@1.2.1 → glamor → fbjs → isomorphic-fetch → node-fetch` | Заменить `vue3-styled-components` (не обновлялся с мая 2023). Архитектурный сдвиг. В браузерной сборке node-fetch не активен — можно принять как accepted risk до миграции |
| LOW | `elliptic <=6.6.1` — рискованная криптопримитива (нет патча) | direct + транзит через bitcoin-libs | Патч не существует. Долгосрочно — миграция на elliptic 7.0+ или другую кривую |

### 10.1. Прочие риски цепочки поставок
- `bip39russian@1.0.7` — форк от единственного автора (grish2018), не мейнстрим. Единственный источник русского BIP39-словаря; стоит провести ручное ревью исходников и зафиксировать в `pnpm-lock.yaml`.
- `crypto-js@4.2.0` для AES — в новом коде использовать `crypto.subtle` (Web Crypto API).
- `miscreant@0.3.2` — без обновлений с 2017, помечен как legacy.

### 10.2. Тяжёлые runtime-зависимости (см. §11 для перфа)
- `matrix-js-sdk@40.1.0` — критично для мессенджера.
- `pixi.js@8.15.0` — аудио-визуализация / star-explosion.
- `hls.js@1.6.15` — видео.
- `d3@7.9.0` — block-explorer.

---

## 11. Производительность

### 11.1. Виртуализация (Medium)
Нет `vue-virtual-scroller` / `@tanstack/vue-virtual` в deps. При этом:
- [post-card-comments.vue:161](src/b-components/content/post-card/components/post-card-comments/post-card-comments.vue#L161) — `v-for` по всем `visibleComments`.
- В мессенджере чат рендерит 100+ сообщений в DOM.

Внедрить виртуализацию для лент >50 элементов; начать с мессенджера (память + TTI).

### 11.2. Реактивность в god-файлах (Medium)
- [video-player.vue](src/b-components/content/video-player/video-player.vue) — 6+ `computed` + 8+ `watch`/`watchEffect` в одном файле. Кандидаты на `throttle`/`debounce` (особенно прогресс-бар, time updates).
- [post-card-comments.vue](src/b-components/content/post-card/components/post-card-comments/post-card-comments.vue) — `getReplies()` вызывается из шаблона на каждый рендер; перевести в `computed` с мемоизацией.
- [messenger-chat-store.ts:82-95](src/b-components/messenger/store/messenger-chat-store.ts#L82) — секретный декрипт без debounce; на bulk-обновлениях ленты может стопорить.

---

## Шаги по убыванию ROI

**🔴 Срочно:**
1. **Заменить `vue3-styled-components`** — закроет последний HIGH `node-fetch` и позволит снять `'unsafe-inline'` со `style-src`. Архитектурное решение: `pinceau` / CSS Modules / форк.

**🟡 Защита и регулярная работа:**
2. **Тесты для критики** — `blockchain/api/request-signer`, `blockchain/ws/ws-service`, `messenger/store`, `video-player`.
3. **i18n: вынос строк** (постоянно) — большой UX-win при низком техническом риске; начать с `header-logo` switcher.
4. **Декомпозиция god-объектов** — `messenger-chat-store` → доменные сторы; `post-card-comments` → подкомпоненты + composables; `video-player` → `use-media-session`, `use-progress-bar-interaction`; `matrix-service` → sync/encryption/transport.
5. **Inline `:style` → styled (доделать)** — остаток 27+56 mostly one-off margin/padding tweaks. Per-file работа.
6. **Виртуализация списков** — мессенджер чат и комментарии (>50 элементов).

**🟢 Точечная гигиена:**
7. **Keyframes в общий модуль** — дубли `@keyframes spin/pulse` в `src/styles/keyframes.ts`.
8. **TS-чистка `any`** — основной долг в `messenger/`, `matrix-service.ts`. Цель — спустить с 333 до ~50 и поднять lint до `error`.
