/**
 * Модуль работы с адресами
 * Экспорт всех функций для генерации и валидации адресов
 */

// Генерация
export {
  generateP2PKHAddress,
  generateP2WPKHAddress,
  generateP2SHAddress,
  generatePocketnetAddress,
  generateAddressFromKeyPair,
  generateWalletAddress,
  clearAddressCache,
} from './address-generator'

// Валидация
export {
  detectAddressType,
  validateAddress,
  isValidAddress,
  getAddressType,
  normalizeAddress,
} from './address-validator'
