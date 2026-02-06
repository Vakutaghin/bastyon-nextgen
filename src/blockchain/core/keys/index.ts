/**
 * Модуль работы с ключами
 * Экспорт всех функций для генерации, восстановления и валидации ключей
 */

// Генерация
export {
  generateMnemonic,
  mnemonicToSeed,
  seedToKeyPair,
  generateKeyPairFromMnemonic,
  generateKeys,
  clearKeyCache,
  deriveMessengerKeys,
} from './key-generator'

// Восстановление
export {
  recoverKeyPairFromMnemonic,
  recoverKeyPairFromHex,
  recoverKeyPairFromWIF,
  recoverKeyPair,
} from './key-recovery'

// Валидация
export {
  validateMnemonic,
  detectPrivateKeyFormat,
  validatePrivateKey,
  normalizeMnemonic,
  loadBip39Russian,
  getBip39Russian,
} from './key-validator'
