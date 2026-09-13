## Зона: C — feed / posts / pending posts / comments / ratings / filters / relations

### Находки
- **C1 · 🔴 критично · logic** — Ответ на ответ уходит с `parentid = id ответа` (третий уровень), а не корневого коммента: коммент невидим и локально, и после подтверждения
  - Файл: `use-comment-form.ts:391-396` (`onReplyToSecondLevel`/`onReplyToComment` → `openReplyEmpty(reply.id, reply.id)`), `:314-315`; `comment-card.vue:236-243`; `use-comments-replies.ts:66-86`; `post-card-comments.vue:70-74`.
  - Суть: для level-2 реплая и `parentId`, и `answerId` = `reply.id`. Legacy (`components/comments/index.js:1686-1694`) всегда шлёт `parentid = корень`, `answerid = id ответа`. Ветки рендерятся только через `getReplies(rootComment.id)`; `getcomments(post, rootId)` третий уровень не вернёт.
  - Сценарий: «Ответить» под ответом → pending в `mergedRepliesByParent[reply.id]` (не рендерится); tx с `parentid=reply.id` → коммент не появится ни здесь, ни в legacy. Деньги потрачены, коммент «пропал».
  - Фикс: для level 2 `openReplyEmpty(reply.id, reply.parentid || reply.id)`; в `sendReply` `answerId = commentId`, `parentId = parentId`.
  - Уверенность: high.

- **C2 · 🔴 критично · data** — Оценка поста уходит и опрашивается по `post.hash` (хеш последней правки), а не по корневому `txid`: для отредактированных постов подтверждение никогда не приходит
  - Файл: `post-card.vue:108` (`:share-id="String(post.hash || post.txid || post.id)"`); `use-star-rating.ts:191,199`; `pending-ratings-store.ts:113-119`; контраст `feed-enrichment.ts:77` (`p.txid || p.hash`), `post-card-comments.vue:279`.
  - Суть: у отредактированных постов `hash !== txid`. Live-проба: 7 из 120 постов такие; `getpagescores([hash])` → `[]`, `getpagescores([txid])` → `[{value:5}]`. Legacy `pShare.upvote` использует `self.txid`.
  - Сценарий: звезда отредактированному посту → tx `upvoteShare {share: <edit-hash>}` (вероятен NotFound), poll 10 минут по hash → пусто → оптимистичная оценка молча откатывается; `enrichWithUserScores` (по txid) может показать `myVal` — расхождение в одной карточке.
  - Фикс: `share-id = String(post.txid || post.hash || post.id)`; ключ pending-ratings по txid.
  - Уверенность: high (живой RPC).

- **C3 · 🔴 критично · ux-claim** — «Похожие видео» на странице поста никогда не загружаются: `getprofilefeed` с 13 параметрами, нода отвечает `No profile address`
  - Файл: `use-related-videos.ts:37-51`; та же раскладка в мёртвом `use-feed-queries.ts:132-146, 206-220`; правильная — `use-profile-feed.ts:88-103`, тип `get-profile-feed.ts:61-76`.
  - Суть: Live-проба: 13-param → `{"code":-32600,"message":"No profile address"}`, 14-param → 6 видео.
  - Фикс: вставить `''` перед `address.value` (индекс 9); удалить `use-feed-queries.ts`.
  - Уверенность: high (живой RPC).

- **C4 · 🟠 высоко · consistency** — `post-card-comments.vue` читает `post.address`, которого нет в `AdaptedPost` → `postAuthorAddress` всегда `''`: модерация автором, проверка «автор меня забанил» и буст автора в сортировке мертвы
  - Файл: `post-card-comments.vue:279-282, 339-347, 705-710`; `use-comment-edit-delete.ts:57`; `helpers.ts:226`; `post-card.types.ts:15-23`.
  - Сценарий: автор поста не видит «Удалить» у чужого коммента; забаненный юзер пишет коммент и получает ошибку ноды вместо `commentsMsg.disableBannedByAuthor`.
  - Фикс: `postAuthorAddress = computed(() => props.post.author?.address || '')`.
  - Уверенность: high.

- **C5 · 🟠 высоко · data** — `switchAccount` и logout не сбрасывают user-relations / pending-posts / comments / pending-ratings / posts-store → аккаунт B видит подписки, блок-лист и pending-элементы A
  - Файл: `auth-store.ts:463-505, 340`; `user-relations-store.ts:90-94` (`isInitialized` гард); `pending-ratings-store.ts:41-48`; `pending-posts-store.ts:145-148`, `comments-store.ts:244-249` — `reset()` не вызывается нигде; `header-events.vue:203-205`.
  - Фикс: в `switchAccount`/`signOut` reset всех сторов; `isInitialized` привязать к адресу.
  - Уверенность: high.

- **C6 · 🟠 высоко · ux-claim** — «Сначала лучшее»: `depth` для `gettopfeed` трактуется как дни (30), нода — как блоки → топ-лента показывает ~2 поста; «Всё время» (99999) даёт SQL-таймаут
  - Файл: `filters-store-consts.ts:31-51` (`TIME_FILTER_DEPTH_MAP`); `feed-queries.ts:74-96`; `use-infinite-feed.ts:141`.
  - Суть: legacy `gettopfeed` с `depth: 7000`/`10000`. Live: depth 30 → 2 поста, 365 → 10, 99999 → `sql request timeout`.
  - Фикс: `depth` в блоках (≈1440/сутки; дефолт 7000–10000), «всё время» ограничить.
  - Уверенность: high (живой RPC).

- **C7 · 🟠 высоко · logic** — `safeDecode` в `use-feed.ts` заменяет каждый `+` на пробел в незакодированном тексте (живые посты не URL-кодированы)
  - Файл: `use-feed.ts:79-85`, применяется `:196-197, :209, :305-306, :315`; `header-search-dropdown.vue:139`, `use-search-navigation.ts:95-97`.
  - Суть: проба 80 постов — 0 с `%XX`, 2 с `+`. `"C++ tutorial" → "C   tutorial"`.
  - Фикс: декодировать только при `%[0-9A-F]{2}` и без замены `+`.
  - Уверенность: high.

- **C8 · 🟠 высоко · leak/logic** — Неудачная подгрузка страницы навсегда оставляет `isLoadingMore=true`, а `content-feed` прячет всю ленту за блоком ошибки
  - Файл: `use-infinite-feed.ts:211-227` (`await refetch()` глотает ошибки, `catch` недостижим), `:150-160`; `content-feed.vue:69-82` (`v-else-if="error"` раньше постов). Контраст: `use-profile-feed.ts:115-119`.
  - Сценарий: сеть моргнула на странице 3 → 60 постов исчезают, «Error: …»; после восстановления `loadMore` не вызывается.
  - Фикс: `watch(error)` → `isLoadingMore=false`; ошибку страницы показывать под списком.
  - Уверенность: high.

- **C9 · 🟡 средне · race** — Асинхронный watcher `data` может применить страницу старого таба/фильтра поверх нового
  - Файл: `use-infinite-feed.ts:150-206` (`await fetchAndMergeRepostOriginals` в `:166`), reset `:75-95`; `use-profile-feed.ts:147-178`.
  - Фикс: снимок `queryKey`/поколения до `await`.
  - Уверенность: medium-high.

- **C10 · 🟡 средне · logic** — `refetch()` по WS-подтверждению и кнопка «Обновить ленту» рефетчат текущую страницу (N), а не голову: подтверждённый пост исчезает, «обновить» после скролла ничего не делает
  - Файл: `use-profile-feed.ts:285-291, 177-183`; `content-feed.vue:23`; контраст `use-infinite-feed.ts:260-265`.
  - Фикс: `currentTxidForQuery=''; hasMore=true; refetch()`.

- **C11 · 🟡 средне · ux-claim** — Звёзды на своём посте кликабельны (нода отвергает SelfScore=5, код не классифицирован), pre-validation ошибки только `emit('error')` → молчание, `isLowRatingBlocked` падает на null-профиле
  - Файл: `use-star-rating.ts:160-174, 139-153`; `star-rating-validation.ts:27-33`; `star-rating-errors.ts:46-49`; `post-card.vue:417-419`.
  - Фикс: `disabled` для своего поста; тосты для pre-validation; `userProfile?.reputation ?? 0`.

- **C12 · 🟡 средне · consistency** — WS-финализация pending-постов и комментов ожидает `transaction.type ∈ {share,video,…}` / `{comment,…}`, которых в словаре WS нет; TTL/reconcile pending-постов живут только в ленте профиля → «песочные часы» могут висеть до перезагрузки
  - Файл: `use-pending-posts-realtime.ts:30-36`, `pending-post-adapter.ts:13`; `use-comments-ws.ts:46-57`; `ws-service.ts:279-290`; `get-missed-info.ts:56-66`; `use-profile-feed.ts:187-193`; `comments-store.ts:227-235`.
  - Фикс: сверить с payload прокси; `cleanupExpired` таймером в `header-events`; overrides по comment id.
  - Уверенность: medium (протокол прокси не представлен в репе).

- **C13 · 🟡 средне · ux-claim** — Ссылки «Скопировать/поделиться/embed» от `window.location.origin` → в Tauri (`tauri://localhost`) и Capacitor нерабочие URL
  - Файл: `post-card.vue:350-353`; `post-card-comments.vue:562-566`; `post-share-menu.vue:60-68`; `embed-post-page.vue:73`.
  - Фикс: константа публичного веб-origin для нативных сборок.

- **C14 · 🟡 средне · consistency** — Блок-лист применяется только к комментам и профилю; посты заблокированных авторов в лентах не фильтруются (legacy фильтрует клиентски)
  - Файл: `use-infinite-feed.ts`, `feed-queries.ts:74-96, 127-149`, `use-boosted-feed.ts`, `use-recommended-users.ts:83-84`.
  - Фикс: `!relations.isBlocked(p.author.address)` в `displayedPosts` и рекомендациях.

- **C15 · 🟡 средне · consistency** — `post-mapper.adaptPostData` (страница поста, embed, messenger-embed) — усечённая модель: нет `myVal`, `lastComment`, `preview`, `repostAuthor`, `pending`; потребители читают несуществующие поля
  - Файл: `post-mapper.ts:80-149`; `use-post-by-txid.ts:62`; `post-page.vue:64`; `embed-post-page.vue:103-108` (`post.value?.time` → дата никогда не показывается); `post-embed.vue:128-138`.
  - Сценарий: репост по `/post/:txid` без контента оригинала; `myVal` не подгружается → повторная оценка → `DoubleScore`; в чате превью статьи = сырой JSON.
  - Фикс: один адаптер (`use-feed.adaptPostData` + `mergeRepostContent` + `enrichWithUserScores`).

- **C16 · 🟡 средне · consistency (i18n)** — Захардкоженные русские строки (= H15) + `useLastComments` жёстко `'ru'` (`use-comments-queries.ts:52`).

- **C17 · ⚪ низко · data** — Избранное, черновики комментов не пер-аккаунт; pending-ratings без уникального индекса (`post-rating-pending-api.ts:24-54`, `pending-ratings-store.ts:63-70` `add` не awaited).
  - Фикс: `address` в ключах; `put` по `[shareId+userAddress]`.

- **C18 · ⚪ низко · logic** — Вкладка «Избранное»: если хотя бы один из 20 id не вернулся (удалённый пост) → `hasMore=false`, остальные недостижимы
  - Файл: `feed-queries.ts:156-202`, `use-infinite-feed.ts:191-194`.

- **C19 · ⚪ низко · leak** — После `deletePost` тумбстоун только в локальной карточке; `emit('deleted')` никто не слушает
  - Файл: `post-card.vue:310-323`.
  - Фикс: `postsStore.removePost` + фильтр в лентах.

- **C20 · ⚪ низко · logic** — `resolvePostTitleFromPost` читает `blocks[0].text` вместо `blocks[0].data.text` → для статей заголовок в «песочных часах» всегда «без названия»
  - Файл: `post-title-resolver.ts:28`.

### Несостыковки между модулями
- **C21 · ⚪ низко · consistency** — Два `adaptPostData` и мёртвые дубли: `use-infinite-feed-fetchers.ts`/`-enrichment.ts`/`-consts.ts` (мёртвые), `use-feed-helpers.ts` (другой `safeDecode`), `feed-store-helpers.ts`, `post-card/helpers.ts:3`+`consts.ts:16` (глобальный `/g`-regex с `.test()`), `use-feed-queries.ts` (неверная раскладка), `use-comments-queries.ts:23-42` (`useComments` без потребителей); `composables/index.ts:11-13` — конфликт экспорта `safeDecode` (TS2308). `related-videos.vue:51-62` — собственный декодер.
- **C22 · ⚪** — `extractPostsFromResponse` фильтрует профили только в ветке `data.contents`; `profile-feed.vue:77-79` `profile-loaded` — мёртвый путь.
- **C23 · ⚪** — `nextCommentsPageSize` обещает «Показать ещё 20», `showMoreComments` добавляет 15.
- **C24 · ⚪** — Sort-/time-фильтры без UI-потребителей; deep-watcher сбрасывает `allPosts` без рефетча — мина.

### Проверено — ОК
- Все `v-html` зоны проходят whitelist-санитайзер.
- Статические i18n-ключи: 1436/1436; динамические `postMsg.validation.*` полны.
- Дедуп ленты по `String(p.id)` нужен и работает (сервер отдаёт пересекающиеся страницы).
- `getboostfeed`, `getmostcommentedfeed`, 14-param `getprofilefeed`, `getcomments` по txid — сверены с legacy и нодой.
- `report-modal`: двойная отправка заблокирована; `sendComplaint` формат как legacy.
- Комментарии: оптимистичные create/edit/delete/score откатываются; deep-link рабочий; черновик корректен.
- Интервалы/подписки чистятся.
- Pending-посты: id = реальный txid → дедуп; пропуск `registerPost` для pending никому не мешает.
- `calculateRatingUpdate` не двоит `scoreCnt`.
- `share-targets.ts` корректно энкодит.
- vitest зоны 91/91.
