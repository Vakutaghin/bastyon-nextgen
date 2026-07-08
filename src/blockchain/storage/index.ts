/**
 * Модуль хранения
 * Экспорт всех функций для работы с хранилищем
 */

// Device fingerprint
export { generateDeviceFingerprint, getDeviceFingerprint } from './device-fingerprint'

// Сейф at-rest шифрования сида (P0-1): passwordless WebCrypto-ключ + opt-in passphrase.
export {
  ensureInitialized,
  finalizeMigration,
  destroyVault,
  lockVault,
  hasVault,
  isVaultUnlocked,
  getVaultLevel,
  getVaultStatus,
  enablePassphrase,
  disablePassphrase,
  configureVault,
  type VaultLevel,
  type VaultStatus,
} from './vault/crypto-vault'
export {
  ensureVaultUnlocked,
  configureUnlockUi,
  submitUnlockPassphrase,
  requestUnlockReset,
  getUnlockAttemptState,
} from './vault/vault-unlock'

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
