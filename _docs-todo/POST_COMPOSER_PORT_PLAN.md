# План композера поста — оставшееся (P3, P5)

> **Выполнено:** P0–P2 (текст + картинки + теги/язык/видимость), **P4 (репост + редактирование)**
> и **WYSIWYG-редактор статей** (Editor.js, P5-article).
> Код — в `src/b-components/content/post-composer/`, `src/blockchain/core/actions/post-action.ts`,
> `src/services/image-upload-service.ts`, `src/helpers/common/resize-image.ts`, `src/pages/compose-page/`.
> Контекст по выполненному — память `project_post_composer_port`. Здесь — **только несделанное**.

---

## 0. Незакрытая верификация (сделать при первом живом запуске)

- **Реальная загрузка картинки** на узел (peertube: proxy `peertube/best` `{type:'upload'}` →
  POST `{base64, Action:'upload'}` на `{host}/api/v1/`) вживую не прогонялась. Проверить CORS и
  нужна ли подпись peertube (`app.user.signature('peertube')` в legacy).
- **Первая транзакция поста** на узел не отправлялась (нужен залогиненный аккаунт с балансом).
  Логика хэша/payload закрыта тест-векторами, но совпадение `serialize()` с ожиданием ноды стоит
  подтвердить на реальной публикации. Это же касается **edit (`txidEdit`) и repost (`txidRepost`)** —
  логика готова и протестирована, но вживую не отправлялась.
- Обработка кодов антиспама/лимитов ноды (`2/3/15/29/31/49/61`) — маппинг в i18n при живых ошибках.
- **Статья (article v2)**: `m` уходит ОБЪЕКТОМ Editor.js, а serialize хеширует `JSON.stringify(объект)`.
  Нода должна сериализовать тот же объект идентично (порядок ключей) — совпадает с legacy, но вживую
  не проверялось. Подтвердить на первой реальной публикации статьи.

---

## 1. Протокол — что нужно для P3, P5

Полная схема serialize/payload — в `post-action.ts`. Ниже только специфика оставшихся типов.

### operationType (уже реализовано в `resolvePostOperationType`)
- `'video'` / `'audio'` — для `peertube://…` URL (по последнему сегменту `/audio`). **Уже работает.**
- `'article'` — `settings.v==='a' && settings.version>=2`. **Уже работает.**
- Для не-peertube видео (youtube/vimeo/…) legacy оставляет `'share'` — это нормально.

### Что в payload отвечает за оставшиеся фичи
```js
{ s: { f: '3' } } // платная видимость (P5 — остаётся проверка наличия подписки)
```
Уже реализованы: `u` (видео-ссылка) + `c` (заголовок видео), опрос `p`, отложка `s.t`,
статья `v:'a'/version:2`, `txidEdit`/`txidRepost`.

---

## 2. Файлы, которые предстоит создать

```
src/b-components/content/post-composer/
└── composer-video.vue        # P3 (заблокировано): выбор/привязка загруженного видео (интеграция с video-uploader)
```

---

## 3. Roadmap (оставшееся)

### P3 — Видео и аудио
- ✅ **Видео по ссылке** (youtube/vimeo/peertube): `parse-video-url.ts` (авто-детект из текста поста) +
  `composer-url-preview.vue` (iframe youtube/vimeo, badge для peertube); `u`=ссылка, поле заголовка для
  peertube-видео. Готово.
- **Загрузка своего видео** — ⛔ заблокировано: в `src/b-components/video-uploader/` нет реальной
  загрузки на узел (только транскод). Когда появится: результат → `peertube://host/id` в `u`,
  `composer-video.vue` (интеграция с аплоадером). См. `VIDEO_RELIABILITY_PLAN.md` (D1/D2).
- OG-превью обычных (не-видео) веб-ссылок — нужен метаданные-эндпойнт ноды (отдельный блокер).

### P5 — осталась только платная видимость (опрос ✅, отложка ✅)
- ✅ **Опрос**: `composer-poll.vue` (тоггл + вопрос + ≤5 вариантов) → `p = { title, list }`; валидация
  `pollTitle`/`pollOptions`, опрос считается контентом. Не входит в хэш serialize.
- ✅ **Отложенная публикация**: `datetime-local` в `composer-settings.vue` → `settings.t=<unix>` →
  `delayedNtime` (locktime/nTime). Не входит в хэш serialize.
- **Платная видимость** `f='3'`: опция уже в `composer-settings.vue` (с P2) — осталась только
  проверка наличия платной подписки (нужен API подписок ноды); стримы (`settings.c`) — опционально.

---

## 4. Оставшиеся риски

- Готовность `video-uploader` (живая загрузка/транскод) блокирует полноценный P3.
- Доступность/контракт peertube-эндпоинта загрузки картинок (см. §0) — общий риск и для медиа в P3.
- Несовпадение `serialize()` статьи/видео с ожиданием ноды — подтвердить на первой живой публикации каждого типа.

---

## Приложение. Ключевые ссылки

**Legacy-эталон:**
- `___original-repos/pocketnet.gui/components/share/index.js` — UI-композер (≈3090 строк)
- `___original-repos/pocketnet.gui/js/kit.js:1450-1839` — класс `Share` (serialize/export/typeop/validation)
- `___original-repos/pocketnet.gui/js/peertube.js` — резолв peertube-сервера (`proxy.best`, `getservers`)
- `___original-repos/pocketnet.gui/components/uploadpeertube/`, `components/video/` — видео-флоу

**Опора в nextgen:**
- `src/b-components/content/post-composer/` — готовые P0–P2 (образец для новых под-компонентов)
- `src/blockchain/core/actions/post-action.ts` — serialize/export/operationType (video/audio/article учтены)
- `src/b-components/video-uploader/` + [VIDEO_RELIABILITY_PLAN.md](./VIDEO_RELIABILITY_PLAN.md) — видео (для P3)
- `src/helpers/api/peertube-parser.ts`, `peertube-api.ts`, `peertube-url.ts` — парсинг/инфо peertube (для P3)
- `src/b-components/content/post-card/post-card.vue` — превью поста (для P4-репоста)
