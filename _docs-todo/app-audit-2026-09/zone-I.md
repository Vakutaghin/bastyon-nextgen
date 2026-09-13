## Зона: I — блок-эксплорер / embed & info / changelog / shared UI / layout & nav / QR / e2e / styles tooling

### Находки
- **I1 · 🟠 высоко · security** — Поле мнемоники/приватного ключа в sign-in не маскируется: обёртка `Input` глотает `type`, `placeholder`, `disabled`, `allowClear`
  - Файл: `src/components/input/input.vue:3` + `input/types.ts`; `sign-in-modal.vue:19-26` (`SC_InputWithToggle = styled(Input)`)
  - Суть: обёртка объявляет antd-пропсы через `defineProps<InputProps>()`, но в `<Input>` прокидывает только `$attrs`. Проверено runtime-пробой: `type='password'` → у DOM-инпута `type=text`.
  - Сценарий: «Войти», ввод 12 слов → видны открытым текстом, «глаз» ничего не переключает, во время `loading` поле редактируемое.
  - Фикс: убрать `defineProps` из обёртки (или `inheritAttrs:false` + `v-bind="{ ...$attrs, ...props }"`); unit-тест «type=password доходит до DOM».
  - Уверенность: high.

- **I2 · 🟠 высоко · logic** — Enter/кнопка в глобальном поиске не работают: `InputSearch` глотает `@search` (= G1). Также `mini-apps-grid.vue:4` (`v-model:value` uncontrolled).

- **I3 · 🟡 средне · consistency** — Обёртка `Modal` теряет `title`, `centered`, `destroyOnClose`, `footer`, `okText/cancelText/onOk`; то же у `Spin` (size/tip), `Card`, `Empty`
  - Файл: `modal.ts:8-10,58-60`, `modal.vue:16-21` (слоты `#title/#footer` всегда заданы); `spin.vue:3`, `card.vue`, `empty.vue:8-10`
  - Сценарий: без заголовка рендерятся 7 модалок с `:title` пропом (sign-in, register, account-switcher, post-modal, post-composer-modal, registration-validation-modal, captcha-modal); модалки не центрированы; `destroy-on-close` no-op; `Empty` в ленте без иллюстрации.
  - Фикс: единая правка семи обёрток: `inheritAttrs:false` + явный проброс; слоты условно.
  - Уверенность: high (пробы).

- **I4 · 🟡 средне · logic** — Страница пиров падает при ошибке `getpeerinfo`: `s.peers.peersError` — `s` не объявлен → TypeError в ветке ошибки
  - Файл: `peers-page.vue:80`
  - Фикс: `:message="t('explorerPage.peersError')"`.

- **I5 · 🟡 средне · race** — Список транзакций адреса смешивается при быстрой смене адреса (нет guard на устаревший ответ)
  - Файл: `address-page.vue:164-210`
  - Фикс: request-id/`AbortController`.

- **I6 · 🟡 средне · data** — Курсор-пагинация адреса `minHeight − 1` пропускает транзакции того же блока на границе страницы; скопирован в кошелёк
  - Файл: `address-page.vue:188-198`; `wallet-history.vue:167-205`; неиспользуемый `useAddressTransactions` в `use-block-explorer-queries.ts:190-210`
  - Фикс: курсор `minHeight` включительно + дедуп; один helper.
  - Уверенность: medium.

- **I7 · 🟡 средне · security/ux-claim** — Embed: ссылки внутри контента поста уводят iframe на полное приложение (с восстановлением сессии) внутри чужого сайта; framing не ограничен
  - Файл: `embed-post-page.vue:34`, `text-formatter.ts:35` (`<a href='/name' class='mention-link'>` без target), `src.vue:64-66`, `index.html` (CSP без `frame-ancestors`), `main.ts:132`
  - Сценарий: блог встраивает embed; пост с `@ник`; клик → внутри iframe открывается аккаунт посетителя на чужой странице; clickjacking.
  - Фикс: в embed перехват кликов по `a[href^="/"]` → `_top`; `frame-ancestors 'self'` на деплое кроме `/embed/*`; не рендерить `AppLayout` при `window.top !== window`.
  - Уверенность: high/medium.

- **I8 · 🟡 средне · logic** — Три источника правды для языка (= G7); changelog рендерится не в языке UI.

- **I9 · 🟡 средне · logic** — `pingtime` пиров трактуется как микросекунды — все пиры «0.0 ms» (в Core — секунды с дробью)
  - Файл: `peers-page.vue:166-171`, `get-peer-info.ts:25`
  - Фикс: `pingtime * 1000`.
  - Уверенность: medium.

- **I10 · 🟡 средне · logic** — Block page: «Загрузить ещё» стирает список до скелетона; открытие по высоте даёт лишний RPC, мигание и дубль в истории
  - Файл: `use-block-data.ts:41-52,68`, `block-tx-list.vue:8`
  - Фикс: `placeholderData: keepPreviousData`; `setQueryData` при replace; `recordVisit` один раз.

- **I11 · ⚪ низко · logic** — `isEmbedRoute()` в `main.ts` до резолва роутера (= A15).

- **I12 · ⚪ низко · logic** — Кэш блока 24 ч не инвалидируется WS → у tip-блока `nexthash` пустой до перезагрузки
  - Файл: `use-block-explorer-queries.ts:139`, `use-explorer-ws-updates.ts:9-12`

- **I13 · ⚪ низко · ux** — `appToast` рендерится под масками модалок (z 1050 против 2000–3100); `Z_INDEX.TOAST=3000` не применён
  - Файл: `app-toast/index.ts:21-27`, `design-tokens.ts:76`
  - Фикс: `notification.config({ zIndex: 3200 })`.

- **I14 · ⚪ низко · ux-claim** — Embed без состояния для невалидного txid (пустой iframe) и «мёртвые» клики по картинкам (`ImageGallery` не смонтирован)
  - Файл: `embed-post-page.vue:2-5,23`, `use-post-by-txid.ts:19-23,66-69`

- **I15 · ⚪ низко · consistency** — Changelog: «что нового» ключуется по последней папке `changelogs/`, а не по версии приложения; `CURRENT_APP_VERSION` не используется; текст устарел; Android `versionName "1.0"` отдельно
  - Файл: `use-changelog.ts:43,75,84`, `changelog-loader.ts:97`, `changelogs/v0.1.0/ru.desc.md`, `android/app/build.gradle:11`

- **I16 · ⚪ низко · tooling** — `check-inline-styles.mjs` не видит одинарные кавычки (9 пропущенных `style='…'`); e2e привязаны к RU-локали (Playwright en-US по умолчанию → `getByText` падают)
  - Файл: `scripts/check-inline-styles.mjs:34`, `e2e/block-explorer.spec.ts`, `playwright.config.ts`
  - Фикс: `PLAIN_STYLE = /(^|[\s"'])style\s*=\s*["']/`; `use.locale: 'ru-RU'`.

### Несостыковки между модулями
- **I17 · 🟡 средне · consistency** — Настройка «предпочитаемая нода» обещает «не влияет на остальное приложение», но управляет историей кошелька; WS всегда `proxy[0]`; лейбл «Авто (round-robin)» описывает удалённое поведение
  - Файл: `ru.ts:331`/`en.ts:325`; `wallet-history.vue:174`; `ws-service.ts:101`; `node-selector.ts:1-20`
  - Фикс: честно назвать настройку и дать reset в кошельке; WS из node-selector; текст `autoNode`.

- **I18 · 🟡 средне · consistency** — Восемь независимых форматтеров даты/времени с разной локалью и разными i18n-ключами; в EN даты русские (= G13)
  - Файл: `date-formatter.ts:18-31,51-57,69-85`; `format-explorer.ts:47-70`; `notification-formatter.ts:15-27` (копия); `messenger/helpers.ts:314-324`; `message-item/helpers.ts:122-142`; `chat-list-item.vue:134`; `profile-sidebar.vue:230`; `video-info-modal.vue:50`; корректно только `embed-post-page.vue:108`, `app-permissions-tab.vue:98`, `diagnostics-tab.vue:112-116`. В RU `relativeAgo.years: '{n} год назад'` без плюрализации.
  - Фикс: один модуль на `Intl.DateTimeFormat(locale)` + `Intl.RelativeTimeFormat`; плюрализация через `|`.

- **I19 · ⚪ низко · consistency** — Мёртвые/дублирующие модули: `src-mobile/components/mobile-bottom-nav` (не импортируется, RU-хардкод); `avatar-resolver.ts` (только тест) vs `profile-avatar.ts`; `scroll-utils.ts` не используется при трёх ad-hoc `body.style.overflow` без счётчика (`mobile-nav-drawer.vue:87-89`, `messenger-wrapper.vue:210-219`, `modal-store.ts:151`); `sidebar-categories/{helpers,consts}.ts`, `sidebar-tags/consts.ts` не импортируются; `effects-store.ts` — setup-style вне messenger; `vite-plugin-styled-data-attr.js` закомментирован; `use-tx-data.ts` `firstAddress` дублируется в `tx-io-table.vue`; `sidebar-tabs.vue:104-116` пишет `?feedMode=` через `history.replaceState` мимо роутера; `star-explosion/use-star-explosion.ts:126` pixi-ticker крутится постоянно.

- **I20 · ⚪ низко · consistency** — RU-хардкоды и light-only цвета в эксплорере/сайдбаре: `tx-type-labels.ts:67`; `sidebar-tags.vue:93`, `sidebar-categories.vue:143` (`getTags(..., 'ru')`); `network-stats-chart.vue:75-80,169-176`, `peers-page.vue:31-33` — hex-цвета в шаблонах.

### Проверено — ОК
- i18n: все 307 ключей зоны есть в ru/en.
- Эксплорер: v-html нет; малформенный ввод уходит в RPC, ошибка текстом.
- `use-search-history`: валидация, лимит 20.
- WS-подписки снимаются; `prefetchExplorerTarget` использует те же ключи.
- `ExplorerError.retry` перезапускает запросы.
- QR-сканер: стрим/треки останавливаются; decoded только в `privateKey`; не логируется.
- Embed: `SC_EmbedHeader`/`SC_EmbedCta` `target="_top"`; `restoreSession` на embed не вызывается; bridge принимает только от установленных origin.
- Changelog: текст экранируется; версии согласованы 0.1.0.
- Modal-обёртка: `closable`, `maskClosable`, `keyboard`, `z-index`, `width`, `v-model:open` доходят.
- Dark-тема: 61 из 127 токенов переопределён по замыслу.
- check-breakpoints ok; `star-explosion` под CSP без `unsafe-eval`.
- e2e строки соответствуют `ru.ts` (дрейфа нет); `baseURL :1980` совпадает.
