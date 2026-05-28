# Аудит кода: соответствие best practices

Дата: 2026-05-27 (последнее обновление: 2026-05-28)
Скоуп: `src/`, `src-mobile/`, `index.html`
Конвенции проекта: `eslint.config.js`, `.stylelintrc.json`, `.prettierrc` (плюс правила в auto-memory Claude)
Стек: Vue 3.5 + TS, Pinia, Vue Query, vue3-styled-components, Vue Router 4, Vite 5

## Открытые риски

| # | Категория | Что не так | Приоритет |
|---|-----------|------------|-----------|
| 1 | Vue Options API | ~36 компонентов на legacy `defineComponent({ data, methods, props })` без `<script setup lang="ts">` | Высокий |
| 2 | Inline `:style` | 95+ вхождений `:style="..."` в шаблонах вместо `*.styled.ts` | Средний |
| 3 | TS-качество | 17+ `: any`, 15+ `as any` без причины | Средний |
| 4 | God-объекты | `messenger-chat-store.ts` 1401 стр., `video-player.ts` 836 стр., `matrix-service.ts` 805 стр. | Средний |
| 5 | i18n | Нужен `vue-i18n` (продуктовое требование), сейчас весь UI на русском без локализации | Средний |
| 6 | Hardcoded status-colors | ~24 rgb(red/green/yellow вариаций) в styled-файлах без COLORS-токенов | Низкий |
| 7 | Service worker / PWA | manifest готов, SW нет — нет offline и установки как PWA | Низкий |
| 8 | Global error boundary | Нет composable `onErrorCaptured` поверх роутера | Низкий |
| 9 | Тесты | 12% покрытие; critical-модули (`blockchain/`, `messenger/`, `video-player`, `mini-apps/`) почти без тестов | Средний |

---

## 1. Vue: нарушения конвенций

### 1.1. Options API вместо `<script setup lang="ts">`
Конвенция: новые компоненты создавать только через `<script setup lang="ts">` (см. auto-memory `project_coding_conventions`).

~36 компонентов используют `defineComponent({...})` или plain `<script>`:
- [b-components/sidebar/sidebar-tabs/sidebar-tabs.vue:31](src/b-components/sidebar/sidebar-tabs/sidebar-tabs.vue#L31) — `export default { ...sidebarTabsOptions }`
- [b-components/content/post-card/post-card.vue:115](src/b-components/content/post-card/post-card.vue#L115) — `defineComponent({ props, components, emits })`
- [b-components/content/post-card/components/post-card-comments/post-card-comments.vue:653](src/b-components/content/post-card/components/post-card-comments/post-card-comments.vue#L653) — 657-строчный компонент на Options API
- [b-components/messenger/components/chat-room/chat-room.vue:156](src/b-components/messenger/components/chat-room/chat-room.vue#L156) — `data()` вместо `ref()`
- `block-content.vue:13`, `content-feed.vue:133`, `sidebar-left.vue:10`, `sidebar-tags.vue:40`, `sidebar-categories.vue:94`, `video-uploader.vue:77` — аналогично.

> 65 компонентов уже на `<script setup lang="ts">` — паттерн есть, нужно завершить миграцию.

### 1.2. Отсутствие `lang="ts"`
36 компонентов используют `<script>` без `lang="ts"`. Те же файлы, что в 1.1 — типизация props/emits не работает. В частности, `src/b-components/header/header-tor/header-tor.vue` падает по `vue-tsc` именно из-за этого.

### 1.3. `any` в типах props/emits
- [b-components/content/video-message/video-message.vue](src/b-components/content/video-message/video-message.vue) — `const info: any = props.message.info`
- [b-components/content/post-embed/post-embed.vue](src/b-components/content/post-embed/post-embed.vue) — `post.value as any`
- [b-components/header/header-tor/header-tor.vue](src/b-components/header/header-tor/header-tor.vue) — `(e: any) => onSelectKind`

### 1.4. Гигантские компоненты (декомпозировать в composables)
| Файл | Строк |
|------|-------|
| `post-card-comments.vue` | 657 |
| `block-page.vue` | 372 |
| `tx-page.vue` | 312 |
| `header-search-dropdown.vue` | 308 |

Логику нужно вынести в соседние `use-*.ts` (конвенция проекта).

---

## 2. Оставшиеся HTML / семантика / a11y

### 2.1. i18n
- `<html lang="ru">` сейчас захардкожен. **Многоязычность подтверждена в продуктовых требованиях.**
- `vue-i18n` не подключён — нужно подключать, выносить строки в `src/locales/{ru,en}.ts`, динамически обновлять `<html lang>` через router-meta / `useHead`.

### 2.2. PWA service worker
- `public/manifest.webmanifest` уже есть, но service worker не настроен. Установка из браузера работает, offline-режим — нет.

### 2.3. Глобальный error boundary
- Vue 3 не даёт встроенного. Нет composable обёртки `onErrorCaptured` поверх роутера. Любая необработанная ошибка валит ветку рендера без UI.

### 2.4. Прочие мелочи
- Inconsistent `alt=""` для смысловых изображений — нужно пройти отдельно.
- `<article>` для `post-card` не реализовано (требует ревизии каскада `SC_PostCard`).
- `<footer>` для приложения — пока нет видимого футера; добавить когда появится контент.

---

## 3. CSS / Styled-components (оставшееся)

### 3.1. Z-index — магические значения
`Z_INDEX` определён в `design-tokens.ts`, но не используется:
- [mini-app-frame.styled.ts:11,98](src/mini-apps/ui/mini-app-frame.styled.ts#L11) — `z-index: 500, 600`
- `wallet-transfer.styled.ts` — `z-index: 10`
- `explorer-search.styled.ts` — `z-index: 100`
- `address-qr.styled.ts` — `z-index: 2000` (совпадает с MODAL — потенциальный конфликт)

### 3.2. Inline `:style` в шаблонах
95+ вхождений. Конвенция: стили задаются через Styled-Components в отдельном файле `*.styled.ts`. Примеры:
- [pages/block-explorer-page/block-explorer-page.vue:121,152](src/pages/block-explorer-page/block-explorer-page.vue#L121) — `style='color: rgb(0,123,255); padding: 16px 18px'`
- [pages/block-explorer-page/peers-page/peers-page.vue:36,97](src/pages/block-explorer-page/peers-page/peers-page.vue#L36)
- [pages/settings-page/settings-page.vue:139](src/pages/settings-page/settings-page.vue#L139)
- Множественно: `:style="{ fontSize: '24px', color: 'rgb(0,123,255)' }"` на иконках sidebar/last-comments

### 3.3. `<style scoped>` в `.vue` (нарушение архитектуры)
- [components/image-gallery/image-gallery.vue](src/components/image-gallery/image-gallery.vue) — подключает внешний `image-gallery.styles.css` через `<style scoped src>`. По конвенции должно быть в `*.styled.ts`.

### 3.4. Дублирование стилей
Один и тот же `SC_SectionTitle` (`font-size: 16px; font-weight: 600; color: rgb(33,33,33);`) повторяется в 5+ файлах:
- `wallets-page.styled.ts:70`, `pkoin-chart.styled.ts:10`, `mini-apps-grid.styled.ts:12`, `peers-page.styled.ts:55`

Кандидат — выделить в общую коллекцию `src/components/typography/` или `src/styles/shared.ts`.

### 3.5. Большие styled-файлы (>250 строк)
- `wallet-transfer.styled.ts` — 263
- `block-explorer-page.styled.ts` — 244
- `block-page.styled.ts` — 234
- `wallets-page.styled.ts` — 225

### 3.6. Transitions/animations захардкожены
- `TRANSITIONS` есть в `design-tokens.ts`, но в стилях встречаются `0.2s`, `0.15s`, `0.3s` напрямую.
- Похожие keyframes в разных файлах: `@keyframes pulse` (`mini-app-frame.styled.ts:57`), `@keyframes live-pulse` (`block-explorer-page.styled.ts:77`).

### 3.7. Дублирование брейкпоинтов
- `BREAKPOINTS` в токенах, плюс `style.css` имеет свои `@media (max-width: 480px / 768px)`. Источник правды разъезжается.

### 3.8. Остаточный хардкод rgb (status-colors)
~24 значения вида `rgb(180, 50, 50)` (danger-shades), `rgb(34, 120, 60)` (success-darker), `rgb(245, 180, 0)` (warning-yellow), `rgb(22, 119, 255)` (alt-blue) — требуют дизайнерского решения о токенах. Stylelint их подсвечивает как warning.

---

## 4. JS/TS качество (оставшееся)

### 4.1. `: any` (17+ вхождений)
- [b-components/sidebar/sidebar-tags/sidebar-tags.ts:114](src/b-components/sidebar/sidebar-tags/sidebar-tags.ts#L114) — `let tags: any[]`
- [b-components/sidebar/sidebar-categories/sidebar-categories.ts:92](src/b-components/sidebar/sidebar-categories/sidebar-categories.ts#L92) — `(e: any)`
- `b-components/video-uploader/utils/environment.ts:63` — `catch (e: any)` (приемлемо до TS 4.4; сейчас лучше `unknown`)
- `b-components/content/post-card/components/star-rating/helpers/star-rating-validation.ts`

### 4.2. `as any` / небезопасные касты (15+)
- [polyfills.ts:4-9](src/polyfills.ts#L4) — `(globalThis as any).Buffer`, `(window as any).process` (для полифилла можно объявить через `declare global`)
- `b-components/sidebar/sidebar-right/last-comments/last-comments.ts` — `post as any`
- `b-components/video-uploader/components/fab-button/fab-button.ts` — `(import.meta as any).env` (есть типы Vite, не нужен каст)
- `b-components/content/content-feed/content-feed.ts` — `(feedRootRef.value as any).$el`

### 4.3. God-объекты
| Файл | Строк | Что делать |
|------|-------|-----------|
| `b-components/messenger/store/messenger-chat-store.ts` | 1401 | Разнести по доменам (rooms, messages, presence, typing) |
| `b-components/content/video-player/video-player.ts` | 836 | Вынести HLS, controls, analytics в composables |
| `b-components/messenger/services/matrix-service.ts` | 805 | Отделить sync, encryption, transport |
| `b-components/content/post-card/components/post-card-comments/post-card-comments.ts` | 619 | Compose: use-comments-tree, use-reply-panel |
| `b-components/header/register-modal/register-modal.ts` | 368 | use-mnemonic, use-registration-flow |

### 4.4. Magic numbers (оставшееся)
- `b-components/header/register-modal/helpers/wait-for-unspents.ts:43,84` — таймауты в коде получают значения из аргументов вызова, низкий приоритет.

### 4.5. Test coverage
- 82 теста на 676 исходных файлов (~12%).
- Покрыты в основном сторы и helpers. Composables и UI-компоненты — почти нет.
- Критичные модули без тестов: `blockchain/`, `messenger/`, `video-player`, `mini-apps/`.

### 4.6. Прочее
- Двойные кавычки в JS/TS — преимущественно в комментариях, в коде — единицы.
- Стрелочные функции без `()` — встречаются только в styled-component template literals (нормально для контекста).
- Default exports — Vue-компоненты по необходимости (`.vue` SFC), но в `*.ts` стоит проверять.

---

## 5. Архитектурные наблюдения

### 5.1. Router
[src/router/index.ts](src/router/index.ts) — `vue-router` 4 (createRouter/createWebHistory), code-splitting через `() => import()`, auth guard через Pinia. **Корректно.** Добавлен `afterEach` для синхронизации `document.title`.

> NB: `package.json` указывает `"vue-router": "^5.0.1"` — это alias, фактически используется API v4. Стоит свериться, тот ли пакет в lockfile.

### 5.2. Main bootstrap
[src/main.js](src/main.js) — Pinia, Vue Query, Antd, Capacitor, IndexedDB с timeout-фолбэком (5s). **Грамотно.** Минусы:
- `main.js` (не `.ts`) — теряется типизация при подключении плагинов.
- Полифиллы Buffer/process дублируются в `index.html` и `main.js`.

### 5.3. Скрытые риски
- `silence-console.ts` подавляет `console.log/info/debug` глобально — может маскировать настоящие баги. Toggle через `?debug=1`/`localStorage.debug='1'` есть.
- `register-modal.ts` и серия `setTimeout` — корректная очистка не везде проверена, особенно при ранней размонтировке.

---

## 6. Оставшиеся рекомендуемые шаги (по убыванию ROI)

1. **i18n внедрение** (1 спринт): подключить `vue-i18n` (composition API), вынести строки в `src/locales/{ru,en}.ts`, динамически обновлять `<html lang>` через router meta / `useHead`. Многоязычность — продуктовое требование.
2. **Миграция Options API → Script Setup** (1-2 спринта): постепенно, начиная с самых маленьких. Параллельно убирать `any`.
3. **Тесты для критики** (постоянно): начать с `blockchain/` и `messenger/store` — там самая высокая цена бага.
4. **Декомпозиция god-объектов** (отдельная инициатива): `messenger-chat-store`, `video-player`, `matrix-service` — порисовать диаграммы и разнести по доменам.
5. **Inline `:style` → styled** (1-2 дня): пройти по 95+ вхождениям, перенести в `*.styled.ts`.
6. **PWA service worker** (1 день): добавить SW через `vite-plugin-pwa` или вручную, чтобы реально работала установка/offline.
7. **Global error boundary** (полдня): composable + `app.config.errorHandler`, fallback-UI.
8. **Status-color токены** (1 час): добавить недостающие 5-7 токенов (DANGER_DEEP, SUCCESS_DEEP, WARNING_YELLOW и т.п.), убрать остаточные ~24 rgb.

---

## Приложение: правила для автоматизации

Стоит добавить в `eslint`/`stylelint`, чтобы новые нарушения не появлялись:

- `eslint-plugin-vuejs-accessibility` — проверяет alt, label, role, keyboard handlers.
- `eslint`: `vue/require-v-for-key` (essential, уже включён, но нарушается — поднять severity до `error`).
- `eslint`: `@typescript-eslint/no-explicit-any` — сейчас `off`, временно включить как `warn` с TODO-планом снижения.
- `eslint`: `vue/component-api-style: ['error', ['script-setup']]` — заставит новые компоненты быть на script setup.

`stylelint`: правило `declaration-property-value-disallowed-list` для запрета `rgb()/rgba()` в свойствах color/background/border/etc уже включено как warning. Поднять до `error` после закрытия остаточных §3.8.
