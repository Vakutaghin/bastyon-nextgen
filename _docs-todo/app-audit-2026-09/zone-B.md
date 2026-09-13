## Зона: B — blockchain core / транзакции / RPC-транспорт / WS / Tor

### Находки
- **B1 · 🟠 высоко · logic/data** — Бродкаст транзакции переезжает на следующую ноду по таймауту: ложный «Failed to send» для уже отправленной tx → повторная отправка пользователем
  - Файл: `src/helpers/api/rpc-retry.ts:46-62`, `src/helpers/api/request.ts:50-70,230-236`, `src/blockchain/core/transactions/transaction-sender.ts:45-49`
  - Суть: `sendrawtransactionwithmessage` идёт через общий `retryWithBackoff`; `AbortError` (30 с) превращается в обычный `Error` без `code` → не «логическая» → тот же подписанный hex шлётся на следующую ноду. Ни одна из семи точек отправки не отличает «нода приняла, но ответила медленно» от «не отправлено» и не проверяет `getrawtransaction(txid)` перед объявлением провала.
  - Сценарий: перевод 100 PKOIN → нода A приняла tx в mempool, ответ > 30 с → failover на B: B отвечает «already in chain / consensus duplicate» (логическая ошибка → `Failed to send transaction`), либо все ноды таймаутят → «All RPC servers failed». Пользователь видит ошибку и шлёт ещё раз → двойной платёж; для постов/комментов — дубли.
  - Фикс: для `sendrawtransactionwithmessage` не делать межнодовый failover по таймауту (один сервер, длинный таймаут); при таймауте/«already in mempool/chain» вернуть txid, посчитав его локально (`tx.getId()`) и/или проверив `getrawtransaction`.
  - Уверенность: high по механике; medium по точному ответу ноды на дубль.

- **B2 · 🟠 высоко · security** — Tor fail-open: при «включён, но не ready/failed» весь трафик (RPC с подписью, WS с адресом, Matrix) молча идёт напрямую; Rust-сторона тоже подменяет клиент на direct
  - Файл: `src/stores/tor-store.ts:110-112` (`shouldTorify = enabled && status==='ready'`), `src/helpers/api/fetch-strategies.ts:24-28`, `src/helpers/tor/tor-websocket.ts:259-268`, `src-tauri/src/tor/mod.rs:59-74,232` (`pick_client` → `direct_client`, `used_tor:false`), `src/helpers/api/request-tor.ts:88` (`used_tor` только в debug-счётчик), `src/main.ts:71-72` (hydrate fire-and-forget).
  - Суть: нет kill-switch. UI обещает «all app network traffic will go through the Tor network» (`locales/en.ts:176`), но: (а) на каждом старте Tor бутстрапится 10–60 с, а `restoreSession`/лента/уведомления/`initMatrix`/WS стартуют сразу и уходят в клирнет с подписью и адресом; (б) если tor упал (`failed`) — всё идёт напрямую; (в) даже при `shouldTorify=true` Rust `tor_fetch` при `status != Ready` шлёт через `direct_client`, а JS игнорирует `used_tor=false`.
  - Сценарий: `tor:enabled=1`, перезапуск → в первые секунды `getuserprofile`/WS-subscribe с `signature.address` уходят с реальным IP → корреляция IP↔адрес.
  - Фикс: при `enabled && !ready` — держать запросы в очереди/бросать `TorNotReady` (fail-closed), в `torFetch` бросать при `resp.used_tor === false`, на Rust-стороне не падать на `direct_client`, когда Tor включён.
  - Уверенность: high.

- **B3 · 🟠 высоко · security** — Сетевые точки входа мимо `appFetch` и потому мимо Tor
  - 1. Все `<img :src>`/`<video>`/`<audio>`/`poster` — webview грузит напрямую, прокси webview под Tor не настроен (нет `proxy_url` в `src-tauri/src/lib.rs`/`tauri.conf.json`): аватары (`recommended-users.vue:11`, `comment-avatar.vue:23`, `post-composer.vue:50`), картинки постов, медиа мессенджера.
  - 2. hls.js с дефолтным XHR-лоадером — `src/b-components/content/video-player/services/hls-initializer.ts:133` (нет `loader`/`xhrSetup`), нативный HLS `initNativeHlsVideo`, mp4-fallback.
  - 3. `<iframe>`: YouTube `post-card.vue:79`, превью ссылок `composer-url-preview.vue:3`, мини-аппы `mini-app-frame.vue:9` — документ мини-аппы и subresources грузятся напрямую.
  - 4. Сырые `fetch`: `src/helpers/common/download-media.ts:36`, `src/b-components/content/video-player/composables/use-video-subtitles.ts:52`.
  - 5. `installTorWebSocketGlobalGuard` (`tor-websocket.ts:277`) никем не вызывается, `__torStoreSync` нигде не выставляется — мёртвый гард.
  - 6. Намеренно: `request-debug.ts:83` (checkIp), `tauri-transcoder.ts:211` (локальный asset) — ок.
  - Сценарий: Tor ready, лента → аватары/картинки/HLS-сегменты и YouTube-iframe уходят с реального IP; IPFS при этом честно блокируется под Tor, для медиа такой логики нет.
  - Фикс: системный прокси webview на SOCKS Tor (Tauri `proxy_url`), либо под Tor грузить медиа через `torFetch` → blob-URL, кастомный `loader` для hls.js, блокировать iframe/эмбеды с тем же предупреждением, что у IPFS.
  - Уверенность: high.

- **B4 · 🟠 высоко · ux-claim/data** — «Дополнительные кошельки» (Z-адреса, P2SH-P2WPKH) предлагаются для приёма и показываются с балансом, но потратить с них клиент не умеет
  - Файл: `src/pages/wallets-page/wallet-transfer/use-receive-address.ts:25-40`, `src/pages/wallets-page/use-wallet-balances.ts:207-210` (авто-создание 3 Z-адресов), `wallet-transfer.vue:262-283` (Send только с `mainAddr`), `src/blockchain/core/transactions/build-transfer-transaction.ts:92-110` (`addInput` без redeemScript), `address-generator.ts:243-290`.
  - Суть: нет пути, который берёт unspents Z-адреса и подписывает P2SH(P2WPKH)-вход. Средства, принятые на «дополнительный кошелёк», в этом клиенте неизрасходуемы.
  - Сценарий: копирует Z-адрес из «Получить», получает 50 PKOIN → баланс есть, в «Отправить» — «недостаточно средств».
  - Фикс: не предлагать Z-адреса на приём (оставить только просмотр), либо реализовать сборку с `redeemScript`/`witnessValue` и выбор источника.
  - Уверенность: high.

- **B5 · 🟠 высоко · data/consistency** — Два разных seed'а для деривации кошельков: `BST_WALLET_ADDRS_` из seed мнемоники, `BST_ADDITIONAL_WALLETS_LIST` — всегда из 32-байтного приватного ключа
  - Файл: `src/blockchain/wallet-addresses.ts:77-83` (приоритет `privateKeyAsSeed`), `use-wallet-balances.ts:191-192,208-209` (всегда `authStore.getKeyPair.privateKey`), `wallet-addresses.ts:32-64` (`deriveAndSaveWalletAddresses` от `mnemonicToSeed`), `src/mini-apps/actions/host-context-methods/auth.ts:28`.
  - Суть: страница кошельков никогда не использует мнемонику → для одного аккаунта два несовпадающих набора Z-адресов; index 0 = тот же ключ, что аккаунт, в P2SH-обёртке.
  - Сценарий: мини-аппа и вкладка «Балансы» показывают разные кошельки одного пользователя; средства с одного списка не видны в другом.
  - Фикс: один источник истины — при наличии мнемоники всегда `mnemonicToSeed`, privkey-as-seed только для аккаунтов без мнемоники; объединить ключи хранения.
  - Уверенность: high (тест `wallet-addresses.test.ts:114-116` подтверждает приоритет privkey).

- **B6 · 🟡 средне · logic** — `torFetch` игнорирует `AbortSignal` после старта и не передаёт `timeout_ms` → под Tor таймауты RPC (30 с) и health-пинга (4 с) не работают; холодный старт node-selector ждёт мёртвую ноду до 120 с
  - Файл: `src/helpers/api/request-tor.ts:61-105`, `src-tauri/src/tor/mod.rs:55` (reqwest timeout 120 с), `src/helpers/api/node-selector.ts:112-122` (`Promise.all`), `request.ts:50-52`.
  - Фикс: слушать `signal` (`invoke` + `abort` → reject `AbortError`, на Rust отменять future), прокидывать `timeout_ms`; не ждать всех проб (`Promise.any`).
  - Уверенность: high.

- **B7 · 🟡 средне · logic/consistency** — WS: `switchAccount` не переподписывает сокет, `connect()` жёстко берёт `proxy[0]` без failover, `pendingSubscriptions` не чистятся в `close()`
  - Файл: `src/blockchain/ws/ws-service.ts:95-103,131-141,206-211,356-379`, `src/blockchain/store/auth-store.ts:463-500`.
  - Сценарий: A → B через свитчер, публикация от B → `usePendingPostsRealtime` не получает `transaction`; события A продолжают приходить. При падении `1.pocketnet.app:8099` реалтайма нет вообще.
  - Фикс: в `switchAccount`/`signIn` делать `wsService.reconnect()`, чистить `pendingSubscriptions` в `close()`, брать хост из `orderedProxies()`.
  - Уверенность: high.

- **B8 · 🟡 средне · leak** — `TorWebSocket.close()` до завершения `tor_ws_connect` оставляет «зомби» на Rust-стороне, `_onOpen` игнорирует CLOSING; `ws-service.close()` не обнуляет `onopen`
  - Файл: `src/helpers/tor/tor-websocket.ts:98-115,146-152`, `src/blockchain/ws/ws-service.ts:116-129,369-375`.
  - Фикс: в `close()` запоминать флаг и после `tor_ws_connect` сразу `tor_ws_close`; в `_onOpen` при `CLOSING` закрывать; обнулять `onopen`.
  - Уверенность: high.

- **B9 · 🟡 средне · race** — Два параллельных `wsService.connect()` во время `await pickWebSocketCtor()` создают два сокета; первый — сирота с живыми хендлерами
  - Файл: `src/blockchain/ws/ws-service.ts:85-114`, `src/composables/use-explorer-ws-updates.ts:55-57`, `restore-session.ts:105,144`.
  - Фикс: `connectInFlight: Promise` (как `selectionInFlight` в node-selector).
  - Уверенность: medium.

- **B10 · 🟡 средне · data** — `useRpcQuery*` снимают `queryKey`/`params`/`enabled` один раз (не реактивны): `useUserState` после смены аккаунта показывает лимиты старого адреса
  - Файл: `src/composables/use-rpc-query.ts:53-69,92-108`, `src/composables/use-user-profile.ts:124-142`, `src/pages/limits-page/limits-page.vue:89-98`.
  - Сценарий: `/limits`, свитчер A→B → рефетч со старыми `parameters: [[A]]` → лимиты A под именем B. Если смонтировано до появления адреса — `enabled=false` навсегда.
  - Фикс: принимать `MaybeRef` и оборачивать в `computed` (как в `use-wallet-queries.ts:163-176`).
  - Уверенность: high.

- **B11 · 🟡 средне · consistency/data** — Локинг UTXO применяется в 8 отправителях и не применяется ещё в 5
  - Без `lockUTXOs`: `donate-action.ts:41-58`, `profile-update-action.ts:67-81`, `use-message-sending.ts:266-281`, `send-registration-transaction.ts:59-74`, `retry-registration-tx.ts:77-85`. Плюс `unspents-manager.ts:23-33`: повторный лок не продлевает TTL.
  - Сценарий: донат → сразу лайк/коммент → вторая tx на том же UTXO → `txn-mempool-conflict`.
  - Фикс: лочить внутри `buildTransaction`/`buildTransferTransaction`, TTL через `Map<key, expiresAt>`.
  - Уверенность: high.

- **B12 · ⚪ низко · logic** — Сдача ниже dust молча уходит в комиссию; контентная tx с входами в [700, 701) сат сжигает ~700 сат
  - Файл: `build-content-transaction.ts:99-107,176-178`, `build-transfer-transaction.ts:80-87`, `unspents-manager.ts:84-101`.
  - Фикс: набирать входы до `target + DUST_VALUE`, либо показывать реальную комиссию.

- **B13 · ⚪ низко · consistency** — Автодетект WIF с bitcoin-сетью, восстановление — с Pocketnet: вход по WIF невозможен ни в одном направлении
  - Файл: `key-validator.ts:182-188` (`ECPair.fromWIF(raw)` без network), `key-recovery.ts:126`.
  - Фикс: `ECPair.fromWIF(raw, [POCKETNET_NETWORK])` в детекторе.

- **B14 · ⚪ низко · logic** — `validateAddress` принимает любой Base58Check с любым version-byte и любой bech32
  - Файл: `address-validator.ts:97-166`, `use-receiver-search.ts:113`.
  - Фикс: сверять `decoded.version` с `POCKETNET_NETWORK.pubKeyHash/scriptHash`.

- **B15 · ⚪ низко · consistency** — Дубли/мёртвые хелперы транспортного слоя
  - `api-client.ts` (`createAuthenticatedApiClient`) не используется, `timeout` игнорируется; EXAMPLES.md:372 его продвигает. `services/retry.ts` не используется; третий классификатор таймаута. `error-codes.matchApiError` не используется. `signatures/transaction-signature.ts` не используется; content — объектная форма sign, transfer — позиционная (DEPRECATED-warn на каждый перевод). Два d.ts одного билдера (`types/btc17-types.ts` vs `lib/pocketnet/btc17.d.ts`). Шесть парсеров ответа `sendrawtransactionwithmessage` вместо `sendTransactionWithMessage`.

- **B16 · ⚪ низко · consistency (i18n)** — `free-balance-api.ts:150` русский текст мимо i18n; `captcha-api.ts:139` `language='ru'` всегда; `build-transfer-transaction.ts:83`/`build-content-transaction.ts:102` английские `Insufficient funds…` показываются как есть.

- **B17 · ⚪ низко · consistency (docs)** — README/EXAMPLES: импорт из несуществующего `@/helpers/request`; `saveEncryptedMnemonic(mnemonic, true)` при сигнатурах без аргументов; описание device fingerprint устарело после P0-1; «bitcoinjs-lib» вместо btc17.

### Несостыковки между модулями
- **B18 · 🟡 средне · consistency** — Четыре независимых «текущих ноды»: RPC (`node-selector`), WS (`proxy[0]`), block-explorer (`explorer-preferred-node`), регистрация (`proxy-with-wallet`). tx уходит на одну, подтверждение по WS ждётся от другой.
- **B19 · 🟡 средне · consistency** — `constants/network.ts:18-21` bip32 `0x0488b21e/0x0488ade4` vs `lib/pocketnet/modules/networks.js` `0x043587cf/0x04358394`.

### Проверено — ОК
- rpc-retry: «логические» ошибки не перебираются; `isTimeout500` получает `httpStatus`; подписанные params переиспользуются корректно (nonce живёт 6 мин).
- node-selector: дедуп перевыборов, восстановленная из LS нода не валидна, sticky после failover.
- api-signature: свежий nonce, sha256(nonce) подписывается; нет логов ключей.
- mnemonicToSeed/recoverKeyPairFromMnemonic: NFKD, русский wordlist, кэши чистятся при logout.
- toSatoshis = Math.round; feemode/receiverAmount согласованы в donate/wallet-transfer/messenger.
- OP_RETURN ≤ 80 байт; sequence при locktime; addNTime(0).
- sendTransactionWithMessage не фабрикует txid; registration-status не понижает сетевую ошибку.
- WS: backoff ≤ 30 с, scheduleReconnect идемпотентен, исключения в хендлерах изолированы.
- use-feed-queries кладут computed(address) в ключ; explorer инвалидируется по префиксу.
- fetch-tunnel, pkoin-chart (CoinGecko), PeerTube, Matrix, image-upload — через appFetch.
- Локали: все ключи зоны есть в ru/en; словари симметричны.
