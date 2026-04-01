# План рефакторинга Bastyon NextGen

## Оглавление

1. [Общие принципы и стандарты](#1-общие-принципы-и-стандарты)
2. [Глобальные задачи (применяются ко всему проекту)](#2-глобальные-задачи)
3. [Фаза 0 — Подготовка инфраструктуры](#3-фаза-0--подготовка-инфраструктуры)
4. [Фаза 1 — Критические компоненты (P0)](#4-фаза-1--критические-компоненты-p0)
5. [Фаза 2 — Компоненты высокого приоритета (P1)](#5-фаза-2--компоненты-высокого-приоритета-p1)
6. [Фаза 3 — Компоненты среднего приоритета (P2)](#6-фаза-3--компоненты-среднего-приоритета-p2)
7. [Фаза 4 — Низкий приоритет и финальная полировка (P3)](#7-фаза-4--низкий-приоритет-и-финальная-полировка-p3)
8. [Карта зависимостей между фазами](#8-карта-зависимостей-между-фазами)
9. [Чек-лист для каждого компонента](#9-чек-лист-для-каждого-компонента)

---

## 1. Общие принципы и стандарты

### 1.1 Структура папки компонента

```
component-name/
├── component-name.vue          // Шаблон (template + script setup)
├── component-name.ts           // Логика компонента (composable useComponentName)
├── styled.ts                   // Все стили через vue3-styled-components
├── types.ts                    // Интерфейсы и типы
├── consts.ts                   // Константы (магические числа, конфиги, маппинги)
├── helpers.ts                  // Чистые вспомогательные функции
├── index.ts                    // Реэкспорт
└── components/                 // Подкомпоненты (если есть)
    ├── sub-component-a/
    │   ├── sub-component-a.vue
    │   ├── sub-component-a.ts
    │   ├── styled.ts
    │   └── index.ts
    └── sub-component-b/
        └── ...
```

### 1.2 Правила именования

| Сущность | Формат | Пример |
|----------|--------|--------|
| Папка компонента | `kebab-case` | `post-card/` |
| Vue-файл | `kebab-case.vue` | `post-card.vue` |
| Логика компонента | `kebab-case.ts` | `post-card.ts` |
| Стили | `styled.ts` | `styled.ts` |
| Типы | `types.ts` | `types.ts` |
| Константы | `consts.ts` | `consts.ts` |
| Хелперы | `helpers.ts` | `helpers.ts` |
| Composable (хук) | `use-*.ts` | `use-voice-recorder.ts` |
| Styled-компонент | `SC_PascalCase` | `SC_PostCard` |
| Константа | `UPPER_SNAKE_CASE` | `MAX_NOTIFICATIONS` |

### 1.3 Правила стилей

- **Все стили** — только в `styled.ts` через `vue3-styled-components`
- **Никаких inline-стилей** в `.vue` файлах (кроме динамических, зависящих от вычисляемых значений)
- Цвета берутся из глобального файла `src/styles/theme-colors.ts`
- Отступы, радиусы, брейкпоинты — из `src/styles/design-tokens.ts`
- Styled-файл компонента не должен превышать **300 строк**; если больше — разделить по подкомпонентам

### 1.4 Правила комментариев

- Язык комментариев: **русский**
- Каждый файл `.ts` / `.vue` начинается с краткого описания назначения файла (1–2 строки)
- Комментарии на уровне функций: **что делает** и **зачем** (не «как»)
- Комментарии внутри функции: только для неочевидной логики, хаков, обходных решений
- Формат JSDoc для публичных функций и composables:

```typescript
/**
 * Получает аватар пользователя с фолбэком на дефолтный
 *
 * @param profile - профиль пользователя из RPC
 * @returns URL аватара или undefined
 */
```

### 1.5 Правила форматирования

- Пустая строка **между** импортами и основным кодом
- Пустая строка **между** функциями / computed / watch / методами
- Пустая строка **перед** return в функциях (если тело > 3 строк)
- Пустая строка **между** логическими блоками внутри функции
- Максимальная длина файла `.ts` логики компонента: **200 строк** (если больше — выносить в composables/helpers)
- Максимальная длина одной функции: **50 строк** (если больше — разбивать)

### 1.6 Правила импортов

- Удалять все неиспользуемые импорты
- Порядок импортов:
  1. Библиотеки (vue, pinia, tanstack и т.д.)
  2. Внутренние модули (`@/...`)
  3. Локальные файлы (`./...`)
- Пустая строка между группами импортов

---

## 2. Глобальные задачи

### 2.1 Создание дизайн-системы

**Проблема:** 100+ мест с хардкод-цветами (`rgb(0, 123, 255)`, `rgb(33, 37, 41)`, `rgb(206, 212, 218)` и т.д.),
несогласованные `border-radius` (4px / 6px / 8px / 12px), разнобой в `padding`, отсутствие единой системы брейкпоинтов.

**Решение:** Создать `src/styles/` с файлами:

```
src/styles/
├── theme-colors.ts      // Палитра цветов
├── design-tokens.ts     // Отступы, радиусы, тени, анимации, брейкпоинты
└── index.ts             // Реэкспорт
```

**Файл `theme-colors.ts`:**
```typescript
// Централизованная палитра цветов приложения
export const COLORS = {
  // Основные цвета
  PRIMARY: 'rgb(0, 123, 255)',
  PRIMARY_HOVER: 'rgb(0, 105, 217)',
  PRIMARY_LIGHT: 'rgba(0, 123, 255, 0.1)',

  // Текст
  TEXT_PRIMARY: 'rgb(33, 37, 41)',
  TEXT_SECONDARY: 'rgb(108, 117, 125)',
  TEXT_MUTED: 'rgb(173, 181, 189)',

  // Фоны
  BG_PRIMARY: 'rgb(255, 255, 255)',
  BG_SECONDARY: 'rgb(248, 249, 250)',
  BG_DISABLED: 'rgb(233, 236, 239)',

  // Границы
  BORDER: 'rgb(206, 212, 218)',
  BORDER_LIGHT: 'rgba(206, 212, 218, 0.5)',

  // Состояния
  SUCCESS: 'rgb(40, 167, 69)',
  DANGER: 'rgb(220, 53, 69)',
  WARNING: 'rgb(255, 193, 7)',
  INFO: 'rgb(23, 162, 184)',

  // Оверлеи
  OVERLAY: 'rgba(0, 0, 0, 0.45)',
  OVERLAY_BLUR: 'blur(4px)',

  // Тени
  SHADOW_SM: '0 1px 3px rgba(0, 0, 0, 0.1)',
  SHADOW_MD: '0 4px 12px rgba(0, 0, 0, 0.15)',
} as const
```

**Файл `design-tokens.ts`:**
```typescript
// Дизайн-токены: единые размеры, отступы, брейкпоинты
export const SPACING = {
  XS: '4px',
  SM: '8px',
  MD: '16px',
  LG: '24px',
  XL: '32px',
} as const

export const BORDER_RADIUS = {
  SM: '4px',
  MD: '8px',
  LG: '12px',
  ROUND: '50%',
} as const

export const BREAKPOINTS = {
  MOBILE: '560px',
  TABLET: '800px',
  DESKTOP: '1200px',
  WIDE: '1600px',
} as const

export const TRANSITIONS = {
  FAST: '0.2s ease',
  NORMAL: '0.3s ease',
  SLOW: '0.5s ease',
  CUBIC: '0.3s cubic-bezier(0.645, 0.045, 0.355, 1)',
} as const

export const Z_INDEX = {
  DROPDOWN: 1000,
  MODAL: 2000,
  TOAST: 3000,
  TOOLTIP: 4000,
  REACTION_PICKER: 10000,
} as const
```

### 2.2 Создание общих утилит

**Проблема:** Дублирование кода в 5+ компонентах:
- Трансформация URL (`bastyon.com → pocketnet.app`) — 4 места
- HTML-экранирование — 3 места
- Резолв аватара пользователя — 4 места
- Парсинг API-ответа (вложенные `.data.data.result`) — 5+ мест
- Генерация cachehash — 4 места
- Управление скроллом — 3 места

**Решение:** Создать/дополнить `src/helpers/common/`:

```
src/helpers/common/
├── url-transformer.ts        // normalizeImageUrl(), normalizeAvatarUrl()
├── html-escape.ts            // escapeHtml(), unescapeHtml()
├── avatar-resolver.ts        // resolveAvatarUrl(profile)
├── response-parser.ts        // unwrapRpcResponse(data)
├── cache-hash.ts             // generateCacheHash()
├── scroll-utils.ts           // getScrollPosition(), resetBodyScroll()
├── date-formatter.ts         // formatRelativeTime(), formatDate()
└── validation-regexes.ts     // POCKETNET_ADDRESS_REGEX, HEX_REGEX, ...
```

### 2.3 Удаление неиспользуемых импортов и мёртвого кода

**Затронутые файлы** (обнаружено при анализе):

| Файл | Проблема |
|------|----------|
| `feed-store.ts:216` | Импорт `getByPRC` не используется |
| `button.ts`, `card.ts`, `tag.ts`, `spin.ts`, `empty.ts`, `input.ts` | Пустые computed (`inputClass`, `cardClass` и т.д.) возвращающие `{}` — удалить |
| `header-events.ts:42-46` | `menuItems` возвращает пустой массив с комментом "Deprecated" — удалить или задокументировать |
| `image-gallery.ts:67,74` | Касты `(this as any)` — переписать на Composition API |
| `use-feed-queries.ts:43,89,152` | Устаревший `.substr()` → заменить на `.substring()` |

### 2.4 Единый формат комментариев

**Текущее состояние:** Смесь русских и английских комментариев, многие файлы вообще без комментариев.

**Действие:** При рефакторинге каждого файла:
1. Привести все комментарии к русскому языку
2. Добавить заголовочный комментарий к каждому файлу
3. Документировать неочевидную логику

---

## 3. Фаза 0 — Подготовка инфраструктуры

> Эта фаза создаёт общие модули, которые используются во всех последующих фазах.

### 3.1 Создать `src/styles/theme-colors.ts`

- Собрать все уникальные цвета из styled-файлов проекта
- Создать единый объект `COLORS`
- Экспортировать для использования в styled-компонентах

### 3.2 Создать `src/styles/design-tokens.ts`

- `SPACING`, `BORDER_RADIUS`, `BREAKPOINTS`, `TRANSITIONS`, `Z_INDEX`
- На основе анализа текущих значений в коде

### 3.3 Создать `src/helpers/common/url-transformer.ts`

```typescript
// Трансформация URL изображений между доменами Bastyon

/** Базовый URL сервиса изображений */
const IMAGE_SERVICE_URL = 'https://pocketnet.app:8092'
const LEGACY_IMAGE_SERVICE_URL = 'https://bastyon.com:8092'

/**
 * Нормализует URL изображения: заменяет устаревший домен на актуальный.
 * Используется для аватаров, обложек профилей и медиаконтента.
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return url
  return url.replace(LEGACY_IMAGE_SERVICE_URL, IMAGE_SERVICE_URL)
}
```

### 3.4 Создать `src/helpers/common/html-escape.ts`

```typescript
// Экранирование HTML-символов для безопасного отображения пользовательского контента

/**
 * Экранирует спецсимволы HTML для предотвращения XSS
 */
export function escapeHtml(text: string): string { ... }
```

### 3.5 Создать `src/helpers/common/avatar-resolver.ts`

```typescript
// Резолв URL аватара пользователя с учётом множественных источников данных

/**
 * Извлекает URL аватара из профиля пользователя.
 * Проверяет несколько полей (accSet.image, i, s) с фолбэком.
 *
 * @param profile - объект профиля из RPC-ответа
 * @returns URL аватара или undefined
 */
export function resolveAvatarUrl(profile: any): string | undefined { ... }
```

### 3.6 Создать `src/helpers/common/response-parser.ts`

```typescript
// Утилиты для извлечения данных из многоуровневых RPC-ответов

/**
 * Разворачивает RPC-ответ, проверяя вложенные уровни data/result.
 * API может возвращать данные в разных обёртках — эта функция их нормализует.
 */
export function unwrapRpcResponse<T>(response: any): T | null { ... }
```

### 3.7 Создать `src/helpers/common/cache-hash.ts`

```typescript
// Генерация уникального хэша для инвалидации кэша RPC-запросов

/**
 * Создаёт уникальный cachehash для обхода серверного кэша.
 * Используется при запросах, где нужны свежие данные (лента, рейтинги).
 */
export function generateCacheHash(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}
```

### 3.8 Создать `src/helpers/common/scroll-utils.ts`

```typescript
// Утилиты для управления скроллом и позицией прокрутки

export function getScrollPosition(): number { ... }
export function resetBodyScroll(): void { ... }
export function lockBodyScroll(): void { ... }
export function unlockBodyScroll(): void { ... }
```

### 3.9 Создать `src/helpers/common/date-formatter.ts`

```typescript
// Форматирование дат и относительного времени

/**
 * Форматирует временную метку в относительный формат:
 * "только что", "5 мин", "2 ч", "3 дн", "1 нед"
 */
export function formatRelativeTime(timestamp: number): string { ... }
```

### 3.10 Создать `src/helpers/common/validation-regexes.ts`

```typescript
// Регулярные выражения для валидации данных

export const POCKETNET_ADDRESS_REGEX = /^[PZ][a-zA-Z0-9]{25,}$/
export const HEX_REGEX = /^[0-9a-fA-F]+$/
export const URL_REGEX = /(?:https?|ftp|bastyon):\/\/[^\s]+/g
export const CAPTCHA_CODE_REGEX = /^[a-zA-Z0-9]{4,}$/
```

---

## 4. Фаза 1 — Критические компоненты (P0)

> Файлы более 500 строк, нарушающие все принципы. Рефакторинг обязателен для дальнейшей поддержки.

---

### 4.1 `messenger/store.ts` — 2028 строк

**Текущее состояние:** Монолитный Pinia-стор с UI-состоянием, чат-логикой, кэшированием профилей, шифрованием и коммуникацией по Matrix-протоколу в одном файле.

**Целевая структура:**

```
b-components/messenger/
├── store/
│   ├── messenger-store.ts          // Главный стор — реэкспорт и координация (<150 строк)
│   ├── messenger-chat-store.ts     // Комнаты, сообщения, отправка/получение
│   ├── messenger-ui-store.ts       // UI-состояние: полноэкранность, панели, активный диалог
│   ├── messenger-profile-cache.ts  // Кэш профилей собеседников
│   └── consts.ts                   // Все константы мессенджера
├── services/
│   ├── matrix-service.ts           // (уже есть) — рефакторинг по необходимости
│   ├── pcrypto.ts                  // (уже есть) — оставить
│   └── encryption-service.ts       // НОВЫЙ: вынести шифрование/дешифрование из store
├── types.ts                        // Общие типы мессенджера
├── helpers.ts                      // Хелперы: hexToAddress, парсинг сообщений
└── components/
    └── ... (существующие)
```

**Шаги рефакторинга:**

1. **Создать `store/consts.ts`:**
   - Извлечь все таймауты, лимиты, конфигурационные значения
   - Примеры: размер батча сообщений, интервалы повторных попыток, лимиты кэша

2. **Создать `store/messenger-ui-store.ts`:**
   - Перенести: `isFullscreen`, `activeDialogId`, состояние панелей
   - Перенести: методы переключения UI-режимов

3. **Создать `store/messenger-chat-store.ts`:**
   - Перенести: логику комнат и сообщений
   - Перенести: отправку, получение, пагинацию сообщений

4. **Создать `store/messenger-profile-cache.ts`:**
   - Перенести: кэш профилей и аватаров собеседников
   - Использовать `resolveAvatarUrl()` из общих утилит

5. **Создать `services/encryption-service.ts`:**
   - Перенести всю логику шифрования/дешифрования из store
   - Чистые функции без зависимости от state

6. **Создать `helpers.ts`:**
   - Перенести `hexToAddress()`, парсинг сообщений, форматирование
   - Убрать из `chat-room.ts` (там тоже дублируется)

7. **Рефакторинг `store/messenger-store.ts`:**
   - Главный стор импортирует и координирует подсторы
   - Не более 150 строк

---

### 4.2 `content/post-card/post-card-comments/post-card-comments.ts` — 1001 строка

**Текущее состояние:** Монолитный компонент, объединяющий список комментариев, отдельный комментарий, ввод комментария, треды, пагинацию.

**Целевая структура:**

```
post-card-comments/
├── post-card-comments.vue       // Оркестрация (<80 строк шаблона)
├── post-card-comments.ts        // Основная логика (<200 строк)
├── styled.ts                    // Стили контейнера
├── types.ts                     // CommentItem, CommentThread, etc.
├── consts.ts                    // COMMENTS_PER_PAGE, MAX_NESTING_LEVEL, ...
├── helpers.ts                   // Форматирование текста, парсинг
├── index.ts
└── components/
    ├── comment-item/            // Отображение одного комментария
    │   ├── comment-item.vue
    │   ├── comment-item.ts
    │   ├── styled.ts
    │   └── index.ts
    ├── comment-input/           // Поле ввода комментария
    │   ├── comment-input.vue
    │   ├── comment-input.ts
    │   ├── styled.ts
    │   └── index.ts
    └── comment-thread/          // Вложенный тред комментариев
        ├── comment-thread.vue
        ├── comment-thread.ts
        ├── styled.ts
        └── index.ts
```

**Шаги рефакторинга:**

1. **Создать `types.ts`:** Интерфейсы `CommentItem`, `CommentThread`, `CommentInputProps`
2. **Создать `consts.ts`:** `COMMENTS_PER_PAGE`, `MAX_NESTING_LEVEL`, `COMMENT_MAX_LENGTH`
3. **Создать `components/comment-item/`:** Отображение одного комментария с аватаром, текстом, рейтингом
4. **Создать `components/comment-input/`:** Поле ввода + кнопка отправки
5. **Создать `components/comment-thread/`:** Рекурсивное отображение вложенных комментариев
6. **Создать `helpers.ts`:** Форматирование текста комментария, парсинг ответов
7. **Рефакторинг основного файла:** Оркестрация подкомпонентов, пагинация, загрузка данных

---

### 4.3 `content/video-player/video-player.ts` — 824 строки + `styled.ts` — 929 строк

**Текущее состояние:** Огромный компонент с HLS-логикой, управлением качеством, субтитрами, контролами плеера.

**Целевая структура:**

```
video-player/
├── video-player.vue             // Шаблон (<100 строк)
├── video-player.ts              // Основная логика (<200 строк)
├── styled.ts                    // Стили контейнера (<200 строк)
├── types.ts                     // VideoSource, QualityLevel, PlayerState
├── consts.ts                    // BUFFER_SIZE, QUALITY_LABELS, SEEK_STEP, ...
├── helpers.ts                   // formatDuration, calculateBuffered
├── index.ts
├── use-hls-player.ts            // Composable: инициализация HLS.js, управление потоком
├── use-video-controls.ts        // Composable: play/pause, громкость, полноэкранный режим
├── use-video-quality.ts         // Composable: выбор качества, автопереключение
└── components/
    ├── player-controls/         // UI контролов плеера
    │   ├── player-controls.vue
    │   ├── player-controls.ts
    │   ├── styled.ts
    │   └── index.ts
    ├── quality-selector/        // Выбор качества видео
    │   ├── quality-selector.vue
    │   ├── quality-selector.ts
    │   ├── styled.ts
    │   └── index.ts
    └── progress-bar/            // Прогресс-бар с превью
        ├── progress-bar.vue
        ├── progress-bar.ts
        ├── styled.ts
        └── index.ts
```

**Шаги рефакторинга:**

1. **Создать `consts.ts`:** Таймауты буфера, шаги перемотки, лейблы качества, интервалы обновления
2. **Создать `types.ts`:** `VideoSource`, `QualityLevel`, `PlayerState`, `SubtitleTrack`
3. **Создать `use-hls-player.ts`:** Инициализация HLS.js, подключение к элементу video, обработка ошибок
4. **Создать `use-video-controls.ts`:** Play/pause, громкость, seek, fullscreen
5. **Создать `use-video-quality.ts`:** Получение уровней качества из HLS, переключение
6. **Создать `helpers.ts`:** `formatDuration()`, `calculateBufferedPercentage()`
7. **Разделить `styled.ts`:** По подкомпонентам (controls, quality-selector, progress-bar)
8. **Создать подкомпоненты:** `player-controls`, `quality-selector`, `progress-bar`

---

### 4.4 `composables/use-infinite-feed.ts` — 509 строк

**Текущее состояние:** Огромный composable с 4 ветками логики (подписки, избранное, обсуждаемое, дефолт),
обогащение репостов, подгрузка рейтингов.

**Целевая структура:**

```
composables/
├── use-infinite-feed.ts             // Главный composable (<150 строк) — оркестрация
├── use-infinite-feed-fetchers.ts    // Функции запросов для каждого типа фида
├── use-infinite-feed-enrichment.ts  // Обогащение постов: репосты, рейтинги, профили
├── use-infinite-feed-consts.ts      // Константы: TAB_IDS, лимиты, интервалы
└── use-infinite-feed.helpers.ts     // encodeTagsForQuery, shouldLoadMore, ...
```

**Шаги рефакторинга:**

1. **Создать `use-infinite-feed-consts.ts`:**
   ```typescript
   export const TAB_IDS = {
     SUBSCRIPTIONS: 2,
     DISCUSSED: 6,
     TOP: 7,
   } as const

   export const DEFAULT_THRESHOLD_MULTIPLIER = 1
   ```

2. **Создать `use-infinite-feed-fetchers.ts`:**
   - `fetchSubscribesFeed()`, `fetchFavoritesFeed()`, `fetchDiscussedFeed()`, `fetchDefaultFeed()`
   - Каждая функция < 50 строк

3. **Создать `use-infinite-feed-enrichment.ts`:**
   - `enrichRepostsWithContent()` — подгрузка контента репостов
   - `enrichPostsWithScores()` — подгрузка рейтингов
   - Использовать `generateCacheHash()` из общих утилит

4. **Рефакторинг основного файла:** Оркестрация, вызов fetcher-ов и enrichment-функций

---

### 4.5 `composables/use-user-queries.ts` — 400 строк

**Целевая структура:**

```
composables/
├── use-user-queries.ts          // Основной composable для запросов пользователя (<150 строк)
├── use-user-balance.ts          // Composable: баланс и UTXO
├── use-user-state.ts            // Composable: состояние пользователя (репутация, лимиты)
└── use-user-queries-consts.ts   // SATOSHI_TO_PKOIN = 100_000_000, лимиты
```

**Шаги:**

1. **Создать `use-user-queries-consts.ts`:** `SATOSHI_TO_PKOIN`, `DEFAULT_LANGUAGE`, лимиты запросов
2. **Выделить `use-user-balance.ts`:** Логика UTXO, расчёт баланса, список адресов
3. **Выделить `use-user-state.ts`:** Состояние пользователя, репутация, верификация
4. **Упростить основной файл:** Общие хелперы, реэкспорт composables

---

### 4.6 `notifications-store.ts` — 380 строк

**Целевая структура:**

```
stores/
├── notifications-store.ts               // Основной стор (<150 строк)
├── notifications-store-consts.ts        // MESSAGE_TYPE_TITLES, RETRY_DELAY_MS, limits
├── notifications-store-helpers.ts       // mapMissedEventToNotification, extractEventId, ...
└── notifications-store-fetcher.ts       // fetchMissedNotifications с retry-логикой
```

**Шаги:**

1. **Создать `notifications-store-consts.ts`:**
   ```typescript
   export const RETRY_DELAY_MS = 2000
   export const DEFAULT_NOTIFICATIONS_LIMIT = 30
   export const MESSAGE_TYPE_TITLES: Record<string, string> = { ... }
   ```

2. **Создать `notifications-store-helpers.ts`:**
   - `mapMissedEventToNotification()`, `extractEventId()`, `extractEventType()`

3. **Создать `notifications-store-fetcher.ts`:**
   - Вся retry-логика (63 строки) в отдельном файле

---

## 5. Фаза 2 — Компоненты высокого приоритета (P1)

---

### 5.1 `header/header-user/header-user.ts` — 457 строк

**Проблемы:**
- 13 свойств состояния в одном компоненте
- Логика модалок (sign-in, register, mnemonic, account-switcher) смешана с основной
- Сложная логика резолва аватара (дублируется)
- Магические числа: `30000` (интервал проверки), `3000` (задержка мнемоника)

**Целевая структура:**

```
header-user/
├── header-user.vue
├── header-user.ts              // <150 строк
├── styled.ts
├── consts.ts                   // REGISTRATION_CHECK_INTERVAL, MNEMONIC_SHOW_DELAY
├── helpers.ts                  // resolveBalance (пробует множество полей), formatBalance
├── types.ts
├── use-header-auth.ts          // Composable: авторизация, выход, переключение аккаунтов
├── use-header-modals.ts        // Composable: управление модалками
└── index.ts
```

**Шаги:**

1. **Создать `consts.ts`:**
   ```typescript
   export const REGISTRATION_CHECK_INTERVAL = 30_000 // 30 сек — интервал проверки статуса регистрации
   export const MNEMONIC_SHOW_DELAY = 3_000          // 3 сек — задержка перед показом мнемоника
   export const BALANCE_FIELDS = ['balance', 'wallet', 'amount', 'bal'] as const
   ```

2. **Создать `use-header-modals.ts`:** Состояние и методы для 4 модалок
3. **Создать `use-header-auth.ts`:** Логика авторизации, выхода, проверки регистрации
4. **Использовать `resolveAvatarUrl()`** из общих утилит вместо локальной дублирующей логики
5. **Рефакторинг основного файла:** Импорт composables, оркестрация

---

### 5.2 `messenger/components/chat-room/chat-room.ts` — 427 строк

**Проблемы:**
- Логика голосовых сообщений (запись, кодеки, touch-управление) в основном компоненте
- `hexToAddress()` — криптографическая логика в UI-компоненте
- Дублирование `getAvatarUrlFromProfile()`
- Магические числа: `0x80`, `0x350`, `-50` (порог свайпа)

**Целевая структура:**

```
chat-room/
├── chat-room.vue
├── chat-room.ts                 // <150 строк
├── styled.ts
├── consts.ts                    // PREFERRED_AUDIO_TYPES, TOUCH_THRESHOLDS, HEX_CONSTANTS
├── types.ts
├── use-voice-recorder.ts        // Composable: запись голосовых сообщений
├── use-touch-swipe.ts           // Composable: обработка свайпов (блокировка, отмена записи)
└── index.ts
```

**Шаги:**

1. **Создать `consts.ts`:**
   ```typescript
   export const PREFERRED_AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']
   export const TOUCH_THRESHOLDS = { LOCK_UP: -50, CANCEL_LEFT: -50 }
   ```

2. **Создать `use-voice-recorder.ts`:** Инициализация MediaRecorder, управление записью, выбор кодека
3. **Создать `use-touch-swipe.ts`:** Обработка touch-событий для свайпов
4. **Перенести `hexToAddress()`** в `messenger/helpers.ts`
5. **Заменить `getAvatarUrlFromProfile()`** на `resolveAvatarUrl()` из общих утилит

---

### 5.3 `messenger/components/message-item/message-item.ts` — 367 строк

**Проблемы:**
- AES-CTR дешифрование прямо в компоненте (строки 184–224)
- Хардкод эмодзи реакций (`['👍', '❤️', '😂', '😮', '😢', '🙏']`)
- Сложная логика позиционирования пикера реакций
- Дублирование HTML-экранирования

**Целевая структура:**

```
message-item/
├── message-item.vue
├── message-item.ts              // <150 строк
├── styled.ts
├── consts.ts                    // REACTION_EMOJIS, AUDIO_LOAD_TIMEOUT, Z_INDEX
├── types.ts
├── helpers.ts                   // formatMessageText, getScrollParent
├── use-message-audio.ts         // Composable: загрузка и дешифрование аудио
├── use-reaction-picker.ts       // Composable: позиционирование и управление пикером
└── index.ts
```

**Шаги:**

1. **Создать `consts.ts`:**
   ```typescript
   export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
   export const AUDIO_LOAD_TIMEOUT = 30_000
   ```

2. **Создать `use-message-audio.ts`:** Загрузка, дешифрование, fallback-логика для аудиосообщений
3. **Создать `use-reaction-picker.ts`:** Расчёт позиции, показ/скрытие
4. **Создать `helpers.ts`:** `formatMessageText()` (использовать `escapeHtml()` из общих утилит), `getScrollParent()`
5. **Перенести дешифрование** в `services/encryption-service.ts`

---

### 5.4 `b-components/profile/profile-sidebar/profile-sidebar.ts` — 186 строк

**Проблемы:**
- Генерация URL аватара, форматирование дат, декодирование текста, HTML-экранирование, работа с URL — всё в одном компоненте
- Магические строки полей профиля: `accSet.image`, `i`, `s`, `b`, `a`, `r`, `postcnt`

**Целевая структура:**

```
profile-sidebar/
├── profile-sidebar.vue
├── profile-sidebar.ts           // <100 строк
├── styled.ts
├── consts.ts                    // PROFILE_FIELDS, DATE_FORMAT_OPTIONS
├── helpers.ts                   // decodeProfileText, formatUrlsInText, getDisplayName
├── types.ts
└── index.ts
```

**Шаги:**

1. **Создать `consts.ts`:**
   ```typescript
   // Имена полей в объекте профиля из RPC (сокращённые имена — особенность API)
   export const PROFILE_FIELDS = {
     AVATAR: 'i',           // URL аватара
     AVATAR_SMALL: 's',     // Маленький аватар
     AVATAR_BIG: 'b',       // Большой аватар
     ADDRESS: 'a',          // Адрес кошелька
     REPUTATION: 'r',       // Репутация
     POST_COUNT: 'postcnt', // Количество постов
   } as const
   ```

2. **Создать `helpers.ts`:** `decodeProfileText()`, `formatUrlsInText()`, `getDisplayName()`
3. **Использовать общие утилиты:** `resolveAvatarUrl()`, `escapeHtml()`, `normalizeImageUrl()`

---

### 5.5 `sidebar/sidebar-categories/sidebar-categories.ts` — 255 строк

**Проблемы:**
- Управление модалками, валидация ввода, логика выбора категорий — всё в одном
- Магические числа: `4` (базовое число категорий), `10` (макс. в свёрнутом виде)
- Хардкод русских строк в логике

**Целевая структура:**

```
sidebar-categories/
├── sidebar-categories.vue
├── sidebar-categories.ts        // <120 строк
├── styled.ts
├── consts.ts                    // BASE_CATEGORIES, MAX_COLLAPSED, MESSAGES
├── helpers.ts                   // sanitizeTagName, isCategoryExists
├── types.ts
├── use-category-modal.ts        // Composable: управление модалкой добавления/удаления
└── components/
    ├── add-category-modal/
    │   ├── add-category-modal.vue
    │   ├── add-category-modal.ts
    │   ├── styled.ts
    │   └── index.ts
    └── index.ts
```

---

### 5.6 `sidebar/sidebar-tags/sidebar-tags.ts` — 156 строк

**Проблемы:**
- Магические числа: `100` (количество тегов), `5 * 60 * 1000` (stale time), `7` (лимит отображения), `1000` (порог для K-формата)
- Хардкод `'ru'` в API-вызове

**Целевая структура:**

```
sidebar-tags/
├── sidebar-tags.vue
├── sidebar-tags.ts              // <120 строк
├── styled.ts
├── consts.ts                    // TAG_FETCH_COUNT, TAGS_DISPLAY_LIMIT, STALE_TIME, ...
├── helpers.ts                   // formatTagCount
├── types.ts
└── index.ts
```

**Шаги:**

1. **Создать `consts.ts`:**
   ```typescript
   export const TAG_FETCH_COUNT = 100
   export const TAGS_DISPLAY_LIMIT = 7
   export const TAGS_STALE_TIME = 5 * 60 * 1000  // 5 минут
   export const TAGS_GC_TIME = 10 * 60 * 1000    // 10 минут
   export const FORMAT_THRESHOLD_K = 1000
   ```

2. **Создать `helpers.ts`:** `formatTagCount(count)` — форматирование с K-суффиксом

---

### 5.7 `content/post-card/post-card.ts` — 299 строк

**Целевая структура:**

```
post-card/
├── post-card.vue
├── post-card.ts                 // <150 строк
├── styled.ts
├── consts.ts
├── helpers.ts                   // Декодирование заголовков, парсинг медиа
├── types.ts
├── use-post-ratings.ts          // Composable: логика рейтингов
├── use-post-media.ts            // Composable: определение типа медиа (видео/аудио/изображения)
└── components/
    ├── post-card-comments/      // (существующий, рефакторится в 4.2)
    ├── post-card-header/        // НОВЫЙ: заголовок поста (автор, дата, репост-инфо)
    │   └── ...
    ├── post-card-media/         // НОВЫЙ: медиаконтент поста
    │   └── ...
    └── post-card-actions/       // НОВЫЙ: кнопки действий (лайк, коммент, поделиться)
        └── ...
```

---

### 5.8 `content/content-feed/content-feed.ts` — 216 строк

**Целевая структура:**

```
content-feed/
├── content-feed.vue
├── content-feed.ts              // <120 строк
├── styled.ts
├── consts.ts                    // SCROLL_THRESHOLD, LOAD_MORE_THRESHOLD
├── use-scroll-position.ts       // Composable: отслеживание позиции скролла
└── index.ts
```

**Шаги:**

1. **Создать `consts.ts`:** `SCROLL_THRESHOLD`, `SCROLL_TO_TOP_THRESHOLD = 100`
2. **Создать `use-scroll-position.ts`:** Вынести логику подписки на scroll/resize, расчёт позиции кнопки "наверх"

---

### 5.9 `composables/use-feed.ts` — 311 строк

**Проблемы:**
- `adaptPostData()` — 114 строк с глубокой вложенностью
- Дублирование `safeDecode()`
- Дублирование извлечения профиля пользователя

**Целевая структура:**

```
composables/
├── use-feed.ts                  // Основной composable (<100 строк)
├── use-feed-adapter.ts          // adaptPostData и связанные функции
├── use-feed-helpers.ts          // safeDecode, normalizeImages, extractPostsFromResponse
└── use-feed-consts.ts           // TIMESTAMP_MULTIPLIER, RATING_SCALE, ...
```

**Шаги:**

1. **Создать `use-feed-consts.ts`:** `TIMESTAMP_MULTIPLIER = 1000`, `RATING_MAX_STARS = 5`
2. **Создать `use-feed-helpers.ts`:** `safeDecode()`, `normalizeImages()`, `extractPostsFromResponse()`
3. **Создать `use-feed-adapter.ts`:** `adaptPostData()` разбить на:
   - `extractUserProfile()` — извлечение профиля автора
   - `extractMediaContent()` — извлечение медиа
   - `extractLastComment()` — парсинг последнего комментария
   - `calculateRating()` — расчёт рейтинга

---

### 5.10 `stores/feed-store.ts` — 354 строки (deprecated, но используется)

**Проблемы:**
- Помечен как deprecated, но активно используется
- 9 условных проверок для извлечения постов из ответа API
- Неиспользуемый импорт `getByPRC`

**Действие:**

1. **Создать `stores/feed-store-helpers.ts`:** Вынести `extractPostsFromApiResponse()`, `calculateRatingStars()`, `isUserVerified()`
2. **Создать `stores/feed-store-consts.ts`:** `TIMESTAMP_MULTIPLIER`, `RATING_DIVISOR`
3. **Удалить неиспользуемый импорт** `getByPRC`
4. **Добавить комментарии:** Почему стор deprecated и план миграции

---

### 5.11 `stores/filters-store.ts` — 349 строк

**Действие:**

1. **Создать `stores/filters-store-consts.ts`:**
   ```typescript
   export const FEED_MODE_TO_TAB_ID: Record<string, number> = { ... }
   ```
2. **Вынести хелперы:** `deduplicateCategories()`, `cloneFilters()`
3. **Убрать прямой доступ к `window.location`** — использовать Vue Router

---

## 6. Фаза 3 — Компоненты среднего приоритета (P2)

---

### 6.1 `header/app-header/app-header.ts` — директива inline

**Действие:**
- Вынести кастомную директиву `v-hide-zero-width` в `src/directives/hide-zero-width.ts`
- Вынести ResizeObserver-логику в composable `use-resize-observer.ts`

---

### 6.2 `header/header-notifications/header-notifications.ts` — 125 строк

**Действие:**
- Вынести `formatNotificationTime()` в `src/helpers/common/date-formatter.ts`
- Создать `consts.ts`: `MAX_NOTIFICATIONS_DISPLAY = 20`, `TIME_THRESHOLDS`
- Создать `helpers.ts`: `getPopupContainer()`

---

### 6.3 `video-uploader/video-uploader.ts` — 613 строк

**Целевая структура:**

```
video-uploader/
├── video-uploader.vue
├── video-uploader.ts            // <200 строк
├── styled.ts
├── types.ts                     // UploadState (сейчас определён inline)
├── consts.ts
├── helpers.ts
├── use-video-upload.ts          // Composable: процесс загрузки
├── use-video-list.ts            // Composable: управление списком видео
├── utils/                       // (существующие)
├── transcoder/                  // (существующие)
└── components/                  // (существующие)
```

**Шаги:**

1. **Перенести `UploadState`** из основного файла в `types.ts`
2. **Создать `use-video-upload.ts`:** Логика загрузки, прогресс, обработка ошибок
3. **Создать `use-video-list.ts`:** Управление списком видео, состояние транскодинга

---

### 6.4 `pages/wallets-page/wallets-page.ts` — 303 строки

**Целевая структура:**

```
wallets-page/
├── wallets-page.vue
├── wallets-page.ts              // <150 строк
├── wallets-page.styled.ts
├── consts.ts                    // MAX_ADDITIONAL_WALLETS
├── types.ts
├── use-wallet-balances.ts       // Composable: загрузка и расчёт балансов
├── use-wallet-addresses.ts      // Composable: управление адресами
└── components/
    ├── wallet-transfer/         // (существующий)
    └── pkoin-chart/             // (существующий)
```

---

### 6.5 `pages/wallets-page/wallet-transfer/wallet-transfer.ts` — 331 строка

**Целевая структура:**

```
wallet-transfer/
├── wallet-transfer.vue
├── wallet-transfer.ts           // <150 строк
├── wallet-transfer.styled.ts
├── consts.ts                    // SEARCH_DEBOUNCE, POCKETNET_ADDRESS_REGEX, ERROR_MESSAGES
├── types.ts
├── helpers.ts                   // looksLikeAddress, copyAddress
├── use-transfer-form.ts         // Composable: состояние формы
├── use-receiver-search.ts       // Composable: поиск получателя
└── index.ts
```

---

### 6.6 `pages/wallets-page/pkoin-chart/pkoin-chart.ts` — 340 строк

**Целевая структура:**

```
pkoin-chart/
├── pkoin-chart.vue
├── pkoin-chart.ts               // <100 строк
├── pkoin-chart.styled.ts
├── consts.ts                    // COINGECKO_API, PERIOD_OPTIONS, CHART_MARGINS, CHART_COLORS
├── types.ts
├── helpers.ts                   // formatChartDate, formatCurrency
├── use-chart-data.ts            // Composable: загрузка данных из CoinGecko
├── use-d3-chart.ts              // Composable: рендеринг D3-графика
└── index.ts
```

---

### 6.7 `components/captcha/captcha.ts` — 273 строки

**Целевая структура:**

```
captcha/
├── captcha.vue
├── captcha.ts                   // <120 строк
├── styled.ts
├── consts.ts                    // CAPTCHA_CSS_PATH, VALIDATION_REGEX, LOAD_TIMEOUT
├── types.ts
├── helpers.ts                   // validateCaptchaCode
├── hex-captcha-loader.ts        // Динамическая загрузка HexCaptcha (с комментариями по безопасности)
├── captcha-modal.vue
├── captcha-modal.ts
├── captcha-modal.styled.ts
├── captcha-modal-utils.ts       // (существующий)
└── index.ts
```

---

### 6.8 `components/image-gallery/image-gallery.ts` — 85 строк (старый стиль)

**Действие:**
- Переписать с `defineComponent` (Vue 2 стиль) на `<script setup>` (Vue 3)
- Убрать все касты `(this as any)`
- Вынести `preventPageZoom` / `removeZoomPrevention` в утилиту или composable

---

### 6.9 `components/avatar/avatar.ts` — 124 строки

**Действие:**
- Вынести inline-стили из `avatar.vue` в `styled.ts` (строки 6–8, 14–17, 23–34, 63–66)
- Создать `consts.ts`:
  ```typescript
  export const AVATAR_SIZES = { small: 24, medium: 32, default: 40 } as const
  ```
- Использовать `resolveAvatarUrl()` из общих утилит вместо локальной трансформации URL (строка 98)

---

### 6.10 `pages/profile-page/profile-page.ts` — 169 строк

**Действие:**
- Создать `consts.ts`: `MIN_ADDRESS_LENGTH = 30`
- Вынести inline-стиль из `profile-page.vue:13` в styled-компонент
- Разделить `fetchUserProfile()` (55 строк) на:
  - `resolveAddress(identifier)` — резолв адреса из имени
  - `loadProfile(address)` — загрузка профиля по адресу

---

### 6.11 `b-components/effects/star-explosion/use-star-explosion.ts` — 128 строк

**Действие:**
- Создать `consts.ts`:
  ```typescript
  // Конфигурация частиц для эффекта взрыва звёзд (PixiJS)
  export const PARTICLE_CONFIG = {
    COUNT: 20,              // Количество частиц в одном взрыве
    SCALE_MIN: 0.5,         // Минимальный масштаб частицы
    SCALE_MAX: 1.0,         // Максимальный масштаб
    SPEED_MIN: 2,           // Минимальная скорость разлёта
    SPEED_MAX: 8,           // Максимальная скорость
    DECAY_MIN: 0.01,        // Минимальная скорость затухания
    DECAY_MAX: 0.03,        // Максимальная скорость затухания
    ROTATION_SPEED: 0.2,    // Множитель скорости вращения
    GRAVITY: 0.15,          // Сила гравитации
  } as const
  ```
- Добавить комментарии к физической модели анимации

---

### 6.12 `stores/modal-store.ts` — 139 строк

**Действие:**
- Использовать `scroll-utils.ts` вместо дублирующей логики скролла (строки 53–54, 88–89)
- Упростить `requestAnimationFrame` цепочку в `closeImageGallery()` (строки 103–128)

---

### 6.13 `stores/pending-ratings-store.ts` — 173 строки

**Действие:**
- Создать `consts.ts`: `POLL_INTERVAL_MS = 5_000`
- Использовать `generateCacheHash()` и `unwrapRpcResponse()` из общих утилит

---

### 6.14 `stores/ui-store.ts` — 129 строк

**Действие:**
- Использовать `scroll-utils.ts` для логики скролла (дублируется с modal-store)
- Обернуть доступ к `sessionStorage` в утилиту

---

## 7. Фаза 4 — Низкий приоритет и финальная полировка (P3)

---

### 7.1 Замена всех хардкод-цветов на дизайн-токены

**Затронутые файлы (styled.ts):**
- `components/button/styled.ts` — 6+ хардкод-цветов
- `components/input/styled.ts` — 5+ хардкод-цветов
- `components/card/styled.ts` — 4+ хардкод-цветов
- `components/tag/styled.ts` — 3+ хардкод-цветов
- `components/spin/styled.ts` — 2 хардкод-цвета
- `components/empty/styled.ts` — 2 хардкод-цвета
- `components/modal/styled.ts` — 4+ хардкод-цветов
- `components/avatar/styled.ts` — 2 хардкод-цвета
- `components/input-search/styled.ts` — 5+ хардкод-цветов
- `pages/home-page/home-page.styled.ts` — 2+ хардкод-значений
- `pages/profile-page/profile-page.styled.ts` — 3+ хардкод-цветов
- `pages/wallets-page/wallets-page.styled.ts` — множество
- `pages/settings-page/settings-page.styled.ts` — множество
- `pages/limits-page/limits-page.styled.ts` — множество
- Все `b-components/*/styled.ts`

**Действие:** В каждом styled-файле заменить:
```typescript
// Было:
background: rgb(0, 123, 255);
color: rgb(33, 37, 41);

// Стало:
import { COLORS } from '@/styles/theme-colors'
background: ${COLORS.PRIMARY};
color: ${COLORS.TEXT_PRIMARY};
```

---

### 7.2 Удаление пустых computed-свойств

**Файлы:** `button.ts`, `card.ts`, `tag.ts`, `spin.ts`, `empty.ts`, `input.ts`, `input-search.ts`

**Действие:** Удалить все `*Class` computed, возвращающие `{}`, и убрать их из шаблонов

---

### 7.3 Замена `.substr()` на `.substring()`

**Файлы:** `use-feed-queries.ts` (строки 43, 89, 152, 227)

---

### 7.4 Рефакторинг `app-toast/index.ts`

**Действие:** Применить DRY — 4 метода (`success`, `error`, `info`, `warning`) заменить фабричной функцией:

```typescript
const createMethod = (type: NotificationType) =>
  (options: T_ToastOptions) => notification[type]({
    message: options.title || '',
    description: options.text || '',
    duration: TOAST_DURATION,
    placement: TOAST_PLACEMENT,
  })
```

---

### 7.5 Рефакторинг `sidebar-tabs/sidebar-tabs.ts`

**Действие:**
- Заменить цепочку if-else (строки 88–111) маппингом:
  ```typescript
  const TAB_URL_MAPPING: Record<number, string> = {
    2: 'subscriptions', 3: 'video', 4: 'audio', ...
  }
  ```
- Заменить ручную манипуляцию URL на `router.replace()`

---

### 7.6 Рефакторинг `main.js`

**Действие:**
- Вынести полифиллы (строки 1–32) в отдельный `src/polyfills.ts`
- Вынести интервал опроса нотификаций в константу: `NOTIFICATION_POLL_INTERVAL = 30_000`
- Добавить комментарии к инициализации

---

### 7.7 Рефакторинг `style.css`

**Действие:**
- Вынести повторяющиеся цвета в CSS-переменные в `:root`
- Документировать секции (reset, overrides, scrollbar, ant-design)

---

### 7.8 Модернизация `image-gallery` — перевод на Composition API

Подробности в п. 6.8.

---

### 7.9 Рефакторинг `composables/use-profile-feed.ts` — 247 строк

**Действие:**
- Использовать общие хелперы вместо дублирования логики обогащения репостов (та же логика что в `use-infinite-feed.ts`)
- Создать общий `use-repost-enrichment.ts` для обоих composables

---

### 7.10 Рефакторинг `stores/search-store.ts` — 105 строк

**Действие:**
- Создать `consts.ts`: `MAX_HISTORY_LENGTH = 10`
- Удалить `console.info('Search:', ...)` — отладочный вывод
- Заменить `Array.includes()` на `Set` для истории поиска

---

### 7.11 Полная ревизия комментариев

**Действие для каждого рефакторенного файла:**
- [ ] Заголовочный комментарий (назначение файла) — на русском
- [ ] JSDoc для публичных функций и composables
- [ ] Комментарии к неочевидной логике (хаки, обходные решения, особенности API)
- [ ] Удаление TODO-комментариев с фактическим исправлением
- [ ] Единый язык — русский

---

## 8. Карта зависимостей между фазами

```
Фаза 0 (Инфраструктура)
│
├── theme-colors.ts ─────────────────────────────┐
├── design-tokens.ts ────────────────────────────┤
├── url-transformer.ts ──────────┐               │
├── html-escape.ts ──────────────┤               │
├── avatar-resolver.ts ─────────┤               │
├── response-parser.ts ─────────┤               │
├── cache-hash.ts ──────────────┤               │
├── scroll-utils.ts ────────────┤               │
├── date-formatter.ts ──────────┤               │
└── validation-regexes.ts ──────┘               │
                                │               │
Фаза 1 (P0 — Критические) ◄────┘               │
│                                               │
├── messenger/store.ts (2028 строк)             │
├── post-card-comments.ts (1001 строка)         │
├── video-player.ts (824 строки)                │
├── use-infinite-feed.ts (509 строк)            │
├── use-user-queries.ts (400 строк)             │
└── notifications-store.ts (380 строк)          │
                                                │
Фаза 2 (P1 — Высокий приоритет) ◄──────────────┤
│                                               │
├── header-user.ts (457 строк)                  │
├── chat-room.ts (427 строк)                    │
├── message-item.ts (367 строк)                 │
├── profile-sidebar.ts (186 строк)              │
├── sidebar-categories.ts (255 строк)           │
├── post-card.ts (299 строк)                    │
├── content-feed.ts (216 строк)                 │
├── use-feed.ts (311 строк)                     │
├── feed-store.ts (354 строки)                  │
└── filters-store.ts (349 строк)                │
                                                │
Фаза 3 (P2 — Средний приоритет) ◄──────────────┤
│                                               │
├── app-header.ts (директива)                   │
├── video-uploader.ts (613 строк)               │
├── wallets-page.ts (303 строки)                │
├── wallet-transfer.ts (331 строка)             │
├── pkoin-chart.ts (340 строк)                  │
├── captcha.ts (273 строки)                     │
├── image-gallery.ts (85, но старый стиль)      │
├── avatar.ts (124 строки)                      │
├── profile-page.ts (169 строк)                 │
├── star-explosion.ts (128 строк)               │
├── modal-store, pending-ratings-store, ui-store │
└── header-notifications.ts                     │
                                                │
Фаза 4 (P3 — Полировка) ◄──────────────────────┘
│
├── Замена хардкод-цветов во всех styled.ts
├── Удаление пустых computed
├── .substr() → .substring()
├── DRY для app-toast
├── Маппинг для sidebar-tabs
├── main.js → полифиллы
├── style.css → CSS-переменные
├── use-profile-feed дедупликация
├── search-store мелочи
└── Полная ревизия комментариев
```

---

## 9. Чек-лист для каждого компонента

При рефакторинге каждого компонента проверяем:

- [ ] **Стили** — все в `styled.ts`, нет inline-стилей в `.vue`
- [ ] **Структура** — если есть подкомпоненты, они в папке `components/`
- [ ] **Константы** — все магические числа и строки в `consts.ts`
- [ ] **Хелперы** — чистые функции в `helpers.ts`
- [ ] **Хуки** — сложная логика вынесена в `use-*.ts` composables
- [ ] **Типы** — интерфейсы в `types.ts`, нет `any` без необходимости
- [ ] **Импорты** — нет неиспользуемых, правильный порядок, группировка
- [ ] **Комментарии** — на русском, заголовочный + JSDoc + неочевидная логика
- [ ] **Форматирование** — пустые строки между блоками, функции < 50 строк
- [ ] **Размер** — `.ts` файл логики < 200 строк, `styled.ts` < 300 строк
- [ ] **Цвета** — используются из `theme-colors.ts`
- [ ] **Отступы/радиусы** — используются из `design-tokens.ts`
- [ ] **Дублирование** — используются общие утилиты вместо копипаста
- [ ] **Index** — корректный реэкспорт из `index.ts`

---

## Итого

| Фаза | Компонентов | Примерный объём |
|------|-------------|-----------------|
| Фаза 0 | 10 файлов | Создание инфраструктуры |
| Фаза 1 | 6 критических | ~4500 строк на рефакторинг |
| Фаза 2 | 11 компонентов | ~3300 строк на рефакторинг |
| Фаза 3 | 14 компонентов | ~3000 строк на рефакторинг |
| Фаза 4 | ~30 файлов | Полировка и стандартизация |

**Принцип:** Каждая фаза завершается полностью рабочим приложением. Никаких промежуточных сломанных состояний.
