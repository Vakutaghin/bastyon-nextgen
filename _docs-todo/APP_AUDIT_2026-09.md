# Аудит bastyon-nextgen — логика, безопасность, несостыковки (2026-09-13)

> **Объект:** весь клиент (`src/`, `src-mobile/`, `src-tauri/` кроме IPFS-модуля), состояние `main` = `f5fda70`.
> **Метод:** 9 параллельных ревью по зонам (A–I, по одному агенту на зону) + ручная сверка каждого 🔴/🟠 по коду,
> живые пробы к `1.pocketnet.app:8899` (read-only RPC), runtime-пробы обёрток antd через vitest, прогон `tsc`/`eslint`/скриптов.
> Каждая находка имеет `file:line`, конкретный сценарий и фикс. Подробные отчёты по зонам — `app-audit-2026-09/zone-*.md`.
>
> **Не входит:** IPFS-модуль (закрыт вчера); остатки трёх прежних аудитов (ревью 2026-07-02, IPFS, план сейфа) —
> сведены в `AUDIT_LEFTOVERS_2026-09-13.md` (P2-4, P2-5, P2-11, P3-1…P3-5, VP-1…VP-12) и здесь не дублируются, но план учитывает их;
> нереализованные фичи из `FEATURE_GAP_ROADMAP.md` (кроме случаев, когда UI делает вид, что фича работает).
>
> **Статусы:** `[ ]` открыто · `[x]` закрыто (коммит) · `[~]` принято как есть / отложено с причиной.
> Статус вести здесь, в разделе 7 (план). Разделы 1–5 — реестр; при закрытии пункта ставить `[x]` и хэш рядом.

---

## 0. Сводка

| Зона | Что | 🔴 | 🟠 | 🟡 | ⚪ | Итого |
|---|---|---|---|---|---|---|
| A | bootstrap / сессия / регистрация / сейф / мультиаккаунт | 0 | 5 | 8 | 7 | 20 |
| B | blockchain core / RPC / WS / Tor-транспорт | 0 | 5 | 8 | 6 | 19 |
| C | лента / посты / pending / комментарии / оценки | 3 | 5 | 8 | 8 | 24 |
| D | композер / санитайзер / картинки / видео | 1 | 5 | 11 | 8 | 25 |
| E | мессенджер | 1 | 5 | 12 | 4 | 22 |
| F | кошелёк / donate / mini-apps | 1 | 6 | 11 | 2+7 | 27 |
| G | уведомления / поиск / профиль / настройки / хедер | 1 | 5 | 8 | 6 | 20 |
| H | i18n / IndexedDB / Tauri / Tor-модуль / mobile / build | 0 | 8 | 8 | 4 | 20 |
| I | эксплорер / embed / shared UI / layout / e2e | 0 | 2 | 10 | 8 | 20 |
| — | сквозные (мои проверки: дубли, декодеры, baseline) | — | — | — | — | +8 |

После дедупликации (одна и та же проблема в 2–4 зонах) в реестре ниже: **7 🔴 · 42 🟠 · 71 🟡 · 40 ⚪**.

**Десять вещей, которые ломают продукт прямо сейчас (не «когда-нибудь»):**
1. K1 — обход HTML-санитайзера через `bastyon://`/`ipfs://` href: любой пост накрывает экран всем читателям (и XSS, если уедет meta-CSP).
2. K3 — в мессенджере входящие фото/видео/файлы показываются как hex-строка ключа, а не как медиа.
3. K4 — ответ на ответ в комментариях уходит с неверным `parentid`: комментарий теряется, tx оплачена.
4. K5 — оценка отредактированного поста идёт по `hash` вместо `txid` и никогда не подтверждается.
5. K6 / V13 — обёртки `InputSearch`/`Input` глотают пропсы: Enter в поиске мёртв, мнемоника при входе видна открытым текстом.
6. K2 — мини-аппа через `videos.remove` получает свежую подпись пользователя на любой хост и удаляет видео без согласия.
7. V1 — таймаут RPC при бродкасте транзакции → тот же hex уходит на следующую ноду, пользователь видит ошибку и платит дважды.
8. V4 / V5 — история кошелька и доп. балансы показывают «0 PKOIN» (PKOIN форматируются как сатоши).
9. V8 — брошенная регистрация (`step<2`) на следующем запуске стирает ВСЕ локальные аккаунты.
10. V41 — release-workflow не собирается: `npm ci` против устаревшего `package-lock.json` (16 зависимостей отсутствуют).

---

## 1. 🔴 Критично

- [x] **K1 · security · [D1]** — Обход санитайзера: `bastyon://`/`ipfs://`/`ipns://` href возвращается без экранирования → инъекция атрибутов в `<a>`. ✅ закрыто 2026-09-13: `escapeAttrValue` + тест `sanitize-html.test.ts`
  `src/helpers/content/sanitize-html.ts:70-79` (`return value` вместо `escapeAttrValue`). Сток — `text-formatter.ts:108,127` → v-html в post-card-content, comment-card, last-comment-preview, всех `block-*`.
  Сценарий (проверен прогоном): `<a href='bastyon://" style="position:fixed;inset:0;z-index:2147483647;background:#fff'>x</a>` в посте → экран каждого читателя накрыт слоем; `on*`-атрибуты сегодня держит только meta-CSP в `index.html` (`tauri.conf.json` разрешает `'unsafe-inline'`).
  **Фикс:** `return escapeAttrValue(value)` (экспорт из `xss`) в ветке своих схем; тест на payload с кавычкой.

- [ ] **K2 · security · [F1, D3]** — Mini-app `videos.remove` без permission: подпись `blockChainAuth` (nonce без привязки к хосту, TTL 360 с) отправляется на хост из `peertube://<host>/<id>`, затем DELETE без диалога.
  `src/mini-apps/actions/media.ts:53-64` (`permissions: []`), `host-context-methods/media-upload.ts:23-32`, `services/peertube/peertube-videos.ts:196-210`, `peertube-auth.ts:108-116,204-226`.
  Сценарий: `{action:'videos.remove', data:{url:'peertube://evil.example/x'}}` → evil.example переигрывает подпись на настоящем инстансе и получает access+refresh token жертвы (в веб/Capacitor и в Tauri под Tor — `tor_fetch` без скоупа).
  **Фикс:** uniq-промпт с хостом/id + allowlist PeerTube-хостов от ноды; в идеале `data` подписи = хост.

- [ ] **K3 · logic · [E1]** — Мессенджер: `mapEventToMessage` знает только `m.audio`; `m.image`/`m.video`/`m.file`/`pocketnet_transaction` маппятся как текст → в чате и превью диалога строка из 64 hex (секрет медиа), hex ещё и персистится в `decryptedMessages`. Ветки выпали при консолидации стора (`fb599f9`).
  `src/b-components/messenger/store/messenger-chat-store/use-message-mapping.ts:55-68`; мёртвые потребители `image-message.vue`, `video-message.vue`, `file-message.vue`, `transaction-message.vue`.
  **Фикс:** вернуть маппинг msgtype → `type` (url/info/name/posterUrl, JSON body для legacy `m.file`), в `tryDecrypt` не трактовать медиа-секрет как текст; юнит-тест на каждый msgtype.

- [ ] **K4 · logic · [C1]** — Ответ на ответ: `openReplyEmpty(reply.id, reply.id)` → `parentid = id ответа` (третий уровень), legacy шлёт `parentid = корень`, `answerid = ответ`. Pending ложится в `mergedRepliesByParent[reply.id]` и не рендерится; после подтверждения `getcomments(post, rootId)` третий уровень не вернёт. Tx оплачена, коммент «пропал».
  `post-card-comments/composables/use-comment-form.ts:391-396, 314-315`, `comment-card.vue:236-243`, `use-comments-replies.ts:66-86`.
  **Фикс:** для level 2 передавать `parentId = reply.parentid || reply.id`, `answerId = reply.id`; тест на payload `sendReply`.

- [ ] **K5 · data · [C2]** — Оценка поста уходит и опрашивается по `post.hash` (хеш последней правки). Для отредактированных постов (`edit:true`, 7 из 120 в живой ленте) `getpagescores([hash])` → `[]`, tx `upvoteShare{share:<edit-hash>}` не на тот контент; оптимистичная оценка 10 минут «в ожидании» и молча откатывается.
  `post-card.vue:108` (`:share-id="String(post.hash || post.txid || post.id)"`), `star-rating/use-star-rating.ts:191,199`, `pending-ratings-store.ts:113-119`. Контраст: комментарии/удаление/жалоба используют `txid || hash`.
  **Фикс:** `share-id = String(post.txid || post.hash || post.id)`; ключ pending-ratings по txid.

- [ ] **K6 · logic · [G1, I2]** — `InputSearch` объявляет `onSearch/placeholder/value/allowClear/maxLength` через `defineProps` и пробрасывает в `Input.Search` только `$attrs` → `@search` никогда не доходит. Enter/кнопка в поиске хедера, `@ник`-навигация, вставка Bastyon-ссылки — мертвы с первого коммита; в `mini-apps-grid` `v-model:value` работает как uncontrolled.
  `src/components/input-search/input-search.vue:3-7,19-21`, `input-search/types.ts:7-13`, `header-search.vue:8-18,120-170`. Проверено vitest-монтированием (0 вызовов `onSearch` на Enter; чистый `Input.Search` — работает).
  **Фикс (общий с V13, S63):** во всех обёртках `src/components/*` — `inheritAttrs:false` + `v-bind="{ ...$attrs, ...props }"` (или не объявлять antd-пропсы); тест «@search доходит».

- [ ] **K7 · ux-claim · [C3]** — «Похожие видео» на странице поста не загружаются никогда: `getprofilefeed` с 13 параметрами (адрес на индексе 9), нода отвечает `No profile address`; блок скрыт по `videos.length > 0`, ошибка не показывается. Живая проба: 13-param → ошибка, 14-param → 6 видео.
  `src/composables/use-related-videos.ts:37-51`; та же раскладка в мёртвом `use-feed-queries.ts:132-146,206-220`; правильная — `use-profile-feed.ts:88-103`.
  **Фикс:** `''` перед `address.value` (индекс 9); удалить `use-feed-queries.ts`.

---

## 2. 🟠 Высоко

### Деньги и транзакции
- [ ] **V1 · [B1]** — Бродкаст `sendrawtransactionwithmessage` идёт через `retryWithBackoff`: таймаут 30 с → `Error` без `code` → «сетевая» → тот же подписанный hex на следующую ноду; вторая нода отвечает «already in chain» (логическая ошибка) → «Failed to send» → пользователь шлёт ещё раз → двойной платёж/дубль поста. `rpc-retry.ts:46-62`, `request.ts:50-70,230-236`, `transaction-sender.ts:45-49`. **Фикс:** для бродкаста — один сервер, длинный таймаут, при таймауте/«already in mempool» вернуть локально посчитанный `tx.getId()` и/или проверить `getrawtransaction`.
- [ ] **V2 · [E6]** — PKOIN-донат в чате: tx ушла, `sendPkoinTransaction` (Matrix) упал → `submitError` → «Отправить» снова → вторая tx. `use-message-sending.ts:283-301`, `pkoin-transfer-modal.vue:147-170`. **Фикс:** фазовое состояние: после `txid` только «повторить сообщение».
- [ ] **V3 · [F7]** — Поиск получателя: `receiverAddress` ставится на ветке «похоже на адрес» и не сбрасывается на ветке «поиск по нику» → в поле «bob», перевод уходит на прежний адрес A. `use-receiver-search.ts:66-88`, `wallet-transfer.vue:226-243`. **Фикс:** обнулять `receiverAddress/receiverLogin` до выбора результата.
- [ ] **V4 · [F5]** — История кошелька «0 PKOIN» во всех строках: `classifyWalletTx` суммирует `vout.value` (PKOIN, как в эксплорере/legacy), а `formatPkoin(row.amount,4)` делит на 1e8. `wallet-history.vue:42`, `classify-tx.ts:19,59`. **Фикс:** `formatExplorerPkoin(row.amount)`.
- [ ] **V5 · [F6]** — Балансы доп. кошельков: `txunspent.amount` (PKOIN) форматируется как сатоши; `totalBalance = profile.balance(сат) + sumWallets(PKOIN)`. `use-wallet-balances.ts:57-76,106-122`, `parse-tx-unspent.ts:13`; первопричина — JSDoc в `use-wallet-queries.ts:16-35` называет `UTXO.amount` сатоши. **Фикс:** единая шкала + поправить doc, удалить мёртвый `useWalletBalance`.
- [ ] **V6 · [B4, F18]** — Вкладка «Получить» предлагает Z-адреса (P2SH-P2WPKH, автосоздание 3 шт.) и показывает баланс, но ни один путь не подписывает P2SH-вход (`addInput` без redeemScript). Средства на доп. кошельке неизрасходуемы в этом клиенте. `use-receive-address.ts:25-40`, `use-wallet-balances.ts:207-210`, `build-transfer-transaction.ts:92-110`. **Фикс:** решение владельца (раздел 6, Р2).
- [ ] **V7 · [B5]** — Два seed'а деривации: `deriveAndSaveWalletAddresses` от `mnemonicToSeed`, а страница кошельков всегда передаёт `getKeyPair.privateKey` → `privateKeyAsSeed` → для одного аккаунта два несовпадающих набора Z-адресов (мини-аппы получают первый). `wallet-addresses.ts:77-83`, `use-wallet-balances.ts:191-192,208-209`. **Фикс:** при наличии мнемоники всегда `mnemonicToSeed`; объединить ключи хранения.

### Аккаунты, сессия, секреты
- [ ] **V8 · [A3]** — `pending_registration.step<2` на буте → `clearAllUserData()` для ВСЕХ аккаунтов; `clearAllUserData`/`removeAccount` не чистят `pending_registration`. Сценарий: брошенная регистрация → «Выйти» → вход по мнемонике A → следующий запуск стирает A. `restore-session.ts:69-79`, `storage-manager.ts:82-117`. **Фикс:** удалять только `pending.address`, восстанавливать прежний `currentAccount`; чистить pending в `clearAllUserData`.
- [ ] **V9 · [A4]** — Отмена/ретрай регистрации не откатывает персист: отменённый B остаётся `currentAccount` (переход на `/settings` логинит в него), каждый ретрай после ошибки шага 3 минтит нового сироту. `register-modal.vue:263-266,306-316`, `auth-store.ts:145-150,207-219`. **Фикс:** `keys.removeAccount(address)` + восстановление прежнего; переиспользовать `pending.address`.
- [ ] **V10 · [A2]** — Стейт регистрации (`mnemonic`, watcher) не привязан к адресу: регистрация B → «Добавить аккаунт» C → тик watcher'а → модалка «Сохраните сид» с мнемоникой B поверх сессии C, `pending_registration` удалён, tx B не дослан. `use-registration-flow.ts:92-115,157-186`, `registration-status-watcher.ts:45-59`. **Фикс:** хранить адрес регистрируемого, сверять, останавливать watcher при смене.
- [ ] **V11 · [A5]** — «Добавить аккаунт» с опечаткой в мнемонике роняет текущую сессию (`clearProfile` до попытки, `isAuthenticated=false` в catch, `_cancelSignIn → clearKeys`); fallback в `sign-in-modal.ts:93-99` — `signOut()` всех. `auth-store.ts:250-259,158-164,310-319,493-500`. **Фикс:** снапшот сессии и восстановление в catch; `removeAccount(new)+switchAccount(prev)`.
- [x] **V12 · [A1]** — `needs-reset` стирает всё молча; `navigator.storage.persist()` только из Settings → Security; `mintDeviceVault` без round-trip verify. Вытеснение best-effort IDB → аккаунт «исчез». `restore-session.ts:49-54`, `crypto-vault.ts:185-196,292-310`. **Фикс:** persist при первом персисте, verify, недискардимая модалка «восстановите по 12 словам». ✅ закрыто 2026-09-13: persist при создании ключа, verify в `mintDeviceVault`, модалка reset с подтверждением/«Позже», re-bootstrap с fingerprint; e2e `e2e/vault.spec.ts`
- [ ] **V13 · [I1]** — Обёртка `Input` глотает `type/placeholder/disabled/allowClear` (та же причина, что K6) → мнемоника в sign-in видна открытым текстом, «глаз» не работает, поле редактируемо при `loading`. `src/components/input/input.vue:3`, `sign-in-modal.vue:19-26`. **Фикс:** см. K6; тест «type=password доходит до DOM».
- [ ] **V14 · [D6]** — OAuth-токены PeerTube (`token_<address>_<host>`, access+refresh), `resumable_*`, `bastyon_post_draft` живут в localStorage и переживают `signOut`. `peertube-auth.ts:50-72`, `storage-manager.ts:82-117`. **Фикс:** чистить по префиксам в `clearAllUserData`; токены — в память/сейф.
- [x] **V15 · [E2, H9]** — Открытый текст всех расшифрованных DM в IndexedDB `decryptedMessages` и Matrix sync-БД не удаляются при `signOut`/`removeAccount` (`purgeDecryptedCache` нигде не вызывается; `store.destroy()` = `db.close()`). `decryption-cache.ts:75-88`, `auth-store.ts:322-360,503-531`. **Фикс:** `clearDecryptedForUser` + `indexedDB.deleteDatabase(bastyon-matrix-sync:<userId>)` при выходе/удалении (при `switchAccount` — решение Р6). ✅ закрыто 2026-09-13: `matrixService.purgeLocalData` при signOut (`logout({purge:true})`) и `removeAccount`
- [ ] **V16 · [G8]** — CSS-инъекция через обложку профиля: `background-image: url(${props.image})` в styled без экранирования, значение — on-chain `accSet.cover`. `)` закрывает `url(`, `}` — правило → дефейс/UI-redress + пиксель на `https:`. `profile-cover/styled.ts:30`, `profile-page.vue:145-169`. **Фикс:** `:style` с `JSON.stringify(url)` после валидации `http(s)` или `<img>`.
- [ ] **V17 · [D2]** — Tauri-команды без валидации путей: `read_file` (не используется фронтом вообще), `delete_temp_file` (любой путь), `transcode_video` (`output_path` от фронта, `ffmpeg -y`), `get_video_metadata`; `build.rs` без ACL для app-команд. `src-tauri/src/lib.rs:37-60,118-121,154-171,284-316`. **Фикс:** удалить `read_file`; принимать только `temp_dir()/tauri_(video|output)_*`; `output_path` генерировать в Rust.
- [ ] **V18 · [H2]** — Tor `ControlPort 127.0.0.1:<port>` + `CookieAuthentication 0` без пароля; апп контрол-порт не использует. Любой локальный процесс: `AUTHENTICATE` → `SETEVENTS STREAM` (все хосты назначения), `SETCONF`. `src-tauri/src/tor/config.rs:19,41`. **Фикс:** убрать `ControlPort` (или cookie-auth 0600).
- [x] **V19 · [H6]** — В release регистрируются ОС-глобальные хоткеи F12 / Ctrl+Shift+I → devtools Bastyon открываются из любого приложения, чужое приложение хоткей не получает. `lib.rs:694-701,604-613`. **Фикс:** снять глобальную регистрацию в release (P3-5 — отдельно флаг `devtools`). ✅ закрыто 2026-09-13: хоткеи и `devtools` только в debug / cargo-фиче `devtools`

### Tor
- [ ] **V20 · [B2, H10]** — Fail-open: `shouldTorify = enabled && status==='ready'`; во время бутстрапа (10–60 с на каждом старте) и после `failed` весь трафик (RPC с подписью, WS с адресом, Matrix) идёт напрямую; Rust `pick_client` тоже отдаёт `direct_client`, JS игнорирует `used_tor=false`. `tor-store.ts:110-112`, `fetch-strategies.ts:24-28`, `src-tauri/src/tor/mod.rs:59-75,232`, `process.rs:66-70`. **Фикс:** fail-closed: при `enabled && !ready` — очередь/`TorNotReady`; бросать при `used_tor===false`.
- [ ] **V21 · [B3, H1, D15]** — Диалог обещает «весь трафик через Tor», но мимо `appFetch` идут: все `<img>/<video>/<audio>/poster` (аватары, картинки постов, медиа чата), hls.js XHR (`hls-initializer.ts:133` без loader) и нативный HLS, iframe (YouTube `post-card.vue:79`, превью `composer-url-preview.vue:3`, мини-аппы `mini-app-frame.vue:9`), сырые `fetch` (`download-media.ts:36`, `use-video-subtitles.ts:52`, `manifest-loader.ts:46,93`), мёртвый `installTorWebSocketGlobalGuard`. Прокси webview (`proxy_url`) не настроен. Пост с `peertube://evil-host/…` раскрывает IP каждого читателя при монтировании карточки. **Фикс:** решение Р1 (proxy_url для webview vs честный текст + блокировка медиа/iframe под Tor).
- [ ] **V22 · [H3]** — `TorWebSocket` никогда не OPEN: `spawn_ws_loops` эмитит `tor:ws:<id>:open` синхронно до возврата `id` из `tor_ws_connect`, а JS подписывается после `await invoke` — Tauri не буферизует события. Итог: под Tor realtime (pending-посты, комментарии, explorer) не работает никогда, бесконечный reconnect. `src-tauri/src/tor/ws.rs:94,99,121`, `tor-websocket.ts:124-141`. **Фикс:** id генерировать на JS и подписываться до `invoke`, либо эмитить `open` по отдельной команде.

### Mini-apps
- [ ] **V23 · [F2]** — Промпт разрешения по 30-секундному RPC-таймауту резолвится `denied` и **персистится** как отказ пользователя; модалка остаётся, «Разрешить» игнорируется. `permission-resolver.ts:111-133`, `bridge-rpc.ts:24-26`. **Фикс:** при abort не персистить и закрывать модалку.
- [ ] **V24 · [F3]** — Гранты ключуются только `manifest.id`; remote-session/сайдлоад не персистятся → после перезапуска любой origin с тем же id наследует `account/chat/authFetch` без промпта (`assertInstallIdentity` защищает только built-in). `permissions-store.ts:41,128-152`, `apps-store.ts:229-252`. **Фикс:** хранить канонический origin в гранте, сверять при `isGranted`.
- [ ] **V25 · [F4]** — SSRF: allowlist fetch-tunnel объявляет автор манифеста, loopback/private не фильтруются, `authFetch` без allowlist = любой URL с подписью, редиректы следуются; Tauri-скоуп разрешает `http://127.0.0.1:*`, `tor_fetch` без скоупа. `fetch-tunnel.ts:55-66,107-111`, `types/manifest.ts:197-210`, `actions/account.ts:109-121`, `capabilities/default.json:22`. **Фикс:** запрет loopback/private/не-https, `redirect:'manual'`, permission-гейт для tunnel.
- [ ] **V26 · [H4]** — В prod-бандле Tauri действуют ДВЕ CSP (meta `index.html` + заголовок `tauri.conf.json`), пересечение `frame-src` запрещает iframe удалённых мини-апп (и `http://127.0.0.1:*` для IPFS-viewer). В `tauri dev` не воспроизводится. `index.html:22`, `tauri.conf.json:29`. **Фикс:** один источник CSP (убрать meta при `VITE_TAURI` или синхронизировать).
- [ ] **V27 · [H8, F13]** — Десктоп без Tor: `appFetch` → plugin-http со скоупом `*.pocketnet.app`/matrix/127.0.0.1/dweb → CoinGecko (график PKOIN всегда «ошибка»), бэкенды мини-апп, PeerTube вне pocketnet.app — `url not allowed`. Под Tor тех же ограничений нет. `capabilities/default.json:17-29`, `fetch-strategies.ts:24-28`. **Фикс:** расширить скоуп (`api.coingecko.com`, `https://**` с клиентским фильтром из V25) или fallback.

### Мессенджер
- [ ] **V28 · [E3]** — Голосовое, записываемое в момент смены чата: `onBeforeUnmount → mediaRecorder.stop()` без `isCancelling`, `onstop` читает `store.activeChatId` (уже B) → запись для A уходит B. `use-voice-recording.ts:165-184`, `chat-room.vue:409-413`. **Фикс:** `isCancelling=true` на unmount или захват `chatId` при старте.
- [ ] **V29 · [E4]** — Глобальный `document.addEventListener('paste')` живёт, пока виджет скрыт (окно прячется через opacity, ChatRoom смонтирован, `activeChatId` не сброшен) → Ctrl+V скриншота в композер поста молча отправляет его собеседнику. `use-paste-drop.ts:116`, `messenger-window/styled.ts:22-24`, `messenger-store.ts:486-500`. **Фикс:** слушать paste только на поле чата; сбрасывать `activeChatId` при закрытии виджета.
- [ ] **V30 · [E5]** — Свёрнутый виджет с открытым чатом: unread=0, без звука/бейджа/уведомления, но серверу уходит read-marker → собеседник видит «прочитано». `messenger-store.ts:192-197,363-409`. **Фикс:** сбрасывать `activeChatId` при закрытии; read markers только при `isOpen && visible`.

### Лента, комментарии, уведомления, контент
- [ ] **V31 · [C4]** — `post-card-comments.vue` читает `post.address`, которого нет в `AdaptedPost` (`author.address`) → `postAuthorAddress=''`: модерация автором, `disableBannedByAuthor`, буст автора в сортировке — мертвы. `post-card-comments.vue:279-282,339-347,705-710`. **Фикс:** `props.post.author?.address`.
- [ ] **V32 · [C5, G6]** — `switchAccount`/`signIn` не сбрасывают `user-relations` (гард `isInitialized`), `pending-posts`, `comments`, `pending-ratings`, `posts-store` → B видит подписки, блок-лист (и кликает «Разблокировать» от B), pending-элементы A; `poll()` шлёт `getpagescores(postIds_A, B)`. `auth-store.ts:463-505,340`, `user-relations-store.ts:90-94`, `pending-ratings-store.ts:41-48`. **Фикс:** reset всех сторов в `switchAccount`/`signOut`; `initedForAddress`.
- [ ] **V33 · [C6]** — «Сначала лучшее»: `depth` передаётся в днях (30), нода считает блоками → 2 поста и «всё загружено»; «всё время» (99999) → `sql request timeout`. Legacy шлёт 7000–10000. `filters-store-consts.ts:31-51`, `feed-queries.ts:74-96`. **Фикс:** `depth` в блоках (≈1440/сутки), «всё время» ограничить.
- [ ] **V34 · [C7 + моя проверка]** — `safeDecode` в `use-feed.ts:79-85` заменяет `+`→пробел до `decodeURIComponent`; живые посты не URL-кодированы → «C++» → «C   », «+7 900…» → « 7 900…». Применяется к title/content/preview/lastComment и в поиске. **Фикс:** декодировать только при `%[0-9A-F]{2}`, `+` не трогать; один декодер на проект (X3).
- [ ] **V35 · [C8]** — Неудачная подгрузка страницы: `await refetch()` vue-query глотает ошибку → `isLoadingMore=true` навсегда; `content-feed.vue:69-82` показывает ошибку ВМЕСТО 60 загруженных постов. `use-infinite-feed.ts:211-227`. **Фикс:** `watch(error)` → сброс флага; ошибку страницы под списком.
- [ ] **V36 · [D4]** — Редактирование теряет `url` (видео/аудио → `share` вместо `video`, `u:''`), `settings` (пост «только подписчикам» `f:'1'` после правки опечатки становится публичным) и `language`. `composer-source.ts:12-29,77-85`, `use-post-composer.ts:77-93,167-191`; legacy `Share.import` сохраняет. **Фикс:** расширить `ComposerSource`, инициализировать `uploadedVideoUrl/visibility/language` из источника.
- [ ] **V37 · [D5]** — Tauri-транскод: `result.push(...Array.from(chunk))` на 100 МБ → `RangeError` детерминированно для файлов >100 МБ (лимит UI 500 МБ); 5–100 МБ гонятся `number[]`-JSON'ом (8–10× памяти). `file-worker.ts:26-30`, `tauri-transcoder.ts:255-333`, `lib.rs:37`. **Фикс:** raw-тело `invoke` чанками или путь из dialog-плагина без копирования.
- [ ] **V38 · [G2]** — Уведомления не приходят, пока не открыть выпадашку на этом устройстве: единственный писатель `notificationsLastBlock` — `persistReadPointer()`; до этого каждый опрос ставит `lastBlock=head` и спрашивает `getmissedinfo(address, head)`. `notifications-store.ts:93-108,150-151,254-263`. **Фикс:** курсор фетча персистить при каждом опросе отдельно от read-pointer.
- [ ] **V39 · [G3]** — Каждый 30-секундный опрос пересобирает `items` из IDB без snapshot'ов (`user/share/comment`), а `enrichedIds` запрещает дозагрузку → имя/аватар актора и текст коммента деградируют до перезагрузки. `notifications-store.ts:141`, `notifications-enricher.ts:42-67,182`. **Фикс:** копировать snapshot'ы в кэши стора; не пересобирать список целиком.

### Платформа и сборка
- [ ] **V40 · [H5]** — В Tauri (macOS/Linux) `window.open(_, '_blank')` и `<a target=_blank>` — no-op: нет `tauri-plugin-opener`, `on_new_window` не задан (wry возвращает `nil`). «Поделиться → Twitter», внешние ссылки постов/чата, `externallink` мини-апп, сайт пользователя — ничего не происходит. `lib.rs:581-585`, `Cargo.toml`, 8 мест `window.open`. **Фикс:** opener-плагин + централизованный `openExternal(url)`.
- [x] **V41 · [H7]** — `release.yml` делает `npm ci` против `package-lock.json` от мая; в нём нет 16 зависимостей (`vue-i18n`, `zod`, `xss`, `@editorjs/*`, `@ffmpeg/*`…), `pnpm.overrides` npm игнорирует → релиз не собирается. **Фикс:** удалить `package-lock.json`, `pnpm/action-setup` + `pnpm install --frozen-lockfile`. ✅ закрыто 2026-09-13: `release.yml` на pnpm, `package-lock.json` удалён; добавлен `ci.yml`
- [ ] **V42 · [G7, A19, H18, I8]** — Язык: localStorage `bastyon_locale` (i18n, переключатель в логотипе) vs IndexedDB `bastyonAppLanguage` (ui-store, настройки); `loadLanguage()` на старте всегда `setI18nLocale(this.language)` с дефолтом из navigator (`'en'` vs `DEFAULT_LOCALE='ru'`) → выбор в шапке не переживает перезагрузку, мигание `ru→en`, вкладка «Общие» подсвечивает не тот язык, changelog в другом языке, `locale.changed`/`theme.changed` для мини-апп не срабатывают (`ui-store.theme` никем не пишется). `i18n/index.ts:20-38,54-66`, `ui-store.ts:9-16,151-176`, `header-logo.vue:96-102`, `main.ts:90-92`, `mini-apps/events/sources.ts:51-68`. **Фикс:** ui-store — единственный владелец; `loadLanguage` не применяет дефолт, если LS уже задан; sources подписать на i18n/use-theme.

---

## 3. 🟡 Средне

### Транспорт, WS, ноды
- [ ] **S1 · [B6]** — `torFetch` игнорирует `AbortSignal` после старта и не передаёт `timeout_ms` (reqwest 120 с) → под Tor таймауты RPC/health не работают; `probeAll` ждёт мёртвую ноду 120 с. `request-tor.ts:61-105`, `node-selector.ts:112-122`.
- [ ] **S2 · [B7, A8]** — WS: `switchAccount`/`signIn` не переподписывают сокет (подписка только в `onopen`), `connect()` жёстко `proxy[0]` без failover, `pendingSubscriptions` не чистятся в `close()`. `ws-service.ts:95-141,206-211,356-379`.
- [ ] **S3 · [B8]** — `TorWebSocket.close()` до завершения `tor_ws_connect` оставляет зомби на Rust-стороне; `_onOpen` игнорирует CLOSING; `ws-service.close()` не обнуляет `onopen`. `tor-websocket.ts:98-152`.
- [ ] **S4 · [B9]** — Два параллельных `wsService.connect()` во время `await pickWebSocketCtor()` создают два сокета (restoreSession + explorer). `ws-service.ts:85-114`.
- [ ] **S5 · [B10, F17]** — `useRpcQuery*` снимают `queryKey/params/enabled` один раз → `/limits` после смены аккаунта показывает лимиты старого адреса; при монтировании до адреса `enabled=false` навсегда. `use-rpc-query.ts:53-108`, `use-user-profile.ts:124-142`.
- [x] **S6 · [B11]** — UTXO-лок есть в 8 отправителях и отсутствует в 5 (donate, profile-update, messenger sendPkoin, registration ×2); повторный лок не продлевает TTL. `unspents-manager.ts:23-33`. ✅ закрыто 2026-09-13: `selectAndLockUnspents` во всех 7 отправителях, лок продлевает TTL
- [ ] **S7 · [B18, I17]** — Четыре «текущих ноды»: RPC (`node-selector`), WS (`proxy[0]`), explorer (`explorer-preferred-node`, при этом управляет и историей кошелька вопреки тексту настройки), регистрация (`proxy-with-wallet`). Лейбл «Авто (round-robin)» описывает удалённое поведение.
- [ ] **S8 · [B19]** — `constants/network.ts:18-21` bip32 `0x0488b21e/0x0488ade4` vs вендоренный `networks.js` `0x043587cf/0x04358394`.
- [ ] **S9 · [A6, B13]** — Вход по WIF невозможен: детект `fromWIF(raw)` (сеть Bitcoin), восстановление `fromWIF(wif, POCKETNET)`; `plausibility.ts:17` не матчит несжатый Pocketnet-WIF. UI обещает «hex/WIF».

### Сессия, регистрация, аккаунты
- [ ] **S10 · [A7]** — Общий `BST_MNEMONIC` как fallback показывает сид ЧУЖОГО аккаунта («Показать сид» для A → сид B); `removeAccount` оставляет сид удалённого, legacy-ветка restore может его воскресить. `load-account-mnemonic.ts:19-24`, `keys-store.ts:160-198`.
- [ ] **S11 · [A9]** — `isAuthenticated=true` до персиста и последней проверки отмены; `resetMessenger(true)` в `signIn` → два параллельных Matrix-логина (две серверные сессии). `auth-store.ts:274-305`, `messenger-store.ts:302-305,618-623`.
- [ ] **S12 · [A10]** — Сид после регистрации показывается только в той же сессии; перезагрузка во время «регистрация в процессе» → 12 слов не показаны никогда; `setNeedShowMnemonic` нигде не вызывается; гейт «бэкап перед passphrase» — чекбокс. `use-registration-flow.ts:175-178,272-285`, `security-section.vue:30,106-108`.
- [ ] **S13 · [A11]** — «Регистрация в процессе» врёт: аккаунт без on-chain профиля крутит часики и поллит два RPC каждые 5 с бесконечно; фатальная ошибка tx (занятое имя, code 19) проглатывается, после перезагрузки pending снимается молча. `registration-status.ts:103-119`, `send-registration-transaction.ts:102-106`.
- [ ] **S14 · [A12, G20]** — `notifications.init()` без in-flight-guard и сверки адреса после `await` → ответ A дописывает уведомления и тосты A пользователю B; `reset()` не вызывается при выходе; исключение из IDB → `loading=true` навсегда. `notifications-store.ts:83-97,151-200`.
- [ ] **S15 · [A20]** — `pending_registration`: три читателя с разной семантикой (TTL 30 мин vs сырой `getItem`), два пути досыла tx, один без сверки `pending.address`.

### Лента, посты, комментарии, оценки
- [ ] **S16 · [C9]** — Асинхронный watcher `data` (после `await fetchAndMergeRepostOriginals`) применяет страницу старого таба/фильтра поверх нового. `use-infinite-feed.ts:150-206`, `use-profile-feed.ts:147-178`.
- [ ] **S17 · [C10]** — `refetch()` по WS-подтверждению и «Обновить ленту» рефетчат текущую страницу N, а не голову: подтверждённый пост исчезает до перезагрузки. `use-profile-feed.ts:285-291`, `content-feed.vue:23`.
- [ ] **S18 · [C11]** — Звёзды на своём посте кликабельны (нода отвергает, код 5 не классифицирован), все pre-validation ошибки — только `console.error`, `isLowRatingBlocked` падает на null-профиле. `use-star-rating.ts:139-174`, `star-rating-validation.ts:27-33`.
- [ ] **S19 · [C12]** — WS-финализация pending-постов/комментов ждёт `transaction.type ∈ {share,video,…}`/`{comment,…}`, которых в словаре WS нет; TTL/reconcile pending-постов только в ленте профиля → «песочные часы» до перезагрузки; `comments-store` overrides ищутся по txid правки вместо id. `use-pending-posts-realtime.ts:30-36`, `use-comments-ws.ts:46-57`.
- [ ] **S20 · [C13]** — Ссылки «поделиться/копировать/embed» от `window.location.origin` → в Tauri `tauri://localhost/post/…`, в Capacitor `https://localhost`. `post-card.vue:350-353`, `post-share-menu.vue:60-68`.
- [ ] **S21 · [C14]** — Блок-лист применяется к комментам/профилю, но не к лентам/бустам/рекомендациям (legacy фильтрует клиентски).
- [ ] **S22 · [C15, E20, C21]** — `post-mapper.adaptPostData` (страница поста, embed, чат) — усечённая модель: нет decode, `myVal` (повторная оценка → `DoubleScore`), `lastComment`, `preview`, `repostAuthor`, `pending`; `embed-post-page` читает `post.time` (в модели `timestamp`) → дата никогда; превью статьи в чате = сырой JSON. **Фикс:** один адаптер (X3).

### Композер, контент, плеер, видео
- [ ] **S23 · [D7, A16, D25]** — Глобальный keydown (capture, `stopPropagation`) после первого play съедает Space/M у сфокусированных кнопок/select/ссылок и модалок; `use-video-hotkeys` для этих клавиш фактически мёртв. `use-global-keyboard.ts:12-33,51-70,105`.
- [ ] **S24 · [D8]** — Автолинкер вставляет `<a>` внутрь значений атрибутов → инлайн `<a href="https://…">` и `<img src="https://…">` в HTML-контенте теряют href/src (проверено). `text-formatter.ts:55-56,113-127`.
- [ ] **S25 · [D9]** — Два рендерера Editor.js: превью (`editorjs-parser.ts`, без decode, без link/table, есть delimiter) и полный вид (`block-content.vue`, наоборот) → `delimiter` в полном виде пустой `<p>`, `table` в превью исчезает, list-объекты v2 → `[object Object]`.
- [ ] **S26 · [D10]** — `initPlayer` реэнтерабелен (клик по спиннеру → второй `new Hls()`, первый сирота), слушатели `<video>` копятся на каждой переинициализации. `use-video-hls.ts:221-349`, `use-video-element-events.ts:45-93`.
- [ ] **S27 · [D11]** — Отмена транскода не убивает ffmpeg (`destroy()` no-op, команды cancel нет); фаза G в `VIDEO_UPLOAD_CHECKLIST.md` помечена DONE.
- [ ] **S28 · [D12]** — ±10 с на lock screen/media session перематывают от позиции момента `claim()`. `background-media-controller.ts:68-106`.
- [ ] **S29 · [D13]** — Модалку композера можно закрыть во время публикации; черновик жив → повторная публикация = дубль. `post-composer-modal.vue:8-16`, `use-post-composer.ts:261-316`.
- [ ] **S30 · [D14]** — Аудио-визуализатор не закрывает `AudioContext`; после retry `createMediaElementSource` → `InvalidStateError` → плоские бары. `use-audio-visualizer.ts:24,53-89`.
- [ ] **S31 · [D16]** — Два парсера YouTube: композер обещает превью shorts/с хвостовой пунктуацией, лента (`youtube-url.ts`) не встраивает; Vimeo только в композере и заблокирован Tauri-CSP.
- [ ] **S32 · [D17]** — macOS: `Command::new("ffmpeg")` по PATH GUI-процесса (без Homebrew) → «установите ffmpeg» при запуске из Dock; из терминала работает. `lib.rs:135-136,161,318`.

### Мессенджер
- [ ] **S33 · [E7]** — OG-превью для каждого URL из E2E-сообщений автоматически уходит на homeserver (`/preview_url`) с userId; `og:image` с произвольного http(s) грузится напрямую (мимо Tor). `use-link-preview.ts:34-42,73-79`.
- [ ] **S34 · [E8]** — Абсолютные URL медиа из контента отправителя (`content.url`, `info.httpUrl`, сервер в `mxc://`) фетчатся при открытии чата без проверки хоста → трекинг IP. `use-message-mapping.ts:28-44`, `use-audio-playback.ts:61-66`, `mxc-resolver.ts:28-35`.
- [ ] **S35 · [E9]** — Неудачная отправка текста молча теряется: `status` всегда `'sent'`, поле очищено до результата, ретрая нет. `use-message-sending.ts:160-166`, `use-chat-input.ts:40-47`.
- [ ] **S36 · [E10]** — Сообщение, пришедшее во время `loadMessages`, выпадает из ленты (снимок перезаписывает), но read-receipt уже отправлен. `use-message-loading.ts:44-58`.
- [ ] **S37 · [E11]** — После неудачного логина листенеры копятся в `eventQueue`; при успешном входе `Room.timeline`/`sync` навешиваются дважды (2× звук, 2× read-marker); провал логина не показывается — вечная «Загрузка диалогов». `messenger-store.ts:314-321,423-435`, `matrix-service.ts:152-158`.
- [ ] **S38 · [E12]** — Баннер «Ошибка синхронизации» гаснет только на `PREPARED` (бывает раз за жизнь клиента) → висит после восстановления связи.
- [ ] **S39 · [E13]** — Отправка собеседнику без опубликованных ключей (`profile.k`) «успешна», но шифруется только для себя — получатель видит вечное `*** Encrypted ***`. `group-encryption.ts:193-199`, `pcrypto.ts:360-384`.
- [ ] **S40 · [E14]** — `findExistingRoomByAddress` считает DM любую комнату, где адрес — первый чужой участник (группы); «Начать чат» без защиты от дабл-клика → две комнаты. `room-helpers.ts:19-48`.
- [ ] **S41 · [E15]** — OS-уведомление о сообщении показывает шифротекст (base64 JSON / hex) и hex-локалпарт вместо ника. `messenger-store.ts:377-383`.
- [ ] **S42 · [E19]** — Три определения «личного чата»; комнаты, созданные nextgen (`createDirectRoom` без `room_alias_name: tetatetid`), не проходят ни своё `isTetatetchat` (текст идёт групповым протоколом, кнопка PKOIN скрыта), ни legacy-поиск (собеседник на legacy создаёт вторую комнату).
- [ ] **S43 · [E21]** — Два несвязанных чёрных списка: matrix `m.ignored_user_list` в чате и on-chain blacklist в профиле; одинаковая надпись, разные эффекты (решение Р3).

### Mini-apps
- [ ] **S44 · [F8]** — Built-in/remote-session приложения без `fetchHosts` (ошибка типов) → fetch-tunnel `TypeError` → под Tor (`alttransport:true`) Barteron не может сделать ни одного запроса. `apps-installer.ts:101,131`, `fetch-tunnel.ts:56`.
- [ ] **S45 · [F9]** — Отзыв предустановленного permission у built-in отменяется при следующем запуске (`seedPreinstalledGrants` при `null`). `apps-permission-sync.ts:18-22`.
- [ ] **S46 · [F10, G17]** — «Избранное»/«Недавнее» для каталожных мини-апп после перезапуска → «Приложение не найдено» (remote-session не персистятся, `installFromRemoteEntry` только в гриде).
- [ ] **S47 · [F11]** — «Баланс основного кошелька» = `profile.balance` на момент логина, не обновляется после перевода. `use-wallet-balances.ts:57-64`.
- [ ] **S48 · [F12]** — Закрытие мини-аппы не отзывает доступ: popup через `opener.top.postMessage` продолжает RPC (промпты, payment) — резолв по origin, `event.source` не сверяется с iframe. `bridge.ts:91-137`.
- [ ] **S49 · [F14]** — Промпт `sign` не показывает подписываемую строку (`extra` не передаётся); `zaddress` обещает «Zcash-адрес», выдаёт производный PKOIN-кошелёк. `registry.ts:105`, `actions/account.ts:45-91`.
- [ ] **S50 · [F15]** — `authFetch`: приложение выбирает `useOldFormat` → подпись голого nonce = формат авторизации прокси → replay в `auth:true`-эндпоинты. `actions/account.ts:104-106`.
- [ ] **S51 · [F16]** — Сайдлоад есть, удаления нет: `uninstall()` не вызывается ни из одного UI; манифест чужого хоста перечитывается при каждом старте.

### Уведомления, профиль, настройки
- [ ] **S52 · [G4]** — Подсветка «новых» уведомлений никогда не видна: `persistReadPointer()` синхронно при открытии, до рендера. `header-notifications.vue:430-438`.
- [ ] **S53 · [G5]** — Бейдж = все нескрытые за всё время (не непрочитанные); IDB `notifications`/`hiddenIds` никогда не чистятся, каждый опрос читает тысячи записей.
- [ ] **S54 · [G9]** — «О себе» = `profile.a || profile.r`, а `r` — адрес реферера (legacy `ref = v.r`); при редактировании предзаполняется и пишется on-chain. `profile-sidebar.vue:253`, `edit-profile-modal.vue:168`.
- [ ] **S55 · [G10, H11]** — Ключи `comments.blocked`/`comments.unblocked` отсутствуют в обоих словарях → тост показывает сырой ключ (единственные 2 из 1341). `use-profile-relations-actions.ts:47,50`, `blacklist-tab.vue:89`.
- [ ] **S56 · [G11]** — Тумблеры уведомлений `win/transactions/commentScore` ничего не делают; фильтры применяются только к тостам (не к списку, не к browser-notifications).
- [ ] **S57 · [G12]** — Порог «низкой оценки»: `upvoteVal < 0` в дропдауне/type-map vs `<= 2` в тостах и legacy → 1★ показывается как позитив, `header.lowRating` недостижим.
- [ ] **S58 · [G15]** — Аватары в чёрном списке, списках подписчиков, редакторе профиля и обложке не проходят `resolveImageUrl` (голый хеш / `bastyon.com:8092`).

### Tauri / Tor-модуль / платформа
- [ ] **S59 · [H12]** — `tor_start` не защищён от `Installing` (двойная запись в один архив → `SHA256 mismatch`), `tor_stop` не отменяет установку, `Failed` с живым процессом порождает второго `tor`, тихая смерть процесса не сбрасывает `Ready`. `src-tauri/src/tor/mod.rs:145,187-190`, `process.rs:55-134`.
- [ ] **S60 · [H13]** — Rust `ws_map`/writer-таск/сокет не освобождаются при серверном close; JS `_onClose` не шлёт `tor_ws_close`. `ws.rs:102,139-215`.
- [ ] **S61 · [H14]** — Если Dexie `open()` упал (`VersionError` после отката билда, приватный Firefox), приложение монтируется, но `notifications.init` каждые 30 с и `favorites` на каждую карточку дают unhandled rejection → тост «Что-то пошло не так» постоянно. `main.ts:112,150-156`, `use-error-boundary.ts:87-89`.
- [ ] **S62 · [H15, C16, B16, E22, I20, G13]** — Пользовательские строки мимо i18n (EN-интерфейс показывает русский): `star-rating-errors.ts:82-102` (5 тостов), `post-card-comments/helpers.ts:22-27`, `use-audio-playback.ts:63,128,144`, `use-partner-info.ts:86,125`, `use-search-navigation.ts:99`, `use-feed.ts:185` + `post-mapper.ts:81` («Неизвестный автор»), `post-title-resolver.ts:53`, `transcoder/index.ts:105,126,133`, `wasm-transcoder.ts:109,185`, `free-balance-api.ts:150`, `tx-type-labels.ts:67`, `notification-toasts.ts:83`, `notifications-mappers.ts:163` (`Оценка: N` — в IDB и в уведомление), `use-comments-loader.ts:42`, `profile-sidebar.vue:91,224`, `message-item.vue:26`, `messenger-panel.vue:14`, `messenger-window.vue:24`; английские `Insufficient funds…` из билдеров (`build-transfer-transaction.ts:83`, `build-content-transaction.ts:102`) уходят в UI как есть; `captcha-api.ts:139` `language='ru'` всегда; `use-comments-queries.ts:52` и `sidebar-tags.vue:93`/`sidebar-categories.vue:143` `'ru'` жёстко. Полный список — `app-audit-2026-09/` (zone-H, `cyrillic-ui.txt` в scratchpad).

### Shared UI, эксплорер, embed
- [ ] **S63 · [I3]** — Обёртки `Modal` (теряет `title/centered/destroyOnClose/footer/okText/onOk` — 7 модалок без заголовка, `destroy-on-close` no-op), `Spin`, `Card`, `Empty` (всегда без иллюстрации) — та же причина, что K6/V13. `modal.ts:8-10,58-60`, `modal.vue:16-21`, `spin.vue:3`, `empty.vue:8-10`.
- [ ] **S64 · [I4]** — `peers-page.vue:80` `:message="s.peers.peersError"` — `s` не объявлен → TypeError ровно в ветке ошибки `getpeerinfo`.
- [ ] **S65 · [I5, G16]** — `address-page` и `profile-page` без guard на устаревший ответ при быстрой смене параметра → смешение данных двух адресов/профилей.
- [ ] **S66 · [I6]** — Курсор `minHeight − 1` пропускает транзакции того же блока на границе страницы; дедуп мёртв; скопировано в `wallet-history.vue:167-205` (+ FX5: сигнатура `getaddresstransactions` `[addr,height,count]` vs legacy 6-параметровая — нужна живая проверка).
- [ ] **S67 · [I7]** — Embed: ссылки в теле поста (`@ник` без target) уводят iframe на полное приложение с восстановлением сессии внутри чужого сайта; `frame-ancestors` нет → любой сайт фреймит `/wallets` (clickjacking). `embed-post-page.vue:34`, `text-formatter.ts:35`, `src.vue:64-66`.
- [ ] **S68 · [I9]** — `pingtime` пиров (секунды с дробью в Core) делится на 1000 → все «0.0 ms».
- [ ] **S69 · [I10]** — Block page: «Загрузить ещё» стирает список до скелетона (смена queryKey); открытие по высоте → лишний RPC, мигание, дубль в истории.
- [ ] **S70 · [E2/H9 остаток, H19, N10]** — см. X9: `favorites`, черновики комментов/поста, история поиска, кэш ник→адрес не привязаны к аккаунту.
- [ ] **S71 · [I18, G13]** — Восемь форматтеров даты/времени: `date-formatter.ts` (`formatDate`/`formatDateTimeFull` жёстко `'ru-RU'`), `format-explorer.ts` (свой `formatRelativeTime` с другими порогами/ключами, `formatAbsoluteTime` `'ru-RU'`), `notification-formatter.ts` (копия), два `formatMessageTime` в мессенджере, `chat-list-item`, `profile-sidebar`, `video-info-modal` (`'ru-RU'`); в RU `relativeAgo.years` без плюрализации («3 год назад»). Корректно только `embed-post-page`, `app-permissions-tab`, `diagnostics-tab`.

---

## 4. ⚪ Низко

- [ ] **N1 · [B12]** — Сдача ниже dust молча уходит в комиссию; контентная tx с входами в [700,701) сат сжигает ~700 сат; UI показывает fee 1 сат.
- [ ] **N2 · [B14]** — `validateAddress` принимает любой Base58Check version-byte и любой bech32 → bitcoin-адрес «валиден», падает в btc17 с английским текстом.
- [ ] **N3 · [B15]** — Мёртвые/дублирующие транспортные хелперы: `api-client.ts` (EXAMPLES.md его продвигает), `services/retry.ts`, `error-codes.matchApiError`, `signatures/transaction-signature.ts`, два d.ts билдера (объектная форма sign не тайпчекается), шесть парсеров ответа `sendrawtransactionwithmessage`; transfer использует DEPRECATED позиционную форму sign (warn на каждый перевод).
- [ ] **N4 · [B17]** — README/EXAMPLES блокчейн-модуля устарели (`@/helpers/request`, сигнатуры `saveEncryptedMnemonic`, device fingerprint, «bitcoinjs-lib»).
- [x] **N5 · [A13]** — `enablePassphrase` игнорирует `allOk=false` от `finalizeMigration()` → fingerprint и fp-blob'ы остаются рядом с passphrase-сейфом. ✅ закрыто 2026-09-13: `VaultMigrationIncompleteError` + текст в Settings
- [ ] **N6 · [A14]** — Clipboard с сидом не очищается; passphrase остаётся в `pw*` refs после разлока; сид регистрации живёт в reactive ref весь pending.
- [ ] **N7 · [A15, I11]** — `isEmbedRoute()` в `main.ts:78-88` вычисляется на `START_LOCATION` → всегда `false`, «пропуск для embed» мёртв.
- [ ] **N8 · [A17, D19]** — Черновик поста `bastyon_post_draft` глобальный, не чистится при выходе → следующий аккаунт публикует чужой текст одним нажатием.
- [ ] **N9 · [A18]** — `console.error('Recovery result is invalid:', recoveryResult)` печатает объект с `source` = мнемоникой (ветка почти недостижима); убрать `source` из результата.
- [ ] **N10 · [C17, H19]** — `favorites` (IDB `id, addedAt`), `bastyon_comment_draft:<postId>` не per-account; `postRatingsPending` без уникального индекса (`add` не awaited → фантомный pending после reload).
- [ ] **N11 · [C18]** — «Избранное»: один удалённый пост из 20 → `hasMore=false`, остальные недостижимы.
- [ ] **N12 · [C19]** — `deletePost` — тумбстоун только в локальной карточке; `emit('deleted')` никто не слушает; posts-store/ленты/модалка показывают пост.
- [ ] **N13 · [C20]** — `resolvePostTitleFromPost` читает `blocks[0].text` вместо `blocks[0].data.text` → статьи в «песочных часах» «без названия».
- [ ] **N14 · [C22, C23, C24]** — `extractPostsFromResponse` фильтрует профили только в одной ветке (`profile-loaded` мёртв); «Показать ещё 20» добавляет 15; sort/time-фильтры без UI, deep-watcher сбрасывает `allPosts` без рефетча.
- [ ] **N15 · [D18]** — `bastyon://`-ссылки в постах рендерятся как внутренние, но клик никем не обрабатывается (в Tauri — навигация webview на неизвестную схему).
- [ ] **N16 · [D20]** — Enter в поле тегов подставляет первую подсказку вместо набранного слова (`activeIndex=0`).
- [ ] **N17 · [D21]** — Аплоадер называет транскод «загрузкой» (сетевой загрузки нет), wasm-путь недостижим из UI (FAB только в Tauri), но `initialize()` гоняется в каждом браузерном сеансе.
- [ ] **N18 · [D22, D23, D24]** — Мёртвый `video-player/store.ts` (экспортируется из `stores/index.ts`); два `normalizeImageUrl` с разной семантикой; третий `escapeHtml`; hex-капча: `ref="captchaImageRef"` без переменной → при `captcha.hex` UI пустой.
- [ ] **N19 · [E16]** — Blob-URL расшифрованного медиа не ревокаются и не чистятся при логауте; local-echo `~`-id персистится в IDB и лишает свежие сообщения действий.
- [ ] **N20 · [E17]** — `PIXI.Application` (WebGL-контекст) на каждое аудио-сообщение + полный download/decrypt/decode при монтировании.
- [ ] **N21 · [E18]** — Matrix-сессия никогда не отзывается (`client.logout()` не вызывается), каждый запуск — новый device с вечным токеном.
- [ ] **N22 · [F19]** — Payment modal: `appName` не передаётся (`miniapps.paymentRequestedBy` мёртв); получатели не валидируются как адреса; `positive()` пропускает `1e-9`.
- [ ] **N23 · [F20]** — `normalizeError` отдаёт в iframe `err.stack` хоста; `inflight` ключуется только `requestId`.
- [ ] **N24 · [FX2, FX4, FX7]** — `manifest-loader.ts:46,93` сырой `fetch` (мимо Tor); дубли `pkoin-chart/consts.ts`, `ERROR_MESSAGES`, `PERMISSION_I18N_IDS`, `iconFromScope`; заглушки `registerForNotifications`/`complain`/`currency` возвращают «успех».
- [ ] **N25 · [G18]** — История поиска, кэш ник→адрес, фильтры уведомлений глобальные и переживают выход (PII на общем устройстве).
- [ ] **N26 · [G19]** — `edit-profile-modal` не валидирует имя (только длина) → `a/b` ломает `/:userName`; предзаполняет сырой URL-encoded `a`.
- [ ] **N27 · [G14]** — Мёртвые `notifications-store-helpers.ts` + `-consts.ts` (18 тестов на дублёра), `use-notifications-query.ts`, `header-notifications/consts.ts`; `notifications-store.ts:161` — `GetMissedInfoEventItem` не импортирован (TS2304).
- [ ] **N28 · [H16]** — `.vue` не тайпчекаются нигде (`vue-tsc` не установлен, `build` = `vite build`); `miscreant` даёт 69 ошибок в node_modules (`types: src/index.ts`); `RouteMeta.embed` не объявлен; `lint` не покрывает `src-mobile`; `vitest` exclude `src/main.js`.
- [ ] **N29 · [H17]** — PWA `navigateFallbackDenylist` исключает `/app/*`, хотя это SPA-маршрут.
- [ ] **N30 · [H20]** — Capabilities: `core:window:allow-set-fullscreen` отсутствует (шаг fullscreen всегда в catch); `global-shortcut:*` и `allow-set-webview-zoom` выданы webview без использования.
- [ ] **N31 · [I12]** — Кэш блока 24 ч не инвалидируется WS → у tip-блока `nexthash` пустой до перезагрузки.
- [ ] **N32 · [I13]** — `appToast` (z 1050) под масками модалок (2000–3100); `Z_INDEX.TOAST` не применён → «Скопировано» в mnemonic-modal не видно.
- [ ] **N33 · [I14]** — Embed: невалидный txid → пустой iframe; клик по картинке ничего не делает (`ImageGallery` не смонтирован).
- [ ] **N34 · [I15]** — Changelog: «что нового» по последней папке, а не по версии приложения; Android `versionName "1.0"` отдельно; текст changelog про язык устарел.
- [ ] **N35 · [I16]** — `check-inline-styles.mjs` не видит `style='…'` (9 пропущенных); e2e привязаны к RU-локали, Playwright en-US → `getByText` падают; никто их не запускает.
- [ ] **N36 · [I19]** — Мёртвые модули: `src-mobile/components/mobile-bottom-nav` (RU-хардкод), `avatar-resolver.ts` (только тест) vs `profile-avatar.ts`, `scroll-utils.ts` при трёх ad-hoc `body.style.overflow` без счётчика (дровер снимает лок мессенджера), `sidebar-categories/{helpers,consts}.ts`, `sidebar-tags/consts.ts`, `effects-store` setup-style, закомментированный `vite-plugin-styled-data-attr.js`, `feedMode` через `history.replaceState` мимо роутера, pixi-ticker `star-explosion` крутится постоянно.
- [ ] **N37 · [мои]** — Мёртвые дубли ядра ленты: `feed-store-helpers.ts` (никем не импортируется, есть тест), `use-feed-queries.ts` (второй `useProfileFeed`, неверная раскладка), `use-infinite-feed-fetchers/-enrichment/-consts.ts`, `use-feed-helpers.ts` (другой `safeDecode`), `mapMissedEventToNotification` ×2, `post-card/helpers.ts::decodeUrlEncoded` (мёртвый + stateful `/g`-regex в `.test()`), шесть вариантов URL-декодера, конфликт экспорта `safeDecode` в `composables/index.ts` (TS2308), четыре константы fee `=0.00000001` (`COMMENT_TX_FEE`, `POST_TX_FEE`, `RELATION_TX_FEE`, `DEFAULT_TX_FEE`).
- [~] **N38 · [мои]** — ESLint: 33 ошибки / 256 предупреждений при `npm run lint` (в основном `preserve-caught-error`, `no-empty` в tor-websocket/tor-store, `no-empty-object-type` в rpc-типах, `no-require-imports` в bip39-loader); lint-staged видит только изменённые файлы. ✅ частично 2026-09-13: 0 ошибок eslint, `lint` покрывает `src-mobile/` и `e2e/`; 256 предупреждений остаются
- [ ] **N39 · [I20]** — Light-only hex-цвета в шаблонах эксплорера (`network-stats-chart.vue:75-80,169-176`, `peers-page.vue:31-33`) — в dark-теме светлые оси/сетка; stylelint проверяет только `*styled.ts`.
- [ ] **N40 · [H7-смежное]** — `environment/env.dev`, `env.prod` — пустые файлы в репе; `_docs-todo/ASR.md` — чужой чат-дамп про распознавание речи, не документ проекта.

---

## 5. Сквозные несостыковки (одна причина — много симптомов)

| # | Тема | Симптомы | Корень |
|---|---|---|---|
| X1 | Язык интерфейса | V42 | LS `bastyon_locale` (i18n) vs IDB `bastyonAppLanguage` (ui-store); два детектора дефолта (`ru` vs `en`) |
| X2 | Даты и время | S71 | 8 форматтеров, `'ru-RU'` хардкод, 2 набора i18n-ключей относительного времени |
| X3 | Модель поста и декодирование | K7, V34, S22, N37 | два `adaptPostData` (`use-feed.ts` vs `post-mapper.ts`), шесть URL-декодеров с разной обработкой `+`/`%` |
| X4 | Выбор ноды | S7, S2, S66 | node-selector / `proxy[0]` для WS / explorer-preferred (управляет и кошельком) / proxy-with-wallet |
| X5 | Чёрный список | S43, S21, V32 | on-chain blacklist (user-relations-store) vs matrix ignore-list; в лентах не применяется; не сбрасывается при смене аккаунта |
| X6 | Tor «весь трафик» | V20, V21, V22, S1, S3, S33, S34, S59, S60, N24 | торифицирован только `appFetch`; webview-прокси нет; fail-open; TorWS не открывается |
| X7 | Единицы PKOIN/сатоши | V4, V5, N1 | JSDoc `UTXO.amount` называет PKOIN сатошами; `formatPkoin` делит; explorer не делит |
| X8 | Обёртки antd в `src/components` | K6, V13, S63 | `defineProps<AntdProps>()` + `v-bind="$attrs"` → объявленные пропсы никуда не уходят (Input, InputSearch, Modal, Spin, Card, Empty) |
| X9 | Состояние при смене/выходе аккаунта | V32, V14, V15, S2, S5, S10, S14, N8, N10, N25, S12 | нет единого `resetForAccount(address)`; per-account keying только у notifications/postRatingsPending/decryptedMessages |
| X10 | Регистрация | V8, V9, V10, S12, S13, S15 | стейт в трёх местах (LS `pending_registration` с тремя читателями, refs в шапке, keys-store) без привязки к адресу |
| X11 | Мёртвый код с тестами на него | N3, N18, N27, N36, N37 | 20+ модулей без импортёров; часть покрыта тестами, что создаёт ложное чувство покрытия |

---

## 6. Решения владельца (нужны до соответствующих волн)

- [ ] **Р1 · Tor и медиа (V21).** Вариант A: `WebviewWindowBuilder::proxy_url(socks5://127.0.0.1:<port>)` — честно, но окно нужно пересоздавать после старта Tor и прокси-поддержка webview на macOS/Linux ограничена. Вариант B: переписать текст диалога («через Tor идут RPC, чат и API; медиа и эмбеды — нет»), под Tor блокировать iframe/YouTube/превью и грузить медиа только по клику. **Рекомендация:** B сейчас (одна волна), A — отдельным исследованием.
- [ ] **Р2 · Z-адреса (V6, V7).** Спрятать приём на доп. кошельки (оставить просмотр баланса) до реализации P2SH-траты и единого seed'а, или реализовать трату. **Рекомендация:** спрятать + починить seed (V7), трата — в roadmap.
- [ ] **Р3 · Чёрный список (S43, S21).** On-chain блокировка дополнительно ставит matrix-ignore и фильтрует ленту/рекомендации; кнопка в чате переименовывается в «Скрыть сообщения». **Рекомендация:** да.
- [ ] **Р4 · OG-превью в E2E-чате (S33).** Выключить по умолчанию для зашифрованных комнат (как Element), `og:image` только `mxc://`. **Рекомендация:** да.
- [ ] **Р5 · Избранное/черновики/история поиска (N8, N10, N25).** Per-account (миграция существующих на текущий адрес) или явно «на устройство» с очисткой при выходе. **Рекомендация:** per-account.
- [x] **Р6 · Кэш расшифрованной переписки (V15).** Удалять при `signOut`/`removeAccount` — обязательно; при `switchAccount` — оставить (per-user ключи), но шифровать таблицу ключом из сейфа. **Решено 2026-09-13 по рекомендации:** удаление при выходе/удалении аккаунта сделано; шифрование таблицы — волна 5.
- [ ] **Р7 · `videos.remove` (K2).** Отдельный uniq-промпт с хостом и id + allowlist хостов от ноды. **Рекомендация:** да, без обсуждения.
- [ ] **Р8 · Кошелёк «Общий баланс» (V5).** После унификации единиц: показывать сумму по всем адресам или только основной. **Рекомендация:** сумма, но только после Р2.

---

## 7. План починки

Принципы: (1) сначала страховочные инструменты, чтобы регрессии ловились; (2) каждая волна — отдельные топические коммиты с тестом-репродукцией там, где баг воспроизводим в vitest; (3) после волны — полный `vitest`, `eslint`, `tsc`-baseline не хуже, для Rust — `cargo test --lib`; (4) пункты, требующие живого прогона (Tauri-окно, нода), помечаются `[~ needs-live]` до проверки в сборке.

### Волна 0 — страховка (до любых правок)
- [ ] `vue-tsc` в devDependencies + скрипт `typecheck`; зафиксировать baseline (сейчас `tsc`: 1433 ошибки, ~1000 в `*.styled.ts`, 69 в `node_modules/miscreant`) и гейт «не больше baseline» в husky pre-push (N28; P3-1 частично).
- [ ] `paths` для `miscreant` → `release/index.d.ts`; `RouteMeta.embed`; `eslint src/ src-mobile/`; закрыть 33 eslint-ошибки (N38) — ✅ eslint 0 ошибок, `lint` = `src/ src-mobile/ e2e/` (2026-09-13); осталось: `paths` miscreant, `RouteMeta.embed`.
- [ ] Тест паритета i18n «ключи из кода ⊂ словарь» (скрипт из zone-H готов) — сразу ловит S55 (N28-смежное).
- [x] `release.yml` → pnpm, удалить `package-lock.json` (V41) — ✅ 2026-09-13, плюс `ci.yml` (lint+vitest+build+cargo test).
- [ ] Тесты-репродукции (падают до фикса): K1 (payload с кавычкой через `sanitizeHtml`), K4 (payload `sendReply`), K5 (`share-id` для поста с `hash≠txid`), K6/V13 (монтирование `InputSearch`/`Input` — `onSearch`/`type` доходят), V34 (`safeDecode('C++')`), V4/V5 (`classifyWalletTx` + форматтер), K3 (`mapEventToMessage` для каждого msgtype), K7 (раскладка параметров `getprofilefeed`).

### Волна 1 — критично, деньги, секреты
- [ ] ~~K1 санитайзер~~ ✅ · K6+V13+S63 обёртки antd (одна правка X8) · K3 медиа в чате · K4 parentid · K5 share-id по txid · K7 related videos · K2 videos.remove (Р7).
- [ ] V1 бродкаст без межнодового failover · V2 фазовое состояние PKOIN-доната · V3 receiverAddress · V4/V5 единицы PKOIN (X7).
- [ ] V8/V9/V10/V11 регистрация и добавление аккаунта (X10, одним коммитом с тестами на `restore-session`) · ~~V12 persist + модалка needs-reset~~ ✅.
- [ ] V14 токены PeerTube/черновики в `clearAllUserData` · ~~V15 кэш переписки при выходе (Р6)~~ ✅ · V16 обложка профиля · V17 Tauri-пути · V18 ControlPort · ~~V19 глобальные хоткеи~~ ✅.
- Проверка: vitest полный, `cargo test --lib`, ручной прогон: вход по мнемонике (маскировка), поиск Enter, ответ на ответ, оценка отредактированного поста, фото в чате.

### Волна 2 — Tor честность (после Р1)
- [ ] V20 fail-closed (JS + Rust `pick_client`) · V22 TorWS open-гонка · S1 abort/timeout в `torFetch` · S3/S60 зомби-сокеты · S59 lifecycle `tor_start/stop` · V21 по Р1 · V25 SSRF-фильтр + V27 скоуп plugin-http · S33/S34 (Р4) · N24 manifest-loader через `appFetch`.
- Проверка `[~ needs-live]`: Tauri-сборка с включённым Tor — WS открывается, лента грузится, health-пинг не висит 120 с, `nc 127.0.0.1 <control>` → connection refused.

### Волна 3 — мультиаккаунт и состояние (X9, X1)
- [ ] Единый `resetForAccount()` в auth-store: V32, S2 (WS reconnect), S5 (реактивные ключи `useRpcQuery`), S10 (fallback `BST_MNEMONIC` со сверкой адреса, чистка при `removeAccount`), S14 (notifications in-flight + reset), S11 (авторизация после персиста, один Matrix-login), S12/S13/S15 (регистрация: показ сида после перезагрузки, честный статус, один читатель pending), N8/N10/N25 (Р5), N21 (`client.logout()`).
- [ ] V42 язык: ui-store — владелец, один детектор дефолта, события для мини-апп.
- Проверка: тесты на `switchAccount` (relations/pending/notifications пусты), на `loadLanguage` (LS не перебивается).

### Волна 4 — лента, комментарии, уведомления, кошелёк
- [ ] V31 `author.address` · V33 depth в блоках · V35 ошибка подгрузки · V36 edit сохраняет url/settings/language · S16/S17 гонки и refetch головы · S18 звёзды на своём посте + тосты · S19 WS-типы + `cleanupExpired` в шапке · S20 публичный origin для share · S21 фильтр блок-листа (Р3) · S22 единый адаптер (X3) + N13/N14 · V38/V39/S52/S53/S56/S57 уведомления (курсор, snapshot'ы, read-pointer при закрытии, бейдж по readBlock, фильтры, порог) · S54 `a` вместо `r` · S58 аватары через resolver · S47 обновление баланса · V6/V7 (Р2) · ~~S6 UTXO-лок во всех отправителях~~ ✅ · N1/N2/N11/N12.
- Проверка: живые пробы к ноде (скрипты из zone-C в scratchpad): `gettopfeed` depth, `getprofilefeed` 14 параметров, `getpagescores` по txid.

### Волна 5 — мессенджер
- [ ] V28 голосовое по chatId · V29 paste только в поле чата · V30 read-markers при видимом окне · S35 статус отправки/ретрай · S36 merge во время загрузки · S37 листенеры один раз + ошибка логина · S38 сброс syncError · S39 ошибка «нет ключей» · S40 DM-фильтр + дабл-клик · S41 текст OS-уведомления · S42 `room_alias_name: tetatetid` + один хелпер «direct» · S43 (Р3) · N19 revoke blob-URL + localEchoUpdated · N20 shared PIXI/2D canvas · Р6 шифрование кэша (если решено).
- Проверка `[~ needs-live]`: кросс-клиентный round-trip с legacy-чатом после S42 (обязательно — меняется формат комнат).

### Волна 6 — mini-apps
- [ ] V23 не персистить denied по таймауту · V24 origin в гранте · V26 одна CSP `[~ needs-live: prod-бандл]` · S44 `fetchHosts` у built-in · S45 маркер «отозвано» · S46 install из favorites/recent · S48 сверка `event.source` с iframe · S49 `extra` в промпте + текст zaddress · S50 запрет `useOldFormat` · S51 кнопка «Удалить» · N22/N23.
- Проверка: тесты в `mini-apps/__tests__` на каждый пункт (инфраструктура есть).

### Волна 7 — платформа, Tauri, видео, эксплорер
- [ ] V40 opener + `openExternal` · V37 бинарный IPC/путь из диалога · S27 `cancel_transcode` · S32 PATH ffmpeg · S23 хоткеи (один обработчик в плеере) · S24 линкификация только текстовых нод · S25 один рендерер Editor.js · S26/S30 листенеры и AudioContext · S28 media session · S29 композер при публикации · S31 общий парсер YouTube · S61 `dbUnavailable` · S64/S65/S66/S68/S69/N31 эксплорер · S67 embed (`_top` + `frame-ancestors` на деплое) · N7 `router.isReady()` · N15 делегат `bastyon://` · N29/N30/N32/N33/N34.
- Проверка `[~ needs-live]`: macOS-бандл — внешние ссылки открываются, ffmpeg из Dock, транскод 150 МБ.

### Волна 8 — гигиена и консистентность
- [ ] S62 все хардкоды в i18n · S71 один модуль дат на `Intl` + плюрализация · S7 одна нода для WS (из node-selector) и честный текст настройки · S8 bip32-версии · S9 WIF · N3/N18/N27/N36/N37 удалить мёртвые модули и их тесты · N4 README/EXAMPLES · ~~N5~~ ✅/N6/N9 · N16/N17 · N35 check-inline-styles + `use.locale` в Playwright · N39 цвета через токены · N40 мусорные файлы.

---

## 8. Baseline и инструменты (на 2026-09-13)

| Проверка | Результат | Команда |
|---|---|---|
| vitest | 2128 passed / 1 skipped (177 файлов; часть тестов покрывает мёртвые модули — X11) | `node_modules/.bin/vitest run` |
| eslint | 33 ошибки / 256 предупреждений | `node_modules/.bin/eslint src/ --ext .ts,.tsx,.vue,.js` |
| tsc | 1433 ошибки (TS2345 ×1008 в styled; miscreant 69); `.vue` не проверяются | `node_modules/.bin/tsc --noEmit -p tsconfig.json` |
| vue-tsc | не установлен; `npx vue-tsc@2` падает на TypeScript из npx-кэша (`./lib/tsc` не экспортируется) — ставить pinned в devDeps | — |
| i18n | ru/en симметричны 1436/1436; 2 ключа из кода отсутствуют (S55); 140 ключей не используются | скрипт zone-H |
| Rust | `cargo test --lib` 24/24 (ipfs), `cargo build` ok | `cd src-tauri && cargo test --lib` |
| check-inline-styles / check-breakpoints | ok / ok (но см. N35) | `node scripts/check-*.mjs` |
| Живая нода | пробы `getprofilefeed`/`gettopfeed`/`getpagescores`/`getcomments` к `1.pocketnet.app:8899` подтверждают K7, K5, V33 | скрипты zone-C (scratchpad сессии) |

Верификация после каждой волны: `source ~/.nvm/nvm.sh; nvm use 20.19.5; node_modules/.bin/vitest run && node_modules/.bin/eslint src/ src-mobile/ && npm run build && (cd src-tauri && cargo test --lib)`.

---

## 9. Проверено — ОК (чтобы не перепроверять)

Сводно по зонам (детали в `app-audit-2026-09/zone-*.md`, раздел «Проверено — ОК»):
- **Сейф P0-1:** IV/salt свежие, device-ключ `extractable:false`, PBKDF2-600k, passphrase не персистится, конверт backup-first, один уровень locks, unlock-модалка недискардима, кулдаун персистится.
- **RPC:** логические ошибки не перебираются по нодам, nonce живёт 6 мин, node-selector дедупит выборы; `api-signature` свежий nonce; ключи в логах не встречаются (кроме N9).
- **Транзакции:** `toSatoshis` через `Math.round`, OP_RETURN ≤ 80 байт, `serializePost/exportPost` побайтно = `kit.js`, `validate-post` лимиты = legacy, локи UTXO с TTL 60 с там, где есть.
- **Санитайзер:** штатные фильтры `xss` режут `javascript:`/entity-обфускацию/`data:`/`on*`; все `v-html` идут через whitelist (кроме K1-ветки); `editorjs-parser`, `block-link`, `markdown.ts` экранируют; капча через `data:`-URI.
- **Мессенджер:** DM — AES-SIV с nonce (аутентифицирован), пароль Matrix = SHA256², токен только в памяти, sync-БД per-user, ключи BIP32 `m/33'/…` как legacy, `seg.html` через `escapeHtml`, лимиты вложений = legacy.
- **Mini-apps:** origin-guard строгий, `targetOrigin` канонический, iframe sandbox без `allow-top-navigation`, `rpc` не подписывает, WS-поток не пушится приложениям, rate-limiter и payment-modal snapshot корректны.
- **Tor-installer:** HTTPS + SHA256, tar/zip защищены от traversal, порты только loopback, `__OwningControllerProcess`, `ws.rs` fail-closed через SOCKS.
- **Mobile/build:** `allowBackup=false`, провайдеры не exported, iOS usage-descriptions есть, ATS без исключений, SW не регистрируется в Tauri, CSP meta для веба строгая, release permissions минимальные.
- **Лента/поиск/профиль:** дедуп страниц по id нужен и работает; `getboostfeed`/`getmostcommentedfeed`/`getcomments` сверены с нодой; stale-ответы поиска исключены; `bastyon-input-link` без open-redirect; отношения с корректным откатом; `complain`/`user-info` payload = legacy; QR-сканер чистит стрим и не логирует.
