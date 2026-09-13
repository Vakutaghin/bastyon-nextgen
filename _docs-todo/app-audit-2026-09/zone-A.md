## Зона: A — bootstrap / session / auth / accounts / registration / vault

### Находки
- **A1 · 🟠 высоко · data** — `needs-reset` стирает все локальные данные молча, а `storage.persist()` запрашивается только на вкладке Settings → Security (план §5/§7/§10.1 не выполнен)
  - Файл: `src/blockchain/store/auth-store/restore-session.ts:49-54`; `src/blockchain/storage/vault/crypto-vault.ts:185-196, 292-310`; `src/pages/settings-page/use-vault-security.ts:26-32`, `tabs/security-section.vue:94-97`
  - Суть: план требует для `needs-reset` явный экран «восстановить по 12 словам» и запрос persistent storage при первом персисте; в коде `restore-session` сразу `clearAllUserData()` без сообщения, `mintDeviceVault` не делает round-trip verify, `navigator.storage.persist()` дёргается только в разделе безопасности.
  - Сценарий: passwordless, в Settings не заходил → браузер вытесняет best-effort IndexedDB `bastyon-vault` (Chrome под давлением хранилища, Safari ITP 7 дней в web) → `getKey()===null` → `needs-reset` → `clearAllUserData()` → «Войти/Регистрация» без объяснения; если 12 слов не записаны (A10) — аккаунт потерян.
  - Фикс: звать `navigator.storage?.persist?.()` в `mintDeviceVault`/`bootstrapFromLegacy` (или в `main.ts`), round-trip verify в `mintDeviceVault`, на `needs-reset` недискардимая модалка «локальный ключ утерян — восстановите по 12 словам», стирать только после подтверждения.
  - Уверенность: high по коду, medium по частоте вытеснения.

- **A2 · 🟠 высоко · logic** — стейт регистрации (watcher, `mnemonic`, `pendingNickname`, `registrationPending`) не привязан к адресу и не сбрасывается при смене аккаунта/выходе → чужой сид в модалке и тихая отмена регистрации
  - Файл: `src/b-components/header/header-user/use-registration-flow.ts:92-115, 157-186`, `registration-status-watcher.ts:45-59`, `src/blockchain/api/registration-status.ts:24-29`
  - Сценарий: регистрация B в процессе (step 2) → свитчер «Добавить аккаунт» → вход как C → тик watcher'а: статус C = `registered` → `onComplete` → модалка «Сохраните сид-фразу» с мнемоникой B поверх сессии C, `pending_registration` удалён → tx для B никогда не дослан. Вариант: после регистрации B «Выйти» → через ≤5 с `onComplete` → модалка с сидом удалённого аккаунта на разлогиненном экране.
  - Фикс: хранить адрес регистрируемого аккаунта; в watcher/`onComplete` сверять `authStore.getUserAddress === pending.address`; при смене адреса/выходе останавливать watcher и обнулять состояние.
  - Уверенность: high.

- **A3 · 🟠 высоко · data** — `pending_registration.step < 2` на буте вызывает `clearAllUserData()` для ВСЕХ аккаунтов; `clearAllUserData()`/signOut не чистят `pending_registration`
  - Файл: `src/blockchain/store/auth-store/restore-session.ts:69-79`; `src/blockchain/storage/storage-manager.ts:82-117`; `src/b-components/header/register-modal/register-modal.vue:304-322, 358-368`
  - Сценарий: чистое устройство → «Регистрация» → `register()` персистит B, pending step 1 → капча отменена → модалка закрыта (pending остаётся) → «Выйти» (`removeAccount(B)`, pending не тронут) → «Войти» с мнемоникой A → следующий запуск: `pending.step<2` → `clearAllUserData()` → A стёрт.
  - Фикс: при `step<2` удалять только `pending.address` и восстанавливать прежний `currentAccount`; чистить `pending_registration`/`pending_nickname` в `clearAllUserData()`/`removeAccount`; читать через `loadPendingRegistration()` (TTL).
  - Уверенность: high.

- **A4 · 🟠 высоко · logic** — отмена/повтор регистрации не откатывает персист: отменённый аккаунт остаётся `currentAccount`, каждый ретрай после ошибки шага 3 минтит новый аккаунт-сироту
  - Файл: `register-modal.vue:263-266, 306-316`; `src/blockchain/store/auth-store.ts:145-150, 207-219`
  - Сценарий: «Отмена» после шага 2 → шапка «Войти/Регистрация», но переход на `/settings` или перезагрузка логинят в отменённый B; прежний A вытеснен. Ошибка капчи → «Зарегистрироваться» ещё раз → аккаунты B, C, D… с зашифрованными сидами.
  - Фикс: в ветке отмены/ошибки `keys.removeAccount(address)` + `clearStoredData(BST_MNEMONIC)` и восстановление прежнего аккаунта; при ретрае переиспользовать `pending.address`.
  - Уверенность: high.

- **A5 · 🟠 высоко · logic** — «Добавить аккаунт»: любая ошибка (опечатка в мнемонике) или отмена `signIn` роняет текущую сессию; fallback в модалке при отмене — `signOut()` всех аккаунтов
  - Файл: `src/blockchain/store/auth-store.ts:250-259, 158-164, 310-319, 493-500`; `sign-in-modal.ts:93-99`
  - Суть: `signIn` до попытки восстановления вызывает `profile.clearProfile()`, в `catch` ставит `isAuthenticated=false`; `_cancelSignIn()` делает `keys.clearKeys()`; в `sign-in-modal.ts` при `isCancelling && result.success` — `authStore.signOut()` (= `clearAllUserData()+destroyVault()`).
  - Сценарий: залогинен A → «Добавить аккаунт» → мнемоника с опечаткой → шапка показывает «Войти/Регистрация», профиль стёрт до перезагрузки.
  - Фикс: снапшот сессии и восстановление в `catch`/`_cancelSignIn`; в модалке вместо `signOut()` — `removeAccount(new)` + `switchAccount(prev)`.
  - Уверенность: high.

- **A6 · 🟡 средне · ux-claim** — вход по WIF невозможен, хотя UI обещает «hex/WIF» (= B13; детект по сети Bitcoin, восстановление по Pocketnet; `plausibility.ts:17` не матчит несжатый Pocketnet-WIF)
  - Файл: `key-validator.ts:182-188`; `key-recovery.ts:126`; `src/locales/ru.ts:631,637`
  - Фикс: пробовать `fromWIF(raw, POCKETNET_NETWORK)` и `fromWIF(raw)`; синхронизировать regex в `plausibility.ts`.

- **A7 · 🟡 средне · security** — общий `BST_MNEMONIC` как fallback показывает сид ЧУЖОГО аккаунта; `removeAccount` оставляет сид удалённого аккаунта на диске и legacy-ветка restore может его «воскресить»
  - Файл: `account-switcher/helpers/load-account-mnemonic.ts:19-24`; `use-private-key-reveal.ts:86-96`; `keys-store.ts:160-170, 195-198`; `restore-session.ts:111-146`
  - Сценарий: A (без `BST_ACCOUNT_A`/повреждённый blob) и B (вошёл последним) → «Показать сид-фразу» для A → сид B под заголовком A. «Выйти» из A — `BST_MNEMONIC=A` остаётся; если у следующего аккаунта не читается blob, restore логинит обратно в «удалённый» A.
  - Фикс: при fallback сверять адрес из `recoverKeyPair(secret)`; в `removeAccount` чистить `BST_MNEMONIC`, если он принадлежит удаляемому (или per-account ключ).
  - Уверенность: high/medium.

- **A8 · 🟡 средне · logic** — `switchAccount`/`signIn` не переподписывают WS (= B7)
  - Файл: `auth-store.ts:463-501, :306`; `ws-service.ts:85-91, 220-224`
  - Фикс: `wsService.reconnect()` после смены ключей.

- **A9 · 🟡 средне · race** — `isAuthenticated=true` выставляется до персиста и последней проверки отмены; `resetMessenger(true)` даёт второй параллельный Matrix-login
  - Файл: `auth-store.ts:274-281, 305, 207-209`; `main.ts:119-127`; `messenger-store.ts:302-305, 618-623`; `matrix-service.ts:104-140`
  - Сценарий: любой вход/регистрация → два Matrix-логина (две серверные сессии/девайса), одна брошена; при отмене входа matrix-логин отменённого аккаунта доигрывает.
  - Фикс: `authenticated` только после персиста и проверки `signal.aborted`; убрать `resetMessenger(true)` из `signIn` либо дедупить `initMatrix` промисом; в `_cancelSignIn` — `resetMessenger(false)`.
  - Уверенность: high/medium.

- **A10 · 🟡 средне · ux-claim** — сид после регистрации показывается только в той же сессии; перезагрузка во время «регистрация в процессе» → 12 слов никогда не показаны; `setNeedShowMnemonic` нигде не вызывается; гейт «бэкап перед passphrase» — просто чекбокс
  - Файл: `use-registration-flow.ts:175-178, 272-285`; `mnemonic-storage.ts:12`; `security-section.vue:30, 106-108`
  - Фикс: `setNeedShowMnemonic(address)` в `register()`, снимать в `handleMnemonicModalClose`; в диалоге passphrase показывать сид и требовать ввод 2–3 слов.
  - Уверенность: high.

- **A11 · 🟡 средне · ux-claim** — «регистрация в процессе» врёт: аккаунт без on-chain профиля крутит «часики» и поллит RPC каждые 5 с бесконечно; фатальная ошибка tx проглатывается, после перезагрузки pending снимается молча
  - Файл: `registration-status.ts:103-119`; `registration-status-watcher.ts:35, 61-67`; `use-registration-flow.ts:205-247`; `send-registration-transaction.ts:102-106`; `retry-registration-tx.ts:109-116`
  - Сценарий: импорт мнемоники кошелька без профиля → часики + два RPC каждые 5 с навсегда. Или занятое имя → code 19 → часики до перезагрузки → потом pending исчез, ника нет, ошибки нет.
  - Фикс: «регистрация идёт» только при наличии `pending_registration`; backoff/лимит; `isFatalError` + toast.
  - Уверенность: high.

- **A12 · 🟡 средне · data** — уведомления: in-flight `init()` прежнего аккаунта после `await` вливает свои элементы в список нового; `notificationsStore.reset()` не вызывается при выходе
  - Файл: `src/stores/notifications-store.ts:83-89, 151-196`; `auth-store.ts:322-360`
  - Фикс: после каждого `await` проверять `this.initedForAddress === address`; звать `reset()` в `signOut`/`switchAccount`.
  - Уверенность: high.

- **A13 · ⚪ низко · security** — `enablePassphrase` игнорирует результат `finalizeMigration()`: при `allOk=false` fingerprint и fp-шифрованные blob'ы остаются рядом с passphrase-сейфом
  - Файл: `crypto-vault.ts:366-370, 319-333`
  - Фикс: после `finalizeMigration()` проверять отсутствие fingerprint и отказывать в enable.

- **A14 · ⚪ низко · security** — буфер обмена с сидом не очищается; passphrase остаётся в reactive-состоянии после разлока; сид живёт в `mnemonic` ref шапки весь период pending
  - Файл: `mnemonic-modal.vue:159-192`; `vault-unlock-modal.vue:110-126`; `security-section.vue:118-130`; `use-registration-flow.ts:99`
  - Фикс: автоочистка clipboard 30–60 с; обнулять `pw*` после submit; не-reactive хранение мнемоники.

- **A15 · ⚪ низко · logic** — `isEmbedRoute()` в `main.ts` при буте всегда `false` (роутер на `START_LOCATION`) → «пропуск для embed» мёртв
  - Файл: `main.ts:78-88`; `vault-unlock.ts:57-65`
  - Фикс: kick после `router.isReady()` либо `location.pathname.startsWith('/embed/')`.

- **A16 · ⚪ низко · logic** — глобальный keydown (capture) перехватывает Space/M у сфокусированных кнопок/select после первого воспроизведения видео
  - Файл: `use-global-keyboard.ts:12-33, 51-70, 105`
  - Фикс: считать «вводом» также `button`, `select`, `[role=…]`, открытые модалки.

- **A17 · ⚪ низко · data** — черновик поста `bastyon_post_draft` глобальный и не чистится при выходе
  - Файл: `post-draft.ts:3-16`; `storage-manager.ts:82-117`
  - Фикс: ключ с адресом или удаление в `clearAllUserData()`.

- **A18 · ⚪ низко · security** — `console.error('[auth-store] Recovery result is invalid:', recoveryResult)` печатает объект с полем `source` = сырой мнемоникой (ветка почти недостижима)
  - Файл: `restore-session.ts:129`; `types/keys.ts:65`
  - Фикс: логировать только `format`; убрать `source` из результата.

### Несостыковки между модулями
- **A19 · 🟡 средне · consistency** — язык: два источника истины (localStorage `bastyon_locale` через `setI18nLocale` и IndexedDB `bastyonAppLanguage` через `ui-store`), выбор в шапке не переживает перезагрузку
  - Файл: `i18n/index.ts:27-39, 57-67`; `ui-store.ts:10-17, 151-163`; `header-logo.vue:100`; `main.ts:90-92`; `app-layout.vue:60`
  - Сценарий: navigator `en-US`, в шапке выбрал `ru` → перезагрузка: старт на `ru` (LS) → через ~50 мс переключение на `en`; `loadLanguage()` вызывается дважды.
  - Фикс: единый владелец — `ui-store.setLanguage`; `loadLanguage` применять только если в IDB есть значение.
  - Уверенность: high.

- **A20 · ⚪ низко · consistency** — `pending_registration`: три читателя с разной семантикой (TTL 30 мин vs сырой `getItem`), два пути досыла tx с разной проверкой адреса
  - Файл: `pending-registration-store.ts:25-38`; `restore-session.ts:70-73`; `use-registration-flow.ts:236-243`; `register-modal.vue:206-222`; `retry-registration-tx.ts:107`
  - Фикс: везде `loadPendingRegistration()`, сверять адрес, единый резюмер.

### Проверено — ОК
- i18n: ru/en идентичны (1435 ключей), все 144 ключа зоны есть.
- vault-key-store: null только при отсутствии записи; IDB-проблемы → `storage-unavailable` (недеструктивно), таймаут 2.5 с.
- vault-crypto: свежий IV/salt, device-ключ `extractable:false`, PBKDF2-SHA256/600k; passphrase не персистится; конверт backup-first.
- Locks: один уровень `navigator.locks`, дедлок исключён.
- Unlock-модалка недискардима, кулдаун персистится, «Забыл пароль» доступен.
- Heal-ветки storage-keys/accounts: `looksLikeSecret` не режет валидные данные.
- restoreSession: дедуп `restoreInFlight`; guard паркует навигацию; `compose` без auth сознательно.
- Регистрация персистит мнемонику ДО tx; nickname-валидация согласована; капча до 3 ретраев.
- signOut: закрывает WS, чистит всё, `destroyVault`, messenger logout, invalidate.
- removeAccount: активный+другие → switch; последний → clear+signOut.
- В логах ключей нет (кроме A18); `use-error-boundary` в prod не показывает текст.
- Ключи vue-query включают адрес; z-index стек модалок корректный (2600 < 2700 < 2800 < 3000 < 3100).
