# Аудит кода: оставшиеся работы

Дата актуализации: 2026-05-28
Скоуп: `src/`, `src-mobile/`, `index.html`
Конвенции проекта: `eslint.config.js`, `.stylelintrc.json`, `.prettierrc` (плюс правила в auto-memory Claude)
Стек: Vue 3.5 + TS, Pinia, Vue Query, vue3-styled-components, Vue Router 4, Vite 5

## Открытые риски

| # | Категория | Что не так | Приоритет |
|---|-----------|------------|-----------|
| 1 | God-объекты | `messenger-chat-store.ts` 1401, `video-player.vue` 892, `matrix-service.ts` 805, `post-card-comments.vue` 1200, `chat-room.vue` 565 — декомпозиция в composables/store-доменах | Средний |
| 2 | TS-качество | 346 вхождений `any`/`as any` в коде (без тестов) | Средний |
| 3 | i18n | Инфраструктура подключена; строки UI компонентов ещё не вынесены в `src/locales/{ru,en}.ts` | Средний |
| 4 | Тесты | 12% покрытие; critical-модули (`blockchain/`, `messenger/`, `video-player`, `mini-apps/`) почти без тестов | Средний |
| 5 | Inline `:style` | 84 inline-стиля с size/margin/padding в шаблонах — кандидаты на styled-обёртки | Низкий |

---

## 1. Гигантские компоненты — декомпозиция

| Файл | Строк | Что делать |
|------|-------|-----------|
| `b-components/messenger/store/messenger-chat-store.ts` | 1401 | Разнести по доменам (rooms, messages, presence, typing) |
| `b-components/content/post-card/components/post-card-comments/post-card-comments.vue` | 1200 | Compose: `use-comments-tree`, `use-reply-panel`, `use-comments-display` |
| `b-components/content/video-player/video-player.vue` | 892 | Вынести HLS, controls, analytics в composables (`use-video-hls` уже частично) |
| `b-components/messenger/services/matrix-service.ts` | 805 | Отделить sync, encryption, transport |
| `b-components/messenger/components/chat-room/chat-room.vue` | 565 | Compose: `use-voice-recording`, `use-partner-info`, `use-chat-input` |
| `b-components/header/header-user/header-user.vue` | 563 | Compose: `use-registration-flow`, `use-account-menu` |
| `b-components/messenger/components/audio-message/audio-message.vue` | 541 | Compose: `use-pixi-waveform`, `use-audio-decoding` |
| `pages/settings-page/settings-page.vue` | 512 | Compose: `use-private-key-reveal`; вынести вкладки в подкомпоненты |
| `pages/block-explorer-page/block-page/block-page.vue` | 372 | Вынести логику в `use-block-data` |
| `pages/block-explorer-page/tx-page/tx-page.vue` | 312 | Вынести логику в `use-tx-data` |
| `b-components/header/header-search/header-search-dropdown.vue` | 308 | Compose: `use-search-state` |

---

## 2. TS-качество

### 2.1. `any` в типах

346 вхождений `: any` / `as any` в `src/**/*.{ts,vue}` (без тестов).

Точечные кейсы:
- [b-components/content/video-message/video-message.vue](src/b-components/content/video-message/video-message.vue) — `const info: any = props.message.info`.
- [b-components/content/post-embed/post-embed.vue](src/b-components/content/post-embed/post-embed.vue) — `post.value as any`.
- [b-components/video-uploader/utils/environment.ts:63](src/b-components/video-uploader/utils/environment.ts#L63) — `catch (e: any)` (приемлемо до TS 4.4; сейчас лучше `unknown`).
- [polyfills.ts:4-9](src/polyfills.ts#L4) — `(globalThis as any).Buffer`, `(window as any).process` (для полифилла можно объявить через `declare global`).
- `b-components/video-uploader/components/fab-button/fab-button.vue` — `(import.meta as any).env` (есть типы Vite, не нужен каст).

### 2.2. Включить eslint-правило

`@typescript-eslint/no-explicit-any` сейчас `off`. Включить как `warn` с TODO-планом снижения; позже поднять до `error`.

---

## 3. CSS / Styled-components

### 3.1. Z-index — магические значения
`Z_INDEX` определён в `design-tokens.ts`, но не используется:
- [mini-app-frame.styled.ts:11,98](src/mini-apps/ui/mini-app-frame.styled.ts#L11) — `z-index: 500, 600`.
- `wallet-transfer.styled.ts` — `z-index: 10`.
- `explorer-search.styled.ts` — `z-index: 100`.
- `address-qr.styled.ts` — `z-index: 2000` (совпадает с `MODAL` — потенциальный конфликт).

### 3.2. Inline `:style` — 84 вхождения
Хардкод цветов убран (заменено на `var(--color-*)` и токены `COLORS.*`). Осталось:
- `:style="{ fontSize: '24px' }"` — размер на ant-иконках (использовать `src/styles/icon-styles.ts` или styled-обёртку).
- `:style="{ padding: '...', margin: '...' }"` в шаблонах — переносить в `*.styled.ts`.
- Примеры: [pages/block-explorer-page/block-explorer-page.vue:121,152](src/pages/block-explorer-page/block-explorer-page.vue#L121), [settings-page/settings-page.vue:139](src/pages/settings-page/settings-page.vue#L139).

### 3.3. `<style scoped>` в `.vue` (нарушение архитектуры)
- [components/image-gallery/image-gallery.vue](src/components/image-gallery/image-gallery.vue) — подключает внешний `image-gallery.styles.css` через `<style scoped src>`. По конвенции должно быть в `*.styled.ts`.

### 3.4. Дублирование стилей
Один и тот же `SC_SectionTitle` (`font-size: 16px; font-weight: 600; color: rgb(33,33,33);`) повторяется в 5+ файлах:
- `wallets-page.styled.ts:70`, `pkoin-chart.styled.ts:10`, `mini-apps-grid.styled.ts:12`, `peers-page.styled.ts:55`.

Кандидат — выделить в общую коллекцию `src/components/typography/` или `src/styles/shared.ts`.

### 3.5. Большие styled-файлы (>250 строк)
- `wallet-transfer.styled.ts` — 263.
- `block-explorer-page.styled.ts` — 244.
- `block-page.styled.ts` — 234.
- `wallets-page.styled.ts` — 225.

### 3.6. Transitions/animations захардкожены
- `TRANSITIONS` есть в `design-tokens.ts`, но в стилях встречаются `0.2s`, `0.15s`, `0.3s` напрямую.
- Похожие keyframes в разных файлах: `@keyframes pulse` (`mini-app-frame.styled.ts:57`), `@keyframes live-pulse` (`block-explorer-page.styled.ts:77`).

### 3.7. Дублирование брейкпоинтов
- `BREAKPOINTS` в токенах, плюс `style.css` имеет свои `@media (max-width: 480px / 768px)`. Источник правды разъезжается.

---

## 4. i18n: вынос строк UI

Инфраструктура подключена (`vue-i18n@11`, `src/i18n/`, `src/locales/{ru,en}.ts`, composable `use-locale.ts`, router `meta.titleKey`).

Осталось:
- Пройти по компонентам и заменить захардкоженные русские строки на `t('...')`.
- Добавить ключи в `src/locales/{ru,en}.ts` (router titles уже вынесены — компоненты, формы, тосты, label'ы — нет).
- Обновить language switcher в `header-logo.vue` — сейчас он мутирует локальный `logoData.currentLanguage`, а должен дёргать `useLocale().setLocale()` (TODO в коде помечен).

---

## 5. Тесты

- 82 теста на 676 исходных файлов (~12%).
- Покрыты в основном сторы и helpers. Composables и UI-компоненты — почти нет.
- Критичные модули без тестов: `blockchain/`, `messenger/`, `video-player`, `mini-apps/`.
- Начать с `blockchain/` и `messenger/store` — там самая высокая цена бага.

---

## 6. HTML / семантика / a11y

- Inconsistent `alt=""` для смысловых изображений — нужно пройти отдельно.
- `<article>` для `post-card` не реализовано (требует ревизии каскада `SC_PostCard`).
- `<footer>` для приложения — добавить когда появится контент.

---

## 7. Архитектурные риски

- `src/main.js` — не `.ts`, теряется типизация при подключении плагинов; переименовать в `main.ts`.
- Полифиллы Buffer/process дублируются в `index.html` и `main.js`. Один источник правды.
- `silence-console.ts` подавляет `console.log/info/debug` глобально — может маскировать настоящие баги. Toggle через `?debug=1`/`localStorage.debug='1'` есть, но факт глобального подавления стоит сделать менее агрессивным (например, только `console.log`).
- `register-modal.vue` и серия `setTimeout` — корректная очистка не везде проверена, особенно при ранней размонтировке (используется `withDefaults` + локальный `nicknameTimer` без cleanup в `onUnmounted`).
- `package.json` указывает `"vue-router": "^5.0.1"` — это alias, фактически используется API v4. Свериться, тот ли пакет в lockfile.

---

## Приложение: правила автоматизации (что добавить в lint)

Чтобы новые нарушения не появлялись:

- `eslint-plugin-vuejs-accessibility` — проверяет `alt`, `label`, `role`, keyboard handlers.
- `eslint`: `vue/require-v-for-key` (essential, уже включён, но нарушается — поднять severity до `error`).
- `eslint`: `@typescript-eslint/no-explicit-any` — сейчас `off`, временно включить как `warn` с TODO-планом снижения.
- `eslint`: `vue/component-api-style: ['error', ['script-setup']]` — заставит новые компоненты быть на script setup (теперь, когда Options API закрыт, можно включать без миграционной боли).

---

## Шаги по убыванию ROI

1. **Включить `vue/component-api-style: script-setup` + `no-explicit-any: warn`** (10 минут) — защита от регрессий.
2. **i18n: вынос строк** (постоянно) — большой UX-win при низком техническом риске.
3. **Тесты для критики** (постоянно) — `blockchain/`, `messenger/store`, `video-player`.
4. **Декомпозиция god-объектов** (отдельная инициатива по каждому) — `messenger-chat-store` → доменные сторы; `post-card-comments` → подкомпоненты + composables; `video-player` → выделить `use-media-session`, `use-progress-bar-interaction`.
5. **Inline `:style` → styled** (1-2 дня) — пройти по оставшимся 84 вхождениям.
6. **Z-index, transitions, breakpoints в токены** (полдня).
