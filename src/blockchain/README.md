# Blockchain Module

Модуль для работы с блокчейном Pocketnet в проекте bastyon-nextgen. Предоставляет полную инфраструктуру для авторизации через приватные ключи, генерации адресов, подписи запросов и транзакций.

## 📦 Установка

Все зависимости уже установлены в проекте:
- `bitcoinjs-lib` - криптография Bitcoin
- `bip39` - мнемонические фразы
- `qrcode` - генерация QR-кодов
- `crypto-js` - AES шифрование

## 🚀 Быстрый старт

### Базовое использование

```typescript
import { useAuthStore } from '@/blockchain'

const authStore = useAuthStore()

// Регистрация нового пользователя
const { mnemonic, address } = await authStore.register({
  saveAfterRegistration: true
})

// Вход пользователя
await authStore.signIn({
  privateKey: mnemonic,
  stayLoggedIn: true
})

// Проверка авторизации
if (authStore.isUserAuthenticated) {
  console.info('Адрес:', authStore.getUserAddress)
}
```

## 📚 Структура модуля

```
blockchain/
├── types/          # TypeScript типы
├── core/          # Основные модули
│   ├── keys/      # Работа с ключами
│   ├── addresses/ # Работа с адресами
│   └── signatures/ # Подписи
├── storage/       # Хранилище и шифрование
├── api/           # Интеграция с API
├── store/         # Pinia stores
├── utils/         # Утилиты
└── constants/     # Константы
```

## 🔑 Основные модули

### 1. Работа с ключами

```typescript
import {
  generateMnemonic,
  recoverKeyPair,
  validateMnemonic
} from '@/blockchain'

// Генерация новой мнемоники
const mnemonic = generateMnemonic()

// Восстановление ключей
const { keyPair } = recoverKeyPair(mnemonic)

// Валидация
if (validateMnemonic(mnemonic)) {
  console.info('Мнемоника валидна')
}
```

### 2. Работа с адресами

```typescript
import {
  generatePocketnetAddress,
  validateAddress
} from '@/blockchain'

// Генерация адреса
const addressInfo = generatePocketnetAddress(keyPair.publicKey)

// Валидация
const validation = validateAddress(address)
if (validation.isValid) {
  console.info('Тип адреса:', validation.type)
}
```

### 3. Подписи

```typescript
import {
  generateApiSignature,
  signRequest
} from '@/blockchain'

// Генерация подписи для API
const signature = generateApiSignature(keyPair, address, {
  data: 'pocketnetproxy',
  expiration: 360
})

// Подпись запроса
const signedRequest = signRequest(requestData, keyPair, address)
```

### 4. Хранилище

```typescript
import {
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  getDeviceFingerprint
} from '@/blockchain'

// Сохранение мнемоники
saveEncryptedMnemonic(mnemonic, true) // true = localStorage

// Загрузка мнемоники
const result = loadEncryptedMnemonic(true)
if (result.success && result.data) {
  console.info('Мнемоника загружена')
}
```

### 5. API запросы

```typescript
import { getByPRCWithAuth } from '@/helpers/request'

// Запрос с автоматической подписью
const result = await getByPRCWithAuth({
  method: 'getuser',
  parameters: [address],
  options: {
    auth: true // Требуется подпись
  }
})
```

## 🔐 Безопасность

- ✅ Приватные ключи **никогда** не передаются на сервер
- ✅ Мнемоника шифруется перед сохранением
- ✅ Используется device fingerprint для ключа шифрования
- ✅ Подписи имеют срок действия
- ✅ Все данные валидируются перед использованием

## 📖 Подробная документация

См. файл [EXAMPLES.md](./EXAMPLES.md) для подробных примеров использования.

## 🔗 Связанные документы

- [BLOCKCHAIN_AUTHENTICATION.md](../../_DOCS/BLOCKCHAIN_AUTHENTICATION.md) - Описание системы авторизации
- [BLOCKCHAIN_INFRASTRUCTURE_PLAN.md](../../_DOCS/BLOCKCHAIN_INFRASTRUCTURE_PLAN.md) - План реализации

## ⚠️ Важные замечания

1. **Никогда не логируйте приватные ключи или мнемонические фразы**
2. **Всегда валидируйте входные данные**
3. **Используйте безопасное хранение (шифрование обязательно)**
4. **Тестируйте с тестовой сетью перед продакшеном**

## 🐛 Обработка ошибок

Все функции модуля выбрасывают ошибки с понятными сообщениями:

```typescript
try {
  const keyPair = recoverKeyPair(invalidKey)
} catch (error) {
  console.error('Ошибка восстановления ключей:', error.message)
}
```

## 📝 Лицензия

Часть проекта bastyon-nextgen.
