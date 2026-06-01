# TODO: Комментарии к постам — несделанное

Что осталось довести до паритета с оригиналом (`___original-repos/pocketnet.gui/components/comments/`).
Ядро (CRUD, optimistic UI + WS, скрытие по репутации, алгоритм «interesting», i18n, полиш) — **готово** и здесь не описывается.

**Легенда:** ⏸️ — отложено (ждёт инфраструктуру вне комментариев) · 🔵 — контракт/заглушка готова, ждёт данные.
**Приоритет:** P0 крит · P1 важно · P2 желательно. **Сложность:** XS час · S 1–2 дня · M 3–7 дней · L >нед.

Точки расширения для 🔵-пунктов — опциональные параметры в
[visibility.ts](../src/b-components/content/post-card/components/post-card-comments/visibility.ts) и
[helpers.ts](../src/b-components/content/post-card/components/post-card-comments/helpers.ts):
когда инфраструктура появится — точечный плаг-ин без правки шаблонов.

---

## 1. Медиа

| # | Фича | Ориг. | P | Сл. | Статус / зависит от |
|---|------|-------|---|-----|---------------------|
| 6 | **Прикрепление картинок** (диалог + paste, ресайз 1920×1080) | `index.js:574-669`, `post.html:100-104` | P1 | M | ⏸️ Нужен общий image-upload pipeline: file-picker, paste-handler, resize (Canvas / `browser-image-compression`), обёртка endpoint `pocketnet.app:8092/i/`. В проекте нет ни одного места создания контента с картинкой. |
| 7 | **Удаление/перестановка картинок до отправки** | `index.js:496-572` | P1 | S | ⏸️ Зависит от #6. |
| 10 | **Emoji-picker** (вставка в текст) | `index.js:1860-1900+` | P2 | M | ⏸️ Выбор библиотеки **не нужен** — в проекте есть кастомный picker `b-components/messenger/components/emoji-picker/`. Осталось переиспользовать в форме комментария. |

## 2. Донаты к комментариям

| # | Фича | Ориг. | P | Сл. | Статус / зависит от |
|---|------|-------|---|-----|---------------------|
| 11 | **Прикрепить донат** (PKOIN, мин 0.1) | `index.js:206-297`, `post.html:108-114` | P1 | M | ⏸️ Нужен общий donate-modal + transaction builder для PKOIN-доната с привязкой к comment-tx. |
| 12 | **Бейдж суммы у комментария** | `list.html:51-53, 108-112` | P1 | S | ⏸️ Зависит от #11. (`getCommentDonateAmount()` в `helpers.ts` уже есть — используется алгоритмом, визуала нет.) |
| 13 | **Удаление доната до отправки** | `index.js:206-214` | P1 | S | ⏸️ Зависит от #11. |
| 14 | **Звук при успешном донате** | `index.js:280-282` | P2 | XS | ⏸️ Зависит от #11. |

## 3. Контекстное меню (⋯)

| # | Фича | Ориг. | P | Сл. | Статус / зависит от |
|---|------|-------|---|-----|---------------------|
| 16 | **Share comment** (URL `?commentid=&parentid=` + соцсети) | `index.js:468-494` | P1 | M | ⏸️ Нет social-share UI в проекте (`posts-store.sharePost` лишь инкрементирует счётчик). |
| 17 | **Complain / Report** комментария/автора | `index.js:381-399` | P1 | S | ⏸️ Нет RPC `usercomplain` + UI-модалки выбора причины. |
| 18 | **Block / Unblock** автора | `index.js:1750-1798` | P1 | S | ⏸️ Нет RPC `userblock`/`userunblock` + user-relations store. UI-контракт готов: `canShowMenu` + `isBlockedByMe(blockedSet)`. |

## 4. Скрытие / ограничения

| # | Фича | Ориг. | P | Сл. | Статус / зависит от |
|---|------|-------|---|-----|---------------------|
| 29 | **`hiddenBlockedUserComment`** (мой блок-лист) | `list.html:15, 33` | P1 | S | 🔵 `isBlockedByMe(comment, blockedSet)` готова принять Set из user-relations store. |
| 30 | **`lockedaccount`** (закрытый аккаунт автора) | `list.html:5, 156-162` | P1 | S | 🔵 Заглушка `isAuthorAccountLocked()` готова к подключению; ждёт сигнал из API. |
| 31 | **`myaccauntdeleted`** запрет действий | `index.js:227-231` | P1 | XS | ⏸️ Нет поля `account_deleted` в `UserState` (getuserstate). При появлении → в `getCommentPostingDisableReason`. |
| 34 | **`checkBanned`** (автор поста забанил тебя) | `index.js:354-378` | P2 | S | ⏸️ Требует загрузки отношений автора поста. |

## 5. Навигация / deep-linking

| # | Фича | Ориг. | P | Сл. | Статус / зависит от |
|---|------|-------|---|-----|---------------------|
| 40 | **`?commentid=...` deep-link** | `index.js:2912-2922` | P1 | S | ⏸️ Нет роута `/post/:txid` (или `/:user/:txid`) — за пределами модуля комментариев. |
| 41 | **scrollToComment + подсветка** | `index.js:1363-1380, 880-893` | P1 | S | ⏸️ Зависит от #40. |

## 6. Сортировка «interesting» и настройки

| # | Фактор / фича | Ориг. | P | Статус / зависит от |
|---|---------------|-------|---|---------------------|
| 45 | Буст ×1000 для **verified**-авторов | `index.js:1420-1422` | P1 | 🔵 Контракт в `commentPoint`; ждёт verified-сигнал из API. (Для своих ×20 — уже работает.) |
| 47 | `activities.point * 10` | `index.js:1440-1444` | P2 | 🔵 Контракт `getActivityPoint` в `CommentSortContext`; ждёт activity-сигнал из API. |
| 48 | Сохранение **`commentsOrder`** в user settings | `index.js:36` | P1 | ⏸️ Нет user-settings store. |
| 49 | Размер страницы **25** (сейчас 15) | `index.js:20` | P2 | ⏸️ Вопрос продукту (см. ниже). |

## 7. Прочие мелочи

| # | Фича | Ориг. | P | Сл. | Статус / зависит от |
|---|------|-------|---|-----|---------------------|
| 5 | **Автосохранение черновика** в localStorage | `index.js:2971-2991` | P2 | S | ⏸️ Низкий приоритет, без внешних зависимостей. |
| 24 | **`.mycomment`** подсветка собственных | `list.html:33` | P2 | XS | ⏸️ Стилевая мелочь (~5 минут). |
| 25 | **Бейджи пользователя** (verified/реальный) | `list.html:65-68` | P2 | M | ⏸️ Нужен verified-сигнал из ответа `getuserprofile`. |
| 53 | **TV-фокус классы** | повсеместно | P2 | S | ⏸️ TV-режим не приоритет. |

---

## 8. Уточнения к упрощённым (работают, но не как в легаси)

- **`scamcriteria` диалог** (`index.js:711-725`) — сейчас эвристика «низкая репутация + >80% использованных лимитов» в `shouldShowScamWarningOnDislike`. Нужна **точная legacy-формула**.
- **Порог `hiddenComment` по репутации** (`list.html:5-15`) — сейчас `<−50` (как `reputationBlockedMe`). Легаси использует более сложный набор проверок в `psdk.user.hiddenComment` — при необходимости поднять до паритета.
- **`reputationBlockedMe`** (`index.js:702-708`) — упрощённая формула `reputation < −50`. Свериться с легаси, если будут жалобы.

---

## 9. Открытые вопросы продукту

1. **Уровни вложенности.** Сейчас 2 (root → reply), как в оригинале. Допускаем threading глубже?
2. **Лимит символов.** Сейчас 915 (как в оригинале, настраивается в `consts.ts`). Оставляем / поднимаем?
3. **Размер страницы.** 15 в nextgen vs 25 в оригинале — унифицировать? (#49)
4. **TV-режим.** Поддерживаем или откладываем до отдельного модуля? (#53)
5. **Точная формула `scamcriteria`** — нужна от продукта/легаси.
6. **Порог `hiddenComment`** — оставляем `<−50` или повторяем сложную легаси-проверку?

---

## 10. Ссылки

**Оригинал (для сверки поведения):**
- [components/comments/index.js](../../___original-repos/pocketnet.gui/components/comments/index.js)
- [list.html](../../___original-repos/pocketnet.gui/components/comments/templates/list.html) · [post.html](../../___original-repos/pocketnet.gui/components/comments/templates/post.html) · [metmenu.html](../../___original-repos/pocketnet.gui/components/comments/templates/metmenu.html)

**Nextgen (точки подключения):**
- [post-card-comments/](../src/b-components/content/post-card/components/post-card-comments/) — корень модуля
- [visibility.ts](../src/b-components/content/post-card/components/post-card-comments/visibility.ts) — 🔵-контракты скрытия/прав
- [helpers.ts](../src/b-components/content/post-card/components/post-card-comments/helpers.ts) — `commentPoint`, `getCommentDonateAmount`, `getActivityPoint`
