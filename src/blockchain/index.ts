/**
 * Главный экспорт модуля blockchain
 * Централизованный экспорт всех функций, типов и констант
 */

// Типы
export * from './types'

// Core модули
export * from './core/keys'
export * from './core/addresses'
export * from './core/signatures'

// Хранилище
export * from './storage'

// API
export * from './api'

// Store
export * from './store'

// Утилиты
export * from './utils'

// Константы
export * from './constants'

// Удобные экспорты для часто используемых функций
export { useAuthStore } from './store/auth-store'
export {
  generateKeys,
  recoverKeyPair,
  validateMnemonic,
  validatePrivateKey,
} from './core/keys'
export {
  generatePocketnetAddress,
  generateAddressFromKeyPair,
  validateAddress,
  isValidAddress,
} from './core/addresses'
export {
  generateApiSignature,
  validateApiSignature,
} from './core/signatures'
export {
  encryptData,
  decryptData,
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  getDeviceFingerprint,
} from './storage'
export {
  signRequest,
  createRequestSigner,
} from './api'
export {
  hexToWif,
  wifToHex,
  generateQRCode,
  generateMnemonicQRCode,
} from './utils'
