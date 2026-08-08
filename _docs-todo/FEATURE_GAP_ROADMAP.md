# Roadmap: остаток работ (паритет с pocketnet.gui)

> Что ещё не хватает в **bastyon-nextgen** по сравнению с легаси **pocketnet.gui**
> (`/private/var/www/pocketnet/___original-repos/pocketnet.gui`).
>
> Документ — карта **остатка работ**: только несделанное, сгруппированное по
> приоритетам. Сделанное здесь не перечисляется. Детальные таблицы по доменам
> (только незакрытые строки) — в конце.

**Легенда статусов:** 🟡 частично/заглушка · ❌ нет · 🔌 UI есть, не подключено к RPC

**Принцип** (см. память `principle_decentralization`): мнемоника-only, без SSO/посредников,
работа standalone. Поэтому ряд легаси-фич (email/SSO, node-control, FCM-пуши, electron-обвязка,
Olm/Megolm, cordova-камера/контакты, P2P-видео) — **намеренно вне скоупа** и здесь не перечисляются.

> ⚠️ Статусы отражают состояние кода на дату правки — перед работой над пунктом
> верифицировать, что он ещё актуален. Ряд реализованного **не верифицирован на живой
> ноде** (нет стенда) — это отдельный пласт проверки, не покрытый этим документом.

---

## Q-PLAN: приоритеты

### 🔴 P0 — разрывы базовых сценариев (остаток)

1. 🟡 **Редактирование профиля — осталось:** **обложка** (отдельный `accSet`-tx,
   write-кода нет) и крипто-адреса.
2. 🟡 **История транзакций кошелька — осталось:** история по доп. Z-адресам
   отдельным списком; донат-метка (маркер `a:donate` в message, которого нет в
   `getaddresstransactions` — нужен догруз). *(Метки boost/stake — сделаны.)*
3. ❌ **Загрузка видео на PeerTube** (`uploadpeertube`, `videoCabinet`). nextgen только
   транскодит в локальный IndexedDB; публикации на ноду нет; `pages/my-videos-page` — заглушка.
   *Метаданные при загрузке (название/описание/теги/NSFW/обложка) — тоже отсутствуют.*

### 🟡 P2 — крупные недостающие фичи (по доменам)

**Лента / дискавери**
- On-chain коллекции (`collections`/`newcollection`) — **отложено**: крупная on-chain фича
  (создание = `newcollection` tx уровня композера + `getprofilecollections`), нужен отдельный
  проход и верификация. Сейчас только локальные «Избранное».

**Посты / контент**
- OG-превью ссылок (нужен эндпоинт метаданных ноды).
- Буст поста (`boost`/`liftUpThePost`) — оплата продвижения.
- NSFW-флаг поста.

**Кошелёк / монетизация**
- Платные подписки: подписаться за плату + управление условиями
  (`getpaidsubscription`/`managepaidsubscription`).
- Стейкинг: калькулятор (`staking`) + реальные cold-staking/HTLS-транзакции (`wallet/stake.html`).
- Дашборд рекламы (`advertising`); расширенный earnings (периоды/breakdown — сейчас базовая
  вкладка с тремя суммами).
- Fast-send/батч-платежи (`fastsend`), платёжные ссылки (`createpaymentlink`).
- Динамические комиссии (сейчас фикс `DEFAULT_TX_FEE = 1e-8`), реальный buy/sell (есть только график).

**Видео**
- Редактирование/удаление **опубликованного** видео (`editVideoDescription`; сейчас удаляются
  только локальные блобы), квоты загрузки, выбор обложки.
- Лайв-стриминг (`streampeertube`) — осознанно отложен как отдельная инициатива.

**Мессенджер**
- Звонки voice/video (`BastyonCalls` + `m.call.*`) — весь WebRTC-стек.
- Edit (`m.replace`) и forward сообщений (reply/delete уже есть). Edit упирается в
  зашифрованный путь (ре-шифрование + `m.new_content`) — нужна верификация на живом чате.
- Создание групп, инвайты, управление участниками, инфо/настройки комнаты.
- Стикеры.

**Мини-аппы / инфра**
- Дев-тулинг: создать/редактировать/опубликовать своё приложение (`devapplications`).
- Страница приложения с рейтингом/репортом (`applicationmeta`).
- Выбор backend-ноды / SnowFlake / direct-proxy (`transportsmanagement`; сейчас авто-выбор).
- Статистика контента (`statistic`).

**Уведомления / прочее**
- Лента активностей (`activities`); виджет репутации/бейджей (`ustate`) — сейчас частично.
- Реалтайм-уведомления: сейчас polling 30с вместо WS-пуша `clbks.added`.

### 🟢 P3 — инфо/легал/полировка

- NSFW/privacy-секции в настройках; пустые табы настроек wallets/accounts/system — заглушки.
- `slides` промо-тикер.

---

## Приложение: детальные таблицы по доменам (только незакрытые строки)

### A. Лента, дискавери, навигация

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Коллекции (on-chain) | collections | ❌ | отложено (крупная on-chain фича); сейчас локальные «Избранное» |

### B. Посты, статьи, комментарии, голосование, шаринг, модерация

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Видимость (all/subs/registered/paid) | share | 🟡 | paid без проверки наличия подписки |
| Загрузка своего видео в композер | uploadpeertube | 🟡 | блокирован реальной загрузкой (см. P0-3) |
| OG-превью ссылок | embeding | ❌ | нужен эндпоинт ноды |
| NSFW-флаг поста | share/post | ❌ | нет нигде. ⚠️ 2026-06-08: в legacy-композере поля нет, в `SharePostSettings` (`s`-payload) нет, card-level `Post` флаг `nsfw` не несёт (есть только в `PeertubeVideoInfo` — видео). Нужна нодовая семантика + проброс через feed-mapper. Не чисто client-side. |
| Буст поста | boost | 🟡 | только парсинг в explorer |
| Скачать медиа (видео) | downloadMedia | ❌ | картинки из лайтбокса сделаны (web blob); видео-HLS как файл не качается |

### C. Видео и медиа

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Загрузка на PeerTube (chunked/resumable) | uploadpeertube + video-uploader.js | ❌ | только локальный транскод (см. P0-3) |
| Импорт видео по URL | uploadpeertube | ❌ | — |
| Прогресс загрузки на сервер | uploadpeertube | 🟡 | показывает только транскод |
| Обложка/название/теги/NSFW при загрузке | videoCabinet/editVideoDescription | ❌ | модалка display-only |
| Видео-кабинет / my-videos (список, статы, поиск) | videoCabinet (2036 строк) | ❌ | `my-videos-page.vue` — заглушка |
| Edit/Delete опубликованного видео | videoCabinet | 🟡 | удаляет только локальные блобы |
| Квота загрузки / ability-gating | abilityincrease/ustate | ❌ | — |
| Лайв-стриминг (go-live + watch) | streampeertube | ❌ | отложено осознанно |

### D. Кошелёк, платежи, монетизация

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Несколько адресов | wallet | 🟡 | add (max 20) + rename (локальный ярлык) есть; remove не делаем (HD-derived: удаление середины ломает восстановление), import — вне скоупа (мнемоника-only) |
| Комиссии | wallet/fastsend | 🟡 | фикс `1e-8`, нет динамической оценки |
| Детали транзакции (семантика) | transactionview | 🟡 | boost/stake-метки есть; донат (a:donate в message) нет |
| Fast-send / батч | fastsend | ❌ | — |
| Платёжные ссылки | createpaymentlink | ❌ | — |
| Буст поста | boost | ❌ | — |
| Стейкинг (калькулятор) | staking | ❌ | — |
| Cold-staking / HTLS tx | wallet/stake.html | ❌ | — |
| Платная подписка — подписаться | getpaidsubscription | ❌ | — |
| Платная подписка — условия (креатор) | managepaidsubscription | ❌ | — |
| Дашборд заработка — периоды/breakdown | earnings | 🟡 | базовая вкладка (3 суммы), без периодов/детализации |
| Реклама/boost-earnings | advertising | ❌ | — |
| График цены | pkoin/staking | 🟡 | CoinGecko-график, без buy/sell |

### E. Мессенджер / чат

> Оригинал: `bastyon-chat/src` (Vue 2). Крипта обеих сторон — свой pcrypto (не Olm/Megolm).

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Группы (чтение/отправка) | teamroom | 🟡 | можно читать/писать, **создавать нельзя** |
| Edit / forward сообщений | events/* | ❌ | reply + delete сделаны; edit (m.replace, enc-путь) и forward — нет (нужна чат-верификация) |
| Создание комнат / инвайты / админ комнаты | chat/create, teamroom | ❌ | только `createDirectRoom` |
| Звонки voice/video (WebRTC) | BastyonCalls | ❌ | весь стек отсутствует |
| Стикеры | emoji.js+стикеры | ❌ | эмодзи есть, стикеров нет |

### F. Авторизация, аккаунты, профиль, настройки

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Редактирование профиля | author, usersettings | 🟡 | обложка/крипто-адреса — нет (см. P0-1) |
| Настройки: NSFW/privacy | usersettings | ❌ | — |
| Настройки: табы wallets/accounts/system | usersettings | 🟡 | заглушки |

### G. Мини-аппы, dev-tools, инфра

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Host→app push-события | index.js | 🟡 | нет `permissionchange`, action-status |
| Страница аппа (рейтинг/репорт/install count) | applicationmeta | 🟡 | install/fav есть, остального нет |
| Дев-тулинг (create/edit/publish app) | devapplications | ❌ | — |
| Embed произвольного URL | anothersite | ❌ | — |
| Transports management (выбор ноды/SnowFlake) | transportsmanagement | 🟡 | Tor-toggle есть, выбора ноды нет |
| Статистика контента | statistic | ❌ | — |

> **SDK мини-аппов** перенесён ≈1:1 (~40 экшенов, включая `zaddress`). Остаток расхождений:
> `serviceWorker.*` alt-transport (❌ host-side не подключён), push-события
> `permissionchange`/action-status (🟡).

### H. Уведомления, поиск, captcha, прочее

| Capability | Оригинал | Статус | Заметки |
|---|---|---|---|
| Тип: mention | (mention) | 🟡 | в union есть, маппинга нет. ⚠️ 2026-06-08: нода в getmissedinfo **не шлёт** mesType='mention' (список: upvoteShare/subscribe/answer/post/comment/repost/userInfo) — нужно либо клиентское детектирование @-меншена в comment/post-событиях, либо нодовый тип. Не просто маппинг. |
| Realtime-обновления | WS clbks.added | 🟡 | polling 30с вместо WS-пуша |
| Лента активностей | activities | ❌ | только pending-ratings |
| Виджет репутации (ustate) | ustate | 🟡 | частично (limits-page) |
| `slides` промо-тикер | slides | ❌ | — |
