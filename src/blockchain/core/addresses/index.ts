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
  validateAddress,
  isValidAddress,
  FOREIGN_NETWORK_ERROR,
  INVALID_FORMAT_ERROR,
} from './address-validator'
