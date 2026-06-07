/**
 * Модуль хранения
 * Экспорт всех функций для работы с хранилищем
 */

// Device fingerprint
export { generateDeviceFingerprint, getDeviceFingerprint } from './device-fingerprint'

// Шифрование
export { encryptData, decryptData, canDecrypt } from './encryption'

// Шифрование/мнемоника
export {
  saveEncryptedData,
  loadEncryptedData,
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  clearStoredData,
} from './storage-keys'

// Список аккаунтов
export {
  saveAccountsList,
  loadAccountsList,
  addAccountToStore,
  removeAccountFromStore,
  getAccountInfo,
  setCurrentAccount,
  updateAccountName,
} from './storage-accounts'

// Сессия / адрес пользователя / wallet addresses / общий клин-ап
export {
  saveUserAddress,
  loadUserAddress,
  saveWasLogged,
  hasStoredSession,
  clearAllUserData,
  getWalletAddressesList,
  saveWalletAddressesList,
  getAdditionalWalletAddressesList,
  saveAdditionalWalletAddressesList,
  getWalletLabel,
  setWalletLabel,
} from './storage-manager'
