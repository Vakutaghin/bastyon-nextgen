# Bastyon NextGen - Нерешённые вопросы из аудита

**Исходный аудит:** 2026-04-09
**Обновлено:** 2026-04-10

---

## 1. Архитектура

### 1.1 Несогласованное расположение сторов
- `src/stores/` — основные сторы
- `src/blockchain/store/` — auth/profile/keys (отдельно)
- `src/b-components/messenger/store/` — messenger-store (внутри компонента)
- `src/b-components/content/video-player/store/` — video-player-store

**TODO:** Документировать стратегию co-location или переместить все сторы в `src/stores/`.

---

## 2. Компоненты

### 2.1 Смешение паттернов Vue
Три подхода без стандартизации:
| Паттерн | Где | Примеры |
|---------|-----|---------|
| Options API + .ts | `b-components/` | `post-card.ts`, `app-header.ts` |
| `<script setup>` | `components/` | `button.vue`, `avatar.vue` |
| Hybrid (defineComponent + setup) | `pages/` | `home-page.vue` |

**TODO:** Стандартизировать на `<script setup>` для новых компонентов. Постепенно мигрировать существующие.

### 2.2 Oversized компоненты

| Компонент | Строк | Проблема |
|-----------|-------|----------|
| PostCardComments `.vue` | 591 | 3 состояния в одном файле — разделить на sub-components |
| PostCardComments `.ts` | 800+ | Монолитная логика — вынести useComments() composable |
| VideoPlayer `.vue` | 290 | 20+ условных рендеров — вынести useVideoPlayer() composable |

### 2.3 Old-style PropType в b-components

```typescript
// Ещё используется (post-card.ts:119-122):
props: {
  post: {
    type: Object as PropType<Post>,
    required: true
  }
}

// Нетипизированные emits (post-card.ts:143):
emits: ['like', 'comment', 'share']
```

**TODO:** Мигрировать на `defineProps<{ post: Post }>()` и `defineEmits<{...}>()`.

### 2.4 Дублирование кода

| Дублирование | Где |
|-------------|-----|
| Рендеринг аватара | `post-card-comments.vue` (20+ раз) — вынести в компонент |
| Event `.stop.prevent` | `post-card-comments.vue` (30+ раз) — вынести в handler-методы |

---

## 3. State Management

### 3.1 Неконсистентность паттернов сторов
- **Options API** (80%): feed, posts, ui, modal, notifications, filters, search
- **Setup/Composition** (20%): messenger-store, messenger-chat-store

**TODO:** Выбрать один паттерн.

### 3.2 Бизнес-логика в сторах

| Логика | Store |
|--------|-------|
| Шифрование/дешифровка | `messenger-chat-store.ts` — вынести в PcryptoService |
| Timeline Matrix событий | `messenger-chat-store.ts` — вынести |
| Нотификации: retry + polling | `notifications-store.ts` — перевести на Vue Query |

### 3.3 Deprecated feed-store
`feed-store.ts` помечен как deprecated, но до сих пор импортируется.

**TODO:** Завершить миграцию на composables + Vue Query, удалить deprecated стор.

---

## 4. API Layer

### 4.1 Нет единого response unwrapping
Typed helpers `rpcCall<T>()`, `rpcCallWithAuth<T>()` уже созданы, но не внедрены в существующий код (~48 файлов).

**TODO:** Мигрировать существующие вызовы `getByPRC()`/`getByPRCWithAuth()` на типизированные `rpcCall<T>()`.

---

## 5. TypeScript Quality

### 5.1 Оставшиеся проблемы типизации

| Проблема | Пример |
|----------|--------|
| `unknown` return types | `getByPRC()`, `getByPRCWithAuth()`, `fetchHttp()` — typed wrappers созданы, старые функции не обновлены |
| Old-style PropType | `post-card.ts` и другие b-components |
| Untyped emits | `post-card.ts:143` `emits: ['like', 'comment', 'share']` |
| Cross-store calls | Вызовы между сторами без интерфейсов |

### 5.2 Отсутствующие типы
- Discriminated unions для RPC ответов
- Vue Event handlers не типизированы

---

## 6. Styling

### 6.1 Stylelint для CSS-in-JS
**TODO:** Добавить stylelint для styled-components.

---

## 7. Security

### 7.1 CSRF Protection
Нет CSRF токенов для API запросов.

**TODO:** Оценить необходимость CSRF (с учётом request signing через HMAC).

---

## 8. Testing

### Текущее состояние
- **39 тест-файлов**, **466 тестов** (~9% покрытие)
- 6 pre-existing failure в `mnemonic-storage.test.ts` (localStorage.clear в test env)

### Не покрыто тестами

**Приоритет 1 (Критический путь):**
- `blockchain/core/keys/` — генерация и валидация ключей
- `blockchain/core/transactions/` — построение транзакций
- `blockchain/core/signatures/` — подписи
- `stores/auth-store.ts` — аутентификация

**Приоритет 2 (Бизнес-логика):**
- `helpers/api/request.ts` — основной HTTP клиент
- `stores/notifications-store.ts` — нотификации (retry/polling)
- Composables (`useInfiniteFeed`, `useFeedQueries`, `useUserQueries`)

**Приоритет 3 (UI):**
- Компонентные тесты (`post-card`, `modal`, `button`) — 0 component tests
- E2E тесты (Playwright настроен, тестов нет)

**TODO:** Довести покрытие до 20-30%.

---

## 9. Tooling

### 9.1 noUncheckedIndexedAccess
Включен в `tsconfig.json` — может вызвать новые TS-ошибки в существующем коде.

**TODO:** Исправить TS-ошибки, вызванные `noUncheckedIndexedAccess: true`.
