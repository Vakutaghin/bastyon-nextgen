# Архитектура чатов в новом приложении (bastyon‑vue)

## Основные модули
- `src/b-components/messenger/services/matrix-service.ts` — подключение к Matrix, логин, отправка сообщений, базовая обработка клиента.
- `src/b-components/messenger/store.ts` — Pinia‑стор для диалогов, сообщений, синхронизации и E2E‑дешифровки.
- `src/b-components/messenger/services/pcrypto.ts` — E2E‑криптография (AES‑SIV, derivation ключей, дешифровка).
- `src/blockchain/core/keys/key-generator.ts` — derivation 12 ключей мессенджера по legacy‑пути.

## Подключение и логин
1. `initMatrix()` проверяет `authStore` и вызывает `matrixService.login(address, keyPair)`.
2. Логин выполняется через `m.login.password` с hex‑username (см. LEGACY_AUTH_VERIFICATION.md).
3. Базовый `baseUrl`: в dev — `window.location.origin`, в prod — `https://matrix.bastyon.com`.
4. После успешного логина клиент стартует с `initialSyncLimit: 1`.

## Синхронизация и события
- Подписка на `Room.timeline` добавляет сообщения в активный чат и обновляет список диалогов.
- Подписка на `sync` обновляет `syncState` и перезагружает диалоги при состоянии `PREPARED`.

## Диалоги и сообщения
- `loadDialogs()` берёт комнаты из `matrixService.getRooms()` и маппит их в диалоги.
- `loadMessages(chatId)` загружает `room.timeline` и маппит события в `Message`.
- Профили пользователей подтягиваются батчами через `getuserprofile` и кешируются.

## E2E‑дешифровка
- При наличии `m.room.encrypted` или `secrets` вызывается `tryDecrypt()`.
- Для дешифровки собираются участники комнаты и их публичные ключи из профилей.
- Порядок пользователей сортируется по `dbId` для совместимости с legacy‑алгоритмом.

### Подробный алгоритм дешифровки
1. **Определение, что сообщение зашифровано**
   - Условие: `event.type === "m.room.encrypted"` или найден объект `secrets`.
   - Источники `secrets`:
     - `content.info.secrets`
     - `content.pbody.secrets`
     - `content.secrets`
     - `content.body` как Base64‑JSON, если начинается с `ey` и внутри есть `"encrypted"` или `"keys"+"cipher"`.

2. **Нормализация блока**
   - `block` берётся из `secrets.block` или `content.block`.
   - Если `secrets` получен из `content.body`, в `secrets.block` подставляется `content.block`, либо `block` из декодированного JSON.
   - Для Direct‑чатов при отсутствии `block` берётся текущая высота блока (`getnodeinfo.lastblock.height`) и записывается обратно в `content`/`secrets`.

3. **Сбор участников комнаты**
   - Получаем список участников на момент события (member history + current state).
   - Для каждого участника подгружаем профиль через `getuserprofile`.
   - Публичные ключи берутся из `profile.k` (12 ключей через запятую).
   - Для текущего пользователя приоритет: `profile.k` → локально derivation‑ключи (`deriveMessengerKeys`).

4. **Сортировка участников**
   - `version` определяется из `content.version` или `secrets.version/v`.
   - Если `version > 1`, пользователи сортируются по `dbId` (числовой `profile.id`), затем по `matrixId`.

5. **Декодирование `secrets`**
   - `secrets.keys` всегда Base64‑JSON.
   - Декодирование: `atob` → `TextDecoder` → `JSON.parse`.
   - Получаем объект `body`, где ключи — matrixId участников, а значения — `{ encrypted, nonce }` (старый формат) либо другой формат шифрования ключей.

6. **Выбор индексов для ключей**
   - `sender = getmatrixid(event.sender)`, `me = getmatrixid(myId)`.
   - Если `sender === me`, выбирается первый `body`‑ключ, отличающийся от `me`.
   - Иначе: `bodyindex = me`, `keyindex = sender`.

7. **Деривация AES‑ключей**
   - Формируется список пользователей по `body` + `sender`.
   - Для каждого `i=0..11` вычисляется `cuhash = PBKDF2(SHA224(concat(keys[i]) + block), salt, 1, 32, sha256)`.
   - Скаляр/точка считаются по secp256k1, далее `sharedPoint` → `PBKDF2(sharedPointHex, salt, 64, 32, sha512)`.

8. **Дешифровка AES‑SIV**
   - По `keyindex` выбирается ключ, затем вызывается AES‑SIV `open(ciphertext, nonce)`.
   - На выходе — строка сообщения (`TextDecoder`).

**Ключевые файлы:**
- `src/b-components/messenger/store.ts` — `tryDecrypt`, сбор участников, `block`, сортировка.
- `src/b-components/messenger/services/pcrypto.ts` — Base64‑декодирование, индексы, derivation, AES‑SIV.
- `src/blockchain/core/keys/key-generator.ts` — derivation 12 ключей по пути `m/33'/0'/0'/i'`.

## Криптография (pcrypto)
- Базовые ключи мессенджера получаются через `deriveMessengerKeys(privateKey)` по пути `m/33'/0'/0'/i'` для `i=1..12`.
- Пользовательские ключи берутся из профиля (`getuserprofile`), поле `k` содержит публичные ключи через запятую.
- Алгоритм E2E‑ключей использует EAA‑схему:
  - `cuhash` = PBKDF2(SHA224( concat(keys[i]) + block ), salt, 1, 32, sha256).
  - Скаляры/точки вычисляются через `tiny-secp256k1`, суммирование по кривой secp256k1.
  - Итоговые shared‑keys выводятся через PBKDF2(sharedPoint, salt, 64, 32, sha512).
- Дешифровка поддерживает 2 формата:
  - Новый: `{ keys, cipher, iv }` с дешифровкой CEK и затем сообщения через AES‑SIV.
  - Старый: `{ encrypted, nonce }` с прямой дешифровкой AES‑SIV.
- `secrets` всегда декодируется как Base64‑JSON; `block` по умолчанию = 10.
