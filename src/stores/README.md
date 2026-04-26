# Pinia Stores - Стратегия расположения

## Три уровня сторов

| Уровень | Расположение | Когда использовать |
|---------|-------------|-------------------|
| **Глобальный** | `src/stores/` | Стор нужен нескольким компонентам из разных модулей |
| **Доменный** | `src/<domain>/store/` | Стор принадлежит конкретному домену (например `blockchain/store/`) |
| **Компонентный** | рядом с компонентом | Стор нужен только одному компоненту или его дочерним |

### Глобальные сторы (`src/stores/`)

Общие UI и бизнес-сторы: `ui-store`, `modal-store`, `posts-store`, `filters-store`, `notifications-store`, `search-store`.

### Доменные сторы (`src/blockchain/store/`)

Блокчейн-специфичные сторы: `auth-store`, `keys-store`, `profile-store`.
Живут рядом с доменной логикой, т.к. тесно связаны с `blockchain/core/` и `blockchain/api/`.

### Компонентные сторы

Если стор нужен только одному компоненту, создайте `store.ts` рядом с ним:

```
b-components/content/video-player/
  video-player.vue
  video-player.ts
  store/
    index.ts
```

## Паттерн Pinia сторов

**Стандарт: Options API** (defineStore с state/getters/actions).
Это основной паттерн для всех сторов (feed, posts, ui, modal, notifications, filters, search, auth, keys, profile).

Setup-синтаксис (defineStore с функцией) допускается только для messenger-сторов, где логика тесно связана с composables.

```typescript
// Стандартный Options API стор
export const useExampleStore = defineStore('example', {
  state: () => ({
    items: [] as Item[],
  }),
  getters: {
    itemCount: (state) => state.items.length,
  },
  actions: {
    addItem(item: Item) { this.items.push(item) },
  },
})
```

## Пример использования

```typescript
import { useUiStore } from '@/stores/ui-store'
import { useAuthStore } from '@/blockchain/store'

const ui = useUiStore()
const auth = useAuthStore()
```

## Миграция на composables

Для запросов данных предпочтительно использовать composables + Vue Query вместо Pinia:

```typescript
// Предпочтительно для data-fetching:
import { useHierarchicalStrip } from '@/composables/use-hierarchical-strip'

// Pinia - для UI state и shared state:
import { useUiStore } from '@/stores/ui-store'
```
