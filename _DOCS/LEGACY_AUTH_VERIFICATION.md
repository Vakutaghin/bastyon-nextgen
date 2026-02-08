# Процесс верификации и авторизации (Legacy Implementation)

Этот документ описывает процесс верификации и авторизации в Matrix, основанный на реализации в старых приложениях (`pocketnet.gui` и `bastyon-chat`).

## 1. Авторизация через подпись (`org.pocketnet.auth`)

Этот метод используется в мобильном приложении (`pocketnet.gui`) и является предпочтительным для беспарольной аутентификации.

### Основные параметры запроса
**Тип авторизации:** `org.pocketnet.auth`

**Параметры:**
*   `type`: `"org.pocketnet.auth"`
*   `address`: Bitcoin-адрес пользователя
*   `pubkey`: Публичный ключ (hex)
*   `signature`: Hex-строка подписи
*   `nonce`: Строка, использованная для генерации подписи
*   `v`: Версия протокола (обычно `1`)

### Алгоритм генерации подписи

**Исходный код:** `/private/var/www/pocketnet/pocketnet.gui/js/user.js` (метод `signature`) и `/private/var/www/pocketnet/pocketnet.gui/cordova/www/components/external/index.js`

1.  **Формирование данных для подписи (`str`):**
    *   В `pocketnet.gui` используется строка: `'auth:' + host`
    *   Пример: `auth:matrix.pocketnet.app`
    *   *Примечание:* Если хост не указан, по умолчанию может использоваться `'pocketnetproxy'`.

2.  **Генерация Nonce:**
    Формат строки nonce (Новый формат / `v=1`):
    ```
    date={ISO_DATE},exp={EXPIRATION_SECONDS},s={HEX_ENCODED_DATA}
    ```
    *   `ISO_DATE`: Текущее время в UTC (ISO 8601), например `2023-10-27T10:00:00.000Z`.
    *   `EXPIRATION_SECONDS`: Время жизни подписи (обычно 360 секунд).
    *   `HEX_ENCODED_DATA`: Hex-кодированное значение строки данных (см. п.1).

3.  **Создание подписи:**
    *   Nonce хешируется алгоритмом SHA256.
    *   Полученный хеш подписывается приватным ключом (ECPair).
    *   Подпись конвертируется в Hex-строку.

    ```javascript
    // Псевдокод (из pocketnet.gui/js/user.js)
    var nonce = 'date=' + currentMomentInUTC + ",exp=" + exp + ',s=' + hexEncode(str);
    var signature = keyPair.sign(bitcoin.crypto.sha256(Buffer.from(nonce)));
    ```

## 2. Авторизация через пароль (`m.login.password`)

Этот метод обнаружен в репозитории `bastyon-chat`. Он использует детерминированный пароль, сгенерированный из приватного ключа.

**Исходный код:** `/private/var/www/pocketnet/bastyon-chat/src/application/user/pnuser.js` (метод `matrixCredentials`)

### Алгоритм генерации пароля

Пароль представляет собой двойной SHA256 хеш от приватного ключа.

```javascript
var password = bitcoin.crypto
    .sha256(bitcoin.crypto.sha256(Buffer.from(this.credentials.privateKey)))
    .toString("hex");
```

### Параметры запроса
**Тип авторизации:** `m.login.password`

**Параметры:**
*   `type`: `"m.login.password"`
*   `user`: Bitcoin-адрес пользователя (в нижнем регистре)
*   `password`: Сгенерированный пароль (см. выше)
*   `device_id`: ID устройства (опционально)

## 3. Сравнение реализаций

| Характеристика | pocketnet.gui (Mobile) | bastyon-chat (Web) |
| :--- | :--- | :--- |
| **Метод** | `org.pocketnet.auth` | `m.login.password` (преимущественно) |
| **Данные подписи** | `'auth:' + host` | `'pocketnetproxy'` (в методе signature) |
| **Формат подписи** | SHA256 от Nonce | SHA256 от Nonce |
| **Пароль** | Не используется | Double-SHA256 от Private Key |

## 4. Текущая реализация в Bastyon Vue

Фактическая реализация логина в текущем коде опирается на `m.login.password` и поведение из рабочего коммита 3a15627. Используется hex-идентификатор пользователя, совместимый с legacy-приложением.

### 4.1. Нормализация адреса
1. Входной `address` может прийти как hex-строка.
2. Если строка выглядит как hex и успешно декодируется в валидный Pocketnet-адрес, он используется как нормализованный адрес.
3. Для Matrix username используется hex-строка адреса в нижнем регистре.
4. Преобразование `addressToHex` работает посимвольно и учитывает кириллицу через смещение `0x350`, обратное преобразование `hexToAddress` делает зеркальную коррекцию.

### 4.2. Алгоритм генерации пароля
Пароль = Double-SHA256 от **hex-строки** приватного ключа.

```typescript
const privateKeyHex = keyPair.privateKey.toString('hex')
const passwordHash = CryptoJS.SHA256(
  CryptoJS.SHA256(privateKeyHex)
).toString(CryptoJS.enc.Hex)
```

Это важно: хэшируется именно строка `privateKeyHex`, а не бинарные байты.

### 4.3. Параметры логина
**Тип авторизации:** `m.login.password`

**Параметры:**
* `user`: `addressToHex(normalizedAddress).toLowerCase()`
* `password`: `passwordHash`
* `initial_device_display_name`: `Bastyon Web`

### 4.4. Регистрация (fallback)
Если логин не удался и username доступен, выполняется регистрация:

* `register(user, password, null, { type: 'm.login.dummy' })`

### 4.5. Флоу логина в коде
1. Создается временный Matrix‑клиент `sdk.createClient({ baseUrl })`.
2. Входящий `address` нормализуется, затем вычисляется `userHex`.
3. Если есть `loginToken`, используется `m.login.token` с `user: userHex`.
4. Если передан `keyPair`, выполняется `m.login.password` с `userHex` и `passwordHash`.
5. При ошибке логина выполняется регистрация через `m.login.dummy` при доступности username.
6. При успешном ответе основной клиент инициализируется через `init(user_id, access_token, device_id)`.

### 4.6. Источник истины
Файл реализации:
`/private/var/www/pocketnet/bastyon-nextgen/src/b-components/messenger/services/matrix-service.ts`
