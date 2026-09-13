# Остатки по закрытым аудитам — сводный реестр

> Дата: 2026-09-13. Объект: `bastyon-nextgen`, `main@f5fda70`.
> Собрано из трёх документов, которые этим же изменением удалены (последняя версия каждого —
> `git show f5fda70:_docs-todo/<имя>`):
> - `CODE_REVIEW_AUDIT_2026-07-02.md` — ревью всего клиента (2026-07-02, актуализация 2026-08-05);
> - `IPFS_SECURITY_AUDIT.md` — аудит IPFS-модуля Ф0–Ф5c (2026-09-11);
> - `P0-1_VAULT_PLAN.md` — план сейфа сида (P0-1), реализован в `fad220c` (2026-07-08);
> - `LARGE_FILE_SPLIT_AUDIT.md` — аудит разбиения крупных файлов (2026-08-08), удалён 2026-09-13 вечером
>   (последняя версия — `git show 9435377:_docs-todo/LARGE_FILE_SPLIT_AUDIT.md`), хвост — §6.
>
> Каждый пункт ниже я перепроверил по коду сегодня; закрытое сюда не вошло (что именно закрыто и как
> проверялось — §4). Статус: `[ ]` открыто · `[x]` закрыто · `[~]` осознанно принято · `[~ needs-live]` код есть,
> нужна проверка в живой сборке. Пересечения с `APP_AUDIT_2026-09.md` помечены его ID (V12, S6, …) —
> план и статус таких пунктов ведутся ТАМ, здесь только ссылка.

---

## 0. Сводка

| Источник | Всего | Закрыто | Принято `[~]` | Осталось |
|---|---|---|---|---|
| CODE_REVIEW 2026-07-02 | 36 (P0 4 · P1 13 · P2 13 · P3 6) | 35 | 0 | **1** (P2-11, протокол) — §1 |
| IPFS_SECURITY_AUDIT | 27 (B 6 · C 7 · D 14) | 25 (+ регресс C6→K1 закрыт) | 2 (D3, D13) | **3 `[~ needs-live]`** — §2 |
| P0-1_VAULT_PLAN | план из 10 разделов | реализован; 11 из 12 недоделок закрыты 2026-09-13 | 4 решения | **VP-1 UI в Tauri `[~ needs-live]`, VP-12 AES-GCM (roadmap)** — §3 |
| LARGE_FILE_SPLIT_AUDIT | 14 разбиений + 6 quick-wins + follow-up'ы | 13 разбиений + #14 частично, 5/6 quick-wins, follow-up'ы 2026-09-13 | 6 «не резать» | **3 вопроса семантики + 3 отложенных разбиения** — §6 |

**Статус 2026-09-13 (вечер):** закрыто всё, что закрывается кодом и тестами — 7 из 8 пунктов ревью,
регресс C6→K1, 11 из 12 недоделок сейфа (vitest 2178/2178, eslint 0 ошибок, `cargo test` 25/25,
e2e сейфа 6/6 на Chromium+WebKit, `npm run build` ок). Остаётся: **P2-11** (смена протокола группового
шифрования — только вместе с legacy-клиентом), **3 проверки IPFS + UI сейфа в Tauri-сборке**
(`[~ needs-live]`), **AES-GCM для payload'ов** (roadmap), принятые D3/D13.

Коммиты: `3b0931c` K1 · `a222413` P3-5/V19 · `fbc3c0e` P2-4/P2-5/S6 · `e18eeb7` P3-2/P3-3/P3-4/V15 · `5c73d18` сейф VP-2…VP-11/V12/N5 · `d13710f` VP-7/VP-8 · `915edad` P3-1/V41/N38. Не запушено.

**Аудит крупных файлов (вечер 2026-09-13):** добит хвост `LARGE_FILE_SPLIT_AUDIT.md` — §6; vitest 2244/2244,
eslint 0 ошибок, `tsc` 1415 (было 1418, новых нет), `npm run build` ок. Коммиты `d0a71aa`…`9435377` + этот. Не запушено.

---

## 1. CODE_REVIEW_AUDIT_2026-07-02 — 8 открытых (перепроверены 2026-09-13)

### 🟡 P2 — логика транзакций/крипто, нужна живая или кросс-клиентная проверка

- [x] **Оплата mini-app игнорирует `feemode: 'include'`** ✅ закрыто 2026-09-13: `split-fee.ts` (комиссия делится между получателями как в legacy) + `selectAndLockUnspents`; тесты `split-fee.test.ts`. Живая value-tx на ноде — при первом реальном платеже. `logic · conf: high`
  `src/mini-apps/ui/mini-app-payment-modal.vue:105-131` — `requiredAmount` при `include` = сумма без комиссии,
  выход получателя `feemode === 'include' ? r.amount : r.amount` (обе ветки одинаковы).
  `build-transfer-transaction.ts:74-83` всегда вычитает комиссию из сдачи: если `selectBestUnspents` подобрал
  впритык — `Insufficient funds`; если с запасом — получатель получает полную сумму, комиссию платит отправитель,
  т.е. `include` молча работает как `exclude`, а в `messageData.feemode` уезжает `include`.
  **Фикс:** при `include` вычитать `DEFAULT_TX_FEE` из выхода получателя (пропорционально при нескольких) и
  подбирать UTXO под ту же сумму. Проверять на живой ноде (реальная value-tx). Волна 6 (mini-apps).

- [x] **Value-transfer не лочит выбранные UTXO** ✅ закрыто 2026-09-13: `selectAndLockUnspents` во всех 7 отправителях без лока (= S6), лок продлевает TTL; тесты в `unspents-manager.test.ts`. `logic · conf: medium`
  `mini-app-payment-modal.vue:112-114` — `getUnspents → filterAvailableUnspents → selectBestUnspents` без
  `lockUTXOs`; то же в `wallet-transfer.vue:268`. Вместе с пятью отправителями из **S6** (donate,
  profile-update, messenger sendPkoin, registration ×2) — семь мест без лока при восьми с локом.
  **Фикс:** один хелпер «выбрать и залочить» в `unspents-manager`, использовать во всех отправителях (S6).
  Волна 4.

- [ ] **P2-11 · Групповые сообщения: AES-CBC с фиксированным IV под долгоживущим ключом комнаты** — ⏸ не закрыто 2026-09-13: формат общий с legacy-клиентом, менять только версией протокола и синхронно с ним.
  `security · conf: medium (messenger)` `src/b-components/messenger/services/encryption-service.ts:99-124`,
  `store/consts.ts:31` (`AES_CBC_IV` константа). Детерминированный CBC: одинаковые block-aligned префиксы дают
  одинаковый шифропрефикс — homeserver видит повторы и подтверждает угаданный plaintext.
  **Оговорка (новое):** комментарий в коде говорит, что формат намеренно совместим с legacy `bastyon-chat`
  (`pcryptoFile.encrypt`) — значит, это не локальный баг, а протокол. Фикс = версия формата (случайный IV
  префиксом или AES-GCM) с обратной совместимостью на чтение и синхронной правкой legacy-клиента;
  кросс-клиентный round-trip обязателен. Волна 5 (после S42).

### ⚪ P3 — гигиена, tooling, defense-in-depth

- [x] **Нет CI-гейта (lint/тесты/typecheck)** ✅ закрыто 2026-09-13: `.github/workflows/ci.yml` — lint + vitest + build + `cargo test --lib` на push/PR; eslint 0 ошибок (N38), `lint` покрывает `src-mobile/` и `e2e/`. Шаг typecheck — после N28 (vue-tsc). `quality · conf: high`
  `.github/workflows/release.yml` — единственный workflow, запускается по тегу `v*`, шагов lint/vitest нет
  (и сам он сломан — **V41**). **Фикс:** job `pnpm lint && vitest run && vue-tsc --noEmit` на push/PR как
  required-гейт; `vue-tsc` сначала поставить (**N28**, Волна 0).

- [x] **Нерасшифрованный DM рендерит сырой шифротекст** ✅ закрыто 2026-09-13: сбой дешифровки/skipDecryption → всегда плейсхолдер; `use-message-mapping.test.ts`. `logic · conf: high (messenger)`
  `src/b-components/messenger/store/messenger-chat-store/use-message-mapping.ts:133-137` — ветка
  `text = content.body || ENCRYPTED_MESSAGE_PLACEHOLDER` при непустом `body` (legacy-формат) отдаёт шифротекст
  в UI. **Фикс:** для encrypted-type/secrets при сбое дешифровки — всегда плейсхолдер. Волна 5 (рядом с K3).

- [x] **Нет пиннинга ключей собеседника (TOFU/MITM-зазор)** ✅ закрыто 2026-09-13: `services/key-pinning.ts` (TOFU per-owner в localStorage), проверка в `messenger-profile-cache` (тост + `changedKeyPeers`), баннер «Принять новые ключи» в `chat-room.vue`, пины стираются в `clearAllUserData`; тесты `key-pinning.test.ts`, `messenger-profile-cache.test.ts`. `security · conf: low (messenger)`
  `use-message-decryption.ts:76,157` — `parseProfileKeys(p.k)` из профиля через RPC при каждом маппинге, без
  сравнения с ранее виденным ключом. Вредоносная нода подменяет ключ на новых диалогах. **Фикс:** таблица
  «адрес → отпечаток ключа» в IndexedDB, предупреждение при смене. Волна 5.

- [x] **Приватный ключ логируется при ошибке конверсии** ✅ закрыто 2026-09-13: в лог уходит только `typeof`. `security · conf: low (messenger)`
  `src/b-components/messenger/services/pcrypto.ts:120` —
  `console.error('[Pcrypto] Failed to convert private key to hex', privateKey)`. **Фикс:** убрать значение из
  лога. Одна строка — Волна 1.

- [x] **Tauri-фича `devtools` включена безусловно** ✅ закрыто 2026-09-13: фича `devtools` вынесена в opt-in cargo-feature (`tauri build -- --features devtools`), хоткеи F12/Ctrl+Shift+I и `open_devtools` только под `debug_assertions | feature` (= V19). Проверено `cargo check` в dev/release/release+feature. `security · conf: high`
  `src-tauri/Cargo.toml:24` — `tauri = { … features = ["protocol-asset", "devtools"] }`. В Tauri 2 инспектор в
  debug-сборках доступен и без фичи — фича нужна только чтобы он ехал в release. **Фикс:** убрать `devtools` из
  дефолтных фич (при желании — cargo-feature, включаемая в `tauri dev`); вместе со снятием ОС-глобальных хоткеев
  **V19**. Волна 1.

---

## 2. IPFS_SECURITY_AUDIT — что осталось

Все 27 пунктов B/C/D перепроверены сегодня по коду (`src-tauri/src/ipfs/*`, `use-ipfs-links.ts`, `ipfs-link.ts`,
`ipfs-download.ts`, `ipfs-store.ts`, `post-card.vue`, `use-profile-feed.ts`, e2e-тест подписи) — на месте.
Список «проверено и признано безопасным» (бывший раздел E) перенесён в
`IPFS_VIEWER_MODULE_DESIGN.md` → «Аудит 2026-09-11 и принятые решения».

- [~] **D3 · Токен pin-сервиса и `--api-auth` в argv** — `https://` обязателен, `--` перед позиционными
  сделано; секрет виден в `ps` на время команды (у Kubo CLI нет env/файлового варианта). Уход — прямые
  RPC-вызовы (reqwest + `Authorization`) вместо CLI. Принято, отдельная задача.
- [~] **D13 · CSP главного окна широкая** (`tauri.conf.json:29`: `'unsafe-inline' 'unsafe-eval'`,
  `connect-src http://*`) — не IPFS-scope. Живёт как **V26** (две CSP) и общая задача по CSP приложения.
- [x] **** ✅ закрыто 2026-09-13: `friendlyAttrValue` + `escapeAttrValue`; `sanitize-html.test.ts` с payload из K1. Разрешение `ipfs://`/`ipns://`/`bastyon://` в href сделано через
  `safeAttrValue`, который возвращает значение без экранирования (`sanitize-html.ts:75-77`) — это **K1**
  из `APP_AUDIT_2026-09.md` (инъекция атрибутов из поста). Фикс там: `return escapeAttrValue(value)`.
- [~ needs-live] **Нативные диалоги из Rust** — `blocking_pick_file`/`blocking_save_file` в `spawn_blocking`
  из async-команды (`mod.rs:609,620`): открыть «Поделиться файлом…», «Поделиться приватно…», сохранение
  приватной ссылки в Tauri-сборке (macOS + Windows).
- [~ needs-live] **`ipfs_open_viewer`** (`mod.rs:268-292`): окно `incognito`, `on_navigation` пускает только
  `127.0.0.1:<gw>` и `*.dweb.link`; проверить, что ссылка на сторонний хост из IPFS-страницы не уводит окно, а
  storage не общий между CID.
- [~ needs-live] **Первый `ensure` с `API.Authorizations` на репо пользователя** — апгрейд с демоном,
  поднятым ДО апгрейда и усыновлённым (auth не требует; probe с лишним заголовком проходит), затем
  рестарт с прописанным `Authorizations`: CLI с `--api-auth`, probe/shutdown с `Authorization`, gateway без
  auth. Плюс `provide once` после `add` реально уходит (лог демона).

---

## 3. P0-1_VAULT_PLAN — реализовано в `fad220c`, недоделки и отклонения

Что есть (сверено с §4 плана): `src/blockchain/storage/vault/{crypto-vault,vault-crypto,vault-key-store,
vault-migration,vault-unlock,vault-envelope-store,vault-attempts,plausibility}.ts`, модалка
`components/vault/vault-unlock-modal.vue` (antd напрямую, недискардимая, троттлинг с cooldown, «забыл пароль»
с confirm), swap ключа в `storage-keys.ts`/`storage-accounts.ts` + heal-ветка, гейт
`ensureVaultUnlocked` в `restore-session.ts:43`, `ensureInitialized` в `register`/`signIn`
(`auth-store.ts:215,279`), `destroyVault` в `signOut` (`:345`), `clearAllUserData` сносит `BST_ACCOUNT_*`
+ артефакты сейфа, `vaultUnlock` в modal-store, мост в `main.ts:79-88` (embed пропускается), секция
`settings-page/tabs/security-section.vue`, i18n, 10 тест-файлов. Решения §10 приняты так: (2) PBKDF2-SHA256/600k
без worker, (3) idle auto-lock OFF, (4) disable-passphrase разрешён с текущим паролем, (5) signOut wipe — да.

- [~ needs-live] **VP-1 · Живой прогон сейфа** — ✅ частично 2026-09-13: движок проверен на настоящем IndexedDB Chromium и WebKit (`e2e/vault.spec.ts`, 6/6); осталась UI-часть в Tauri-сборке (модалки passphrase/reset, Settings). Было: (`fad220c`: «Live in-browser run not yet
  done»; позже только рефакторинги `cbe2dc8`, `4e2d213`). В реальном браузере/Tauri (настоящий IndexedDB):
  регистрация → перезагрузка → тихий разлок; legacy-кошелёк на fingerprint → миграция → `BST_DEVICE_FINGERPRINT`
  исчез, `migrated:true`; включить passphrase → перезагрузка → модалка → 4 неверных ввода → cooldown → верный;
  «забыл» → wipe → импорт по 12 словам; signOut → в `bastyon-vault` нет записи; две вкладки одновременно.
- [x] **Нативный keychain-бэкенд `VaultKeyStore` для мобилки** ✅ закрыто 2026-09-13: `vault-key-store-capacitor.ts` (32 байта в `@capacitor/preferences`, импорт как non-extractable AES-GCM), выбор бэкенда `createPlatformVaultKeyStore` (native → Preferences, иначе IndexedDB); интерфейс `VaultKeyStore` → `createKey()`. Честно: это UserDefaults/SharedPreferences, не Keychain; на устройстве не гонялось. (решение 6, «fast-follow») — не начат;
  интерфейс готов (`vault-key-store.ts:12-16`). Без него на iOS ITP вытесняет IndexedDB через 7 дней
  неиспользования → `needs-reset` → тихий wipe (VP-4). `@capacitor/preferences` уже в зависимостях.
- [x] **`navigator.storage.persist()` только при открытии Settings → Security** ✅ закрыто 2026-09-13: `requestPersistentStorage()` при каждом создании device-ключа (mint/bootstrap).
  (`use-vault-security.ts:26-31`), план: при первом персисте. = **V12**.
- [x] **`needs-reset` → `clearAllUserData()` молча** ✅ закрыто 2026-09-13: модалка фазы `reset` (объяснение, «Восстановить по 12 словам» с confirm, «Позже» без стирания), стирание и переход к импорту только в `vault-unlock` после подтверждения; `ensureInitialized` поверх мёртвого сейфа минтит заново; re-bootstrap с fingerprint при `migrated:false`. Тесты в `vault-unlock.test.ts`, `crypto-vault.test.ts`. (`restore-session.ts:49-53`) без confirm и
  объяснения; план §5: модалка «восстановите по 12 словам» → confirm → Import. = **V12**. Плюс дыра
  в «never-brick»: device-конверт + вытесненный ключ, но `BST_DEVICE_FINGERPRINT` ещё есть и `migrated:false`
  (миграция отложена на 2,5 с или упала с `allOk=false`) → `crypto-vault.ts:185-187` отдаёт `needs-reset` и
  payload'ы, читаемые под fingerprint, стираются. **Фикс:** в этой ветке при наличии fingerprint —
  `bootstrapFromLegacy` заново, а не reset.
- [x] **Реальный IDB-бэкенд не покрыт тестами** ✅ закрыто 2026-09-13: `e2e/vault.spec.ts` — реальный IndexedDB в Chromium и WebKit (round-trip non-extractable ключа через reload, passwordless mint→unlock, passphrase enable→needs-passphrase→wrong/right→destroy); всегда-skipped юнит удалён. — `vault-key-store-idb.test.ts` под
  `describe.skipIf(typeof indexedDB === 'undefined')` = всегда skipped в vitest (тот самый «1 skipped»);
  `fake-indexeddb` не умеет structured-clone non-extractable `CryptoKey` (решение 7 фактически «нет»).
  **Фикс:** vitest browser mode (Playwright/Chromium) для одного этого файла или Playwright-smoke на VP-1.
- [x] **Self-tuning KDF не реализован** ✅ закрыто 2026-09-13: после верного пароля конверт с `iter < target` перезаворачивается (свежие соль/IV); тест. — план: при разлоке с `iter < target` перезавернуть S на
  большем счётчике; `submitPassphrase` (`crypto-vault.ts:342-360`) только разворачивает. Сейчас no-op
  (единственный target 600k), станет нужен при первом повышении — сделать вместе с ним.
- [x] **Гейт включения passphrase — чекбокс** ✅ закрыто 2026-09-13: включение passphrase = шаг 1 челлендж «слова №N» (3 из 12; для key-only аккаунта — хвост ключа), шаг 2 пароль. `backup-check-modal.vue`, `use-backup-verification.ts`, `helpers/backup/backup-verification.ts` (+тесты)., а не «показать и ввести 12 слов заново»
  (`security-section.vue:30,101-127`; план §7/§10-1 — «non-negotiable»). Включение уничтожает device-ключ,
  забытый пароль = только 12 слов — подтверждение галочкой слишком дёшево.
- [x] **Нет периодического напоминания о бэкапе** ✅ закрыто 2026-09-13: карточка «Резервная копия» в Settings → Приватный ключ (статус never/ok/stale 90 дней, кнопка «Проверить 12 слов») + `use-backup-nudge` — тост раз в 7 дней после входа с переходом в `/settings?tab=privateKey`, пока бэкап не проверен. в Settings (решение 1b: «тихо + persist +
  non-blocking recurring nudge») — ни одного места, где после регистрации напоминают проверить 12 слов.
- [x] **Не написаны тесты из §8:** ✅ закрыто 2026-09-13: тесты «две вкладки» (два инстанса модуля, общий keyStore, сериализующий `navigator.locks` → один ключ/один S), «нет `crypto.subtle`» (degraded, `ensureInitialized` не бросает), «зависший IndexedDB» (реальный IDB-бэкенд + таймаут 2,5 с → `storage-unavailable`, ничего не стёрто). гонка двух вкладок (`ensureVaultReady` ×2 → один S, один конверт);
  `crypto.subtle` отсутствует → `degraded-fingerprint`, `register` не бросает; `getKey`, который не резолвится
  → `storage-unavailable` по таймауту 2,5 с (таймаут есть в `vault-key-store.ts:20-37`, но не проверен).
- [x] **`keys-store.ts` без страховочного `ensureVaultReady()`** ✅ закрыто 2026-09-13: `await ensureVaultReady()` в `recoverFromAccount`/`getMessengerKeys`. в `recoverFromAccount`/
  `getMessengerKeys` (план §4, defense-in-depth). Низко: `getVaultSecret()` бросает `VaultLockedError` и
  вызовы отдают `{success:false}`.
- [x] **`enablePassphrase` игнорирует `allOk=false` от `finalizeMigration()`** ✅ закрыто 2026-09-13: `VaultMigrationIncompleteError` при оставшемся fingerprint, текст `vault.migrationIncomplete` в Settings; тест. — fingerprint и
  fp-blob'ы остаются рядом с passphrase-сейфом. = **N5**.
- [~] **VP-12 · Roadmap (решение 8):** ✅ кэш DM 2026-09-13 (= V15/Р6: `purgeLocalData` при signOut/removeAccount); AES-GCM для payload'ов — остаётся roadmap. payload'ы `encryption.ts` — AES-CBC без аутентификации (отсюда
  плаузибилити-проверки формы при миграции) → AES-GCM с версией формата; открытый кэш расшифрованных DM
  в `BastyonDB.decryptedMessages` = **V15 / Р6**.

---

## 4. Закрыто и перепроверено — не перепроверять

- **CODE_REVIEW:** P0-1…P0-4 (`fad220c`: сейф сида; DM-текст через per-user pcrypto на UI и
  `chatSendMessage`; `assertInstallIdentity()` против подмены `manifest.id`; user-scoped `transaction`
  убран из `pushAll`), P1-1…P1-13 (в т.ч. P1-12 — wipe `BST_ACCOUNT_*` при выходе), P2-1,2,3,6,7,8,9,10,12,13,
  P3-6 — сняты в актуализации 2026-08-05 по коммитам и коду; исходный полный список в git не сохранился
  (документ закоммичен уже усечённым в `c0fd1ca`).
- **IPFS (по коду сегодня):** B1 `Provide.Enabled/Strategy` + `provide once` (`config.rs:83-88`, тест
  `config_sets_local_ports_and_provides_only_pinned`); B2/B3 `torBlocked()` + `torActive` после await
  (`use-ipfs-links.ts:60-62`); B4 диалоги в Rust (`mod.rs:307,338,394,609,620`); B5 `api_auth_command`
  (`config.rs:103-111`); B5+C4 `incognito`/`on_navigation` (`mod.rs:291-292`), в `capabilities` нет
  `create-webview-window`/`set-focus`; B6/D1 `ipfs-link.ts` (subdomain только CID-подобная метка, `..`/`%2e`
  выкидываются); C1 `safe_basename` (`mod.rs:629`); C2 `stop_daemon` по RPC (`mod.rs:810`); C3 `probe_client`
  с `PROBE_TIMEOUT_SECS` + `api_peer_id` (`mod.rs:690-724`); C5 `MAX_ENCRYPTED_BYTES` (`config.rs:35`,
  `mod.rs:349,435-438`); C6 href `ipfs://` разрешён (но см. K1); C7 `registerPost` только для `!pending`
  (`post-card.vue:271`); D2 `res.ok` (`ipfs-download.ts:62,86`); D4 семь `--`; D5 `start_lock` в четырёх
  командах; D6 бинарь **и** маркер (`installer.rs:139`); D7 `reap_dead_child`/`lock_error`; D8 FNV-1a в
  `use-ipfs-links.ts`; D9/D10 `_cancelPromise`/откат подписки (`ipfs-store.ts:119-120,471`); D11 модалка
  следит за стором; D12 `transaction-builder-e2e.test.ts`; D14 `buildCurrentUserAuthor` в двух местах.
- **Сейф:** файлы и точки врезки из §4 плана присутствуют (см. §3 выше); ключевые сценарии покрыты
  `crypto-vault.test.ts` (16 кейсов, включая review-фиксы cross-tab race и degrade), `vault-migration.test.ts`
  (7, включая sessionStorage и WIF через `looksLikeSecret`), `vault-unlock.test.ts` (5), heal-тесты
  `storage-keys-heal`/`storage-accounts-heal`/`storage-keys-plausibility`.

---

## 5. Куда это ложится в план `APP_AUDIT_2026-09.md`

| Волна | Отсюда | Статус |
|---|---|---|
| 0 | P3-1 (CI-гейт) + V41 + N38 | ✅ `ci.yml`, `release.yml` на pnpm, eslint 0 ошибок; typecheck-шаг ждёт N28 |
| 1 | P3-4 · P3-5 (с V19) · VP-3/VP-4 (= V12) · VP-11 (= N5) · K1 | ✅ |
| 4 | P2-5 (= S6) | ✅ |
| 5 | P3-2 · P3-3 · VP-12 кэш DM (= V15/Р6) | ✅ · P2-11 — ⏸ протокол, вместе с legacy |
| 6 | P2-4 | ✅ код+тесты; живая value-tx — при первом реальном платеже |
| 7 `[~ needs-live]` | IPFS ×3 · VP-1 UI сейфа | ⏳ нужна Tauri-сборка |
| отдельно | VP-2 · VP-5 · VP-7/VP-8 · VP-6/VP-9/VP-10 | ✅ (VP-2 — Preferences, не Keychain; на устройстве не гонялось) · D3 RPC вместо CLI — принято |

---

## 6. LARGE_FILE_SPLIT_AUDIT (2026-08-08) — хвост

Сам аудит закрыт ещё 2026-08-09 (12 разбиений + 5 quick-wins, все в `o/main`). 2026-09-13 вечером я добил
то, что там осталось «на потом», кроме двух вопросов семантики и трёх разбиений, которые без прогона в
приложении делать не стоит.

### Сделано 2026-09-13 (по коду, с тестами)

- [x] **#9 `messenger-store.ts`** (718 → 441) → `messenger-store/use-dialog-mapping.ts` (`mapRoomToDialog`) +
  `use-matrix-listeners.ts` (Room.timeline/sync) как фабрики по образцу chat-store: инстансы подсторов
  аргументами, `loadDialogs`/`scheduleLoadDialogs` колбэками. 14 тестов на фейковой комнате/событиях. `d0a71aa`
- [x] **`use-media-sending.ts` DRY** (412 → 337): общий `prepareRoom` + `media-sending-helpers.ts`
  (optimistic push / progress / remove / revoke после await / markFailed) — мутируют тот же реактивный
  `messages`. Порядок шагов по типам медиа не менялся; 12 тестов с мок-matrixService. `b96ca52`
- [x] **Тройной `AdaptedPost`** → один контракт `src/types/adapted-post.ts`, `use-feed.ts` и `post-mapper.ts`
  реэкспортируют; type-тест фиксирует тождество. `normalizeImages` в `use-feed-helpers` подтянут до
  инлайна (url/src + `resolveImageUrl`) и переиспользован лентой; barrel `composables/index.ts` реэкспортирует
  хелперы явно (ушёл TS2308). `f01de10`
- [x] **#7 `wallet-transfer.vue` → `send-transfer.ts`** (Vue-free: unspents → лок → сборка → отправка,
  `InsufficientFundsError` → i18n в компоненте; `computeTransferAmounts` и путь целиком в тестах с DI). `8425ae3`
- [x] **#8 `wallets-page.vue`** (327 → 122): вкладка «Балансы» — саб-компонент `wallet-balances/` (свой lifecycle,
  styled, `use-wallet-balances`, `parse-tx-unspent` рядом); mount-тест вкладки + тест парсера; мёртвый
  `SC_WalletTabPlaceholder` удалён. `8425ae3`
- [x] **#11 `post-card.vue`**: сиротские `helpers.ts`/`consts.ts` (никем не импортировались, семантика разошлась,
  `URL_ENCODED_PATTERN` с `g`-флагом под `.test()`) приведены к живому поведению карточки и подключены;
  `use-post-delete.ts` (confirm → contentDelete → тост → emit) с тестами. `use-post-share` не делал —
  10 строк, микро-composable. `87e322b`
- [x] **`peertube-upload.ts` resume-state** → `peertube-upload-resume.ts` (единственное, что аудит разрешал
  здесь резать). `6fade50`
- [x] **#14 `post-card-comments.vue` menu-actions** → `composables/use-comment-menu-actions.ts` + чистый
  `buildCommentPermalink`; `CommentMenuAction` переехал в `types.ts` (ушёл TS2614 в `comment-tree-context.ts`). `5ee0e25`
- [x] **#12 `use-post-poll`** (по образцу `use-post-tags`; «связан через post» оказался просто computed для
  payload). `40f1062`
- [x] **`video-player` `use-video-chapters`** — единственный кусок, «проходящий планку». `9435377`
- [x] Ссылки `(см. LARGE_FILE_SPLIT_AUDIT.md)` в 19 файлах заменены на «аудит крупных файлов 2026-08».

### Открыто — семантика, нужно решение (не трогать вслепую)

- [ ] **`safeDecode`: `+` → пробел или нет.** Живой вариант (`use-feed.ts`, лента/поиск) делает `+`→`%20`;
  орфанный в `use-feed-helpers.ts` — нет. Поля Bastyon приходят `encodeURIComponent`-кодированными
  (литеральный `+` = `%2B`), так что живой вариант превращает настоящий плюс в пробел — вероятно, баг,
  но проверять надо на реальных постах с `+` в заголовке. Пока оба сосуществуют, barrel экспортирует только
  живой; комментарий с вопросом — у хелпера. Тот же вопрос в `post-card/helpers.decodeUrlEncoded`
  (там `+` НЕ трогается — это поведение карточки сегодня).
- [ ] **`post-mapper.adaptPostData` не декодирует `c`/`m`** (`safeDecode` не зовётся) — встраивание поста в
  мессенджере может показывать `%D0%9F…` в заголовке. Второй, слабый адаптер; правильный ход — свести к
  `use-feed.adaptPostData` (usersMap, preview, lastComment) после решения по `safeDecode`.
- [ ] **`isUserVerified` ×3** (`use-feed` инлайн, `use-feed-helpers`, `feed-store-helpers`): инлайн ленты при
  `badges: []` НЕ падает на `flags.real`, хелперы падают. Какая семантика верна — вместе с предыдущим.

### Отложено осознанно (риск без прогона в приложении)

- [ ] `use-comment-form.ts` (432): @mention-меню + оптимистичный `sendReply` — делят `replyDraft`, template-ref'ы
  и keyboard-state; резать только с ручным прогоном формы ответа.
- [ ] `post-card-comments.vue` (640): deep-link (`provideCommentTree` + ref в template) и display-форматтеры с
  `setInterval`-lifecycle — только с прогоном.
- [ ] Общий примитив «оптимистичное сообщение» для комментариев/мессенджера (паттерн 5) — отдельный дизайн,
  6 call-site'ов.
- «Не резать» из аудита остаётся в силе: `video-player` (кроме глав), `chat-room` микро-composables,
  `matrix-service` `rooms.ts`, `use-post-video`, `use-post-share`.
