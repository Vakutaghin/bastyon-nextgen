# Bastyon NextGen - Нерешённые вопросы из аудита

**Исходный аудит:** 2026-04-09
**Обновлено:** 2026-04-10
**Статус:** Большая часть критических и архитектурных проблем исправлена. Ниже — оставшиеся задачи.

---

## 1. Архитектура

### 1.1 Несогласованное расположение сторов
- `src/stores/` — основные сторы
- `src/blockchain/store/` — auth/profile/keys (отдельно)
- `src/b-components/messenger/store/` — messenger-store (внутри компонента)
- `src/b-components/content/video-player/store/` — video-player-store

**TODO:** Документировать стратегию co-location или переместить все сторы в `src/stores/`.

### 1.2 Неконсистентное именование
- `wallet-page/` vs `wallets-page/` (единственное vs множественное число)
- `blockchain/api/` vs `db/apis/` (api vs apis)

**TODO:** Привести к единому стилю.

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

| Компонент | Строк | Проблема | Статус |
|-----------|-------|----------|--------|
| PostCardComments `.vue` | 591 | 3 состояния в одном файле | **Не разделён на sub-components** |
| PostCardComments `.ts` | 800+ | Монолитная логика | **Нужен useComments() composable** |
| VideoPlayer `.vue` | 290 | 20+ условных рендеров | **Нужен useVideoPlayer() composable** |

> StarRating уже вынесен в `useStarRating()` composable (535 → 49 строк).

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

| Дублирование | Где | Статус |
|-------------|-----|--------|
| Получение инициалов | `post-card.ts`, `avatar.ts` | **Не дедуплицировано** |
| Рендеринг аватара | `post-card-comments.vue` (20+ раз) | **Не вынесено в компонент** |
| Event `.stop.prevent` | `post-card-comments.vue` (30+ раз) | **Не вынесено в handler-методы** |

> Форматирование времени уже дедуплицировано в `formatDateTimeFull()`.

---

## 3. State Management

### 3.1 Неконсистентность паттернов сторов
- **Options API** (80%): feed, posts, ui, modal, notifications, filters, search
- **Setup/Composition** (20%): messenger-store, messenger-chat-store

**TODO:** Выбрать один паттерн.

### 3.2 Cross-store мутации (частично исправлено)
```
useMessengerStore ──→ uiStore.dialogs = [...]  // прямая запись в чужой state
useFeedStore ──→ filtersStore.orderby           // tight coupling
```

> `pendingRatingsStore → postsStore` уже исправлено через `calculateRatingUpdate()`.

**TODO:** Исправить messenger → ui прямую запись.

### 3.3 Бизнес-логика в сторах

| Логика | Store | Статус |
|--------|-------|--------|
| Шифрование/дешифровка | `messenger-chat-store.ts` | **Не вынесено в PcryptoService** |
| Адаптация постов (`adaptPostData`) | `feed-store.ts` | **Не вынесено в PostMapper** |
| Timeline Matrix событий | `messenger-chat-store.ts` | **Не вынесено** |
| Нотификации: retry + polling | `notifications-store.ts` | **Не переведено на Vue Query** |

> Rating calculator уже вынесен в `helpers/common/rating-calculator.ts`.

### 3.4 Реактивность

```typescript
// Manual caching вместо computed (feed-store.ts:71-84)
if (this.cachedPostsData && this.cachedFeedDataHash === feedDataHash) {
  return this.cachedPostsData
}

// Deep watch на неограниченном объекте (messenger-store.ts:444)
watch(() => profileCache.userProfiles, () => { ... }, { deep: true })
```

> `isLoadingMore` уже переведён с `let` на `ref()`.

**TODO:** Заменить manual caching на computed. Ограничить deep watch.

### 3.5 Deprecated feed-store
`feed-store.ts` помечен как deprecated, но до сих пор импортируется.

**TODO:** Завершить миграцию на composables + Vue Query, удалить deprecated стор.

---

## 4. API Layer

### 4.1 Нет единого response unwrapping
Typed helpers `rpcCall<T>()`, `rpcCallWithAuth<T>()` уже созданы, но не внедрены в существующий код.

**TODO:** Мигрировать существующие вызовы `getByPRC()`/`getByPRCWithAuth()` на типизированные `rpcCall<T>()`.

### 4.2 console.log в production коде
- `free-balance-api.ts:39-61` — 10+ console.log с `[requestUnspents]` prefix
- `messenger-store.ts` — различные debug logs

**TODO:** Заменить на `logger.debug()` из `@/services/logger`.

### 4.3 Дублирование кода

| Дублирование | Статус |
|-------------|--------|
| BIP39 module loading (`key-validator.ts`, `key-generator.ts`) | **Не дедуплицировано** |
| SHA256 hashing (`address-validator.ts`, `api-signature.ts`) | **Не дедуплицировано** |
| Hex encoding (manual vs Buffer.toString) | **Не унифицировано** |

> Buffer polyfill уже дедуплицирован в `blockchain/utils/buffer-polyfill.ts`.

---

## 5. TypeScript Quality

### 5.1 Оставшиеся проблемы типизации

| Проблема | Пример | Статус |
|----------|--------|--------|
| `unknown` return types | `getByPRC()`, `getByPRCWithAuth()`, `fetchHttp()` | Typed wrappers созданы, старые функции не обновлены |
| Old-style PropType | `post-card.ts` и другие b-components | **Не мигрировано** |
| Untyped emits | `post-card.ts:143` `emits: ['like', 'comment', 'share']` | **Не типизировано** |
| Cross-store calls | Вызовы между сторами без интерфейсов | **Не валидируются** |

### 5.2 Отсутствующие типы
- Discriminated unions для RPC ответов
- Vue Event handlers не типизированы

---

## 6. Styling

### 6.1 Styled.ts файлы с hex-хардкодом
36 из 69 styled.ts файлов обновлены на дизайн-токены.
33 файла используют hex-цвета (`#00A3F7`, `#f0f0f0` и т.д.), не совпадающие с текущей палитрой COLORS.

**TODO:** Расширить палитру `theme-colors.ts` hex-значениями из мессенджера и других компонентов, затем обновить оставшиеся 33 файла.

### 6.2 Stylelint для CSS-in-JS
**TODO:** Добавить stylelint для styled-components.

---

## 7. Security

### 7.1 CSRF Protection
Нет CSRF токенов для API запросов.

**TODO:** Оценить необходимость CSRF (с учётом request signing через HMAC).

### 7.2 Hardcoded URLs
`proxy-with-wallet.ts:32` — HTTPS URL без валидации хоста.

**TODO:** Вынести URL в конфигурацию.

### 7.3 Captcha storage
`captcha-api.ts` хранит captcha данные в `localStorage` с хардкодированными ключами.

**TODO:** Вынести ключи в константы.

---

## 8. Testing

### Текущее состояние
- **36 тест-файлов**, **439 тестов** (~8% покрытие, было ~5%)
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

### 9.1 Установка новых зависимостей
ESLint, Prettier, Husky, lint-staged сконфигурированы, но пакеты нужно установить:

```bash
pnpm add -D husky lint-staged
```

### 9.2 noUncheckedIndexedAccess
Включен в `tsconfig.json` — может вызвать новые TS-ошибки в существующем коде.

**TODO:** Исправить TS-ошибки, вызванные `noUncheckedIndexedAccess: true`.

---

## Справка: что уже сделано

<details>
<summary>Полный список выполненных задач (нажмите чтобы раскрыть)</summary>

### Phase 1: Critical Fixes (5/5)
- ✅ CRITICAL-01: Таймер вынесен из Pinia state в closure variable
- ✅ CRITICAL-02: Недостижимое условие в api-client.ts исправлено
- ✅ CRITICAL-05: console.warn вместо silent catch
- ✅ CRITICAL-06: Убран агрессивный сброс данных при ошибке
- ✅ CRITICAL-07: AES шифрование: PBKDF2 + random IV + обратная совместимость

### Phase 2: Architecture (7/7)
- ✅ auth-store разделён на auth + profile-store + keys-store (фасад для совместимости)
- ✅ src/services/ — logger.ts, retry.ts
- ✅ Lazy-loading: все 6 страниц через `() => import()`
- ✅ Typed RPC: `rpcCall<T>()`, `rpcCallWithAuth<T>()`, `rpcCallArray<T>()`
- ✅ Buffer polyfill дедуплицирован (7 файлов → 1 утилита)
- ✅ RpcRequestParams алиас исправлен
- ✅ Удалён deprecated feed-store — **нет, пока не удалён, только помечен**

### Phase 3: Styling & Tooling
- ✅ ESLint flat config (`eslint.config.js`)
- ✅ Prettier (`.prettierrc`)
- ✅ CSS variables в `style.css`
- ✅ 36 из 69 styled.ts файлов переведены на дизайн-токены
- ✅ Husky + lint-staged
- ✅ noUncheckedIndexedAccess: true
- ✅ Barrel exports для components/, b-components/, composables/

### Phase 4: Components
- ✅ useTimeFormatter() composable + дедупликация в 4 файлах
- ✅ useStarRating() composable (535 → 49 строк)
- ✅ authorOverride prop типизирован

### Phase 5: State Management
- ✅ rating-calculator.ts вынесен из pending-ratings-store
- ✅ isLoadingMore переведён с let на ref()
- ✅ Cross-store мутация pending-ratings → posts через calculateRatingUpdate()

### Phase 6: API Quality
- ✅ Logger utility (src/services/logger.ts)
- ✅ Retry utility (src/services/retry.ts) с exponential backoff
- ✅ Error codes enum (helpers/api/error-codes.ts)
- ✅ free-balance-api.ts: string matching → error codes

### Phase 7: TypeScript
- ✅ authorOverride: any → конкретный тип

### Phase 9: Security
- ✅ Device fingerprint: SHA-256 через CryptoJS
- ✅ Санитизация auth-state данных в логах request.ts

### Phase 10: Testing
- ✅ 62 новых теста (encryption, retry, logger, error-codes, rating-calculator, date-formatter)
- ✅ Покрытие: 377 → 439 тестов

</details>
