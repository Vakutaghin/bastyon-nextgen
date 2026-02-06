# Авторизация через блокчейн с приватным ключом

## Обзор

В приложении Pocketnet/Bastyon авторизация происходит через блокчейн с использованием криптографических ключей. Вместо традиционной пары логин/пароль используется приватный ключ, который может быть представлен в виде:
- **12-словной мнемонической фразы** (BIP39)
- **Приватного ключа в формате WIF** (Wallet Import Format)
- **Приватного ключа в hex-формате**
- **QR-кода** (содержащего один из вышеперечисленных форматов)

Система использует ту же криптографию, что и Bitcoin (ECDSA, BIP32, BIP39).

---

## Архитектура авторизации

### Компоненты системы

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Layer                                  │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Authorization   │         │   Registration   │         │
│  │   Component      │         │    Component      │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
└───────────┼────────────────────────────┼─────────────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  User Module (user.js)                       │
│  - signin(mnemonic)                                         │
│  - setKeys(mnemonic)                                        │
│  - keysFromMnemo(mnemonic)                                 │
│  - signature(str, exp)                                      │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Cryptography Layer                              │
│  - BIP39: Генерация/валидация мнемоники                     │
│  - BIP32: Деривация ключей по пути                         │
│  - ECDSA: Генерация ключевых пар                           │
│  - Bitcoin.js: Работа с адресами и подписями               │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              SDK Layer (Platform SDK)                        │
│  - address.pnet(): Генерация Pocketnet адреса             │
│  - address.path(n): BIP32 путь для деривации              │
│  - address.wallet(n): Генерация кошельковых адресов        │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              API Layer                                       │
│  - Подпись запросов (signature)                             │
│  - Верификация на сервере                                   │
│  - Blockchain транзакции                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Процесс регистрации

### 1. Генерация мнемонической фразы

**Файл:** `pocketnet.gui/components/registration/index.js`

```javascript
// Генерация 12-словной мнемонической фразы
var key = bitcoin.bip39.generateMnemonic();

// Пример результата:
// "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```

**Процесс:**
1. Используется библиотека `bitcoin.bip39.generateMnemonic()`
2. Генерируется 128 бит энтропии
3. Создается 12-словная мнемоническая фраза из словаря BIP39
4. Фраза сохраняется и показывается пользователю для сохранения

### 2. Генерация ключевой пары из мнемоники

**Файл:** `pocketnet.gui/js/user.js`

```javascript
self.keysFromMnemo = function(mnemonic) {
    mnemonic = (mnemonic || '').toLowerCase()
    
    // Кеширование для оптимизации
    var cache = self.smcache('mncache' + (window.testpocketnet ? 'test' : 'production'), true)
    
    // Конвертация мнемоники в seed (512 бит)
    var seed = cache.get(mnemonic) || bitcoin.bip39.mnemonicToSeedSync(mnemonic)
    cache.set(mnemonic, seed)
    
    return self.keysFromSeed(seed)
}
```

**Процесс:**
1. Мнемоническая фраза конвертируется в seed через PBKDF2 (2048 итераций)
2. Seed используется для генерации ключевой пары

### 3. Деривация ключа по BIP32 пути

**Файл:** `pocketnet.gui/js/user.js`

```javascript
self.keysFromSeed = function(seed) {
    var cache = self.smcache('seedcache' + (window.testpocketnet ? 'test' : 'production'))
    
    // BIP32 путь для основного адреса: m/44'/0'/0'/0'
    var d = cache.get(seed.toString('hex')) || 
            bitcoin.bip32.fromSeed(seed)
                .derivePath(app.platform.sdk.address.path(0))
                .toWIF()
    
    cache.set(seed.toString('hex'), d)
    
    var keyPair = bitcoin.ECPair.fromWIF(d)
    return keyPair
}
```

**BIP32 пути:**
- **Основной адрес:** `m/44'/0'/0'/0'` (через `address.path(0)`)
- **Кошельковые адреса:** `m/44'/0'/0'/n'` (где n > 0)
- **Криптографические ключи:** `m/33'/0'/0'/n'` (через `address.path33(n)`)

### 4. Генерация Pocketnet адреса

**Файл:** `pocketnet.gui/js/satolist.js` (SDK)

```javascript
address: {
    pnet: function (pubkey, type) {
        type || (type = 'p2pkh')
        
        if (!pubkey) pubkey = self.app.user.key.value;
        
        if (!pubkey) return null
        
        // Генерация P2PKH адреса (начинается с 'P')
        if (type == 'p2pkh' || type == 'p2wpkh') {
            a = bitcoin.payments[type]({
                pubkey
            })
            
            this.storage[type] = a;
            return a;
        }
    },
    
    // Упрощенная версия для быстрой генерации
    pnetsimple: function (pubkey) {
        var type = 'p2pkh';
        var a;
        
        if (type == 'p2pkh' || type == 'p2wpkh') {
            a = bitcoin.payments[type]({
                pubkey: pubkey
            })
            return a;
        }
    },
    
    // Генерация кошелькового адреса (P2SH, начинается с '3')
    wallet: function (n, _private) {
        const { publicKey: pubkey } = self.sdk.address.dumpKeys(n, _private);
        
        const a = bitcoin.payments['p2wpkh']({
            pubkey
        });
        
        const p2sh = bitcoin.payments.p2sh({
            redeem: a
        });
        
        return p2sh;
    }
}
```

**Типы адресов:**
- **P2PKH** (Pay-to-Public-Key-Hash): Адреса начинаются с `P` - основной тип для пользователей
- **P2WPKH** (Pay-to-Witness-Public-Key-Hash): SegWit адреса
- **P2SH** (Pay-to-Script-Hash): Адреса начинаются с `3` - для кошельков

---

## Процесс авторизации (вход)

### 1. Ввод приватного ключа

**Файл:** `pocketnet.gui/components/authorization/index.js`

Пользователь может ввести:
- Мнемоническую фразу (12 слов)
- Приватный ключ в hex-формате
- Приватный ключ в WIF-формате
- Загрузить QR-код с ключом

```javascript
var mnemonicKey = trim(el.login.val());

// Валидация мнемоники
var validation = function(m){
    return bitcoin.bip39.validateMnemonic(m)
};

// Обработка QR-кода
if(file.ext == 'png' || file.ext == 'jpeg' || file.ext == 'jpg'){
    grayscaleImage(file.base64, function(image){
        bfqrscanner.q.callback = function(data){
            if(data == 'error decoding QR Code'){
                sitemessage(self.app.localization.e('filedamaged'))
            } else {
                el.login.val(trim(data))
                el.hiddenform.submit()
            }
        }
        bfqrscanner.q.decode(image)
    })
}
```

### 2. Восстановление ключевой пары

**Файл:** `pocketnet.gui/js/user.js`

```javascript
self.signin = function(mnemonic, clbk) {
    var setKeysClbk = function() {
        // Шифрование мнемоники для хранения
        app.platform.cryptography.api.aeswc.encryption(
            mnemonic, 
            app.options.fingerPrint, 
            {}, 
            function(enc) {
                // Сохранение в localStorage/sessionStorage
                if (self.stay) {
                    try {
                        localStorage['mnemonic'] = enc
                    } catch(e) {}
                } else {
                    sessionStorage['mnemonic'] = enc
                }
                
                self.umnemonic = enc
            }
        )
        
        // Проверка состояния авторизации
        self.isState(function(state) {
            if(state) {
                try {
                    localStorage['waslogged'] = true
                    localStorage['useraddress'] = self.address.value
                } catch(e) {}
                
                app.apps.emit('state', 1)
                self.prepare(clbk)
            } else {
                if (clbk) clbk(state)
            }
        })
    }
    
    // Валидация и восстановление ключей
    if(!bitcoin.bip39.validateMnemonic(mnemonic)) {
        // Попытка восстановить из приватного ключа
        self.setKeysPairFromPrivate(mnemonic, function(result) {
            if(result) {
                setKeysClbk()
            } else {
                state = 0;
                if (clbk) clbk(state)
            }
        })
    } else {
        // Восстановление из мнемоники
        self.setKeys(mnemonic, function() {
            setKeysClbk()
        })
    }
}
```

### 3. Восстановление из приватного ключа

```javascript
self.keysPairFromPrivate = function(_private, clbk) {
    if(!_private) _private = ''
    
    var keyPair = null;
    
    // Проверка, является ли это мнемоникой
    if (bitcoin.bip39.validateMnemonic(_private.toLowerCase())) {
        keyPair = self.keysFromMnemo(_private)
    } else {
        // Попытка восстановить из hex
        try {
            keyPair = bitcoin.ECPair.fromPrivateKey(Buffer.from(_private, 'hex'))
        } catch (e) {
            // Попытка восстановить из WIF
            try {
                keyPair = bitcoin.ECPair.fromWIF(_private)
            } catch (e) {
                // Ошибка
            }
        }
    }
    
    return keyPair
}
```

### 4. Установка ключевой пары

```javascript
self.setKeysPair = function(keyPair, clbk) {
    keys.private.set(keyPair.privateKey)
    keys.public.set(keyPair.publicKey)
    keys.pair.set(keyPair)
    
    // Генерация адреса из публичного ключа
    var address = app.platform.sdk.address.pnet()
    self.address.set(address.address)
    
    localStorage['useraddress'] = address.address
    
    if (clbk) clbk()
}
```

---

## Подпись запросов (Signature)

### Генерация подписи для API

**Файл:** `pocketnet.gui/js/user.js`

```javascript
self.signature = function(str, exp, old, expirationShift) {
    if(!str) str = 'pocketnetproxy'
    if(!exp) exp = 360  // Время жизни в секундах
    if(!expirationShift) expirationShift = 160
    
    var keyPair = self.keys()
    
    // Создание nonce с временной меткой
    const currentMomentInUTC = (new Date()).toISOString();
    var nonce = 'date=' + currentMomentInUTC + ",exp=" + exp + ',s=' + hexEncode(str);
    
    var signature = null;
    
    if (old) {
        // Старый формат (для совместимости)
        nonce = utcnow().getTime()
        do {
            nonce = nonce + '' + rand(0, 9).toString();
        } while(nonce.length < 32)
        
        signature = keyPair.sign(Buffer.from(nonce))
    } else {
        // Новый формат: подпись SHA256 хеша nonce
        signature = keyPair.sign(bitcoin.crypto.sha256(Buffer.from(nonce)))
    }
    
    var sobj = {
        nonce: nonce,
        signature: signature.toString('hex'),
        pubkey: keyPair.publicKey.toString('hex'),
        address: self.address.value,
        v: 1  // Версия подписи
    }
    
    if(old) delete sobj.v
    
    return sobj
}
```

**Структура подписи:**
```javascript
{
    nonce: "date=2026-01-24T12:00:00.000Z,exp=360,s=706f636b65746e657470726f7879",
    signature: "30440220...",  // ECDSA подпись в hex
    pubkey: "02...",           // Публичный ключ в hex
    address: "P...",            // Pocketnet адрес
    v: 1                        // Версия протокола
}
```

### Использование подписи в API запросах

**Файл:** `pocketnet.gui/js/lib/client/api.js`

```javascript
var sign = function(data) {
    var signature = null
    var session = ''
    
    if (proxy && proxy.session) session = proxy.session
    
    if (app.user && (app.user.getstate && app.user.getstate() == 1)) {
        try { 
            signature = app.user.signature(session) 
        } catch(e) {}
    }
    
    if (signature) { 
        data.signature = signature 
    }
    
    return data
}

// Применение подписи к запросам
if (p.auth) {
    data = sign(data)
} else {
    if (app.user && (app.user.getstate && app.user.getstate() == 1)) { 
        data.state = 1 
    }
}
```

---

## Подпись транзакций

### Подпись входов транзакции

**Файл:** `pocketnet.gui/js/lib/client/actions.js`

```javascript
self.signInput = function(txb, input, indexOfInput) {
    // Pocketnet адреса (начинаются с 'P' или 'T')
    if (input.address.indexOf("T") == 0 || input.address.indexOf("P") == 0) {
        var keyPair = parent.app.user.address.value != input.address 
            ? self.keyPair 
            : parent.app.user.keys()
        
        if(!keyPair) {
            throw 'unableSign:1'
        }
        
        txb.sign(indexOfInput, keyPair);
        return
    }
    
    // HTLC адреса
    if (input.type == 'htlc') {
        var keyPair = parent.app.user.address.value != input.address 
            ? self.keyPair 
            : parent.app.user.keys()
        
        if(!keyPair) {
            throw 'unableSign:2'
        }
        
        txb.sign({
            prevOutScript: Buffer.from(input.scriptPubKey, 'hex'),
            prevOutScriptType: 'htlc',
            vin: indexOfInput,
            keyPair
        });
        return
    }
    
    // Z/Y адреса (кошельковые)
    if (input.address.indexOf("Z") == 0 || input.address.indexOf("Y") == 0) {
        if (parent.app.user.address.value != self.address) {
            throw 'unableSign:3'
        }
        
        // Деривация ключа для конкретного кошелька
        var index = _.indexOf(parent.app.platform.sdk.addresses.storage.addresses, input.address);
        // ... дополнительная логика
    }
}
```

---

## Хранение ключей

### Шифрование и сохранение

**Безопасность:**
- Мнемоническая фраза **никогда** не хранится в открытом виде
- Используется AES шифрование с ключом на основе fingerprint устройства
- Ключи хранятся только в памяти во время сессии

```javascript
// Шифрование перед сохранением
app.platform.cryptography.api.aeswc.encryption(
    mnemonic, 
    app.options.fingerPrint,  // Уникальный идентификатор устройства
    {}, 
    function(enc) {
        if (self.stay) {
            localStorage['mnemonic'] = enc  // Постоянное хранение
        } else {
            sessionStorage['mnemonic'] = enc  // Только для сессии
        }
    }
)
```

### Восстановление при следующем входе

**Файл:** `pocketnet.gui/js/user.js`

```javascript
self.isState = function(clbk) {
    if (keys.private.value && keys.public.value) {
        state = 1;  // Уже авторизован
    } else {
        var lsmn = ''
        var ssmn = ''
        
        try {
            lsmn = localStorage['mnemonic']
            ssmn = sessionStorage['mnemonic']
        } catch(e) {}
        
        if ((lsmn && self.stay) || ssmn) {
            var m = lsmn || ssmn;
            
            // Расшифровка
            app.platform.cryptography.api.aeswc.decryption(
                m, 
                app.options.fingerPrint, 
                {}, 
                function(m) {
                    if(m) {
                        if(!bitcoin.bip39.validateMnemonic(m)) {
                            // Восстановление из приватного ключа
                            self.setKeysPairFromPrivate(m, function() {
                                self.isState(clbk)
                            })
                        } else {
                            // Восстановление из мнемоники
                            self.setKeys(m, function() {
                                self.isState(clbk)
                            })
                        }
                    } else {
                        state = 0;
                        clbk(state);
                    }
                }
            )
            return
        }
        
        state = 0;
    }
    
    clbk(state);
}
```

---

## Валидация и проверка

### Валидация мнемонической фразы

```javascript
// Проверка корректности мнемоники
bitcoin.bip39.validateMnemonic(mnemonic)
```

### Проверка состояния авторизации

```javascript
self.validate = function() {
    var account = app.platform.actions.getCurrentAccount()
    
    if(!account) return false
    
    var astatus = account.getStatus()
    
    if (astatus == 'not_in_progress_no_processing') {
        return false
    }
    
    return true
}
```

### Проверка адреса

```javascript
self.isItMe = function(address) {
    return self.address.value && self.address.value == address
}
```

---

## Безопасность

### Важные моменты

1. **Приватный ключ никогда не передается на сервер**
   - Только подписи транзакций и запросов
   - Сервер проверяет подпись через публичный ключ

2. **Шифрование при хранении**
   - Используется AES с ключом на основе fingerprint устройства
   - Ключи не хранятся в открытом виде

3. **Временные подписи**
   - Подписи имеют срок действия (exp)
   - Каждая подпись содержит временную метку

4. **Невозможность восстановления**
   - Если пользователь потерял приватный ключ, восстановление невозможно
   - Даже разработчики не могут восстановить доступ

### Рекомендации

- **Всегда сохраняйте мнемоническую фразу в безопасном месте**
- **Не делитесь приватным ключом ни с кем**
- **Используйте QR-код для удобного хранения**
- **Регулярно делайте резервные копии**

---

## API для интеграции в bastyon-vue

### Основные функции для реализации

```typescript
// Генерация мнемоники
function generateMnemonic(): string

// Валидация мнемоники
function validateMnemonic(mnemonic: string): boolean

// Восстановление ключей из мнемоники
function keysFromMnemonic(mnemonic: string): KeyPair

// Восстановление ключей из приватного ключа
function keysFromPrivateKey(privateKey: string): KeyPair

// Генерация адреса из публичного ключа
function addressFromPublicKey(publicKey: Buffer): string

// Генерация подписи для API
function generateSignature(data: string, expiration?: number): Signature

// Проверка подписи
function verifySignature(signature: Signature, data: string): boolean

// Шифрование мнемоники для хранения
function encryptMnemonic(mnemonic: string, deviceFingerprint: string): string

// Расшифровка мнемоники
function decryptMnemonic(encrypted: string, deviceFingerprint: string): string
```

### Структуры данных

```typescript
interface KeyPair {
    privateKey: Buffer;
    publicKey: Buffer;
}

interface Signature {
    nonce: string;
    signature: string;  // hex
    pubkey: string;     // hex
    address: string;     // Pocketnet address
    v?: number;          // version
}

interface AddressInfo {
    address: string;
    type: 'p2pkh' | 'p2wpkh' | 'p2sh';
    pubkey: Buffer;
}
```

---

## Примеры использования

### Регистрация нового пользователя

```javascript
// 1. Генерация мнемоники
const mnemonic = bitcoin.bip39.generateMnemonic();
// "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

// 2. Генерация ключевой пары
const seed = bitcoin.bip39.mnemonicToSeedSync(mnemonic);
const root = bitcoin.bip32.fromSeed(seed);
const path = "m/44'/0'/0'/0'";
const keyPair = root.derivePath(path).keyPair;

// 3. Генерация адреса
const address = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey
});

console.log("Address:", address.address);  // P...
console.log("Mnemonic:", mnemonic);  // Сохранить!
```

### Вход пользователя

```javascript
// 1. Ввод мнемоники
const mnemonic = userInput;

// 2. Валидация
if (!bitcoin.bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic");
}

// 3. Восстановление ключей
const seed = bitcoin.bip39.mnemonicToSeedSync(mnemonic);
const root = bitcoin.bip32.fromSeed(seed);
const keyPair = root.derivePath("m/44'/0'/0'/0'").keyPair;

// 4. Генерация адреса
const address = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey
});

// 5. Сохранение (зашифрованное)
const encrypted = encrypt(mnemonic, deviceFingerprint);
localStorage.setItem('mnemonic', encrypted);
```

### Генерация подписи для API

```javascript
// 1. Получение ключевой пары
const keyPair = getUserKeyPair();

// 2. Создание nonce
const timestamp = new Date().toISOString();
const expiration = 360;  // секунд
const nonce = `date=${timestamp},exp=${expiration},s=${hexEncode('pocketnetproxy')}`;

// 3. Подпись
const hash = bitcoin.crypto.sha256(Buffer.from(nonce));
const signature = keyPair.sign(hash);

// 4. Формирование объекта подписи
const signatureObj = {
    nonce: nonce,
    signature: signature.toString('hex'),
    pubkey: keyPair.publicKey.toString('hex'),
    address: getUserAddress(),
    v: 1
};

// 5. Добавление к запросу
fetch('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify({
        ...data,
        signature: signatureObj
    })
});
```

---

## Зависимости

### Основные библиотеки

- **bitcoinjs-lib**: Работа с Bitcoin-совместимой криптографией
  - BIP39: Мнемонические фразы
  - BIP32: Иерархические детерминированные ключи
  - ECDSA: Эллиптическая криптография
  - Address generation: Генерация адресов

### Дополнительные библиотеки

- **QR Code Scanner**: Сканирование QR-кодов с ключами
- **AES Encryption**: Шифрование для хранения

---

## Примечания для разработчиков

1. **Всегда валидируйте входные данные** перед использованием
2. **Никогда не логируйте приватные ключи** или мнемонические фразы
3. **Используйте безопасное хранение** (шифрование обязательно)
4. **Обрабатывайте ошибки** при восстановлении ключей
5. **Тестируйте с тестовой сетью** перед продакшеном

---

## Ссылки на исходный код

- **Компонент авторизации**: `pocketnet.gui/components/authorization/index.js`
- **Компонент регистрации**: `pocketnet.gui/components/registration/index.js`
- **Модуль пользователя**: `pocketnet.gui/js/user.js`
- **SDK адресации**: `pocketnet.gui/js/satolist.js` (строка 12912)
- **API клиент**: `pocketnet.gui/js/lib/client/api.js`
- **Подпись транзакций**: `pocketnet.gui/js/lib/client/actions.js`

---

## Заключение

Система авторизации через блокчейн обеспечивает:
- ✅ Децентрализованную аутентификацию
- ✅ Полный контроль пользователя над своими данными
- ✅ Безопасность через криптографию Bitcoin
- ✅ Отсутствие зависимости от централизованных серверов
- ✅ Возможность восстановления на любом устройстве (при наличии ключа)

При реализации в bastyon-vue необходимо обеспечить совместимость с существующей системой и правильную обработку всех форматов ключей.
