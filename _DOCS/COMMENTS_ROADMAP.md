# ROADMAP: Комментарии к постам в ленте

## 0. Контекст

Документ описывает дорожную карту по доведению функционала комментариев в `bastyon-nextgen`
до паритета с оригинальным приложением (`___original-repos/pocketnet.gui`).

**Файлы текущей реализации (Vue3):**
- [src/b-components/content/post-card/components/post-card-comments/](../src/b-components/content/post-card/components/post-card-comments/)
  - `post-card-comments.vue` — шаблон (441 строка)
  - `post-card-comments.ts` — Options API логика (680 строк)
  - `comment-sender.ts` — TX `comment` (отправка нового/ответа)
  - `comment-scoring.ts` — TX `cScore` (лайк/дизлайк)
  - `comment-reply-panel.vue` — форма ответа
  - `comment-avatar.vue` — аватар комментатора
  - `helpers.ts` / `consts.ts` / `types.ts` / `styled.ts`
- [src/b-components/sidebar/sidebar-right/last-comments/](../src/b-components/sidebar/sidebar-right/last-comments/) — последние комментарии в сайдбаре

**Файлы оригинала (jQuery + Backbone + Underscore templates):**
- `___original-repos/pocketnet.gui/components/comments/index.js` (3411 строк)
- `___original-repos/pocketnet.gui/components/comments/templates/`
  - `list.html` (357) — список и сам элемент комментария
  - `post.html` (163) — форма создания/редактирования
  - `metmenu.html` (104) — контекстное меню комментария
  - `donate.html` / `caption.html` / `index.html`

---

## 1. Текущее состояние (что уже работает)

### 1.1 Загрузка и отображение
- Вызов RPC `getComments` через `getByPRC` ([post-card-comments.ts:343-385](../src/b-components/content/post-card/components/post-card-comments/post-card-comments.ts#L343-L385))
- Lazy-load ответов второго уровня (`getComments` с `parentId`)
- Превью-режим: показ `lastComment` без подгрузки списка
- Свёрнутый/развёрнутый вид
- Пагинация по 15 шт + «Показать все»

### 1.2 Создание / голосование
- Отправка нового комментария (`comment` TX) — [comment-sender.ts](../src/b-components/content/post-card/components/post-card-comments/comment-sender.ts)
- Ответ первого/второго уровня (`parentid`/`answerid`)
- Лайк / дизлайк (`cScore` TX) — [comment-scoring.ts](../src/b-components/content/post-card/components/post-card-comments/comment-scoring.ts)
- Базовая защита: нельзя поставить лайк своему / дизлайкнуть после лайка

### 1.3 UX
- Сортировка: `interesting` / `newest` / `oldest`
- @упоминания: фильтр, навигация стрелками, Enter, Escape, скролл к подсвеченному
- Префикс «@user, » при «Ответить автору»
- Confirm-модалка отмены ответа (если есть текст)
- Ctrl/Cmd+Enter — быстрая отправка

### 1.4 Чего нет в реализации (high-level)
- Редактирование/удаление комментариев
- Изображения и донаты в комментариях
- Контекстное меню (⋯) с действиями
- Жалоба (complain) / блокировка пользователя
- Состояния pending/rejected/edited
- Realtime-обновления (WebSocket)
- Deep-linking на конкретный комментарий
- Скрытие по репутации / блок-листу / закрытым аккаунтам
- Лимит символов и индикатор
- Эмодзи-picker
- i18n (тексты захардкожены)

---

## 2. Карта пробелов (детальное сравнение)

Каждая фича помечена приоритетом: **P0** (критично/MVP), **P1** (важно), **P2** (желательно).
И сложностью: **S** (1–2 дня), **M** (3–7 дней), **L** (>1 нед).

### 2.1. Управление комментарием (CRUD)

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 1 | **Редактирование своего комментария** (`commentEdit` TX) | `index.js:2317-2347`, `metmenu.html:6` | P0 | M |
| 2 | **Удаление своего комментария** (soft, `commentDelete` TX) | `index.js:1105-1124`, `metmenu.html:13` | P0 | S |
| 3 | **Удаление чужого комментария автором поста** | `metmenu.html:67-69` | P1 | S |
| 4 | **Лимит 915 символов + индикатор «N осталось / X over»** | `index.js:2270-2294` | P0 | S |
| 5 | **Автосохранение черновика в localStorage** | `index.js:2971-2991` (`state.save`) | P2 | S |

### 2.2. Медиа в комментариях

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 6 | **Прикрепление картинок** (диалог + paste, ресайз 1920×1080) | `index.js:574-669`, `post.html:100-104` | P1 | M |
| 7 | **Удаление/перестановка картинок до отправки** | `index.js:496-572` | P1 | S |
| 8 | **Сетка картинок в комментарии** (one/two/three/four/more) | `list.html:194-220` | P1 | S |
| 9 | **Открытие fullscreen-галереи по клику** | `index.js:1278-1311` | P1 | S |
| 10 | **Emoji-picker (вставка эмодзи в текст)** | `index.js:1860-1900+` (`emojioneArea`) | P2 | M |

### 2.3. Донаты к комментариям

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 11 | **Прикрепить донат (PKOIN, мин 0.1) к комменту** | `index.js:206-297`, `post.html:108-114` | P1 | M |
| 12 | **Бейдж суммы у комментария + иконка `.donatedbefore`** | `list.html:51-53, 108-112` | P1 | S |
| 13 | **Удаление доната до отправки** | `index.js:206-214` | P1 | S |
| 14 | **Звук при успешном донате** | `index.js:280-282` | P2 | XS |

### 2.4. Контекстное меню (⋯)

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 15 | **Кнопка ⋯ + tooltip-меню** | `list.html:115-122`, `metmenu.html` | P0 | S |
| 16 | **Share comment** (URL `?commentid=&parentid=` + соцсети) | `index.js:468-494` | P1 | M |
| 17 | **Complain / Report** комментария/автора | `index.js:381-399` | P1 | S |
| 18 | **Block / Unblock** автора комментария | `index.js:1750-1798` | P1 | S |
| 19 | **«Waiting» пункт для temp/relay** | `metmenu.html:40-44, 51-62` | P1 | XS |

### 2.5. Состояния и визуальные индикаторы

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 20 | **`.temptransaction`** (mempool, TX ещё не подтверждена) | `list.html:33, 90-95` | P0 | S |
| 21 | **`.rejected`** (TX отклонена) | `list.html:33, 91-92` | P0 | S |
| 22 | **`.deleted`** (мягкое удаление, текст-заглушка) | `list.html:148-154` | P0 | S |
| 23 | **`.edited` иконка пера** (`timeUpd > time`) | `list.html:102-106` | P1 | XS |
| 24 | **`.mycomment`** подсветка собственных | `list.html:33` | P2 | XS |
| 25 | **Бейджи пользователя** (`markUser` — verified, реальный) | `list.html:65-68` | P2 | M |
| 26 | **Compressed numbers** для score (1.2K вместо 1234) | `list.html:236, 246` | P1 | XS |
| 27 | **Relative time live-update** («5 минут назад» обновляется) | `list.html:98` (`.realtime`) | P2 | S |

### 2.6. Скрытие / фильтрация / ограничения

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 28 | **`hiddenComment` по репутации** + кнопка «Show anyway» | `list.html:5-15, 130-146`, `index.js:1590-1599` | P1 | M |
| 29 | **`hiddenBlockedUserComment`** (юзер в моём блок-листе) | `list.html:15, 33`, `index.js:1602-1609` | P1 | S |
| 30 | **`lockedaccount`** (закрытый аккаунт автора) | `list.html:5, 156-162` | P1 | S |
| 31 | **`myaccauntdeleted`** запрет действий | `index.js:227-231, 2361-2365` | P1 | XS |
| 32 | **`reputationBlockedMe`** запрет публикации | `index.js:702-708, 1327-1330` | P1 | XS |
| 33 | **`scamcriteria` диалог-предупреждение** при дизлайке | `index.js:711-725, 1333-1346` | P1 | S |
| 34 | **`checkBanned`** (автор поста в блок-листе) | `index.js:354-378, 2115-2127` | P2 | S |

### 2.7. Realtime / WebSocket / Sync

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 35 | **Listener на новые комментарии** (`comment` TX в mempool) | `index.js:2787-2800` (`actionListeners`) | P0 | M |
| 36 | **Listener на чужие cScore** (обновление счётчиков лайков) | `index.js:2801-2812` | P0 | M |
| 37 | **Optimistic UI** — добавление temp-комментария сразу | `index.js:1487` | P0 | M |
| 38 | **Refresh-кнопка** | `list.html:324-328`, `index.js:2685-2695` | P1 | XS |
| 39 | **Live counts** (children, scoreUp/Down) при приходе TX | `index.js:40-85, 186-204` | P0 | S |

### 2.8. Навигация и deep-linking

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 40 | **`?commentid=...&parentid=...` deep-link** (auto-expand) | `index.js:2912-2922` (`fastreply`) | P1 | S |
| 41 | **scrollToComment + подсветка `.newcommentsn`** | `index.js:1363-1380, 880-893` | P1 | S |
| 42 | **«Свернуть/закрыть комментарии»** | `list.html:332-338` | P2 | XS |

### 2.9. Сортировка и алгоритм «interesting»

В nextgen алгоритм есть, но **не учитывает** ряд факторов оригинала:

| # | Фактор «interesting» | Где в оригинале | Приоритет |
|---|----------------------|-----------------|-----------|
| 43 | `comment.amount * 1000` — буст за донат | `index.js:1414` | P1 |
| 44 | Буст ×50 если автор комментария = автору поста | `index.js:1434-1436` | P1 |
| 45 | Буст ×20 для своих, ×1000 для verified (`platform.real`) | `index.js:1420-1422` | P1 |
| 46 | `relation('blocking') → score × 0` | `index.js:1429-1432` | P1 |
| 47 | `activities.point * 10` — учёт активностей пользователя | `index.js:1440-1444` | P2 |
| 48 | Сохранение выбора сортировки в `usersettings.commentsOrder` | `index.js:36` | P1 |
| 49 | Размер страницы 25 (vs 15 в nextgen) — выровнять | `index.js:20` | P2 |

### 2.10. Прочие UX-мелочи

| # | Фича | Где в оригинале | Приоритет | Сложность |
|---|------|-----------------|-----------|-----------|
| 50 | **i18n** — все тексты через `e('key')` | повсеместно | P0 | M |
| 51 | **Avatar мой аватар в форме root reply** | `post.html:18-53` | P2 | XS |
| 52 | **Иконка close (×) в форме редактирования** | `post.html:57-67` | P0 | XS |
| 53 | **TV-фокус классы (`tvfocusedopacity`, `tvfocusedzoom`)** | повсеместно | P2 | S |
| 54 | **Mobile vibration на действиях** | `index.js:1736, 1787` | P2 | XS |

---

## 3. План реализации (этапы)

Задача — двигаться так, чтобы каждый этап давал видимый, законченный кусок функциональности и
не оставлял компонент в полу-рабочем состоянии.

### Phase 1 — CRUD и базовая корректность (P0, ~1.5–2 нед)

**Цель:** пользователь может полностью управлять своими комментариями и видит правильные
состояния транзакций.

1. **Контекстное меню (⋯)** — каркас, tooltip/popover, доступ к действиям
   - Файлы: новый `comment-menu.vue` + слот в `post-card-comments.vue`
   - DoD: меню открывается, разные пункты для своих/чужих
2. **Удаление комментария** (`commentDelete` TX)
   - Аналогично `comment-sender.ts` → `comment-deleter.ts`
   - Confirm-диалог; рендер `.deleted` плашки
3. **Редактирование комментария** (`commentEdit` TX)
   - Inline-форма поверх комментария (как `metmenu` → `renders.edit`)
   - Иконка пера если `timeUpd > time`
4. **Состояния транзакций**
   - `temp` (отправлено, в mempool) → стопватч-иконка + класс
   - `rejected` (отклонена) → бан-иконка + класс
   - Хук в `comment-sender.ts` отдаёт временный объект; обновление при подтверждении
5. **Лимит 915 символов + индикатор**
   - Считать длину в `replyDraft`, рендер при `< 500` оставшихся
6. **i18n каркас**
   - Завести namespace `comments.*` в локализации
   - Заменить все захардкоженные строки

**Зависимости:** требуется механизм подписки на статус TX — синхронизировать с подходом
`@/blockchain/core/transactions/*` (см. как это сделано для постов).

---

### Phase 2 — Реалтайм и контент-операции (P0–P1, ~2 нед)

**Цель:** комментарии живут — appears/scores обновляются без F5; есть жалобы и блокировки.

7. **Pinia-store для комментариев** (`useCommentsStore`)
   - Кеш: `byPostId`, `byCommentId`, `repliesByParentId`
   - Селекторы: `commentsForPost(postId, sort)`, `replies(parentId)`
   - Заменяет `data()` локальный стейт текущего компонента
   - Аналог `psdk.comment.get(id)` в оригинале
8. **WebSocket / event-listener подписка**
   - На `comment` (новые комменты к конкретному `txid`)
   - На `cScore` (изменения голосов)
   - Хук в `useCommentsStore.subscribe(postId)` / `unsubscribe`
9. **Optimistic UI**
   - При отправке `comment-sender.ts` сначала кладёт temp-объект в стор
   - При подтверждении/отклонении обновляет статус
10. **Refresh-кнопка** в шапке списка
11. **Жалоба (complain)** — переиспользовать существующий компонент `complain` (если уже есть в nextgen) или сделать заглушку с RPC
12. **Block / Unblock** автора комментария (через существующий blockchain action)
13. **Share comment** — генерация URL `?commentid=&parentid=`, передача в существующий social-share UI
14. **Deep-link `?commentid=`** при открытии поста — авто-раскрыть, прокрутить, подсветить

---

### Phase 3 — Богатый контент (P1, ~1.5–2 нед)

**Цель:** комментарии не только текст — картинки и донаты как в оригинале.

15. **Картинки в комментарии**
    - Кнопка `embedimages`, file-dialog, paste-from-clipboard
    - Resize (`@/helpers/common/image-resize` если есть, иначе завести)
    - Сетка отображения (one/two/three/four/more) в `comment-images.vue`
    - Удаление до отправки
16. **Открытие галереи** при клике на картинку — переиспользовать `imageGallery` из nextgen
17. **Донаты к комментарию**
    - Кнопка `embeddonate`, modal выбора суммы PKOIN
    - Бейдж `.donatedbefore` + сумма у комментария
    - Минимум 0.1, валидация
18. **Сортировка — недостающие факторы**
    - В `helpers.ts:commentPoint` добавить amount/postAuthor/relation/verified
    - Сохранение `commentsOrder` в user settings store

---

### Phase 4 — Скрытие, безопасность, репутация (P1, ~1 нед)

**Цель:** комментарии правильно фильтруются по репутации и блок-листам.

19. **`hiddenComment` по репутации**
    - Хук на user info store: `isHiddenByReputation(comment)`
    - Скрывающая плашка + кнопка «Показать»
20. **`hiddenBlockedUserComment`** — учёт блок-листа текущего юзера
21. **`lockedaccount`** — закрытый аккаунт автора
22. **`myaccauntdeleted`** — блокировка действий
23. **`reputationBlockedMe`** — запрет публикации с предупреждением
24. **`scamcriteria` диалог** перед дизлайком
25. **`checkBanned`** — предупреждение о бане автором поста

---

### Phase 5 — Финальный полиш (P2, ~1 нед)

26. **Эмодзи-picker** (можно базовый ant-design / emoji-mart-vue вместо `emojioneArea`)
27. **Compressed numbers** в счётчиках score
28. **Relative time live-update** через интервал на mounted
29. **Бейджи пользователя** (verified, реальный) — переиспользовать общий компонент
30. **Свернуть/закрыть весь блок** (close-comments)
31. **TV-focus классы** (если поддерживается TV-режим)
32. **Mobile vibration** API в обработчиках
33. **Автосохранение черновика** в localStorage по `postId`

---

## 4. Архитектурные решения

### 4.1. Pinia-store для комментариев

**Сейчас:** `data()` внутри `post-card-comments.ts` — каждый пост держит свой кеш и
перезагружает при ремоунте.

**Цель:** единый `useCommentsStore` — кеш переживает unmount, разделяется между
`post-card-comments` и `last-comments` сайдбара, упрощает realtime.

```ts
// src/store/comments.ts
export const useCommentsStore = defineStore('comments', () => {
  const byCommentId = ref<Record<string, GetComment>>({})
  const rootByPostId = ref<Record<string, string[]>>({})       // postId → commentIds
  const repliesByParentId = ref<Record<string, string[]>>({})  // parentId → commentIds
  const sortByPostId = ref<Record<string, CommentsSortOrder>>({})
  const pendingByPostId = ref<Record<string, GetComment[]>>({}) // optimistic temps

  function loadRoot(postId: string): Promise<void> { ... }
  function loadReplies(postId: string, parentId: string): Promise<void> { ... }
  function applyTxResult(comment: GetComment, optype: 'comment'|'commentEdit'|'commentDelete'): void { ... }
  function applyScoreEvent(commentId: string, value: number, address: string): void { ... }
  // ...
  return { ... }
})
```

### 4.2. Разбиение `post-card-comments.ts`

Сейчас — 680 строк одного файла. Предлагается разделение:

```
post-card-comments/
├── post-card-comments.vue      # template (тонкий)
├── post-card-comments.ts       # composition root: подписки + связки
├── components/
│   ├── comment-item.vue        # 1 элемент комментария (универсальный для root/reply)
│   ├── comment-menu.vue        # ⋯ tooltip
│   ├── comment-images.vue      # сетка картинок
│   ├── comment-donate-badge.vue
│   ├── comment-status-badge.vue # temp/rejected/edited
│   └── reply-form.vue          # вместо comment-reply-panel.vue (расширенная)
├── composables/
│   ├── use-comments-list.ts    # сортировка, пагинация, expand/collapse
│   ├── use-reply-state.ts      # replyTarget, draft, mentions
│   ├── use-comment-mutations.ts # send/edit/delete/score
│   └── use-comment-realtime.ts # WS подписки
├── api/
│   ├── comment-sender.ts       # уже есть
│   ├── comment-editor.ts       # NEW (commentEdit TX)
│   ├── comment-deleter.ts      # NEW (commentDelete TX)
│   └── comment-scoring.ts      # уже есть
├── helpers.ts
└── ...
```

### 4.3. Унификация с реализацией постов

Многое из «комментарии — это маленькие посты» уже реализовано для постов:
- TX-builders, mempool subscription, optimistic UI
- Image upload pipeline
- Donate flow
- Mention input

**Принцип:** не дублировать. Прежде чем писать новое для комментариев — найти и переиспользовать
существующее в коде постов / профиля. Список модулей-кандидатов под аудит:
- `src/blockchain/core/transactions/*`
- `src/b-components/content/post-create*` (если есть форма создания поста)
- `src/b-components/common/image-upload*`
- `src/b-components/common/donate*`

---

## 5. Открытые вопросы / решения нужны от продукта

1. **Уровни вложенности.** Оригинал: 2 уровня (root → reply). Sохраняем 2 или допускаем threading глубже?
2. **Лимит символов 915.** Зашит в оригинале — оставить тот же, или поднять?
3. **Эмодзи picker.** `emojioneArea` устарел. Заменяем на `emoji-mart-vue` / встроенный браузерный — нужен выбор библиотеки.
4. **Размер страницы.** Сейчас 15 в nextgen vs 25 в оригинале. Унифицировать?
5. **TV-режим.** Поддерживаем сейчас или откладываем до отдельного модуля?
6. **i18n-словарь.** Используем существующие ключи `e13029..e13040`, `comments_*` или вводим новый namespace `comments.*`?

---

## 6. Источники / Ссылки на код

### Оригинал (для сверки поведения)
- [components/comments/index.js](../../___original-repos/pocketnet.gui/components/comments/index.js)
- [components/comments/templates/list.html](../../___original-repos/pocketnet.gui/components/comments/templates/list.html)
- [components/comments/templates/post.html](../../___original-repos/pocketnet.gui/components/comments/templates/post.html)
- [components/comments/templates/metmenu.html](../../___original-repos/pocketnet.gui/components/comments/templates/metmenu.html)

### Nextgen (текущая база)
- [post-card-comments.vue](../src/b-components/content/post-card/components/post-card-comments/post-card-comments.vue)
- [post-card-comments.ts](../src/b-components/content/post-card/components/post-card-comments/post-card-comments.ts)
- [comment-sender.ts](../src/b-components/content/post-card/components/post-card-comments/comment-sender.ts)
- [comment-scoring.ts](../src/b-components/content/post-card/components/post-card-comments/comment-scoring.ts)
- [helpers.ts](../src/b-components/content/post-card/components/post-card-comments/helpers.ts)
