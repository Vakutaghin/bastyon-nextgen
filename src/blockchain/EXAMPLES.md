# Примеры использования Blockchain Module

Подробные примеры использования всех модулей блокчейн инфраструктуры.

## 📋 Содержание

1. [Регистрация и вход](#регистрация-и-вход)
2. [Работа с ключами](#работа-с-ключами)
3. [Работа с адресами](#работа-с-адресами)
4. [Подписи](#подписи)
5. [Хранилище](#хранилище)
6. [API запросы](#api-запросы)
7. [QR-коды](#qr-коды)
8. [Конвертация форматов](#конвертация-форматов)

---

## Регистрация и вход

### Регистрация нового пользователя

```typescript
import { useAuthStore } from '@/blockchain'

const authStore = useAuthStore()

// Регистрация
const result = await authStore.register({
  generateNew: true,
  saveAfterRegistration: true
})

// ⚠️ ВАЖНО: Показать мнемонику пользователю для сохранения!
// Если пользователь потеряет мнемонику, восстановление невозможно!
```

### Вход по мнемонической фразе

```typescript
import { useAuthStore } from '@/blockchain'

const authStore = useAuthStore()

const mnemonic = 'abandon abandon abandon ...' // 12 слов

const result = await authStore.signIn({
  privateKey: mnemonic
})

if (!result.success) {
  console.error('Ошибка входа:', result.error)
}
```

### Вход по приватному ключу (hex)

```typescript
const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const result = await authStore.signIn({
  privateKey: hexKey
})
```

### Вход по приватному ключу (WIF)

```typescript
const wifKey = '5KJvsngHeMoo...'

const result = await authStore.signIn({
  privateKey: wifKey
})
```

### Восстановление сессии

```typescript
// При загрузке приложения
const authStore = useAuthStore()

const restored = await authStore.restoreSession()
if (restored) {
  console.info('Сессия восстановлена')
  console.info('Адрес:', authStore.getUserAddress)
} else {
  console.log('Сессия не найдена, требуется вход')
}
```

### Выход

```typescript
await authStore.signOut()
// Все данные очищены, пользователь разлогинен
```

---

## Работа с ключами

### Генерация новой мнемоники

```typescript
import { generateMnemonic } from '@/blockchain'

const mnemonic = generateMnemonic()
console.log('Новая мнемоника:', mnemonic)
// "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```

### Генерация ключей из мнемоники

```typescript
import { generateKeyPairFromMnemonic } from '@/blockchain'

const mnemonic = 'your mnemonic phrase here'
const keyPair = generateKeyPairFromMnemonic(mnemonic)

console.info('Приватный ключ (hex):', keyPair.privateKey.toString('hex'))
console.info('Публичный ключ (hex):', keyPair.publicKey.toString('hex'))
```

### Восстановление ключей из разных форматов

```typescript
import { recoverKeyPair } from '@/blockchain'

// Из мнемоники
const fromMnemonic = recoverKeyPair('abandon abandon ...')

// Из hex
const fromHex = recoverKeyPair('0123456789abcdef...', {
  format: 'hex'
})

// Из WIF
const fromWIF = recoverKeyPair('5KJvsngHeMoo...', {
  format: 'wif'
})

// Автоматическое определение формата
const auto = recoverKeyPair(someKey) // Автоматически определит формат
```

### Валидация ключей

```typescript
import { validateMnemonic, validatePrivateKey } from '@/blockchain'

// Валидация мнемоники
if (validateMnemonic(mnemonic)) {
  console.info('Мнемоника валидна')
}

// Валидация приватного ключа (любой формат)
if (validatePrivateKey(key)) {
  console.info('Приватный ключ валиден')
}
```

---

## Работа с адресами

### Генерация основного адреса

```typescript
import { generatePocketnetAddress, generateAddressFromKeyPair } from '@/blockchain'

// Из публичного ключа
const addressInfo = generatePocketnetAddress(keyPair.publicKey)
console.info('Адрес:', addressInfo.address) // P...
console.info('Тип:', addressInfo.type) // p2pkh

// Из ключевой пары
const result = generateAddressFromKeyPair(keyPair)
console.info('Адрес:', result.addressInfo.address)
```

### Генерация кошелькового адреса

```typescript
import { generateWalletAddress } from '@/blockchain'

// Генерация адреса кошелька по индексу
const walletResult = generateWalletAddress(
  1, // индекс кошелька
  seed, // seed из мнемоники
  true // использовать кеш
)

console.log('Кошельковый адрес:', walletResult.addressInfo.address) // 3...
```

### Валидация адреса

```typescript
import { validateAddress, isValidAddress, getAddressType } from '@/blockchain'

const address = 'P...'

// Полная валидация
const validation = validateAddress(address)
if (validation.isValid) {
  console.log('Адрес валиден, тип:', validation.type)
} else {
  console.error('Ошибка:', validation.error)
}

// Быстрая проверка
if (isValidAddress(address)) {
  console.log('Адрес валиден')
}

// Получение типа
const type = getAddressType(address)
console.log('Тип адреса:', type) // 'p2pkh' | 'p2wpkh' | 'p2sh' | null
```

---

## Подписи

### Генерация подписи для API

```typescript
import { generateApiSignature } from '@/blockchain'

const signature = generateApiSignature(keyPair, address, {
  data: 'pocketnetproxy',
  expiration: 360, // секунд
  session: 'optional-session-id'
})

console.log('Подпись:', signature)
// {
//   nonce: "date=2026-01-24T12:00:00.000Z,exp=360,s=...",
//   signature: "30440220...",
//   pubkey: "02...",
//   address: "P...",
//   v: 1
// }
```

### Валидация подписи

```typescript
import { validateApiSignature } from '@/blockchain'

const validation = validateApiSignature(signature)
if (validation.isValid) {
  if (validation.isExpired) {
    console.log('Подпись истекла')
  } else {
    console.log('Подпись валидна до:', validation.expirationTime)
  }
}
```

### Подпись запроса

```typescript
import { signRequest } from '@/blockchain'

const requestData = {
  method: 'getuser',
  parameters: [address]
}

const signedRequest = signRequest(requestData, keyPair, address, {
  requireSignature: true,
  session: 'session-id'
})

// signedRequest теперь содержит поле signature
```

---

## Хранилище

### Сохранение мнемоники

```typescript
import { saveEncryptedMnemonic } from '@/blockchain'

// Сохранение в localStorage (постоянно)
saveEncryptedMnemonic(mnemonic, true)

// Сохранение в sessionStorage (только для сессии)
saveEncryptedMnemonic(mnemonic, false)
```

### Загрузка мнемоники

```typescript
import { loadEncryptedMnemonic } from '@/blockchain'

// Загрузка из localStorage
const result = loadEncryptedMnemonic(true)
if (result.success && result.data) {
  console.log('Мнемоника загружена:', result.data)
}

// Загрузка из sessionStorage
const sessionResult = loadEncryptedMnemonic(false)
```

### Device Fingerprint

```typescript
import { getDeviceFingerprint, generateDeviceFingerprint } from '@/blockchain'

// Получить или сгенерировать fingerprint
const fingerprint = getDeviceFingerprint()

// Принудительно перегенерировать
const newFingerprint = getDeviceFingerprint(true)
```

### Шифрование данных

```typescript
import { encryptData, decryptData } from '@/blockchain'

const data = 'sensitive data'
const key = getDeviceFingerprint()

// Шифрование
const encrypted = encryptData(data, key)

// Дешифрование
const decrypted = decryptData(encrypted, key)
console.log('Расшифровано:', decrypted)
```

---

## API запросы

### Запрос с авторизацией

```typescript
import { getByPRCWithAuth } from '@/helpers/request'

// Автоматическая подпись запроса
const result = await getByPRCWithAuth({
  method: 'getuser',
  parameters: [address],
  options: {
    auth: true, // Требуется подпись
    session: 'optional-session'
  }
})
```

### Запрос без авторизации

```typescript
import { getByPRC } from '@/helpers/request'

// Обычный запрос без подписи
const result = await getByPRC({
  method: 'getuser',
  parameters: [address]
})
```

### Создание API клиента

```typescript
import { createAuthenticatedApiClient } from '@/blockchain'
import { useAuthStore } from '@/blockchain'

const authStore = useAuthStore()

const apiClient = createAuthenticatedApiClient({
  getKeyPair: () => authStore.getKeyPair,
  getAddress: () => authStore.getUserAddress
})

// Использование клиента
const result = await apiClient({
  method: 'getuser',
  parameters: [address],
  options: {
    auth: true
  }
})
```

---

## QR-коды

### Генерация QR-кода для мнемоники

```typescript
import { generateMnemonicQRCode } from '@/blockchain'

// Генерация QR-кода
const qrDataURL = await generateMnemonicQRCode(mnemonic, {
  width: 300,
  errorCorrectionLevel: 'H' // Высокий уровень коррекции ошибок
})

// Использование в img элементе
// <img src={qrDataURL} alt="Mnemonic QR Code" />
```

### Генерация QR-кода для приватного ключа

```typescript
import { generatePrivateKeyQRCode } from '@/blockchain'

const qrCode = await generatePrivateKeyQRCode(privateKey, {
  width: 400
})
```

### Генерация SVG QR-кода

```typescript
import { generateQRCodeSVG } from '@/blockchain'

const svg = await generateQRCodeSVG(data, {
  width: 300
})

// Использование SVG напрямую
// <div dangerouslySetInnerHTML={{ __html: svg }} />
```

---

## Конвертация форматов

### Hex ↔ WIF

```typescript
import { hexToWif, wifToHex } from '@/blockchain'

// Hex в WIF
const hex = '0123456789abcdef...'
const wif = hexToWif(hex)

// WIF в Hex
const hexFromWif = wifToHex(wif)
```

### Hex ↔ Base64

```typescript
import { hexToBase64, base64ToHex } from '@/blockchain'

const hex = '0123456789abcdef...'
const base64 = hexToBase64(hex)
const hexBack = base64ToHex(base64)
```

### Buffer ↔ Hex

```typescript
import { bufferToHex, hexToBuffer } from '@/blockchain'

const buffer = Buffer.from('hello')
const hex = bufferToHex(buffer)
const bufferBack = hexToBuffer(hex)
```

### Валидация hex

```typescript
import { isValidHex, normalizeHex } from '@/blockchain'

const hex = ' 0123 ABCD '
const normalized = normalizeHex(hex) // '0123abcd'

if (isValidHex(normalized)) {
  console.log('Валидный hex')
}
```

---

## BIP32 пути

### Работа с путями

```typescript
import {
  getMainAddressPath,
  getCryptoKeyPath,
  validateBip32Path,
  parseBip32Path
} from '@/blockchain'

// Генерация путей
const mainPath = getMainAddressPath(0) // "m/44'/0'/0'/0'"
const cryptoPath = getCryptoKeyPath(1) // "m/33'/0'/0'/1'"

// Валидация
if (validateBip32Path(path)) {
  console.log('Путь валиден')
}

// Парсинг
const indices = parseBip32Path(path) // [44, 0, 0, 0]
```

---

## Полный пример: Регистрация и первый вход

```typescript
import { useAuthStore } from '@/blockchain'
import { generateMnemonicQRCode } from '@/blockchain'

async function registerNewUser() {
  const authStore = useAuthStore()

  // 1. Регистрация
  const { mnemonic, address, keyPair } = await authStore.register({
    saveAfterRegistration: true
  })

  // 2. Генерация QR-кода для сохранения
  const qrCode = await generateMnemonicQRCode(mnemonic)

  // 3. Показать пользователю мнемонику и QR-код
  console.log('Сохраните мнемонику:', mnemonic)
  console.log('QR-код:', qrCode)

  // 4. Пользователь сохранил, продолжаем
  // Мнемоника уже сохранена в зашифрованном виде

  return { mnemonic, address, qrCode }
}

async function signInUser(mnemonic: string) {
  const authStore = useAuthStore()

  // Вход
  const result = await authStore.signIn({
    privateKey: mnemonic
  })

  if (result.success) {
    console.log('Вход успешен!')
    console.log('Адрес:', authStore.getUserAddress)
    return true
  } else {
    console.error('Ошибка входа:', result.error)
    return false
  }
}

// При загрузке приложения
async function initApp() {
  const authStore = useAuthStore()

  // Пытаемся восстановить сессию
  const restored = await authStore.restoreSession()

  if (!restored) {
    // Показать форму входа
    console.log('Требуется вход')
  } else {
    // Пользователь авторизован
    console.log('Добро пожаловать!', authStore.getUserAddress)
  }
}
```

---

## Обработка ошибок

```typescript
import { recoverKeyPair, validateMnemonic } from '@/blockchain'

try {
  // Восстановление ключей
  const { keyPair } = recoverKeyPair(invalidKey)
} catch (error) {
  if (error instanceof Error) {
    console.error('Ошибка восстановления:', error.message)
    
    // Специфичная обработка
    if (error.message.includes('Invalid')) {
      console.error('Неверный формат ключа')
    }
  }
}

// Валидация перед использованием
if (!validateMnemonic(mnemonic)) {
  console.error('Неверная мнемоника')
  return
}
```

---

## Интеграция в Vue компонент

```vue
<template>
  <div>
    <div v-if="!authStore.isUserAuthenticated">
      <input v-model="mnemonic" placeholder="Введите мнемонику" />
      <button @click="handleSignIn">Войти</button>
    </div>
    <div v-else>
      <p>Адрес: {{ authStore.getUserAddress }}</p>
      <button @click="handleSignOut">Выйти</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/blockchain'

const authStore = useAuthStore()
const mnemonic = ref('')

const handleSignIn = async () => {
  const result = await authStore.signIn({
    privateKey: mnemonic.value
  })
  
  if (!result.success) {
    alert('Ошибка входа: ' + result.error)
  }
}

const handleSignOut = async () => {
  await authStore.signOut()
}

onMounted(async () => {
  await authStore.restoreSession()
})
</script>
```

---

## Лучшие практики

1. **Всегда валидируйте входные данные** перед использованием
2. **Никогда не логируйте приватные ключи** или мнемонические фразы
3. **Используйте безопасное хранение** (шифрование обязательно)
4. **Обрабатывайте ошибки** везде
5. **Тестируйте с тестовой сетью** перед продакшеном
6. **Показывайте мнемонику пользователю** только один раз при регистрации
7. **Используйте QR-коды** для удобного сохранения ключей

---

## Дополнительная информация

- [README.md](./README.md) - Общая информация о модуле
- [BLOCKCHAIN_AUTHENTICATION.md](../../_DOCS/BLOCKCHAIN_AUTHENTICATION.md) - Детальное описание авторизации
- [BLOCKCHAIN_INFRASTRUCTURE_PLAN.md](../../_DOCS/BLOCKCHAIN_INFRASTRUCTURE_PLAN.md) - План реализации
