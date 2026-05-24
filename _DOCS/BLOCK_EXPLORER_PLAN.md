# План реализации встроенного блок-эксплорера

## 0. Контекст и цели

В оригинальном Bastyon блок-эксплорер вынесен как внешнее мини-приложение
`app.pocketnet.blockexplorer` и открывается переходом на `https://www.bastyon.com/blockexplorer/`
(Angular SPA, использует `_executePOST(...)` к публичным нодам). В nextgen-приложении
этот функционал отсутствует — есть только пустая вкладка-плейсхолдер в настройках
(`src/pages/settings-page/settings-page.ts:46-55`).

**Цель:** встроить в `bastyon-nextgen` полноценный блок-эксплорер как нативную страницу
приложения — без внешних редиректов, на той же инфраструктуре нод и подписей, что и
остальная часть приложения. Эксплорер должен быть **понятнее, быстрее и красивее**
эталона, а также соответствовать [[principle_decentralization]] — работать на любой ноде
из `servers.json`, без зависимости от центрального www.bastyon.com.

**Что значит «улучшенный»:**

1. **Понятность.** Карточки вместо плотных таблиц на главной; человеко-понятные подписи
   (например, «Время до следующего блока ~», «Награда блока», «Размер блока» с единицами);
   tooltip’ы с пояснениями для технических терминов (cb-tx, vin/vout, scriptPubKey).
2. **Скорость.** Vue Query c долгим `staleTime` для исторических данных (старые блоки/tx
   неизменны) и коротким для tip/mempool; параллельная загрузка карточек главной;
   prefetching при наведении на хеши.
3. **Реактивность.** WS-подписка (`ws-service.ts`) на новые блоки → автообновление tip и
   списка последних блоков без рефетча.
4. **Контекст Bastyon.** Распознавание Pocketnet-специфичных транзакций (Post, Comment,
   Score, Subscribe, Boost, AccountSetting и т.д.) — отображать не «raw witness», а
   читаемое описание + ссылку на соответствующий контент в приложении.
5. **Связь с UI приложения.** Адрес → ссылка на профиль (если есть аккаунт), и наоборот —
   на странице профиля добавляется кнопка «Посмотреть в эксплорере». Балансы в кошельках
   тоже линкуются в эксплорер.
6. **Self-custody friendly.** Поиск работает офлайн-валидацией формата (bech32 / hex64 /
   integer height) до сетевого запроса, чтобы не утекать в логи ноды опечатки.

---

## 1. Эталонный UX и RPC-поверхность

Анализ Angular-бандла `https://www.bastyon.com/blockexplorer/main-es2015.*.js` показал
**фиксированный набор RPC-методов**, которыми пользуется референсный эксплорер. Все они
идут через стандартный `getByPRC` (POST `/rpc/<method>`, без авторизации):

| Метод | Параметры | Назначение |
| --- | --- | --- |
| `getnodeinfo` | `[]` | tip, chain (main/test), version, netstakeweight, lastblock |
| `getcoininfo` | `[]` | эмиссия, supply, награды, общие константы |
| `getlastblocks` | `[count, fromHeight=-1, verbose=false]` | список последних N блоков |
| `getcompactblock` | `[hashOrHeight, count=-1]` | блок (с N предков) в компактной форме |
| `getblocktransactions` | `[blockHash, offset, count]` | пагинированные tx внутри блока |
| `gettransactions` | `[txidOrArray]` | одна или несколько транзакций целиком |
| `getaddressinfo` | `[address]` | баланс/статистика по адресу |
| `getaddresstransactions` | `[address, fromHeight, count, direction]` | tx адреса (пагинация) |
| `searchbyhash` | `[query]` | определяет тип строки: block / tx / address |
| `getpeerinfo` | `[]` | список пиров |
| `getstatisticbyhours` | `[depth, hours]` | статистика по часам |
| `getstatisticbydays` | `[depth, days]` | статистика по дням |
| `getstatisticcontentbyhours` | `[depth, hours]` | контент-статистика (посты/комменты) |
| `getstatisticcontentbydays` | `[depth, days]` | то же по дням |

Дополнительные REST/JSON, которые тянет референс (мы делаем то же, но через `appFetch`):

- `GET <node>/ping` — health-чек ноды.
- `GET <explorerUrl>/topaddresses/30.json` — топ-30 адресов по балансу.
- `GET <node>/info` — список нод сети (мы используем встроенный `servers.json` +
   обновляемый список через `getnodeinfo.proxies`).

Из перечисленного у нас **уже определены** в `src/helpers/api/rpc-endpoints.ts`:
`getNodeInfo`, `getRawTransaction`, `txUnspent`. Остальные методы нужно добавить.

---

## 2. Архитектура (соответствие `.cursorrules`)

Конвенции проекта, которые мы обязаны соблюсти:

- Имена файлов — **kebab-case**.
- Компоненты — **`<script setup lang="ts">`**, `defineProps`/`defineEmits` как generic-сигнатуры.
- Стили — **`vue3-styled-components`** в соседнем `*.styled.ts`.
- Данные — через **`useRpcQuery`/`useRpcQueryWithAuth`** (`src/composables/use-rpc-query.ts`),
  не через прямые `getByPRC` в компонентах.
- Сложная логика — соседний composable `use-*.ts`.
- Только именованные экспорты, одиночные кавычки, скобки вокруг одного параметра стрелки.
- Pinia store — только если состояние нужно более чем одному компоненту; иначе локальный
  `store.js` рядом.

### Дерево файлов

```
src/pages/block-explorer-page/
├── block-explorer-page.vue           # /explorer — главная (карточки + последние блоки + tx)
├── block-explorer-page.ts            # setup, прокидка composables
├── block-explorer-page.styled.ts
├── components/
│   ├── explorer-search/
│   │   ├── explorer-search.vue       # умный input (block/tx/address)
│   │   ├── explorer-search.ts
│   │   ├── explorer-search.styled.ts
│   │   └── use-explorer-search.ts    # детект типа + роутинг
│   ├── network-stats-card/
│   │   ├── network-stats-card.vue    # height, supply, difficulty, netstakeweight
│   │   ├── network-stats-card.ts
│   │   └── network-stats-card.styled.ts
│   ├── latest-blocks-list/
│   │   ├── latest-blocks-list.vue
│   │   ├── latest-blocks-list.ts
│   │   ├── latest-blocks-list.styled.ts
│   │   └── use-latest-blocks.ts      # poll + WS update
│   ├── latest-transactions-list/
│   │   ├── latest-transactions-list.vue
│   │   ├── latest-transactions-list.ts
│   │   └── latest-transactions-list.styled.ts
│   ├── stats-charts/
│   │   ├── stats-charts.vue          # d3 spark/line: tx/day, mempool
│   │   ├── stats-charts.ts
│   │   ├── stats-charts.styled.ts
│   │   └── use-network-stats.ts      # бьёт getstatistic{by,content-by}{hours,days}
│   ├── top-addresses/
│   │   ├── top-addresses.vue         # топ-30 (через node-агрегат или /topaddresses/30.json)
│   │   ├── top-addresses.ts
│   │   └── top-addresses.styled.ts
│   └── shared/                        # переиспользуемые ячейки
│       ├── tx-row.vue
│       ├── block-row.vue
│       ├── hash-link.vue              # копировать + укорочение middle-ellipsis
│       ├── address-link.vue           # ссылка → /explorer/address/:addr или /:userName
│       ├── amount-pkoin.vue
│       └── *.styled.ts / *.ts
│
├── block-page/
│   ├── block-page.vue                # /explorer/block/:hashOrHeight
│   ├── block-page.ts
│   ├── block-page.styled.ts
│   ├── use-block-details.ts          # getcompactblock + getblocktransactions
│   └── components/
│       ├── block-header-card.vue
│       ├── block-tx-table.vue
│       └── block-nav.vue              # prev/next/«#к высоте»
│
├── tx-page/
│   ├── tx-page.vue                   # /explorer/tx/:txid
│   ├── tx-page.ts
│   ├── tx-page.styled.ts
│   ├── use-tx-details.ts             # gettransactions + расшифровка Pocketnet-payload
│   └── components/
│       ├── tx-summary-card.vue       # type, fee, size, block, confirmations
│       ├── tx-io-table.vue           # vin / vout
│       ├── tx-payload-card.vue       # человеко-понятный разбор pocketnet TX-типов
│       └── tx-raw-toggle.vue         # «Показать сырой JSON»
│
├── address-page/
│   ├── address-page.vue              # /explorer/address/:address
│   ├── address-page.ts
│   ├── address-page.styled.ts
│   ├── use-address-details.ts        # getaddressinfo + getaddresstransactions
│   └── components/
│       ├── address-summary-card.vue  # баланс, кол-во tx, in/out
│       ├── address-tx-table.vue
│       └── address-qr.vue
│
└── peers-page/                       # опционально, см. этап 3
    ├── peers-page.vue
    ├── peers-page.ts
    └── peers-page.styled.ts
```

### Composables (общие)

`src/composables/`

| Файл | Назначение |
| --- | --- |
| `use-block-explorer-queries.ts` | тонкие обёртки над `useRpcQuery` для каждого explorer-RPC (queryKey + staleTime) |
| `use-block-explorer-search.ts`  | классификатор строки → `{ kind: 'block-hash'\|'block-height'\|'txid'\|'address'\|'unknown' }` + опциональный сетевой fallback на `searchbyhash` |

Composables держат **только реактивные query-обёртки**, без UI. Это позволит переиспользовать
их вне страниц (например, в `wallets-page` для линка «в эксплорер»).

### Типы

`src/types/rpc-requests/` и `src/types/rpc-responses/` — добавить:

- `get-coin-info.ts`
- `get-last-blocks.ts`
- `get-compact-block.ts`
- `get-block-transactions.ts`
- `get-transactions.ts`
- `get-address-info.ts`
- `get-address-transactions.ts`
- `search-by-hash.ts`
- `get-peer-info.ts`
- `get-statistic.ts` (общий — оба периодических метода)

`src/helpers/api/rpc-endpoints.ts` — расширить `rpcEndpoints` всеми этими методами и,
если потребуется, пометить, какие из них идут через `rpc-ex` (по факту все
explorer-методы — обычный `/rpc/...`).

### Stores

Намеренно **без** глобального `block-explorer-store`. Состояния, которые нужны странице,
кэшируются Vue Query (это и есть наш «стор данных»). Локальное UI-состояние (открытая
вкладка, режим «raw JSON») — в `ref()` внутри компонента.

Исключение: `use-explorer-prefs-store.ts` (Pinia) — только если появятся пользовательские
настройки эксплорера (тема, какие колонки показывать) — на этапе 4.

---

## 3. Роутинг и интеграция в приложение

`src/router/index.ts` — добавить ленивые маршруты:

```ts
const BlockExplorerPage = () => import('@/pages/block-explorer-page/block-explorer-page.vue')
const ExplorerBlockPage = () => import('@/pages/block-explorer-page/block-page/block-page.vue')
const ExplorerTxPage    = () => import('@/pages/block-explorer-page/tx-page/tx-page.vue')
const ExplorerAddrPage  = () => import('@/pages/block-explorer-page/address-page/address-page.vue')

// routes (вставить ДО catch-all '/:userName' — иначе он перехватит)
{ path: '/explorer',                         name: 'explorer',          component: BlockExplorerPage },
{ path: '/explorer/block/:hashOrHeight',     name: 'explorer-block',    component: ExplorerBlockPage,  props: true },
{ path: '/explorer/tx/:txid',                name: 'explorer-tx',       component: ExplorerTxPage,     props: true },
{ path: '/explorer/address/:address',        name: 'explorer-address',  component: ExplorerAddrPage,   props: true },
```

⚠️ **Важно:** маршрут `/:userName` в текущем `router/index.ts` стоит последним и съест
`/explorer/...`, если поставить новые маршруты после него. Все `/explorer/*` должны идти
**до** `/:userName`.

Эксплорер **не требует авторизации** — не добавляем его в `AUTH_REQUIRED_NAMES`.

### Точки входа в UI

1. **Sidebar / меню.** В левой панели (`src/b-components/sidebar/sidebar-left/`) — пункт
   «Эксплорер» (иконка `BlockOutlined` или своя SVG), `to: { name: 'explorer' }`.
2. **Settings → Block Explorer.** Сейчас это пустой плейсхолдер
   (`settings-page.ts:46-55`). Превращаем его либо в (а) встроенный мини-эксплорер
   (быстрый поиск + tip), либо в простую страницу со ссылкой «Открыть полный эксплорер»
   + настройки (см. этап 4).
3. **Profile → «В эксплорере».** Кнопка/иконка возле адреса в `profile-page` →
   `name: 'explorer-address'`. Аналогично в `wallets-page` рядом с каждым адресом —
   ссылка на адрес в эксплорере.
4. **Search-bar (глобальный поиск).** Если ввели строку, которая по формату — txid/блок/
   адрес, добавить опцию-suggest «Открыть в эксплорере». Реализация — на этапе 4.

---

## 4. RPC-слой и работа с нодами

### Расширение `rpc-endpoints.ts`

```ts
export const rpcEndpoints = {
  // ...существующие...
  getCoinInfo: 'getcoininfo',
  getLastBlocks: 'getlastblocks',
  getCompactBlock: 'getcompactblock',
  getBlockTransactions: 'getblocktransactions',
  getTransactions: 'gettransactions',
  getAddressInfo: 'getaddressinfo',
  getAddressTransactions: 'getaddresstransactions',
  searchByHash: 'searchbyhash',
  getPeerInfo: 'getpeerinfo',
  getStatisticByHours: 'getstatisticbyhours',
  getStatisticByDays: 'getstatisticbydays',
  getStatisticContentByHours: 'getstatisticcontentbyhours',
  getStatisticContentByDays: 'getstatisticcontentbydays',
} as const
```

### Стратегии кеширования (Vue Query)

| Запрос | `staleTime` | `refetchInterval` | Примечание |
| --- | --- | --- | --- |
| `getnodeinfo` (tip) | 5 с | 15 с | заменяется WS-инвалидацией при появлении блока |
| `getcoininfo` | 5 мин | — | константы коина меняются крайне редко |
| `getlastblocks` (главная) | 10 с | 15 с | + WS push добавляет верхний элемент |
| `getcompactblock(hash)` | 24 ч | — | старые блоки иммутабельны |
| `getcompactblock(tip)` | 5 с | 15 с | пока блок свежий, инвалидируем |
| `getblocktransactions` | 24 ч | — | (исторические) |
| `gettransactions(txid)` | 60 с при `confirmations<6`, иначе 24 ч | — | свежие могут реоргнуться |
| `getaddressinfo` | 30 с | — | live-данные |
| `getaddresstransactions` | 30 с | — | пагинированный список |
| `searchbyhash` | без кэша | — | разовый запрос |
| `getpeerinfo` | 30 с | 60 с | для страницы peers |
| `getstatistic*` | 5 мин | — | для чартов |

`queryKey` — кебаб-стиль строкой + параметры: `['explorer', 'block', hashOrHeight]`,
`['explorer', 'tx', txid]`, `['explorer', 'address', addr]`, `['explorer', 'last-blocks', 20]`.

### WebSocket автообновление

В `src/blockchain/ws/ws-service.ts` уже есть инфраструктура. Подписаться (или, если ещё
не реализовано, добавить) на событие нового блока (`block` / `newblock` — уточнить по
текущему WS-протоколу). По событию — `queryClient.invalidateQueries({ queryKey: ['explorer', 'tip'] })`
+ `['explorer', 'last-blocks']`.

### Выбор нод и децентрализация

- Все запросы идут через стандартный `getByPRC` → `request.ts`, который сам ходит по
  списку нод из `servers.json` с бэкоффом (`server-backoff.ts`).
- На странице peers (этап 3) — показать **тот же** список + статус каждой ноды (success
  rate из `server-backoff`), плюс позволить пользователю «закрепить» предпочитаемую ноду
  для эксплорера (через `localStorage`, без отдельного стора).
- `topaddresses/30.json` (REST-эндпоинт из эталона) — **не** делаем хардкод на
  `www.bastyon.com`. Если такой эндпоинт есть на наших нодах — используем; если нет —
  строим топ из последних N блоков «по факту» (медленнее, но без зависимости от
  центрального хоста) или просто прячем секцию до появления данных.

---

## 5. UX-улучшения относительно эталона

Конкретные пункты, которые должны быть «better than reference»:

1. **Карточная главная.** Сетка 12-колоночная: слева — две колонки «Последние блоки» и
   «Последние транзакции» (виртуализированные списки), справа — стек карточек: «Сеть»
   (tip, версия, chain, netstakeweight), «Эмиссия» (supply, награда), «Mempool/Активность»
   (sparkline tx/час), «Топ адресов» (если доступно).
2. **Tooltip-словарь.** При наведении на термины (`vin`, `vout`, `witness`, `netstakeweight`,
   `coinbase`, «зрелость», «подтверждения») — поясняющий tooltip. Тексты — в одном словаре
   `block-explorer-glossary.ts` (готов к [[i18n]]).
3. **Pocketnet-aware tx-страница.** Помимо стандартных vin/vout, парсим payload
   Pocketnet-транзакций (Post/Comment/Score/Subscribe/Boost/...) и показываем:
   - тип TX крупно с цветной плашкой;
   - человеко-читаемые поля (заголовок поста, автор, оценка и т.д.);
   - кнопку «Открыть в ленте» (deep-link в приложение).
4. **Поиск.** Локальный детектор формата + автодополнение (по последним просмотренным
   tx/блокам/адресам — `localStorage` history). При вставке — мгновенный redirect без
   нажатия Enter.
5. **Permalinks.** URL-схема `/explorer/<kind>/<id>` shareable. Канонический redirect
   `/explorer/block/<height>` → `/explorer/block/<hash>` после получения хеша.
6. **Состояния загрузки/ошибки.** Скелетоны (не спиннеры) для всех карточек.
   Ошибка ноды → «Попробовать другую ноду» (вместо «refresh»).
7. **Копирование.** Все хеши/адреса — клик копирует, с тостом
   (через `b-components/app-toast`).
8. **Дизайн.** Соответствует существующей теме (см. `src/style.css`, `src/styles/`),
   одинаковые карточки/радиусы/типографика. Светлая/тёмная — наследуется от приложения.
9. **Mobile-friendly.** Таблицы → карточный режим на узких экранах (`@media`).

---

## 6. Локализация

В проекте нет глобального i18n-движка (см. TODO #33 — «Мультиязычность»). Но мы готовим
эксплорер так, чтобы добавить его был одним рефактором:

- Все строки UI вынести в `block-explorer-strings.ts` (по умолчанию ru — как в остальных
  страницах nextgen). Никаких inline-строк в шаблонах.
- Технический словарь (см. п. 5.2) — отдельный объект, тоже легко i18n-extract.

---

## 7. Тестирование

Соответствует подходу проекта (vitest рядом с файлом):

- `use-explorer-search.test.ts` — детектор формата (bech32 vs hex64 vs integer vs unknown).
- `use-block-explorer-queries.test.ts` — корректность queryKey и параметров (с mock
  Vue Query + `@pinia/testing`).
- `use-tx-details.test.ts` — парсер Pocketnet payload (фикстуры в `src/types/dummy-data.d.ts`).
- Компонентные тесты (`@vue/test-utils`) для `explorer-search`, `block-header-card`,
  `tx-payload-card`.
- E2E (`playwright`) — 4 базовых маршрута: главная → блок → tx → адрес; поиск по
  всем трём форматам.
- Никаких моков сети по умолчанию: composables принимают `RpcRequestConfig`, в тестах
  подкладываем фейковую ноду через MSW или прямой стаб.

---

## 8. Поэтапная дорожная карта

### Этап 1 — MVP «всё работает» (1–2 дня)

Цель — пройти 4 базовых пути end-to-end на реальной сети.

- [ ] Расширить `rpcEndpoints` и типы (`src/types/rpc-{requests,responses}/*`).
- [ ] `use-block-explorer-queries.ts` с обёртками над 10 RPC-методами.
- [ ] Роуты `/explorer`, `/explorer/block/:x`, `/explorer/tx/:x`, `/explorer/address/:x`.
- [ ] Минимальная главная: tip, последние блоки (без чартов и top-addresses).
- [ ] Страница блока: header-карточка + tx-таблица (без расшифровки payload).
- [ ] Страница tx: vin/vout таблица + raw JSON.
- [ ] Страница адреса: баланс + tx-таблица.
- [ ] `explorer-search` с локальной детекцией + fallback `searchbyhash`.
- [ ] Пункт в левой панели sidebar.

### Этап 2 — UX-улучшения (1–2 дня)

- [ ] Скелетоны вместо спиннеров.
- [ ] Карточки сети/эмиссии на главной (`getcoininfo`).
- [ ] Tooltip-словарь.
- [ ] `hash-link` / `address-link` / `amount-pkoin` shared-компоненты.
- [ ] Копирование хешей + тосты.
- [ ] Mobile-режим таблиц.
- [ ] Замена настройки «Block Explorer» в `settings-page` на мини-эксплорер + ссылку.

### Этап 3 — реактивность и аналитика (2–3 дня)

- [ ] WS-подписка на новые блоки → инвалидация tip и `last-blocks`.
- [ ] `stats-charts` (d3) с переключателем час/день.
- [ ] Pocketnet-aware payload-парсер для `tx-payload-card` (post/comment/score/subscribe/boost).
- [ ] Deep-link «Открыть в ленте/профиле» из страницы tx.
- [ ] Кнопки «В эксплорере» на `profile-page` и `wallets-page`.
- [ ] Страница `peers-page` (опционально).

### Этап 4 — полировка (1 день)

- [ ] История просмотра (последние 20 tx/блоков/адресов) в `localStorage` + автокомплит в поиске.
- [ ] «Закрепить ноду» для эксплорера.
- [ ] Топ-30 адресов (если есть источник без центрального хоста).
- [ ] Все строки выведены в `block-explorer-strings.ts` (готовность к i18n).
- [ ] Vitest + Playwright согласно §7.

### Этап 5 — i18n-проброс (отложен до общего ввода i18n по проекту)

- [ ] Заменить ru-строки на `t(...)` после появления единого i18n-движка (TODO #33).

---

## 9. Открытые вопросы (для обсуждения до старта)

1. **Точка входа в меню.** Sidebar-left уже плотный — нужен ли отдельный пункт, или
   эксплорер живёт под Settings/«Сеть»? **Рекомендация:** отдельный пункт + ссылки из
   профиля/кошельков.
2. **Топ-адресов.** Если на наших нодах нет агрегата `topaddresses/30.json` — мы строим
   его сами или просто не показываем секцию? **Рекомендация:** на этапе 1–3 не
   показываем; в этапе 4 добавляем серверо-независимую реализацию или прячем.
3. **WS-события.** Текущий `ws-service.ts` уже отдаёт `newblock`? Если нет — нужен ли
   отдельный subтикет на расширение WS. **Действие:** проверить при старте этапа 3.
4. **Pocketnet-payload-парсер.** Логика расшифровки TX уже частично есть в
   `src/blockchain/core/transactions/` — переиспользуем или пишем отдельный read-only
   парсер для эксплорера? **Рекомендация:** read-only обёртка над существующим.
5. **Settings-tab судьба.** Заменить плейсхолдер «Block Explorer» в settings на
   мини-эксплорер или удалить вкладку, оставив только маршрут `/explorer`?
   **Рекомендация:** оставить вкладку как «настройки эксплорера» (предпочитаемая нода,
   единицы, тема) + крупная кнопка-ссылка «Открыть полный эксплорер».

---

## 10. Зависимости и риски

- **`d3` уже в зависимостях** — для чартов ничего ставить не надо.
- **`searchbyhash` зависим от ноды.** Если метод не поддерживается всеми нодами из
  `servers.json` — нужен локальный fallback (он у нас и так есть в `use-explorer-search`).
- **Размер бандла.** Все страницы — ленивые (`() => import(...)`), payload-парсер
  Pocketnet-tx — отдельный chunk. Контролируем через `vite build` size-report.
- **Совместимость с Tauri и iOS Capacitor.** Никаких `window.open(...)` на внешние URL —
  всё через `router.push`. `appFetch` уже учитывает Tauri/Tor.

---

## 11. Definition of Done (для этапа 1)

- Открыть `/explorer` — видны tip, версия сети, последние N блоков.
- Кликнуть на блок → `/explorer/block/<hash>` — видны метаданные блока и его транзакции.
- Кликнуть на tx → `/explorer/tx/<txid>` — видны vin/vout и raw JSON.
- Кликнуть на адрес из tx → `/explorer/address/<addr>` — видны баланс и tx адреса.
- Ввести в поиск hash/height/txid/address — попадаем на правильную страницу.
- Всё работает в `npm run dev`, `npm run tauri:dev`, в браузере через `npm run build`.
- Никаких прямых вызовов `getByPRC` из компонентов; всё через `use-block-explorer-queries`.
- Lint/format/stylelint без замечаний.
