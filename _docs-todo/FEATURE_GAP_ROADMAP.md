# Roadmap: остаток работ (паритет с pocketnet.gui)

> Что ещё не хватает в **bastyon-nextgen** по сравнению с легаси **pocketnet.gui**
> (`/private/var/www/pocketnet/___original-repos/pocketnet.gui`).
>
> Сделанное убрано. **Закрыто и здесь больше не перечисляется:** P0-1 follow/subscribe,
> P0-3 донат, весь P1 («нарисовано, но не работает» — фильтр даты/сортировка/тоггл
> «Сначала лучшее»→gettopfeed, язык контента, QR-логин, zaddress, getaccountearning,
> limits-CTA), P2-блок «Социальный граф / профиль» (списки подписчиков/подписок,
> block-UI + чёрный список, onboarding/welcome).
>
> Документ — карта **остатка**, сгруппированная по приоритетам. Детальные таблицы по
> доменам (только незакрытые строки) — в конце.

**Легенда статусов:** 🟡 частично/заглушка · ❌ нет · 🔌 UI есть, не подключено к RPC · ➖ осознанно вне скоупа

**Принцип** (см. память `principle_decentralization`): мнемоника-only, без SSO/посредников,
работа standalone. Поэтому ряд легаси-фич (email/SSO, node-control, FCM-пуши, electron-обвязка)
— **намеренно вне скоупа**, см. соответствующий раздел.

> ⚠️ Статусы отражают состояние кода на дату правки — перед работой над пунктом
> верифицировать, что он ещё актуален. Ряд реализованного **не верифицирован на живой
> ноде** (нет стенда) — это отдельный пласт проверки, не покрытый этим документом.

---

## Q-PLAN: приоритеты

### 🔴 P0 — разрывы базовых сценариев (остаток)

1. 🟡 **Редактирование профиля.** Сделано имя/about/сайт/язык/аватар
   (`profile-update-action.ts`, `edit-profile-modal.vue`). Осталось: **обложка**
   (отдельный `accSet`-tx — нет write-кода), крипто-адреса.
2. 🟡 **История транзакций кошелька.** Сделана вкладка «История» (received/sent,
   пагинация). Осталось: история по доп. Z-адресам отдельным списком; резолв
   контрагента в ник; семантичный `transactionview` (донат/стейк/буст).
3. ❌ **Загрузка видео на PeerTube** (`uploadpeertube`, `videoCabinet`). nextgen только
   транскодит в локальный IndexedDB; публикации на ноду нет; `pages/my-videos-page` — заглушка.
   *Метаданные при загрузке (название/описание/теги/NSFW/обложка) — тоже отсутствуют.*
4. ❌ **Удаление своего поста** + **жалоба/репорт на пост и коммент** (`complain`, 6 категорий
   включая CSAM). Удаление есть только у комментариев; модуля жалоб нет вовсе — это ещё и
   safety/легал-требование сторов.

### 🟡 P2 — крупные недостающие фичи (по доменам)

**Лента / дискавери**
- On-chain коллекции (`collections`/`newcollection`) — **отложено**: крупная on-chain фича
  (создание = `newcollection` tx уровня композера + `getprofilecollections`), нужен отдельный
  проход и верификация. Сейчас только локальные «Избранное».
- *(Сделано: виджет «Рекомендуемые пользователи» `recommended-users` в правом сайдбаре;
  бустед-лента `getboostfeed` секцией «Продвигаемое» вверху главной; бейджи «новые посты» —
  облегчённая версия: пилюля «Показать новые посты» по фоновой проверке головы ленты.)*

**Посты / контент**
- Внешний шаринг (TG/FB/Twitter/VK/Reddit) и **copy-link на сам пост** (есть только на коммент).
- OG-превью ссылок (нужен эндпоинт метаданных ноды).
- Буст поста (`boost`/`liftUpThePost`) — оплата продвижения.
- @-меншены и эмодзи-пикер в простом композере (в редакторе статей тулбар уже есть).
- Редактор изображений crop/rotate/фильтры (`imageGalleryEdit`); embed-код (`embeding`).
- NSFW-флаг поста.

**Кошелёк / монетизация**
- QR на приём (util `qr-code.ts` есть, в receive-флоу не подключён).
- Платные подписки: подписаться за плату + управление условиями
  (`getpaidsubscription`/`managepaidsubscription`).
- Стейкинг: калькулятор (`staking`) + реальные cold-staking/HTLS-транзакции (`wallet/stake.html`).
- Дашборд рекламы (`advertising`); расширенный earnings (периоды/breakdown — сейчас базовая
  вкладка с тремя суммами).
- Fast-send/батч-платежи (`fastsend`), платёжные ссылки (`createpaymentlink`).
- Динамические комиссии (сейчас фикс `DEFAULT_TX_FEE = 1e-8`), реальный buy/sell (есть только график).

**Видео**
- Picture-in-Picture, субтитры/captions.
- Редактирование/удаление **опубликованного** видео (`editVideoDescription`; сейчас удаляются
  только локальные блобы), квоты загрузки, выбор обложки.
- Лайв-стриминг (`streampeertube`) — осознанно отложен как отдельная инициатива.

**Мессенджер**
- Звонки voice/video (`BastyonCalls` + `m.call.*`) — весь WebRTC-стек.
- Reply / edit / delete / forward сообщений (кроме реакций — ничего).
- Создание групп, инвайты, управление участниками, инфо/настройки комнаты.
- Поиск по сообщениям; typing-индикаторы; block/mute; стикеры.
- Браузерные/пуш-уведомления (сейчас только in-app звук-бип).

**Мини-аппы / инфра**
- Дев-тулинг: создать/редактировать/опубликовать своё приложение (`devapplications`).
- UI просмотра/отзыва пермишенов (граны персистятся, экрана нет).
- Страница приложения с рейтингом/репортом (`applicationmeta`); фильтр каталога по категориям.
- Выбор backend-ноды / SnowFlake / direct-proxy (`transportsmanagement`; сейчас авто-выбор).
- Диагностика (`diagnosticsPage`), статистика контента (`statistic`).

**Уведомления / прочее**
- Донат-уведомления: `tip` есть в типах, но нет маппинга `mesType→tip` (`notifications-mappers.ts`).
- Анимация монеток при донате (`donateAnimations`).
- Лента активностей (`activities`); виджет репутации/бейджей (`ustate`) — сейчас частично.
- Реалтайм-уведомления: сейчас polling 30с вместо WS-пуша `clbks.added`.
- Реальные звуки уведомлений (сейчас синтез-бип; `sounds/*.mp3` не перенесены).

### 🟢 P3 — инфо/легал/полировка

- Инфо-страницы: about / FAQ / help / terms / CSAE policy / support + footer
  (нужны для app-store/легал-комплаенса).
- NSFW/privacy-секции в настройках; пустые табы настроек wallets/accounts/system — заглушки.
- Тег-облако с весами и clear-all (`tagcloud`); `slides` промо-тикер; related-видео на пост-странице.

---

## ➖ Осознанно вне скоупа (не считать пробелами)

- Email/SSO/соц-логин/серверное восстановление аккаунта; управление сессиями/устройствами
  (нет серверного аккаунта — модель self-custody).
- `nodecontrol`, `easynode`, `updatenotifier`, `electronnav`, `testApi` — node-operator/electron.
- Firebase/FCM фоновые пуши (`firebase-messaging-sw.js`) — зависимость от Google.
- Нативная Matrix Olm/Megolm-крипта — обе стороны используют свой pcrypto (ECDH+AES на ключах профиля).
- Импорт телефонных контактов (`invite/listPhoneContacts`) — cordova-only.
- `dust`-sweep по приватному ключу — конфликтует с мнемоника-only.
- P2P/WebRTC шеринг сегментов видео (`p2pvideo.js`) — отложено осознанно (`VIDEO_RELIABILITY_PLAN.md`).
- `camerapreview`/`media.js` — cordova-камера; веб-захват камеры под вопросом (решение продукта).

---

## Приложение: детальные таблицы по доменам (только незакрытые строки)

### A. Лента, дискавери, навигация

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Мобильная нижняя навигация | bnavigation | 🟡 | drawer-гамбургер, не bottom-bar |
| Коллекции (on-chain) | collections | ❌ | отложено (крупная on-chain фича); сейчас локальные «Избранное» |

### B. Посты, статьи, комментарии, голосование, шаринг, модерация

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Видимость (all/subs/registered/paid) | share | 🟡 | paid без проверки наличия подписки |
| Загрузка своего видео в композер | uploadpeertube | 🟡 | блокирован реальной загрузкой (см. P0-3) |
| Удаление своего поста | post | ❌ | есть только у комментов |
| @-меншены / эмодзи в простом композере | share | ❌ | textarea без меншенов |
| OG-превью ссылок | embeding | ❌ | нужен эндпоинт ноды |
| NSFW-флаг поста | share/post | ❌ | нет нигде |
| Жалоба на коммент | complain | ❌ | в `comment-menu.vue` нет репорта |
| Жалоба/репорт на пост | complain | ❌ | модуль (6 категорий) не перенесён |
| Copy-link на пост | socialshare2 | 🟡 | только на коммент |
| Внешний соц-шаринг | socialshare2 | ❌ | нет sharer-URL |
| Embed-код (iframe) | embeding | ❌ | — |
| Редактор изображений (crop/фильтры) | imageGalleryEdit | ❌ | — |
| Буст поста | boost | 🟡 | только парсинг в explorer |
| Скачать медиа | downloadMedia | ❌ | (частично cordova-скоуп) |

### C. Видео и медиа

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Picture-in-Picture | Plyr/native | ❌ | — |
| Субтитры/captions | peertube embed | ❌ | — |
| Загрузка на PeerTube (chunked/resumable) | uploadpeertube + video-uploader.js | ❌ | только локальный транскод (см. P0-3) |
| Импорт видео по URL | uploadpeertube | ❌ | — |
| Прогресс загрузки на сервер | uploadpeertube | 🟡 | показывает только транскод |
| Обложка/название/теги/NSFW при загрузке | videoCabinet/editVideoDescription | ❌ | модалка display-only |
| Видео-кабинет / my-videos (список, статы, поиск) | videoCabinet (2036 строк) | ❌ | `my-videos-page.vue` — заглушка |
| Edit/Delete опубликованного видео | videoCabinet | 🟡 | удаляет только локальные блобы |
| Квота загрузки / ability-gating | abilityincrease/ustate | ❌ | — |
| Лайв-стриминг (go-live + watch) | streampeertube | ❌ | отложено осознанно |
| P2P-шеринг сегментов | p2pvideo.js | ➖ | вне скоупа |
| Камера/захват | camerapreview | ➖ | cordova; веб-захват — решение продукта |

### D. Кошелёк, платежи, монетизация

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Несколько адресов | wallet | 🟡 | add (max 20), без rename/remove/import |
| Приём — QR | wallet/depositqrmaker | ❌ | util есть, не подключён в receive-флоу |
| Комиссии | wallet/fastsend | 🟡 | фикс `1e-8`, нет динамической оценки |
| Детали транзакции (семантика) | transactionview | 🟡 | только generic explorer-tx |
| Fast-send / батч | fastsend | ❌ | — |
| Платёжные ссылки | createpaymentlink | ❌ | — |
| Анимация доната | donateAnimations | ❌ | только star-explosion |
| Буст поста | boost | ❌ | — |
| Стейкинг (калькулятор) | staking | ❌ | — |
| Cold-staking / HTLS tx | wallet/stake.html | ❌ | — |
| Платная подписка — подписаться | getpaidsubscription | ❌ | — |
| Платная подписка — условия (креатор) | managepaidsubscription | ❌ | — |
| Дашборд заработка — периоды/breakdown | earnings | 🟡 | базовая вкладка (3 суммы), без периодов/детализации |
| Реклама/boost-earnings | advertising | ❌ | — |
| График цены | pkoin/staking | 🟡 | CoinGecko-график, без buy/sell |
| How-to-buy | howtobuy | ❌ | — |

### E. Мессенджер / чат

> Оригинал: `bastyon-chat/src` (Vue 2). Крипта обеих сторон — свой pcrypto (не Olm/Megolm).

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Группы (чтение/отправка) | teamroom | 🟡 | можно читать/писать, **создавать нельзя** |
| Read-receipts отображение чужих | mtrx | 🟡 | отправка есть; отображение чужих unread — нет |
| Reply / edit / delete / forward | events/* | ❌ | только реакции |
| Typing-индикаторы | input sendTyping | ❌ | — |
| Поиск по сообщениям | searchEngine.js | ❌ | — |
| Создание комнат / инвайты / админ комнаты | chat/create, teamroom | ❌ | только `createDirectRoom` |
| Звонки voice/video (WebRTC) | BastyonCalls | ❌ | весь стек отсутствует |
| Block/unblock, mute | mtrx, chatInfo | ❌ | — |
| Уведомления (звук+браузер) | notifier.js | 🟡 | только in-app звук |
| Стикеры | emoji.js+стикеры | ❌ | эмодзи есть, стикеров нет |

### F. Авторизация, аккаунты, профиль, настройки

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Репутация / бейджи | author | 🟡 | репутация есть, бейджей нет |
| Редактирование профиля | author, usersettings | 🟡 | обложка/крипто-адреса — нет (см. P0-1) |
| Настройки: NSFW/privacy | usersettings | ❌ | — |
| Настройки: табы wallets/accounts/system | usersettings | 🟡 | заглушки |
| Инфо-страницы (about/FAQ/help/terms/CSAE/support/footer) | about/faq/... | ❌ | нужно для сторов |
| Email/SSO/серверное восстановление | registration | ➖ | вне скоупа |

### G. Мини-аппы, dev-tools, инфра

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Host→app push-события | index.js | 🟡 | нет `permissionchange`, action-status |
| Каталог: фильтр по категориям | applications | ❌ | loader поддерживает `tags`, UI нет |
| Страница аппа (рейтинг/репорт/install count) | applicationmeta | 🟡 | install/fav есть, остального нет |
| UI отзыва пермишенов | applicationmeta | 🟡 | граны персистятся, экрана нет |
| Дев-тулинг (create/edit/publish app) | devapplications | ❌ | — |
| Sideload/local-override манифеста | devapplication | 🟡 | есть в коде, UI нет |
| Embed произвольного URL | anothersite | ❌ | — |
| Node control / easy-node | nodecontrol, easynode | ➖ | вне скоупа |
| Transports management (выбор ноды/SnowFlake) | transportsmanagement | 🟡 | Tor-toggle есть, выбора ноды нет |
| Diagnostics page | diagnosticsPage | ❌ | — |
| Статистика контента | statistic | ❌ | — |

> **SDK мини-аппов** перенесён ≈1:1 (~40 экшенов, включая `zaddress`). Остаток расхождений:
> `serviceWorker.*` alt-transport (❌ host-side не подключён), push-события
> `permissionchange`/action-status (🟡).

### H. Уведомления, поиск, captcha, прочее

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Тип: mention | (mention) | 🟡 | в union есть, маппинга нет |
| Тип: донат/tip (PKOIN received) | transactions/win | ❌ | `tip` без `mesType`-маппинга |
| Realtime-обновления | WS clbks.added | 🟡 | polling 30с вместо WS-пуша |
| Звук-алерты | ion.sound + sounds/*.mp3 | 🟡 | синтез-бип, без ассетов |
| Тег-облако (веса, clear-all) | tagcloud | 🟡 | список тегов есть, облака нет |
| Анимация монеток при донате | donateAnimations | ❌ | — |
| Лента активностей | activities | ❌ | только pending-ratings |
| Виджет репутации (ustate) | ustate | 🟡 | частично (limits-page) |
| `slides` промо-тикер | slides | ❌ | — |
