# TODO: доработка поиска в bastyon-nextgen

Остались только пункты, требующие будущих действий (новый UX или ручной
прогон). Архитектура поиска описана в
[SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md).

Источники в старом коде:
- `___original-repos/pocketnet.gui/components/main/index.js:328,725` —
  TV-режим (search.get с `type='videos'`).
- `___original-repos/pocketnet.gui/components/mobilesearch/index.js` —
  mobile overlay search.

Текущая реализация в новом приложении:
- `src/services/search-service.ts`, `src/services/bastyon-input-link.ts`,
  `src/services/user-resolver.ts`
- `src/composables/use-search-query.ts`
- `src/stores/search-store.ts`
- `src/pages/search-page/search-page.vue`
- `src/b-components/header/header-search/header-search.vue` + dropdown
- `src/components/input-search/input-search.{ts,vue}`

---

### 9. Объединённый RPC `searchAll` для dropdown

**Контекст.** Реализация `useSearchAll` (один RPC `search` с
`type='all'` вместо трёх параллельных) собрана в
[use-search-query.ts](../src/composables/use-search-query.ts) и
[search-service.ts](../src/services/search-service.ts), но при подключении
в dropdown секции Users/Tags/Posts оказались пустыми — нода вернула
не тот формат, который мы предположили (`{ users, posts:{data}, tags:{data} }`).
Dropdown откатили на три раздельных хука.

**Что сделать:**
- Проверить в network/devtools, что реально приходит от ноды на
  `search` с `type='all'` для непустого запроса (ключи объекта,
  есть ли вообще `users`, нужен ли отдельный `searchusers`).
- Скорректировать парсинг в `searchAll` (`search-service.ts`)
  под фактический формат — или сделать `useSearchAll` параллельной
  парой `search('all') + searchUsers()` (2 RPC вместо 3).
- Вернуть `useSearchAll` в [header-search-dropdown.vue](../src/b-components/header/header-search/header-search-dropdown.vue).

---

### 10. Тип `videos` как отдельный режим поиска

**Контекст.** В старом `self.app.television` → `search.get(v, 'videos', ...)`
(main/index.js:328,725). В новом приложении нет TV-режима пока — если
будет, потребуется добавить таб «Видео» в `search-page` и использовать
`type='videos'`.

**Что сделать (когда появится TV-режим):**
- Добавить таб «Видео» в [search-page.vue](../src/pages/search-page/search-page.vue).
- Завести `useSearchVideos` по аналогии с `useSearchPosts` (RPC тот же
  `search` с `type='videos'`, ветка `posts` в ответе).

---

### 13. Отдельный mobile overlay search

**Контекст.** В старом есть полноэкранный `mobilesearch` overlay
(components/mobilesearch). В новом mobile использует тот же
`header-search` — он отзывчивый и в верстке шапки занимает 100% ширины
на узких экранах (см. `SC_HeaderSearchWrapper` media-query в
[styled.ts](../src/b-components/header/header-search/styled.ts)).

**Что сделать:** прогнать сценарии на устройстве:
- поле фокусируется и не заслоняется клавиатурой;
- dropdown с Recent/Apps/Users/Tags/Posts помещается на экран и
  скроллится;
- клик по элементу не закрывает dropdown преждевременно
  (текущая `blurTimer` задержка 150 мс — проверить, что хватает на
  всех платформах).

Если что-то ломается — заводить отдельный тикет под mobile-UX, не
переиспользовать старый overlay (его API завязан на jQuery и
несовместим с Vue/Pinia).

---

## Чек-лист

- [ ] 9. Объединённый `searchAll` для dropdown (откачен — нужен реальный формат ответа)
- [ ] 10. Тип `videos` (отложено до TV-режима)
- [ ] 13. Mobile overlay (по результатам проверки на устройстве)
