## Зона: F — wallet / transfers / donate / limits / mini-apps bridge & permissions

### Находки
- **F1 · 🔴 критично · security** — `videos.remove` без permission отдаёт свежую подпись пользователя на произвольный хост из указателя и удаляет видео без согласия (= D3)
  - Файл: `src/mini-apps/actions/media.ts:53-64` (`permissions: []`), `host-context-methods/media-upload.ts:23-32`, `peertube-videos.ts:196-210`, `peertube-auth.ts:44-46, 108-116, 204-226`
  - Суть: action гейтится только `authorization: true`. `removeVideoByPointer` берёт `host` из `peertube://<host>/<id>`, строит `generateApiSignature(keyPair, address, {data:'peertube'})` (одинаковая для всех инстансов) и POST-ит на `https://<host>/api/v1/users/blockChainAuth`, затем DELETE.
  - Сценарий: любая миниаппа шлёт `{action:'videos.remove', data:{url:'peertube://evil.example/x'}}` → хост отправляет валидную 360-секундную подпись → атакующий логинится на настоящих PeerTube-инстансах как пользователь. Вариант: `peertube://<легитимный>/<id>` — удаление любого видео без диалога.
  - Фикс: permission-гейт (uniq-промпт с хостом/id) + allowlist PeerTube-хостов; привязать `data` подписи к хосту.
  - Уверенность: high.

- **F2 · 🟠 высоко · logic** — Промпт разрешения через 30 с RPC-таймаута автоматически резолвится «denied» и персистится как отказ пользователя
  - Файл: `permission-resolver.ts:111-133`, `bridge-rpc.ts:24-26`, `registry.ts:104-107`, `use-mini-app-bridge.ts:94-105`
  - Сценарий: пользователь читает промпт 35 с и жмёт «Разрешить» → `permission_denied`, в KV записан `denied`, дальнейшие вызовы отбиваются без промпта до ручного revoke.
  - Фикс: при abort не персистить и закрывать модалку; либо не абортить prompt по RPC-таймауту.
  - Уверенность: high.

- **F3 · 🟠 высоко · security** — Гранты привязаны только к `manifest.id`; для remote-session/сайдлоад-аппов связка id→origin не персистится → чужой origin с тем же id наследует гранты без промпта
  - Файл: `permissions-store.ts:41, 128-152`, `apps-store.ts:229-252, 201-219`, `apps-installer.ts:63-97` (`assertInstallIdentity` только built-in)
  - Сценарий: дал `account`+`chat`+`authFetch` каталожному `somegame.app` → атакующий сайдлоадит `id:'somegame.app'`, scope `evil.example` → без промпта получает адрес+подпись, шлёт сообщения от имени пользователя.
  - Фикс: хранить канонический origin в `PermissionGrant`, сверять при `stateOf/isGranted`.
  - Уверенность: high.

- **F4 · 🟠 высоко · security** — SSRF из iframe в localhost/LAN: allowlist fetch-tunnel объявляет автор манифеста, приватные адреса не фильтруются; `authFetch` без allowlist = любой URL; Tauri-скоуп разрешает `http://127.0.0.1:*`, `tor_fetch` без скоупа
  - Файл: `fetch-tunnel.ts:55-66, 107-111`, `types/manifest.ts:197-210`, `actions/account.ts:109-121`, `types/messages.ts:48-57`, `capabilities/default.json:22`, `src-tauri/src/tor/mod.rs:227-258`
  - Сценарий: `fetch_hosts:["http://127.0.0.1:8080","http://192.168.1.1"]` → запросы к Kubo-gateway/роутеру с чтением ответа; через `authFetch` — любой URL с подписью в теле.
  - Фикс: запрещать loopback/private/link-local и не-https; `redirect:'manual'`; permission-гейт для tunnel; убрать `http://127.0.0.1:*/**` из общего скоупа.
  - Уверенность: high.

- **F5 · 🟠 высоко · logic** — История кошелька показывает «0 PKOIN» для всех строк: `vout.value` (PKOIN) форматируется как сатоши
  - Файл: `wallet-history.vue:42`, `classify-tx.ts:19, 59`, `pkoin-formatter.ts:24-40`, `get-transactions.ts:31`
  - Сценарий: перевод 5 PKOIN → `formatPkoin(5,4)` = `"0"`. Вся вкладка бесполезна.
  - Фикс: `formatExplorerPkoin(row.amount)` без деления.
  - Уверенность: high.

- **F6 · 🟠 высоко · logic** — Балансы доп. кошельков и fallback основного: сумма `txunspent.amount` (PKOIN) форматируется как сатоши; `totalBalance` складывает разные единицы
  - Файл: `use-wallet-balances.ts:57-76, 106-109, 111-122`, `parse-tx-unspent.ts:13`
  - Сценарий: на доп. кошельке 12.5 PKOIN → «0 PKOIN»; «Общий баланс» = бессмысленное число.
  - Фикс: единая шкала (умножать на 1e8 в парсере либо не делить при выводе).
  - Уверенность: high.

- **F7 · 🟠 высоко · logic/data** — Поиск получателя: `receiverAddress` не сбрасывается, когда ввод перестаёт быть адресом → перевод уходит на прежний адрес при другом тексте в поле
  - Файл: `use-receiver-search.ts:66-88`, `wallet-transfer.vue:226-236, 240-243`
  - Сценарий: вставили адрес A → выделили всё, набрали «bob» → «Отправить» активна → средства уходят на A.
  - Фикс: на не-адресной ветке обнулять `receiverAddress`/`receiverLogin` до выбора результата.
  - Уверенность: high.

- **F8 · 🟡 средне · logic** — У built-in и remote-session приложений нет `fetchHosts` → fetch-tunnel падает с TypeError; под Tor (`alttransport:true`) Barteron не может сделать ни одного запроса
  - Файл: `apps-installer.ts:101, 131` (tsc), `fetch-tunnel.ts:56`, `actions/helpers.ts:36`
  - Фикс: `fetchHosts` в `BUILT_IN_APPS`; защита от `undefined`.

- **F9 · 🟡 средне · logic/ux-claim** — Отзыв предустановленного permission у built-in отменяется при следующем запуске (`seedPreinstalledGrants` при `stateOf === null` снова пишет `granted`)
  - Файл: `apps-permission-sync.ts:18-22`, `apps-store.ts:127-131`, `app-permissions-tab.vue:101-107`
  - Фикс: маркер «явно отозвано» или сеять только при первом init.

- **F10 · 🟡 средне · ux-claim** — «Избранное» для каталожных миниапп после перезапуска ведёт на «Приложение не найдено» (remote-session не персистятся)
  - Файл: `sidebar-favorites.vue:78-80`, `favorites-store.ts:5-8`, `mini-app-frame.vue:72, 38`
  - Фикс: `installFromRemoteEntry` из favorites при открытии.

- **F11 · 🟡 средне · data** — Карточка «Баланс основного кошелька» показывает баланс профиля на момент логина и не обновляется после перевода
  - Файл: `use-wallet-balances.ts:57-64`, `wallet-transfer.vue:284-291`, `profile-store.ts:185-215`
  - Фикс: свежий `accountsWithBalances` первым; после отправки `loadBalances()` + `fetchUserState()`.

- **F12 · 🟡 средне · security** — Закрытие миниаппы не отзывает доступ: резолв по origin + connection пересоздаётся любым сообщением из любого окна этого origin (popup через `opener.top.postMessage`)
  - Файл: `bridge.ts:114, 128-137, 91-96`, `mini-app-frame.vue:12` (`allow-popups`)
  - Фикс: принимать сообщения только от `iframe.contentWindow`; при unmount снимать remote-session.

- **F13 · 🟡 средне · consistency/logic** — plugin-http скоуп блокирует CoinGecko/authFetch/tunnel на сторонние хосты (= H8).

- **F14 · 🟡 средне · ux-claim/security** — Промпт `sign` не показывает, что подписывается (`extra` не передаётся); промпт `zaddress` говорит «Zcash-адрес», а выдаёт реальный производный PKOIN-кошелёк
  - Файл: `registry.ts:105`, `use-mini-app-bridge.ts:83-93`, `actions/account.ts:45-57, 80-91`, `ru.ts:1627-1630, 1640`
  - Фикс: передавать `data.string` в `extra`; переписать описание `zaddress`.

- **F15 · 🟡 средне · security** — `authFetch`: формат подписи выбирает приложение (`useOldFormat`), старый формат = формат авторизации прокси → replay
  - Файл: `actions/account.ts:104-106`, `_schema.ts:59`, `api-signature.ts:49-56, 97-99`, `request-signer.ts:52-58`
  - Фикс: всегда nonce+ttl с `s=hex(manifest.id)`.
  - Уверенность: medium.

- **F16 · 🟡 средне · ux-claim/security** — Сайдлоад есть, удаления нет: `uninstall()` не вызывается ни из одного UI
  - Файл: `apps-store.ts:275-289`, `sideload-modal.vue`, `app-permissions-tab.vue:105`
  - Фикс: кнопка «Удалить» на карточке local-аппа и в настройках.

- **F17 · 🟡 средне · data** — Страница лимитов привязана к адресу на момент монтирования (= B10).

- **F18 · 🟡 средне · ux-claim** — «Получить» предлагает доп. кошелёк, но потратить с него нечем (= B4).

- **F19 · ⚪ низко · consistency** — Payment modal: `appName` никогда не передаётся (`src.vue:61`), строка `miniapps.paymentRequestedBy` мёртвая; получатели не валидируются как адреса, `positive()` пропускает `1e-9`
  - Файл: `mini-app-payment-modal.vue:16, 76`, `payment-modal-controller.ts:20-24`
  - Фикс: прокидывать `manifest.name`; `isValidAddress` + `amount >= DUST_VALUE`.

- **F20 · ⚪ низко · leak** — `normalizeError` отдаёт в iframe `err.stack` хоста; `inflight` ключуется только `requestId`
  - Файл: `bridge-helpers.ts:105-110`, `bridge-rpc.ts:21, 45`
  - Фикс: без `stack` в production; ключ `${appId}:${requestId}`.

### Несостыковки между модулями
- **FX1** — `use-wallet-queries.ts:16-35` документирует `UTXO.amount` как сатоши и `useWalletBalance` (мёртвый) делит на 1e8, тогда как билдер/donate/legacy трактуют как PKOIN — первопричина F5/F6.
- **FX2** — `manifest-loader.ts:46, 93` ходит сырым `fetch` (мимо `appFetch`/Tor); иконки/iframe — напрямую.
- **FX3 (i18n)** — `'Insufficient funds…'` из `build-transfer-transaction.ts:83` уходит в UI как есть (`wallet-transfer.vue:294`, `donate-modal.vue:182`, `mini-app-payment-modal.vue:140`); `free-balance-api.ts:150` русская строка.
- **FX4** — Мёртвые дубли: `pkoin-chart/consts.ts` vs локальные в `pkoin-chart.vue:110-120`; `wallet-transfer/consts.ts::ERROR_MESSAGES`; `PERMISSION_I18N_IDS` = `PERMISSION_IDS`; `iconFromScope` = `getBuiltInIconUrl`.
- **FX5 (low)** — `getaddresstransactions` `[addr, height, count]` (`wallet-history.vue:171`) vs legacy `[addr, block, pageStart, pageSize, direction, types]` — если сигнатура legacy-подобная, третий параметр = `pageStart=30`. Нужна живая проверка.
- **FX6** — Три ручных transfer-UI считают fee одинаково; mini-app payment — иначе (P2-4).
- **FX7** — Заглушки `registerForNotifications` (`true`), `complain` (молчаливый успех), `currency` (`{}`) — помечены TODO.

### Проверено — ОК
- Origin-guard: строгое равенство `URL.origin`; ответы с `targetOrigin = canonical`; парсер Zod-ограничен.
- iframe: `sandbox` без `allow-top-navigation`, `credentialless`, `referrerpolicy=no-referrer`.
- `rpc` action не может заставить хост подписать запрос.
- `SafeUrl` режет `javascript:`/`data:`/`file:`.
- WS-поток `transaction` не пушится приложениям; KV-store не экспонируется.
- Rate limiter корректен; permissions-store: session не персистится, uniq не пишется.
- Payment modal: payload снапшот после Zod; `payment_modal_busy`; double-submit защищён.
- Билдер перевода/donate/wallet-transfer математика корректна и согласована; `validateAddress` на blur.
- Earnings ÷1e8 сверено с legacy; pkoin-chart через `appFetch`; Limits page по реальному `getuserstate`.
- classify-tx 1:1 legacy; i18n все 184 ключа + динамические.
- `assertInstallIdentity` закрывает угон id built-in.
