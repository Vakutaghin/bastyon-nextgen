# IPFS-viewer: докачиваемый модуль + универсальный вьювер

> Статус: в работе. Дата: 2026-08-10.
> Ядро перехвата ссылок уже в репозитории (коммит `825c1d3`, ещё не запушен).
> Этот документ — durable-план; исполняется по фазам (см. §6).

## 0. TL;DR

Клик по `ipfs://` / `ipns://` / `/ipfs/<cid>` / `/ipns/<name>` открывает контент в
отдельном нативном окне Tauri. Обычные `http(s)` не трогаем. Движок резолвинга
изолирован за одной функцией `buildIpfsViewerUrl` (`src/helpers/ipfs/ipfs-viewer.ts`).

Задача распадается на **три ортогональные сущности**:

| Сущность | Что делает | Резолвер публичный? |
|---|---|---|
| **Resolver** | добывает байты из сети по CID | ✅ можно публичный (Tier 0) |
| **Viewer** | рендерит или скачивает добытое | резолверу безразличен |
| **Publisher** (файлообменник) | публикует свои файлы → CID | ❌ нужна своя нода (write-сторона) |

Viewer и resolver независимы → **универсальный вьювер катится уже на публичном шлюзе,
до всякой Kubo**. Publisher — надстройка, появляется бесплатно, как только есть локальная нода.

## 1. Осуществимость: yes-with-caveats — и ~80% инфраструктуры уже боевая

В приложении уже живёт **модуль Tor** (`src-tauri/src/tor/`), делающий ровно тот же
жизненный цикл, что нужен Kubo:

```
download → verify SHA → extract → chmod +x → снять macOS quarantine
  → spawn managed child → парсинг stdout → kill на выходе
```

- Backend: `src-tauri/src/tor/{installer.rs, process.rs, config.rs, state.rs, mod.rs, ws.rs}`.
- Фронт: `src/stores/tor-store.ts` (паттерн «грубый `status` + тонкий `install-progress`»),
  `src/b-components/header/header-tor/header-tor.vue`.
- Wiring: `src-tauri/src/lib.rs` — `mod tor`, `invoke_handler` (`tor_status/tor_start/…`),
  `tor::init()` в `setup()`, kill в `RunEvent::ExitRequested`.
- `Cargo.toml` уже содержит `reqwest(stream) + flate2 + tar + zip + sha2 + hex` — новых
  зависимостей для Kubo нет.

**Значит модуль Kubo = клон Tor-модуля** (`s/tor/ipfs/`) с другим URL, арх-маппингом,
SHA-512 вместо SHA-256 и другим парсером stdout.

Реальные оговорки — эксплуатационные, не архитектурные (см. §4).

## 2. Универсальность типов

**CID не несёт MIME/Content-Type вообще.** multicodec внутри CID описывает *кодировку
блока* (`dag-pb` для UnixFS-файлов/директорий, `raw` для листовых байтов, `dag-cbor`/`dag-json`
для IPLD), а не медиатип. «Сайт» — это UnixFS-директория с `index.html`; картинка/видео —
UnixFS-файл. **Тип определяет gateway при извлечении**: расширение в пути/`?filename=` →
magic-bytes (первые ~512 байт) → `application/octet-stream`.

Так что да — за CID может стоять что угодно (файл любого типа, директория, сырой блок),
но выводить тип из самого CID нельзя.

**Единственный принцип: вести себя как браузер.** Одна точка решения —
`classify(contentType, contentDisposition, os)`:

- `Content-Disposition: attachment` → **DOWNLOAD** (сервер сказал явно, уважаем даже для рендеримых типов).
- `text/*`, `image/*`, `audio/*`, `video/*`, `application/json`, `application/xhtml+xml` → **RENDER**.
  Медиа — нативным `<video src="http://127.0.0.1:...">`, **никогда** через `blob:` (убивает Range/seek, грузит всё в память).
- `application/pdf` → **RENDER на macOS/Windows** (WKWebView/WebView2), **DOWNLOAD на Linux** (WebKitGTK без встроенного PDF; pdf.js — позже). Самая крупная кросс-платформенная ловушка.
- пустой/отсутствующий тип → **RENDER** (браузероподобно; без потери данных — окно в худшем случае покажет то же, что и раньше).
- `application/octet-stream`, `zip`, `x-tar`, архивы, office, всё прочее → **DOWNLOAD** (стриминг на диск, не буферизовать большие файлы).
- Директория как «скачать» → `?format=tar` (сразу пригодно) или `?format=car` (верифицируемо).

Точка перехвата ссылок и точка render/download — **разные этапы**; `classify` живёт на этапе render/download.

## 3. Целевая архитектура

### 3.1 Seam и tiers деградации (оба слоя держим постоянно)

- **Tier 0 — публичный gateway (`dweb.link`), уже работает.** Остаётся навсегда:
  дефолт до установки модуля, fallback за корп/ISP-файрволом (libp2p/DHT режется),
  аварийный путь по таймауту пока swarm прогревается. Кандидат вместо `dweb.link` —
  **своя Kubo-нода на evolise VPS** (первопартийный доверенный шлюз).
- **Tier 1 — скачанный локальный Kubo.** Активируется по согласию на первом клике.
- Правило переключения: локальный узел не резолвит CID за короткий таймаут → падаем на
  Tier 0 **с клиентской верификацией CID по хэшу** (скомпрометированный gateway не подсунет чужое).
- Тезис «no public gateways» реализуется как «локальная нода по умолчанию», а не «шлюз запрещён».

### 3.2 Стейт-машина модуля (Kubo)

```
NotInstalled → Downloading → Verifying → Installing(extract + `ipfs init`)
  → Ready(на диске, daemon down) → DaemonStarting → Running(gateway-порт известен)
Error{phase, retryable, message} — из любой активной фазы
Running --(daemon exit/EOF)--> Error/Ready
```

Рестарт приложения: бинарь + repo существуют → сразу `Ready` (скачивание пропускается),
ленивый `DaemonStarting` на первый клик. Источник истины — ФС
(`app_data_dir()/ipfs/`: `bin/ipfs`, `repo/`=IPFS_PATH, `install.json`). localStorage —
только неавторитетные UX-подсказки.

### 3.3 Как локальный Kubo заменяет `buildIpfsViewerUrl` (код интерцепта не трогаем)

`buildIpfsViewerUrl` становится **async** с семантикой «обеспечь модуль + daemon → верни локальный URL»:

```ts
export async function buildIpfsViewerUrl(target: IpfsTarget): Promise<string> {
  const port = await useIpfsStore().ensureRunning() // install (consent) + start; reject на cancel/hard-error
  const suffix = target.path ? `/${target.path}` : ''
  return `http://127.0.0.1:${port}/${target.namespace}/${target.root}${suffix}`
}
```

- **`127.0.0.1`, не `localhost`** — на `localhost` Kubo уходит в subdomain-gateway, делает 301, ломает path-форму.
- `IpfsTarget{namespace, root, path}` ложится 1:1 на path-gateway `/ipfs/<cid>/<path>` — парсинг `ipfs-link.ts` не меняется.
- В `use-ipfs-links.ts` — три микро-правки (Фаза 3): `await` на build; focus-existing-window ВЫШЕ await (мгновенный повтор-клик); снять ранний `if (!inTauri()) return`, решение о доступности отдать стору (`store.available` → `showDesktopOnly()`).

### 3.4 Файлы (клонируем Tor-модуль)

- Backend: `src-tauri/src/ipfs/{mod.rs, installer.rs, state.rs, process.rs, config.rs}`;
  команды `ipfs_status/ipfs_ensure/ipfs_start/ipfs_stop/ipfs_update/ipfs_uninstall`;
  `ipfs::init()` в `setup()`; kill в `ExitRequested`; события `ipfs:state` + `ipfs:install-progress`.
- Драйвим через `std::process::Command` (путь Tor), **НЕ** `tauri-plugin-shell` sidecar
  (его scope статичен на build-time, не авторизует динамический путь в `app_data_dir`).
  Поэтому shell/fs/http-разрешения не нужны.
- Frontend: `src/stores/ipfs-store.ts` (клон tor-store), `src/components/ipfs/ipfs-install-modal.vue`
  + sibling `.styled.ts` (SC_*), singleton в `src.vue` рядом с `DonateModal/ReportModal/VaultUnlockModal`.
  Опц. `header-ipfs.vue`.
- CSP: `frame-src` в `tauri.conf.json` + `http://127.0.0.1:*` (`connect-src http://*` уже есть).
- Один in-flight promise `ensureRunning()` (охватывает ретраи, помнит `pendingTarget` для Retry без второго клика).

## 4. Честные сложности (из adversarial-прогона)

- **macOS Apple Silicon: неподписанный arm64 → `Killed: 9` при exec.** Реальный блокер (важнее quarantine).
  Митигейшн: `codesign -s - -f <binary>` после скачивания; проверить `codesign -dv` на реальном артефакте
  Kubo v0.42/0.43. Плюс `xattr -dr com.apple.quarantine` (belt-and-suspenders). Hardened runtime
  субпроцесс НЕ блокирует — это про in-process dylib.
- **Mobile = строго desktop-only, физически.** iOS запрещает fork/exec неподписанного кода; Android
  SELinux/W^X + Play-политика (+ сломанный Tauri-sidecar #9774). Митигейшн: `store.available = isTauriEnv()`
  → на web/mobile `showDesktopOnly()`.
- **Корп/ISP-файрволы ломают libp2p/DHT** (режут UDP/QUIC, DCUtR не 100%). Митигейшн: Tier 0 fallback
  обязателен + короткий таймаут резолва.
- **Обязательная верификация загрузки** (это RCE-канал). Kubo даёт per-artifact `.sha512` (SHA-512!),
  но по тому же TLS и без GPG. Митигейшн: **запинить ожидаемый SHA-512 Rust-const'ом** рядом с
  `KUBO_VERSION`, сверять ДО распаковки/exec, при несоответствии — удалить и abort (fail-closed).
  Арх-маппинг Go-стиль (`amd64/arm64/386`), не Rust. Хэш из `.sha512` брать по первому whitespace-токену (kubo#9323).
- **AV/SmartScreen false-positives (Windows).** Митигейшн: бинарь в `app_cache_dir` (не Roaming);
  в идеале подписать `kubo.exe` (EV-cert = мгновенная репутация SmartScreen). Для энтерпрайза Tier 0 спасает.
- **Не раздавать чужое + не жрать батарею/диск.** Митигейшн: `Routing.Type=autoclient` (НЕ
  `AcceleratedDHTClient` — OOM kubo#9990; НЕ `dhtclient` — медленнее), `Provide.Enabled=false`,
  профиль `lowpower`, `Datastore.StorageMax` + периодический GC, API строго на loopback без CORS.
  Порты — `Addresses.Gateway/API = /ip4/127.0.0.1/tcp/0`, реальный порт из `$IPFS_PATH/gateway` (+ сигнал живости) или stdout.
- **Orphaned daemon держит `repo.lock`** (kill -9 минует `ExitRequested`). Митигейшн: `try_attach()`
  (`POST /api/v0/id` перед спавном); graceful shutdown (`POST /api/v0/shutdown`/SIGTERM → ждать → kill).

## 5. Файлообменник (Publisher, write-сторона)

Не покрыт основным прогоном — отдельная продуктовая ветка, появляется поверх §3 (нода уже есть).

**Асимметрия чтения и записи:** публичный gateway read-only — залить через него нельзя.
Для публикации нужна **своя нода** (встроенная Kubo, или VPS-Kubo, или pinning-API).

Что нужно, чтобы это был настоящий обменник, а не игрушка:

1. **Персистентность (pinning).** Контент жив, пока нода его держит и достижима; автор офлайн +
   файл никто не запинил → провайдер-записи в DHT протухают (~сутки), GC удаляет. Нужен pin-таргет:
   VPS-Kubo автопином или pinning-сервис.
2. **Приватность.** CID публичен — кто угодно с ссылкой скачает. Приватные файлы — **шифровать на
   клиенте до `ipfs add`**, ключ передавать вне IPFS. Синергия: у Bastyon есть зашифрованный
   мессенджер (matrix) → CID + ключ уходят в DM, ссылку открывает уже готовый перехватчик.
3. **Достижимость (NAT).** Прямая раздача с ноды автора требует dialable-узла (relay/hole-punching);
   нода с публичным IP (VPS) как pin-таргет обходит это разом.

Полный цикл: `ipfs add` → CID → шаринг ссылки в пост/DM → открытие во вьювере.

## 6. Поэтапный план

- **Ф0 — Tier 0 публичный шлюз.** Уже работает (`825c1d3`).
- **Ф1 — универсальный render/download на Tier 0. ← ТЕКУЩАЯ.** `classify()` + проба типа перед
  выбором render-vs-download + сохранение на диск (dialog+fs). Ценно само по себе, Kubo не нужна,
  не блокируется решением по движку. Юнит-тест `classify` (матрица contentType×os) + имена файлов.
- **Ф2 — backend-модуль IPFS (Rust).** Клон `src-tauri/src/tor/` → `src-tauri/src/ipfs/`: URL/арх Go-стиль,
  SHA-512 + пин хэша, `KUBO_VERSION`, парсер stdout, `codesign -s - -f`, config `autoclient`/`Provide.Enabled=false`/
  StorageMax+GC/loopback. Портировать доменную логику из `ipfs-site/app` `node.rs` (init `--profile lowpower`,
  свободные порты, `try_attach`, `wait_ready`), заменив sidecar на `std::process::Command`. Команды +
  `ExitRequested`-hook + cancellation-token для отмены скачивания (у Tor нет — добавить). Rust-тесты.
- **Ф3 — frontend + Tier 1.** `ipfs-store.ts` (клон tor-store), `ipfs-install-modal.vue` (consent «~80 МБ»
  → progress → Retry → авто-открытие вьювера), singleton в `src.vue`. Три правки в `use-ipfs-links.ts`.
  `buildIpfsViewerUrl` → async, локальный URL. CSP `frame-src`. i18n `ipfs.*` (зеркало `header.tor*`).
  Fallback Tier1→Tier0 по таймауту.
- **Ф4 — полировка.** `header-ipfs.vue` (статус/update/uninstall), update (`ipfs daemon --migrate=true`),
  uninstall+GC, graceful shutdown, Linux pdf.js, subdomain-gateway для изоляции origin недоверенных CID.
- **Ф5 — файлообменник (write).** `ipfs add` → CID → шаринг + pinning (VPS-нода) + шифрование поверх
  крипты Bastyon (см. §5).

## 7. Принятые решения (соло-продакт)

- **Download-on-demand, не bundled.** Продуктовое видение = скачиваемый модуль; в приложении это уже
  боево работает для Tor. Bundled — запасной вариант, если macOS-переподпись окажется нестабильной.
- **Публичный gateway остаётся навсегда как Tier 0 fallback** (за файрволом/на mobile — единственный путь) +
  клиентская верификация CID. Кандидат: своя evolise-нода вместо `dweb.link`.
- **Kubo v0.42+/v0.43** (там stdout-формат `Gateway server listening on`/`Daemon is ready`, `lowpower` не зануляет reprovider).
- **Lazy-старт** демона на первый IPFS-клик (не на запуск приложения).
- **Бинарь в `app_cache_dir`** (перекачиваемый), **repo в `app_data_dir`**; предусмотреть uninstall/GC.
- **PDF на Linux — сначала download**, pdf.js в Ф4.
- **Пока path-gateway** (свои/доверенные CID); subdomain-gateway + строгий CSP — при рендере произвольного недоверенного контента.
- **Прод-предпосылки:** проверить наличие Apple Developer ID / Windows-cert (для переподписи/репутации) и
  реальное signature-состояние Kubo-бинарей (`codesign -dv`).

## 8. Текущий статус реализации

| Фаза | Статус | Артефакты |
|---|---|---|
| Ф0 | ✅ готово (не запушено) | `helpers/ipfs/ipfs-link.ts`, `ipfs-viewer.ts`, `use-ipfs-links.ts`, capabilities — коммит `825c1d3` |
| Ф1 | ✅ готово (не запушено) | `helpers/ipfs/ipfs-content.ts` (17 тестов), `ipfs-download.ts`, врезка `use-ipfs-links.ts` — коммит `76cb24d`; сьют 2099 зелёный. Живая проверка render/download в Tauri-сборке — TODO |
| Ф2 | ✅ готово (не запушено) | backend `src-tauri/src/ipfs/{state,process,config,installer,mod}.rs` (клон Tor); Kubo v0.43.0, запиненные SHA-512, Go-арх-маппинг, `/tcp/0`+чтение портов из `api`/`gateway`, `autoclient`+`Provide.Enabled=false`+`lowpower`, try_attach, kill на выходе. Команды `ipfs_status/ipfs_ensure/ipfs_stop/ipfs_uninstall`. `cargo check` без предупреждений, `cargo test ipfs::` 11/11. Живой запуск демона в Tauri-сборке — TODO. Не сделано (осознанно): cancellation-token отмены скачивания и `ipfs_update` — Ф3/Ф4 |
| Ф3 | ✅ готово (не запушено) | фронт+Tier1: `stores/ipfs-store.ts` (consent/ensure/resolveGateway/tier), `helpers/ipfs/ipfs-tier.ts` (+6 тестов), `components/ipfs/ipfs-install-modal.vue`+styled, врезка в `use-ipfs-links.ts` (availability→resolveGateway→per-CID fallback), `probeContent` таймаут+loopback-байпас Tor, i18n `header.ipfs*`, CSP `frame-src`/`media-src http://127.0.0.1:*`, plugin-http allowlist (`127.0.0.1`+`dweb.link`). Прогнан adversarial-workflow (16 находок), 10 контейнированных пофикшены; сьют 2105 зелёный, линт 0. Живая проверка в Tauri-сборке — TODO |
| Ф4 | ✅ частично (не запушено) | полировка: `header-ipfs.vue`+styled (статус/install/stop/uninstall/update, бейдж update) в шапке; backend `ipfs_update` + `update_available` (сравнение install.json с запиненной версией, cargo test 13/13); стор-действия `enable/stop/uninstall/update`; **privacy-at-Tor**: при включённом Tor не открываем публичный шлюз (деанон) — модалка `tor-blocked`, просим локальную ноду; i18n `header.ipfs*`. Сьют 2105 зелёный. **Отложено:** Linux pdf.js, subdomain-gateway для изоляции недоверенных CID |
| Ф5b | ✅ шифрование (не запушено) | приватный шаринг: Rust `ipfs/crypto.rs` (AES-256-GCM, `nonce‖ct`, +4 теста), `ipfs_add_encrypted`→{cid,key} и `ipfs_save_encrypted` (fetch шифртекста→decrypt→на диск); ключ+имя во ФРАГМЕНТЕ ссылки `ipfs://<cid>#key=..&name=..` (не уходят на gateway); `parseIpfsSecret`/`buildIpfsSecretLink` (+2 теста); перехватчик: секрет→save decrypted, Tor-guard распространён на encrypted-фетч; кнопка «Поделиться приватно…» в header-ipfs. Крипта в одном языке (Rust), decrypt тоже Rust — без cross-lang. Сьют 2109 зелёный. **Осталось (Ф5c):** удалённый pin (durability) — см. ниже; инлайн-рендер зашифрованных медиа (сейчас только скачивание) |
| Ф5 | ✅ MVP (не запушено) | файлообменник (write): backend `ipfs_add` (`add -Q --cid-version=1 --pin`); стор `addFile` (ensure→add); кнопка «Поделиться файлом…» в `header-ipfs` → dialog → CID → `ipfs://<cid>` в буфер + модалка с предупреждением «контент публичный»; `buildIpfsShareLink`(+2 теста), capability `dialog:allow-open`. Round-trip: шаринг-ссылка открывается тем же перехватчиком. Сьют 2107 зелёный. **Отложено (Ф5b):** шифрование приватных файлов (нужна расшифровка во вьювере) + удалённый pin (VPS-нода) для durability, когда автор офлайн |

### Файлообменник — важные оговорки (MVP Ф5)

- **Контент публичный.** `ipfs add` не шифрует; любой с CID скачает файл. Модалка шаринга об этом предупреждает. Приватные файлы — шифрование на клиенте ДО `add` (Ф5b, поверх крипты Bastyon; ключ через зашифрованный DM).
- **Durability = пока нода автора онлайн и достижима.** Локальный pin держит контент в repo, но провайдер-записи в DHT протухают, если нода офлайн. Для «жив всегда» нужен удалённый pin (твоя VPS-Kubo автопином или pinning-сервис) — Ф5b.
- **NAT.** Прямая раздача требует dialable-ноды (relay/hole-punching Kubo умеет, корп-NAT может резать) — удалённый pin с публичным IP обходит.

### Удалённый pin (Ф5c) — durability, требует инфры

Локальный pin держит контент, пока нода автора онлайн. Чтобы файл жил всегда,
CID надо запинить на постоянно доступной ноде. Варианты (нужно решение продакта):

1. **Kubo remote pinning service** (стандарт, [IPFS Pinning Service API]): на публикацию
   `ipfs pin remote add --service=<name> --background <cid>`, сервис заранее заведён
   `ipfs pin remote service add <name> <endpoint> <key>`. Нужен endpoint+ключ pinning-сервиса.
   Твоя VPS-Kubo сама по себе НЕ pinning-сервис — нужен ipfs-cluster/pinning-api поверх, либо
   сторонний (Pinata/web3.storage).
2. **Прямой pin на своей ноде через её API** (`POST http://vps:5001/api/v0/pin/add?arg=<cid>`) —
   но публичный Kubo API = полный контроль над нодой, экспонировать опасно (нужен reverse-proxy
   с авторизацией только на `/pin/add`).

Реализация — тонкая (пара `ipfs` вызовов, гейт на конфиге endpoint+key) + поверхность
настроек, где юзер вводит сервис. Отложено, т.к. без реального endpoint не проверить и это
продуктовое решение (какой pinning-путь).

[IPFS Pinning Service API]: https://ipfs.github.io/pinning-services-api-spec/

### Известные ограничения (из adversarial-ревью Фазы 3, отложено в Ф4)

- **Публичный шлюз через нативное окно не торифицируется.** Окно грузит URL напрямую (OS-навигация), минуя app-level Tor. При включённом Tor + публичном шлюзе (или Tier1→Tier0 fallback) — деанон к `dweb.link`. Локальная нода (loopback) не течёт. Митигейшн-опция: при включённом Tor не делать публичный fallback (жертвуем «откроется всегда» ради приватности) — продуктовое решение.
- **`torFetch` не honors AbortSignal.** Проба публичного шлюза через Tor может превысить 8с (таймаут не отменяет invoke). Трогает общий Tor-инфра (`request-tor.ts`) — не в скоупе IPFS-фазы.
- **`saveIpfsResource` буферизует файл целиком** (blob→arrayBuffer). Крупные файлы → память. Стриминг на диск через Rust (`reqwest bytes_stream`) — Ф2/Ф4 хардненинг.
- **Большой «холодный» CID** может дать преждевременный Tier1→Tier0 (8с проба). Адаптивный/раздельный таймаут — Ф4.
- **Смена `IPFS_GATEWAY`** требует добавить хост в plugin-http allowlist (`capabilities/default.json`) — сейчас запинен `dweb.link`.
