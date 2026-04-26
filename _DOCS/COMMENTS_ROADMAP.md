# ROADMAP: Комментарии к постам в ленте

## 0. Контекст

Документ описывает дорожную карту по доведению функционала комментариев в `bastyon-nextgen`
до паритета с оригинальным приложением (`___original-repos/pocketnet.gui`).

**Файлы реализации (Vue 3 + TypeScript + Pinia):**

`src/b-components/content/post-card/components/post-card-comments/`
- [post-card-comments.vue](../src/b-components/content/post-card/components/post-card-comments/post-card-comments.vue) — шаблон
- [post-card-comments.ts](../src/b-components/content/post-card/components/post-card-comments/post-card-comments.ts) — Options API логика
- [comment-sender.ts](../src/b-components/content/post-card/components/post-card-comments/comment-sender.ts) — TX `comment` / `commentEdit` (отправка нового или редактирование)
- [comment-deleter.ts](../src/b-components/content/post-card/components/post-card-comments/comment-deleter.ts) — TX `commentDelete`
- [comment-scoring.ts](../src/b-components/content/post-card/components/post-card-comments/comment-scoring.ts) — TX `cScore`
- [comment-reply-panel.vue](../src/b-components/content/post-card/components/post-card-comments/comment-reply-panel.vue) — форма ответа
- [comment-edit-form.vue](../src/b-components/content/post-card/components/post-card-comments/comment-edit-form.vue) — inline-форма редактирования
- [comment-menu.vue](../src/b-components/content/post-card/components/post-card-comments/comment-menu.vue) — контекстное меню (⋯)
- [comment-avatar.vue](../src/b-components/content/post-card/components/post-card-comments/comment-avatar.vue) — аватар комментатора
- [helpers.ts](../src/b-components/content/post-card/components/post-card-comments/helpers.ts) / [consts.ts](../src/b-components/content/post-card/components/post-card-comments/consts.ts) / [types.ts](../src/b-components/content/post-card/components/post-card-comments/types.ts) / [styled.ts](../src/b-components/content/post-card/components/post-card-comments/styled.ts)
- [visibility.ts](../src/b-components/content/post-card/components/post-card-comments/visibility.ts) — права/скрытие/лимиты

`src/stores/`
- [comments-store.ts](../src/stores/comments-store.ts) — Pinia: optimistic-слой (pending/edited/deleted/revealed) + WS reconcile

`src/helpers/common/`
- [haptics.ts](../src/helpers/common/haptics.ts) — тактильная отдача (mobile vibration)

**Файлы оригинала (jQuery + Backbone + Underscore templates):**
- `___original-repos/pocketnet.gui/components/comments/index.js` (3411 строк)
- `___original-repos/pocketnet.gui/components/comments/templates/`
  - `list.html` (357) — список и сам элемент комментария
  - `post.html` (163) — форма создания/редактирования
  - `metmenu.html` (104) — контекстное меню комментария
  - `donate.html` / `caption.html` / `index.html`

---

## 1. Текущий статус (по фазам)

| Phase | Тема | Статус |
|-------|------|--------|
| 1 | CRUD + лимит символов + статусы TX | ✅ ядро (i18n каркас отложен) |
| 2 | Pinia-store + WebSocket + Refresh + optimistic UI | ✅ ядро (complain/block/share/deep-link отложены) |
| 3 | Алгоритм interesting + рендер картинок в комментариях | ✅ (image-upload + donate-modal отложены) |
| 4 | Скрытие по репутации + лимиты + scam-confirm | ✅ работающее ядро + расширяемая база с заглушками |
| 5 | Полиш: compressed numbers + live time + vibration | ✅ (эмодзи-picker, бейджи, TV-фокус отложены) |

Легенда статусов в таблицах ниже:
- ✅ — реализовано и работает
- ⏸️ — отложено (зависит от инфраструктуры за пределами комментариев)
- 🔵 — реализовано в виде заглушки/контракта (готово принять данные)

---

## 2. Карта пробелов (детальное сравнение)

Каждая фича помечена приоритетом: **P0** (критично/MVP), **P1** (важно), **P2** (желательно).
Сложностью: **XS** (час), **S** (1–2 дня), **M** (3–7 дней), **L** (>1 нед).

### 2.1. Управление комментарием (CRUD)

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 1 | **Редактирование своего комментария** (`commentEdit` TX) | `index.js:2317-2347`, `metmenu.html:6` | P0 | M | ✅ |
| 2 | **Удаление своего комментария** (soft, `commentDelete` TX) | `index.js:1105-1124`, `metmenu.html:13` | P0 | S | ✅ |
| 3 | **Удаление чужого комментария автором поста** | `metmenu.html:67-69` | P1 | S | ✅ (через `canDeleteComment`) |
| 4 | **Лимит 915 символов + индикатор** | `index.js:2270-2294` | P0 | S | ✅ |
| 5 | **Автосохранение черновика в localStorage** | `index.js:2971-2991` | P2 | S | ⏸️ |

### 2.2. Медиа в комментариях

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 6 | **Прикрепление картинок** (диалог + paste, ресайз 1920×1080) | `index.js:574-669`, `post.html:100-104` | P1 | M | ⏸️ (нужен общий image-upload) |
| 7 | **Удаление/перестановка картинок до отправки** | `index.js:496-572` | P1 | S | ⏸️ (зависит от 6) |
| 8 | **Сетка картинок в комментарии** (one/two/three/four/more) | `list.html:194-220` | P1 | S | ✅ (через `PostCardImages`) |
| 9 | **Открытие fullscreen-галереи по клику** | `index.js:1278-1311` | P1 | S | ✅ (через `modalStore.openImageGallery`) |
| 10 | **Emoji-picker (вставка эмодзи в текст)** | `index.js:1860-1900+` | P2 | M | ⏸️ (нужен выбор библиотеки) |

### 2.3. Донаты к комментариям

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 11 | **Прикрепить донат (PKOIN, мин 0.1)** | `index.js:206-297`, `post.html:108-114` | P1 | M | ⏸️ (нужен общий donate-modal) |
| 12 | **Бейдж суммы у комментария** | `list.html:51-53, 108-112` | P1 | S | ⏸️ (зависит от 11) |
| 13 | **Удаление доната до отправки** | `index.js:206-214` | P1 | S | ⏸️ (зависит от 11) |
| 14 | **Звук при успешном донате** | `index.js:280-282` | P2 | XS | ⏸️ (зависит от 11) |

### 2.4. Контекстное меню (⋯)

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 15 | **Кнопка ⋯ + tooltip-меню** | `list.html:115-122`, `metmenu.html` | P0 | S | ✅ |
| 16 | **Share comment** (URL `?commentid=&parentid=` + соцсети) | `index.js:468-494` | P1 | M | ⏸️ (нет social-share UI в проекте) |
| 17 | **Complain / Report** комментария/автора | `index.js:381-399` | P1 | S | ⏸️ (нет RPC `usercomplain`) |
| 18 | **Block / Unblock** автора | `index.js:1750-1798` | P1 | S | ⏸️ (нет user-relations store) |
| 19 | **«Waiting» пункт для temp/relay** | `metmenu.html:40-44, 51-62` | P1 | XS | ✅ (Edit/Delete скрыты для pending/rejected) |

### 2.5. Состояния и визуальные индикаторы

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 20 | **`.temptransaction`** (mempool) | `list.html:33, 90-95` | P0 | S | ✅ (`SC_TxStatusBadge`, `is-pending` класс) |
| 21 | **`.rejected`** (TX отклонена) | `list.html:33, 91-92` | P0 | S | ✅ |
| 22 | **`.deleted`** (мягкое удаление, текст-заглушка) | `list.html:148-154` | P0 | S | ✅ |
| 23 | **`.edited` иконка пера** (`timeUpd > time`) | `list.html:102-106` | P1 | XS | ✅ |
| 24 | **`.mycomment`** подсветка собственных | `list.html:33` | P2 | XS | ⏸️ (стилевая мелочь) |
| 25 | **Бейджи пользователя** (verified/реальный) | `list.html:65-68` | P2 | M | ⏸️ (нужен сигнал из API) |
| 26 | **Compressed numbers** для score (1.2K) | `list.html:236, 246` | P1 | XS | ✅ |
| 27 | **Relative time live-update** | `list.html:98` | P2 | S | ✅ |

### 2.6. Скрытие / фильтрация / ограничения

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 28 | **`hiddenComment` по репутации** + «Show anyway» | `list.html:5-15, 130-146` | P1 | M | ✅ (порог `<−50` + `revealHidden`) |
| 29 | **`hiddenBlockedUserComment`** (мой блок-лист) | `list.html:15, 33` | P1 | S | 🔵 контракт `isBlockedByMe(blockedSet)` готов |
| 30 | **`lockedaccount`** (закрытый аккаунт автора) | `list.html:5, 156-162` | P1 | S | 🔵 функция-заглушка `isAuthorAccountLocked` |
| 31 | **`myaccauntdeleted`** запрет действий | `index.js:227-231` | P1 | XS | ⏸️ (нет поля `account_deleted` в getuserstate) |
| 32 | **`reputationBlockedMe`** запрет публикации | `index.js:702-708` | P1 | XS | ✅ (упрощённая формула: `reputation < −50`) |
| 33 | **`scamcriteria` диалог** при дизлайке | `index.js:711-725` | P1 | S | ✅ (эвристика; точная формула — TBD) |
| 34 | **`checkBanned`** (автор поста забанил тебя) | `index.js:354-378` | P2 | S | ⏸️ (нет user-relations) |

### 2.7. Realtime / WebSocket / Sync

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 35 | **Listener на `comment` TX** | `index.js:2787-2800` | P0 | M | ✅ (через `wsService.on('transaction')`) |
| 36 | **Listener на `cScore` TX** | `index.js:2801-2812` | P0 | M | ✅ |
| 37 | **Optimistic UI** для send/edit/delete | `index.js:1487` | P0 | M | ✅ (через `comments-store`) |
| 38 | **Refresh-кнопка** | `list.html:324-328` | P1 | XS | ✅ |
| 39 | **Live counts** (children, scoreUp/Down) | `index.js:40-85, 186-204` | P0 | S | ✅ (через дебаунс-refresh при WS) |

### 2.8. Навигация и deep-linking

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 40 | **`?commentid=...` deep-link** | `index.js:2912-2922` | P1 | S | ⏸️ (нет роута `/post/:txid`) |
| 41 | **scrollToComment + подсветка** | `index.js:1363-1380, 880-893` | P1 | S | ⏸️ (зависит от 40) |
| 42 | **«Свернуть/закрыть комментарии»** | `list.html:332-338` | P2 | XS | ✅ |

### 2.9. Сортировка и алгоритм «interesting»

| # | Фактор «interesting» | Где в оригинале | Приоритет | Статус |
|---|----------------------|-----------------|-----------|--------|
| 43 | `comment.amount * 1000` — буст за донат | `index.js:1414` | P1 | ✅ |
| 44 | Буст ×50 если автор комментария = автору поста | `index.js:1434-1436` | P1 | ✅ |
| 45 | Буст ×20 для своих, ×1000 для verified | `index.js:1420-1422` | P1 | ✅ для своих; verified — 🔵 контракт |
| 46 | `relation('blocking') → score × 0` | `index.js:1429-1432` | P1 | ✅ через `isBlocked` (заглушка `lowRepAuthors`) |
| 47 | `activities.point * 10` | `index.js:1440-1444` | P2 | 🔵 контракт `getActivityPoint` |
| 48 | Сохранение `commentsOrder` в user settings | `index.js:36` | P1 | ⏸️ (нет user-settings store) |
| 49 | Размер страницы 25 (vs 15) | `index.js:20` | P2 | ⏸️ (вопрос продукту) |

### 2.10. Прочие UX-мелочи

| # | Фича | Где в оригинале | Приоритет | Сложность | Статус |
|---|------|-----------------|-----------|-----------|--------|
| 50 | **i18n** — все тексты через `e('key')` | повсеместно | P0 | M | ⏸️ (нет настроенного `vue-i18n` в проекте) |
| 51 | **Аватар в форме root reply** | `post.html:18-53` | P2 | XS | ✅ |
| 52 | **Иконка close (×) в форме редактирования** | `post.html:57-67` | P0 | XS | ✅ (кнопка «Отмена» + Esc) |
| 53 | **TV-фокус классы** | повсеместно | P2 | S | ⏸️ (TV-режим не приоритет) |
| 54 | **Mobile vibration на действиях** | `index.js:1736, 1787` | P2 | XS | ✅ |

---

## 3. План реализации (этапы) — фактическое выполнение

### Phase 1 — CRUD и базовая корректность ✅

1. ✅ **Контекстное меню (⋯)** — [comment-menu.vue](../src/b-components/content/post-card/components/post-card-comments/comment-menu.vue) на `APopover`
2. ✅ **Удаление комментария** — [comment-deleter.ts](../src/b-components/content/post-card/components/post-card-comments/comment-deleter.ts) (`commentDelete` TX)
3. ✅ **Редактирование комментария** — [comment-sender.ts](../src/b-components/content/post-card/components/post-card-comments/comment-sender.ts) с опц. `editId` + [comment-edit-form.vue](../src/b-components/content/post-card/components/post-card-comments/comment-edit-form.vue)
4. ✅ **Состояния транзакций** — `SC_TxStatusBadge` (Ожидание/Ошибка), `is-pending` класс на `SC_CommentRow`/`SC_CommentItem`, `SC_EditedMark` (перо)
5. ✅ **Лимит 915 символов + индикатор** — `getCommentLengthHint` в `helpers.ts` + `SC_LengthCounter`
6. ⏸️ **i18n каркас** — отложен. Причина: в проекте отсутствует настроенный `vue-i18n`/локализация. Это отдельная инфраструктурная задача (выбор библиотеки, словари, namespace). Все строки сейчас на русском.

### Phase 2 — Реалтайм и optimistic UI ✅ (ядро)

7. ✅ **Pinia comments-store** — [comments-store.ts](../src/stores/comments-store.ts)
   - State: `editedMessages`, `deletedCommentIds`, `pendingCreates`, `revealedHiddenIds`
   - Actions: `setEditedMessage`, `markDeleted`, `addPending`/`removePending`, `revealHidden`, `reconcileWithServer`, `applyConfirmedTx`
8. ✅ **WebSocket подписка** — `subscribeToWs()` через `wsService.on('transaction', ...)` в `created`/`beforeUnmount`
9. ✅ **Optimistic UI** — pending-комменты подмешиваются в `sortedComments` и `getReplies` как синтетические `GetComment` с `temp: true`
10. ✅ **Refresh-кнопка** — `SC_RefreshBtn` в шапке развёрнутого вида + дебаунсенный auto-refresh от WS
11. ⏸️ **Жалоба (complain)** — нет RPC endpoint `usercomplain` в `rpc-endpoints.ts`, нет UI-модалки выбора причины
12. ⏸️ **Block / Unblock** — нет ни RPC endpoint, ни user-relations store. UI-контракт готов через `canShowMenu` + `isBlockedByMe(blockedSet)` в [visibility.ts](../src/b-components/content/post-card/components/post-card-comments/visibility.ts)
13. ⏸️ **Share comment** — в проекте отсутствует social-share компонент (`posts-store.sharePost` лишь инкрементирует счётчик)
14. ⏸️ **Deep-link `?commentid=`** — нет роута для отдельного поста в `src/router/index.ts`

### Phase 3 — Богатый контент ✅ (рендер; upload+donate отложены)

15. ⏸️ **Картинки в комментарии (upload)** — нужна общая инфраструктура: file-picker, paste-handler, resize-утилита (Canvas/`browser-image-compression`), endpoint-обёртка для `pocketnet.app:8092/i/`. В проекте нет ни одного компонента создания контента с картинкой (даже редактора постов нет).
16. ✅ **Сетка картинок + галерея** — `getCommentImages()` извлекает массив из `comment.msg.images`, рендерится через готовый `PostCardImages` (адаптивная сетка), клик → `modalStore.openImageGallery`
17. ⏸️ **Донаты к комментарию (modal + бейдж)** — нет общего donate-modal в проекте. Хелпер `getCommentDonateAmount()` есть в `helpers.ts` (используется алгоритмом «interesting»), но визуального компонента нет.
18. ✅ **Алгоритм «interesting» — недостающие факторы** — `commentPoint(comment, ctx)` в `helpers.ts` теперь учитывает: `amount × 1000`, `children × 4500` для своих, финальные множители `POST_AUTHOR_BOOST ×50`, `VERIFIED_BOOST ×1000`, `MY_COMMENT_BOOST ×20`, `ACTIVITY_POINT × N`, обнуление веса для blocked

### Phase 4 — Скрытие, безопасность, репутация ✅ (работающее ядро + контракты)

19. ✅ **`hiddenComment` по репутации** — `isHiddenByReputation` (порог `<−50`) + `SC_HiddenBanner` с кнопкой «Показать всё равно»
20. 🔵 **`hiddenBlockedUserComment`** — функция `isBlockedByMe(comment, blockedSet)` готова принять Set из user-relations store
21. 🔵 **`lockedaccount`** — функция-заглушка `isAuthorAccountLocked()` готова к подключению
22. ⏸️ **`myaccauntdeleted`** — нет поля `account_deleted` в типе `UserState`. При появлении — добавится в `getCommentPostingDisableReason`
23. ✅ **`reputationBlockedMe`** — упрощённая формула в `getCommentPostingDisableReason` (`reputation < −50` → плашка `SC_ComposerDisabled`)
24. ✅ **`scamcriteria` диалог** — `Modal.confirm` с danger-кнопкой при дизлайке если `shouldShowScamWarningOnDislike` (эвристика: низкая репутация + >80% использованных лимитов)
25. ⏸️ **`checkBanned`** — требует загрузки отношений автора поста

### Phase 5 — Финальный полиш ✅ (мелочи; эмодзи/бейджи/TV отложены)

26. ⏸️ **Эмодзи-picker** — нужен выбор библиотеки (`emoji-mart-vue` / встроенный)
27. ✅ **Compressed numbers** — `compressedNumber()` в `helpers.ts` + метод `formatScore()`
28. ✅ **Relative time live-update** — `nowTick`-счётчик в `data()`, `setInterval(60_000)` в `created`, `formatRelativeTime` из `date-formatter.ts`
29. ⏸️ **Бейджи пользователя (verified)** — нужен сигнал из API
30. ✅ **Свернуть/закрыть весь блок** — `collapseComments` + `SC_ShowCommentsBtnCollapse`
31. ⏸️ **TV-focus классы** — TV-режим не приоритет
32. ✅ **Mobile vibration** — [haptics.ts](../src/helpers/common/haptics.ts), подключён к 6 точкам (4 score + send + edit + delete с `medium`)
33. ⏸️ **Автосохранение черновика в localStorage** — низкий приоритет

---

## 4. Что отложено и зависимости

Сводный перечень того, что не реализовано, и от чего это зависит:

| # | Фича | Зависит от |
|---|------|------------|
| 5 | Автосохранение черновика | — (низкий приоритет) |
| 6, 7 | Картинки в комментарии (upload) | Общий image-upload pipeline в проекте: file-picker, resize-утилита (Canvas или `browser-image-compression`), endpoint-обёртка для `pocketnet.app:8092/i/`. Сейчас нет ни одного места создания контента с картинкой. |
| 10 | Эмодзи-picker | Выбор библиотеки (продуктовое решение) |
| 11–14 | Донаты к комментарию | Общий donate-modal + transaction builder для PKOIN-доната с привязкой к comment-tx |
| 16 | Share comment (соц. сети) | Общий social-share UI в проекте |
| 17 | Complain / Report | RPC endpoint `usercomplain` + UI-модалка выбора причины |
| 18 | Block / Unblock | RPC endpoints `userblock`/`userunblock` + user-relations store с блок-листом |
| 24 | Подсветка собственных | стилевая мелочь (5 минут) |
| 25 | Бейджи пользователя | Сигнал verified/реальный из API ответа `getuserprofile` |
| 29 | `hiddenBlockedUserComment` | user-relations store с Set заблокированных адресов |
| 30 | `lockedaccount` | Сигнал в API о закрытом/удалённом аккаунте автора |
| 31 | `myaccauntdeleted` | Поле `account_deleted` в `getuserstate` |
| 34 | `checkBanned` | Загрузка отношений автора поста (вернул ли он меня в блок) |
| 40, 41 | Deep-link на комментарий | Роут `/post/:txid` (или `/:user/:txid`) — за пределами комментариев |
| 47 | `activities.point` в interesting | Activity-сигнал из API |
| 48 | Сохранение `commentsOrder` | user-settings store |
| 50 | i18n | Настройка `vue-i18n` + словари (отдельная задача проекта) |
| 53 | TV-фокус классы | Решение о поддержке TV |

**Принцип расширения:** все отложенные пункты с пометкой 🔵 (контракт готов) — это функции/API в [visibility.ts](../src/b-components/content/post-card/components/post-card-comments/visibility.ts) и [helpers.ts](../src/b-components/content/post-card/components/post-card-comments/helpers.ts), которые принимают данные опционально. Когда инфраструктура появится — точечный плаг-ин без изменения шаблонов.

---

## 5. Архитектурные решения (фактические)

### 5.1. Pinia comments-store — реализован

[src/stores/comments-store.ts](../src/stores/comments-store.ts) — **только optimistic-слой**, не реплика всех данных. Хранит то, что компонент локально знает «свежее сервера»:

```ts
state: {
  editedMessages: Record<string, string>       // commentId → новый текст
  deletedCommentIds: Record<string, true>       // commentId → удалён
  pendingCreates: Record<string, PendingComment[]>  // postId → temp-комменты
  revealedHiddenIds: Record<string, true>       // commentId → показать всё равно
}
```

Запрос `getComments` остаётся в компоненте; после ответа вызывается `reconcileWithServer(postId, list)`, который снимает локальные флаги, если сервер уже знает о наших правках/созданиях/удалениях. WS-событие `transaction` вызывает `applyConfirmedTx(postId, txid, optype)` — снимает соответствующий флаг по txid.

**Почему так:** полноценный кеш всех комментариев требовал бы дублирования с RPC-кешем `getByPRC` (`cachehash`). Optimistic-слой даёт главное — переживаемость UI-стейта между unmount'ами и согласование с сервером, не вступая в гонку с системой кеширования запросов.

### 5.2. Разбиение `post-card-comments.ts` — частично

Файл вырос с 680 до ~1100 строк. Полное разбиение на composables (`use-comments-list`, `use-reply-state`, `use-comment-mutations`, `use-comment-realtime`) было запланировано, но **отложено** — компонент написан в Options API, его методы тесно связаны общим `data()`, переход на composables = переписать с нуля. Текущая декомпозиция:

```
post-card-comments/
├── post-card-comments.vue         # шаблон
├── post-card-comments.ts          # logic (Options API)
├── comment-menu.vue               # ⋯ tooltip
├── comment-edit-form.vue          # inline-форма редактирования
├── comment-reply-panel.vue        # форма ответа (с mention)
├── comment-avatar.vue             # аватар-инициал
├── comment-sender.ts              # TX comment / commentEdit
├── comment-deleter.ts             # TX commentDelete
├── comment-scoring.ts             # TX cScore
├── visibility.ts                  # права/скрытие/лимиты
├── helpers.ts                     # форматирование, sortComments, compressedNumber
├── consts.ts                      # лимиты, веса алгоритма
├── types.ts                       # PostForComments, CommentsSortOrder, MentionUser
└── styled.ts                      # styled-components
```

Composable-разбиение можно сделать когда / если приедет следующая большая фича (например, image-upload), которая всё равно потребует пройтись по логике методов.

### 5.3. Унификация с реализацией постов

В nextgen **отсутствует редактор постов** (есть только отображение). Поэтому пункты ROADMAP про переиспользование «кода постов» оказались несостоятельными — переиспользовать нечего. Что нашлось:
- ✅ `PostCardImages` (сетка) и `modalStore.openImageGallery` (lightbox) — переиспользованы
- ✅ `wsService` — общий WS-сервис, переиспользован для подписки на `transaction`
- ✅ `pending-ratings-store` как образец паттерна Pinia + polling — повторено в `comments-store`
- ⏸️ image-upload, donate-modal, social-share, complain — **придётся реализовывать первыми в проекте**, не как побочный эффект работы над комментариями

---

## 6. Открытые вопросы / решения нужны от продукта

1. **Уровни вложенности.** Оригинал: 2 уровня (root → reply). Сохраняем 2 или допускаем threading глубже? *(текущая реализация — 2 уровня)*
2. **Лимит символов 915.** Зашит в оригинале — оставить тот же, или поднять? *(текущая реализация — 915, настраивается в `consts.ts`)*
3. **Эмодзи picker.** `emojioneArea` устарел. Заменяем на `emoji-mart-vue` / встроенный браузерный — нужен выбор библиотеки.
4. **Размер страницы.** Сейчас 15 в nextgen vs 25 в оригинале. Унифицировать?
5. **TV-режим.** Поддерживаем сейчас или откладываем до отдельного модуля?
6. **i18n-словарь.** Используем существующие ключи `e13029..e13040`, `comments_*` или вводим новый namespace `comments.*`?
7. **Точная формула `scamcriteria`.** Сейчас эвристика «низкая репутация + >80% лимитов» — нужна точная legacy-формула.
8. **Порог `hiddenComment` по репутации.** Сейчас `<−50` (как `reputationBlockedMe`); легаси использует более сложный набор проверок в `psdk.user.hiddenComment`.

---

## 7. Источники / Ссылки на код

### Оригинал (для сверки поведения)
- [components/comments/index.js](../../___original-repos/pocketnet.gui/components/comments/index.js)
- [components/comments/templates/list.html](../../___original-repos/pocketnet.gui/components/comments/templates/list.html)
- [components/comments/templates/post.html](../../___original-repos/pocketnet.gui/components/comments/templates/post.html)
- [components/comments/templates/metmenu.html](../../___original-repos/pocketnet.gui/components/comments/templates/metmenu.html)
- [proxy16/lib/kit.js:481-552](../../___original-repos/pocketnet.gui/proxy16/lib/kit.js) — формат serialize/payload для `comment` / `commentEdit` / `commentDelete`

### Nextgen (текущая реализация)
- [post-card-comments/](../src/b-components/content/post-card/components/post-card-comments/) — корень модуля
- [comments-store.ts](../src/stores/comments-store.ts) — optimistic-слой
- [visibility.ts](../src/b-components/content/post-card/components/post-card-comments/visibility.ts) — права/скрытие/лимиты
- [haptics.ts](../src/helpers/common/haptics.ts) — мини-helper для `navigator.vibrate`
- [ws-service.ts](../src/blockchain/ws/ws-service.ts) — WebSocket-сервис проекта
- [date-formatter.ts](../src/helpers/common/date-formatter.ts) — `formatRelativeTime` для live-update
