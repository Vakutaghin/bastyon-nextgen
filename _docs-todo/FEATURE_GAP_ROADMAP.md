# Roadmap: паритет с оригиналом (pocketnet.gui)

> Чего не хватает в **bastyon-nextgen** по сравнению с легаси **pocketnet.gui**
> (`/private/var/www/pocketnet/___original-repos/pocketnet.gui`). Сравнение сделано по
> ~117 фич-модулям оригинала (`components/<name>/`, `chat/`, `js/lib/apps/`) против
> `src/pages|b-components|stores|composables|blockchain|mini-apps`.
>
> **Главное:** ядро уже перенесено (лента, пост-карточка, комментарии, рейтинги,
> мессенджер с E2EE+медиа, мини-аппы с почти полным SDK, кошелёк-перевод, авторизация
> по мнемонике, мульти-аккаунт). Но **социальная петля разорвана** (нет подписок и
> редактирования профиля), **монетизация почти отсутствует**, **видео-загрузка не
> завершена**, и есть пласт **«нарисовано, но не подключено к RPC»**.
>
> Документ — карта остатка работ, сгруппированная как роадмап по приоритетам.
> Детальные таблицы по доменам — в конце.

**Легенда статусов:** ✅ готово · 🟡 частично/заглушка · ❌ нет · 🔌 UI есть, не подключено к RPC · ➖ осознанно вне скоупа · 🆕 нового нет в оригинале (nextgen впереди)

**Принцип** (см. память `principle_decentralization`): мнемоника-only, без SSO/посредников,
работа standalone. Поэтому ряд легаси-фич (email/SSO, node-control, FCM-пуши, electron-обвязка)
— **намеренно вне скоупа**, см. соответствующий раздел.

---

## Q-PLAN: приоритеты

### 🔴 P0 — разрывы базовых сценариев (делать первым)

Без этого продукт не замкнут как соцсеть/кошелёк.

1. ✅ **Подписка/фоллоу на пользователя.** Реализованы on-chain `subscribe`/`unsubscribe`/`subscribePrivate`
   (`blockchain/core/actions/user-relations-action.ts`, формат 1:1 с legacy kit.js). Состояние подписок —
   в `stores/user-relations-store.ts` (гидрация `getusersubscribes`, оптимистичные апдейты с откатом),
   сбрасывается при signOut. UI — кнопка «Подписаться/Вы подписаны» + тоггл-колокольчик приватной
   подписки в `profile-sidebar.vue`. Вкладка «Подписки» наполняется (`getsubscribesfeed` уже был
   подключён в `feed-queries.ts`, авто-enable по авторизации). *Live on-chain TX не верифицирован.*
   Осталось (опц.): кнопка фоллоу прямо в карточке поста, списки подписчиков/подписок (см. P2).
2. 🟡 **Редактирование профиля** — реализован update-flow для **имя/about/сайт/язык/аватар**
   (`blockchain/core/actions/profile-update-action.ts` шлёт `userInfo`-tx через готовый
   serializeUserInfo; ключи мессенджера ре-деривятся, крипто-адреса сохраняются). UI —
   `edit-profile-modal.vue` + кнопка «Редактировать» на своём профиле; аватар грузится через
   `image-upload-service` (peertube). *Live on-chain TX не верифицирован.*
   Осталось: **обложка** (отдельный `accSet`-tx — нет write-кода), крипто-адреса.
   *«Соцссылки» в legacy-модели не существуют (поле `b`/addresses — это крипто-кошельки).*
3. **Чаевые/донат автору** (на пост и на комментарий). `donate`/`pkoin` → `sendToAuthor`.
   В nextgen `donate`-упоминания — только парсинг payload/веса, UI отправки нет.
4. **История транзакций кошелька** (`transactionslist` + `transactionview`).
   Сейчас своих отправленных/полученных PKOIN не видно (только косвенный explorer-by-address).
5. **Загрузка видео на PeerTube** (`uploadpeertube`, `videoCabinet`). nextgen только
   транскодит в локальный IndexedDB; публикации на ноду нет; `pages/my-videos-page` — заглушка.
   *Метаданные при загрузке (название/описание/теги/NSFW/обложка) — тоже отсутствуют.*
6. **Удаление своего поста** + **жалоба/репорт на пост и коммент** (`complain`, 6 категорий
   включая CSAM). Удаление есть только у комментариев; модуля жалоб нет вовсе — это ещё и
   safety/легал-требование сторов.

### 🟠 P1 — «нарисовано, но не работает» (дешёвый выигрыш)

UI присутствует и пишет в стор, но **значение не уходит в RPC** — выглядит готовым, но инертно.
Чинится точечно, эффект заметный.

- **Фильтр по дате ленты** (сегодня/неделя/…): `activeTimeFilter` никуда не передаётся
  (`stores/filters-store.ts`, `composables/use-infinite-feed.ts`).
- **Сортировка главной ленты** (популярность/дата/рейтинг): `use-infinite-feed` игнорит
  `orderby` (работает только в профиле — `useProfileFeedWithFilters`).
- **Тоггл «Сначала лучшее»** (`topFirst`): переключается и сохраняется, ни на что не влияет
  (`buildAllTags`/`buildContentTypes` его не читают).
- **Язык контента захардкожен `'ru'`** (`content-feed.vue`, `use-infinite-feed.ts`) — нет
  селектора, не-русские получают русскую ленту.
- **`readQRCode()`** бросает «not implemented» (`blockchain/utils/qr-code.ts`) → нет логина по
  QR и нет QR-сканера (`qrscanner`).
- **`zaddress`** (мини-апп SDK) — стаб, бросает `broken:zaddresses` (`mini-apps/actions/account.ts`);
  блокирован отсутствием `system16`. Любой апп на z-address ломается.
- **`getaccountearning`** — TODO-заглушка типа (`rpc-requests/get-account-earning.ts`), UI нет.
- **Limits page** — read-only; нет CTA «увеличить лимит/abilityincrease» когда лимит достигнут.

### 🟡 P2 — крупные недостающие фичи (по доменам)

**Социальный граф / профиль**
- Списки подписчиков/подписок (есть только счётчики в `profile-sidebar.vue`, не кликабельны).
- Кнопка block в UI (логика в сторе есть, контрола в профиле/посте нет) + экран чёрного списка.
- Онбординг/welcome после регистрации.

**Лента / дискавери**
- Виджет «Рекомендуемые пользователи» (правый сайдбар; сейчас там только LastComments).
- On-chain коллекции (`collections`/`newcollection`); сейчас только локальные «Избранное».
- Бейджи «новые посты» на вкладках (`lentaunseen`); бустед-лента (`getboostfeed`).
- Алгоритмическая лента «Лучшее/Recommended» (`useTopFeed`/`getTopFeed` написан, но не подключён).

**Посты / контент**
- Внешний шаринг (TG/FB/Twitter/VK/Reddit) и **copy-link на сам пост** (есть только на коммент).
- OG-превью ссылок (нужен эндпоинт метаданных ноды).
- Буст поста (`boost`/`liftUpThePost`) — оплата продвижения.
- @-меншены и эмодзи-пикер в простом композере (в редакторе статей тулбар уже есть).
- Редактор изображений crop/rotate/фильтры (`imageGalleryEdit`); embed-код (`embeding`).

**Кошелёк / монетизация**
- QR на приём (util `qr-code.ts` есть, в receive-флоу не подключён).
- Платные подписки: подписаться за плату + управление условиями
  (`getpaidsubscription`/`managepaidsubscription`).
- Стейкинг: калькулятор (`staking`) + реальные cold-staking/HTLS-транзакции (`wallet/stake.html`).
- Дашборд заработка/рекламы (`earnings`/`advertising`).
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
- QR-сканер (`qrscanner`); анимация монеток при донате (`donateAnimations`).
- Лента активностей (`activities`); виджет репутации/бейджей (`ustate`) — сейчас частично.
- Реалтайм-уведомления: сейчас polling 30с вместо WS-пуша `clbks.added`.
- Реальные звуки уведомлений (сейчас синтез-бип; `sounds/*.mp3` не перенесены).

### 🟢 P3 — инфо/легал/полировка

- Инфо-страницы: about / FAQ / help / terms / CSAE policy / support + footer
  (нужны для app-store/легал-комплаенса).
- NSFW/privacy-секции в настройках; пустые табы настроек wallets/accounts/system — заглушки.
- Тег-облако с весами и clear-all (`tagcloud`); `slides` промо-тикер; related-видео на пост-странице.

---

## ✅ Где nextgen уже впереди оригинала

- **Block explorer** — нативный (`pages/block-explorer-page/`: block/tx/address/peers, network
  stats, top-addresses, WS-live). В оригинале нативного не было — только ссылка на внешний апп.
- **Клиентский Tor-транспорт** (`stores/tor-store.ts`, `helpers/tor/tor-websocket.ts`, Tauri
  SOCKS5 + bridges). В оригинале Tor был только на стороне ноды/desktop.
- **Браузерное транскодирование видео** (ffmpeg.wasm single-thread; `video-uploader/transcoder/`).
  В оригинале транскод был только electron-native.
- **Аудио-визуализатор** в плеере (`components/audio-visualizer/`) — в оригинале не было.
- **SDK мини-аппов перенесён почти 1:1** (~40 экшенов; расхождения только `zaddress` + service-worker
  alt-transport). См. таблицу SDK ниже.
- **Structured search history** в IDB (по kind: query/user/tag/app) — богаче оригинала.

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

## Приложение: детальные таблицы по доменам

### A. Лента, дискавери, навигация

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Дефолт-лента (hierarchical strip) | lenta, main | ✅ | `helpers/feed-queries.ts` → `getHierarchicalStrip` |
| Лента подписок | lenta `r=sub` | ✅ | Подписка реализована (P0-1), фид `getsubscribesfeed` наполняется |
| «Обсуждаемое» (most-commented) | lenta | ✅ | `getMostCommentedFeed`, 24h |
| Video/Audio/Articles фильтры | lenta, leftpanel | ✅ | `buildContentTypes()` |
| Тег/категория фильтр | tagcloud, categories | ✅ | `buildAllTags()`, sidebar-tags/categories |
| Custom-категории | addcategory | ✅ | `filters-store.addCustomCategory` (IDB) |
| Бесконечный скролл | lenta | ✅ | `use-infinite-feed.ts` IntersectionObserver |
| Фильтр по дате | lenta | 🔌 | UI есть, не уходит в RPC |
| Сортировка главной ленты | lenta | 🔌 | `orderby` игнорится в главной ленте |
| Тоггл «Сначала лучшее» | leftpanel | 🔌 | `topFirst` инертен |
| Язык контента | lenta (SDK lang) | 🔌 | Захардкожен `'ru'` |
| «Лучшее/Recommended» лента | lenta `r=best` | ❌ | `getTopFeed` написан, не подключён |
| Бустед-strip | lenta `getboostfeed` | ❌ | — |
| Виджет «Рекомендуемые юзеры» | recommendedusers, panel | ❌ | sidebar-right только LastComments |
| Last comments виджет | lastcomments | ✅ | `last-comments.vue` → `getLastComments` |
| Коллекции (on-chain) | collections | ❌ | только локальные «Избранное» |
| Избранное/закладки | lenta `r=saved` | ✅ | `fetchFavoritesFeed` (IDB) |
| Левое меню / топ-панель | leftpanel, toppanel | ✅ | `sidebar-left`, `header/*` |
| Мобильная нижняя навигация | bnavigation | 🟡 | drawer-гамбургер, не bottom-bar |
| Профиль/канал | channel | 🟡 | subscribe-кнопка есть (P0-1); block-кнопки и списков фолловеров нет |
| Список юзеров (followers/following) | userslist | ❌ | только счётчики |
| Бейджи «новые посты» на вкладках | leftpanel `lentaunseen` | ❌ | — |

### B. Посты, статьи, комментарии, голосование, шаринг, модерация

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Простой/картиночный/видео-по-ссылке пост | post, share | ✅ | composer P0–P2 |
| Статья (Editor.js) — создание/рендер | articlev | ✅ | `composer-article-editor.vue`, `block-content.vue` |
| Репост, редактирование поста | post, share | ✅ | mode repost/edit (live TX не верифицирован) |
| Теги (+автокомплит), опросы, язык, расписание, черновик | share, taginput | ✅ | composer-tags/poll/settings |
| Видимость (all/subs/registered/paid) | share | 🟡 | paid без проверки наличия подписки |
| Загрузка своего видео в композер | uploadpeertube | 🟡 | блокирован реальной загрузкой (см. P0-5) |
| Удаление своего поста | post | ❌ | есть только у комментов |
| @-меншены / эмодзи в простом композере | share | ❌ | textarea без меншенов |
| OG-превью ссылок | embeding | ❌ | нужен эндпоинт ноды |
| NSFW-флаг поста | share/post | ❌ | нет нигде |
| Комментарии: пост/реплай/edit/delete/голос/deep-link/картинки | comments | ✅ | полный набор |
| Жалоба на коммент | complain | ❌ | в `comment-menu.vue` нет репорта |
| Star-rating 1–5 на пост | postscores | ✅ | `star-rating.vue` + гейтинг по репутации |
| Жалоба/репорт на пост | complain | ❌ | модуль (6 категорий) не перенесён |
| Copy-link на пост | socialshare2 | 🟡 | только на коммент |
| Внешний соц-шаринг | socialshare2 | ❌ | нет sharer-URL |
| Embed-код (iframe) | embeding | ❌ | — |
| Лайтбокс галереи | imagegallery | ✅ | `image-gallery.vue` |
| Редактор изображений (crop/фильтры) | imageGalleryEdit | ❌ | — |
| Донат на пост/коммент | donate | ❌ | см. P0-3 |
| Буст поста | boost | 🟡 | только парсинг в explorer |
| Скачать медиа | downloadMedia | ❌ | (частично cordova-скоуп) |

### C. Видео и медиа

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Воспроизведение в ленте (peertube HLS) | post/Plyr | ✅ | `video-player.vue` + hls.js / native Safari |
| Контролы, качество (manual+ABR), fullscreen | Plyr | ✅ | composables use-video-* |
| Автоплей/пауза по скроллу, mutual-pause | post | ✅ | `use-video-element-events.ts` |
| Фоновое воспроизведение / lock-screen | mobile.backgroundMode | ✅ | `plugins/background-media` (MediaSession) |
| Скорость, хоткеи, главы/таймкоды, аудио-визуализатор | partial | ✅🆕 | улучшение vs оригинал |
| Picture-in-Picture | Plyr/native | ❌ | — |
| Субтитры/captions | peertube embed | ❌ | — |
| Загрузка на PeerTube (chunked/resumable) | uploadpeertube + video-uploader.js | ❌ | только локальный транскод (см. P0-5) |
| Импорт видео по URL | uploadpeertube | ❌ | — |
| Прогресс загрузки на сервер | uploadpeertube | 🟡 | показывает только транскод |
| Транскодинг | electron native | ✅🆕 | ffmpeg.wasm + tauri (live не верифицирован) |
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
| Баланс (main/additional/total) | wallet | ✅ | `wallets-page.vue` balances |
| Несколько адресов | wallet | 🟡 | add (max 20), без rename/remove/import |
| Приём — адрес+copy | wallet | ✅ | wallet-transfer receive |
| Приём — QR | wallet/depositqrmaker | ❌ | util есть, не подключён |
| Отправка PKOIN | wallet | ✅ | receiver по login/адресу, message, feemode |
| Комиссии | wallet/fastsend | 🟡 | фикс `1e-8`, нет динамической оценки |
| Форматирование сумм | platform.mp.coin | ✅ | `pkoin-formatter.ts` |
| История транзакций | transactionslist | ❌ | см. P0-4 |
| Детали транзакции (семантика) | transactionview | 🟡 | только generic explorer-tx |
| Fast-send / батч | fastsend | ❌ | — |
| Платёжные ссылки | createpaymentlink | ❌ | — |
| Чаевые/донат автору | donate | ❌ | см. P0-3 |
| Анимация доната | donateAnimations | ❌ | только star-explosion |
| Буст поста | boost | ❌ | — |
| Стейкинг (калькулятор) | staking | ❌ | — |
| Cold-staking / HTLS tx | wallet/stake.html | ❌ | — |
| Abilities/limits increase | abilityincrease | 🟡 | limits read-only, без CTA |
| Платная подписка — подписаться | getpaidsubscription | ❌ | — |
| Платная подписка — условия (креатор) | managepaidsubscription | ❌ | — |
| Дашборд заработка | earnings | ❌ | `getaccountearning` — TODO-стаб |
| Реклама/boost-earnings | advertising | ❌ | — |
| График цены | pkoin/staking | 🟡 | CoinGecko-график, без buy/sell |
| How-to-buy | howtobuy | ❌ | — |
| Mini-app payment dialog | js/lib/apps | ✅ | `mini-app-payment-modal.vue` |

### E. Мессенджер / чат

> Оригинал: `bastyon-chat/src` (Vue 2). Крипта обеих сторон — свой pcrypto (не Olm/Megolm).

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Логин/сессия по blockchain-identity | mtrx.js | ✅ | `matrix-service/auth.ts` |
| Список диалогов, 1-1 чат | chats, chat | ✅ | — |
| Группы (чтение/отправка) | teamroom | 🟡 | можно читать/писать, **создавать нельзя** |
| Текст/изображения/файлы/голос/видео | chat/* | ✅ | media-sender + компоненты |
| PKOIN-перевод в чате | tip events | ✅ | `pkoin-transfer-modal` |
| Превью ссылок, реакции, эмодзи-пикер | previews, reactions | ✅ | — |
| E2EE (pcrypto, в т.ч. групповой shared-key) | pcrypto.js | ✅ | group-encryption.ts |
| Read-receipts (отправка) / unread-счётчики | mtrx | ✅ | отправка есть; **отображение чужих — нет** |
| Reply / edit / delete / forward | events/* | ❌ | только реакции |
| Typing-индикаторы | input sendTyping | ❌ | — |
| Поиск по сообщениям | searchEngine.js | ❌ | — |
| Создание комнат / инвайты / админ комнаты | chat/create, teamroom | ❌ | только `createDirectRoom` |
| Звонки voice/video (WebRTC) | BastyonCalls | ❌ | весь стек отсутствует |
| Block/unblock, mute | mtrx, chatInfo | ❌ | — |
| Уведомления (звук+браузер) | notifier.js | 🟡 | только in-app звук |
| Стикеры | emoji.js+стикеры | ❌ | эмодзи есть, стикеров нет |
| Leave/delete диалог | leave room | ✅ | — |

### F. Авторизация, аккаунты, профиль, настройки

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Создание аккаунта (12 слов) | registration | ✅ | `auth-store.register()` |
| Backup-фраза / показ seed | registration, accounts | ✅ | `mnemonic-modal.vue` |
| Логин/импорт mnemonic/WIF/hex | authorization | ✅ | `recoverKeyPair()` |
| Логин по QR | authorization, qrscanner | ❌ | `readQRCode()` бросает |
| Мульти-аккаунт switch/add/remove | accounts, addaccount | ✅ | `account-switcher.vue` |
| Sign out / restore session | user.js | ✅ | AES-encrypted persist |
| Просмотр профиля (аватар/обложка/bio/статы) | author, userpage | ✅ | profile-page/sidebar/cover |
| Репутация / бейджи | author | 🟡 | репутация есть, бейджей нет |
| **Редактирование профиля** | author, usersettings | 🟡 | P0-2: имя/about/сайт/язык/аватар ✅; обложка/крипто-адреса — нет |
| **Follow/subscribe** | author | ✅ | P0-1: кнопка в `profile-sidebar`, on-chain (live TX не верифицирован) |
| Subscribe-privately | author | ✅ | P0-1: тоггл-колокольчик уведомлений в `profile-sidebar` |
| Block/mute юзера | author, usersettings | 🟡 | логика есть, кнопки/списка нет |
| Списки подписчиков/подписок | userpage | ❌ | только счётчики |
| Настройки: язык/тема/нотификации/key-export | usersettings | ✅ | settings-page tabs |
| Настройки: NSFW/privacy | usersettings | ❌ | — |
| Настройки: табы wallets/accounts/system | usersettings | 🟡 | заглушки |
| Permission-requests (мини-аппы) | requestpermission | ✅ | `permission-resolver.ts` |
| Онбординг/welcome | welcome | ❌ | — |
| Инфо-страницы (about/FAQ/help/terms/CSAE/support/footer) | about/faq/... | ❌ | нужно для сторов |
| Email/SSO/серверное восстановление | registration | ➖ | вне скоупа |

### G. Мини-аппы, dev-tools, инфра

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Запуск аппа в sandbox-iframe | application | ✅ | `mini-app-frame.vue` |
| postMessage RPC-мост | js/lib/apps/index.js | ✅ | `core/bridge.ts` |
| Host→app push-события | index.js | 🟡 | нет `permissionchange`, action-status |
| Каталог: browse/search | applications, miniapps | ✅ | remote `getapps` |
| Каталог: фильтр по категориям | applications | ❌ | loader поддерживает `tags`, UI нет |
| Install/favorite | applicationmeta | ✅ | favorites-store |
| Страница аппа (рейтинг/репорт/install count) | applicationmeta | 🟡 | install/fav есть, остального нет |
| Permission consent dialog | requestpermission | ✅ | 11 permission IDs |
| UI отзыва пермишенов | applicationmeta | 🟡 | граны персистятся, экрана нет |
| Дев-тулинг (create/edit/publish app) | devapplications | ❌ | — |
| Sideload/local-override манифеста | devapplication | 🟡 | есть в коде, UI нет |
| Embed произвольного URL | anothersite | ❌ | — |
| Node control / easy-node | nodecontrol, easynode | ➖ | вне скоупа |
| Transports management (выбор ноды/SnowFlake) | transportsmanagement | 🟡 | Tor-toggle есть, выбора ноды нет |
| Diagnostics page | diagnosticsPage | ❌ | — |
| Статистика контента | statistic | ❌ | — |
| `system16` / `zaddress` | system16 | 🟡 | `zaddress` — стаб, бросает |

#### G2. Покрытие SDK мини-аппов (≈1:1)

Перенесено: `appinfo, account, sign, authFetch, balance, fromToTransactions, rpc, payment, ext,
get.feed, get.videos, get.videosWithShares, open.post/donation/profile, share, complain,
openExternalLink, getaction(s), alert, userstate, currency, registration, channel, opensettings,
geolocation, checkPermission, requestPermissions, registerForNotifications, chat.*, mobile.camera,
images.upload, videos.opendialog/remove, barteron.*, psdk.userInfoLoad` — **✅**.
Расхождения: `zaddress` (🟡 стаб), `serviceWorker.*` alt-transport (❌ host-side не подключён),
push-события `permissionchange`/action-status (🟡).

### H. Уведомления, поиск, captcha, explorer, tor, эффекты

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Центр уведомлений (список+дропдаун) | notifications, satolist | ✅ | header-notifications |
| Типы: ratings/comments/subscriptions/reposts | satolist | ✅ | `notifications-mappers.ts` |
| Тип: mention | (mention) | 🟡 | в union есть, маппинга нет |
| **Тип: донат/tip (PKOIN received)** | transactions/win | ❌ | `tip` без `mesType`-маппинга |
| Mark-as-read / hide / clear | seenall | ✅ | block-pointer модель |
| Realtime-обновления | WS clbks.added | 🟡 | polling 30с вместо WS-пуша |
| In-app тосты | sitemessage | ✅ | `notification-toasts.ts` |
| Звук-алерты | ion.sound + sounds/*.mp3 | 🟡 | синтез-бип, без ассетов |
| Тоглы настроек по типам | satolist meta | ✅ | notification-settings-store |
| Push (FCM/background) | firebase-messaging-sw.js | ➖ | вне скоупа (Google) |
| Поиск постов/юзеров/тегов/аппов | satolist, searchusers | ✅ | search-service + хуки |
| Автокомплит / история поиска | mobilesearch | ✅🆕 | structured history (IDB) |
| Тег-облако (веса, clear-all) | tagcloud | 🟡 | список тегов есть, облака нет |
| Captcha / анти-бот | captcha (HexCaptcha) | ✅ | `components/captcha/*` |
| QR-сканер | qrscanner | ❌ | нет BarcodeDetector/qr-scanner |
| Block explorer | внешний апп | 🆕 | нативный (block/tx/address/peers) |
| Tor / privacy (клиент) | node/desktop only | 🆕 | Tauri SOCKS5 + bridges |
| Star-explosion эффект | rating-анимации | ✅🆕 | effects-store |
| Анимация монеток при донате | donateAnimations | ❌ | — |
| Лента активностей | activities | ❌ | только pending-ratings |
| Виджет репутации (ustate) | ustate | 🟡 | частично (limits-page) |
| `slides` промо-тикер | slides | ❌ | — |

---

*Документ сгенерирован сравнительным аудитом 8 доменов. Статусы отражают состояние кода на дату
создания файла — перед работой над пунктом верифицировать, что он ещё актуален.*
