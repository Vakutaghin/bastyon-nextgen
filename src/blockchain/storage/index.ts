/**
 * Модуль хранения
 * Экспорт всех функций для работы с хранилищем
 */

// Device fingerprint
export {
  generateDeviceFingerprint,
  getDeviceFingerprint,
} from './device-fingerprint'

// Шифрование
export {
  encryptData,
  decryptData,
  canDecrypt,
} from './encryption'

// Управление хранилищем
export {
  saveEncryptedData,
  loadEncryptedData,
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  clearStoredData,
  saveUserAddress,
  loadUserAddress,
  saveWasLogged,
  clearAllUserData,
  saveAccountsList,
  loadAccountsList,
  addAccountToStore,
  removeAccountFromStore,
  getAccountInfo,
  setCurrentAccount,
} from './storage-manager'
