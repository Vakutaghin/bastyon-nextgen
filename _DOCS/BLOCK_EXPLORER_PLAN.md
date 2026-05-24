# План реализации встроенного блок-эксплорера — что осталось

> Этапы 1–4 закрыты. Реализованы: 13 RPC-методов, 4 страницы (`/explorer`,
> `/block`, `/tx`, `/address`) + `peers-page`, поиск с историей, charts (d3),
> top-addresses, WS-обновление, payload-парсер Pocketnet-транзакций, кнопка
> «В эксплорере» из profile/wallets, settings-tab с мини-эксплорером и
> закреплением ноды, i18n-prep строки в `block-explorer-strings.ts`, Playwright
> e2e для 4 маршрутов. Подробности — в коммитах и в файлах под
> `src/pages/block-explorer-page/`.
>
> Ниже — то, что осталось.

---

## 1. UX-полировка (отсроченное из этапа 2–3)

### 1.1 Permalinks: канонический redirect

В `block-page.vue` сейчас открытие `/explorer/block/<height>` остаётся на этом
URL. План §5.5 требует, чтобы после загрузки блока URL сменился на канонический
`/explorer/block/<hash>` (через `router.replace`), чтобы share-ссылки указывали
на иммутабельный hash, а не на высоту, которая привязана к chain-state.

**Где править:** [src/pages/block-explorer-page/block-page/block-page.vue](../src/pages/block-explorer-page/block-page/block-page.vue)
— в `watch(() => block.value?.hash, ...)` добавить `router.replace`, если
текущий `p.hashOrHeight` — число и блок успешно загрузился.

### 1.2 «Попробовать другую ноду» на ошибке

Сейчас при ошибке ноды показывается просто текст («Нода недоступна», «Не
удалось загрузить…»). План §5.6: вместо/рядом — кнопка, которая инвалидирует
текущий запрос и (опционально) предлагает выбрать другую ноду из
`use-explorer-preferred-node`.

**Где править:** ошибочные placeholder-ы во всех страницах эксплорера. Логика —
через уже существующий `useQueryClient().invalidateQueries({ queryKey: ['explorer'] })`
или прямой `refetch()` от useQuery.

### 1.3 Prefetch при наведении на хеши/адреса

План §0.2 — «prefetching при наведении на хеши». Сейчас этого нет. Реализация:
в `hash-link.vue` / `address-link.vue` на `@mouseenter` дёрнуть
`queryClient.prefetchQuery({ queryKey, queryFn })` с тем же ключом, что
использует целевая страница. Эффект — клик открывает страницу мгновенно из
кэша.

**Где править:** [src/pages/block-explorer-page/components/shared/hash-link.vue](../src/pages/block-explorer-page/components/shared/hash-link.vue)
и [address-link.vue](../src/pages/block-explorer-page/components/shared/address-link.vue).

---

## 2. Компонентные тесты (отсроченное из этапа 4 / §7)

Юнит-тесты для логики покрыты:
[use-explorer-search.test.ts](../src/pages/block-explorer-page/components/explorer-search/use-explorer-search.test.ts),
[format-explorer.test.ts](../src/pages/block-explorer-page/components/shared/format-explorer.test.ts),
[parse-pocketnet-payload.test.ts](../src/pages/block-explorer-page/components/shared/parse-pocketnet-payload.test.ts),
[extract-coinstake.test.ts](../src/pages/block-explorer-page/components/shared/extract-coinstake.test.ts),
[use-search-history.test.ts](../src/pages/block-explorer-page/components/shared/use-search-history.test.ts),
[aggregate-stats.test.ts](../src/pages/block-explorer-page/components/network-stats-chart/aggregate-stats.test.ts),
[aggregate-active-addresses.test.ts](../src/pages/block-explorer-page/components/top-addresses/aggregate-active-addresses.test.ts),
[use-explorer-preferred-node.test.ts](../src/composables/use-explorer-preferred-node.test.ts).

Что осталось из §7 — `@vue/test-utils` mount-тесты на сами компоненты:

- [ ] `explorer-search.vue` — рендер дропдауна истории, submit по Enter, выбор подсказки → router.push.
- [ ] `tx-payload-card.vue` — корректный рендер для каждого `kind` payload (фикстуры в `parse-pocketnet-payload.test.ts` уже есть, можно реюзнуть).
- [ ] `info-tooltip.vue` — рендер по `term-key` из glossary и по сырому `text`-prop.

---

## 3. Этап 5 — i18n

Все ru-строки уже собраны в [block-explorer-strings.ts](../src/pages/block-explorer-page/block-explorer-strings.ts)
(namespace-ы: `common`/`search`/`main`/`block`/`tx`/`address`/`peers`/`topAddresses`/`stats`).
Технический словарь — отдельно в [explorer-glossary.ts](../src/pages/block-explorer-page/components/shared/explorer-glossary.ts).

Когда в проекте появится общий i18n-движок (см. TODO #33 «Мультиязычность»):

- [ ] Перевести `s.foo.bar` → `t('explorer.foo.bar')`, ключи мапятся 1:1 со структурой `block-explorer-strings.ts`.
- [ ] Параметризованные функции (`s.main.subtitle(chain, height, age)`, `s.stats.subtitle(total, n, granularity)` и т.п.) — перевести в i18n-плюрал-нотацию или сохранить как функции, оборачивающие `t(...)`.
- [ ] Glossary — экстракт ключей в общий каталог переводов.

Замены делать одним проходом по всему `block-explorer-page/` — структурно расстановка строк не изменится.

---

## 4. Опциональные улучшения (low priority)

Не входило в Definition of Done, но упоминалось в плане как «good-to-have»:

- **Декомпозиция страниц на под-компоненты** (`block-header-card.vue`,
  `block-nav.vue`, `tx-summary-card.vue`, `tx-io-table.vue` и т.д.). Сейчас
  всё сидит в `block-page.vue`/`tx-page.vue` напрямую — работает, но файлы
  крупноваты (300–400 строк). Цена рефакторинга — высокая; пользы — мало,
  пока эти компоненты не нужны где-то ещё.
- **Топ-30 адресов без центрального хоста**. Уже работает на агрегате
  `aggregate-active-addresses.ts` по последним блокам — серверо-независимо,
  без внешнего REST. Если появится более точный источник на нодах (например,
  отдельный RPC) — можно переключиться.
- **Глобальный search-bar suggest для txid/блока/адреса**. План §3.4 —
  при вставке в общий header-поиск показывать «Открыть в эксплорере».
  Требует доработки header-search-bar.
