// Шифрование/расшифровка пользовательских секретов (мнемоника, произвольные данные).
// Транспорт — localStorage или sessionStorage в зависимости от опции persistent.

import type {
  StorageOptions,
  StorageSaveResult,
  StorageLoadResult,
  EncryptedData,
} from '../types/storage'
import { encryptData, decryptData } from './encryption'
import { getDeviceFingerprint } from './device-fingerprint'
import { MNEMONIC_STORAGE_KEY } from '../constants/storage'

/**
 * Сохраняет зашифрованные данные в хранилище.
 * options.persistent определяет storage (localStorage/sessionStorage), default — sessionStorage.
 */
export function saveEncryptedData(data: string, options: StorageOptions = {}): StorageSaveResult {
  const { persistent = false, storageKey = MNEMONIC_STORAGE_KEY } = options

  try {
    const fingerprint = getDeviceFingerprint()
    const encrypted = encryptData(data, fingerprint)

    const encryptedData: EncryptedData = {
      data: encrypted,
      timestamp: Date.now(),
      version: '2.0',
    }

    const storage = persistent
      ? typeof localStorage !== 'undefined'
        ? localStorage
        : null
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null

    if (!storage) {
      return { success: false, error: 'Storage is not available' }
    }

    storage.setItem(storageKey, JSON.stringify(encryptedData))
    return {
      success: true,
      storageType: persistent ? 'localStorage' : 'sessionStorage',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Загружает и расшифровывает данные из хранилища.
 */
export function loadEncryptedData(options: StorageOptions = {}): StorageLoadResult<string> {
  const { persistent = false, storageKey = MNEMONIC_STORAGE_KEY } = options

  try {
    const storage = persistent
      ? typeof localStorage !== 'undefined'
        ? localStorage
        : null
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null

    if (!storage) {
      return { success: false, data: null, error: 'Storage is not available' }
    }

    const stored = storage.getItem(storageKey)
    if (!stored) {
      return {
        success: true,
        data: null,
        storageType: persistent ? 'localStorage' : 'sessionStorage',
      }
    }

    const encryptedData: EncryptedData = JSON.parse(stored)
    const fingerprint = getDeviceFingerprint()
    const decrypted = decryptData(encryptedData.data, fingerprint)

    return {
      success: true,
      data: decrypted,
      storageType: persistent ? 'localStorage' : 'sessionStorage',
    }
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Сохраняет мнемоническую фразу (всегда в localStorage с ключом MNEMONIC_STORAGE_KEY). */
export function saveEncryptedMnemonic(mnemonic: string): StorageSaveResult {
  return saveEncryptedData(mnemonic, {
    persistent: true,
    storageKey: MNEMONIC_STORAGE_KEY,
  })
}

/**
 * Загружает мнемоническую фразу. Сначала localStorage (основное хранилище),
 * затем sessionStorage для обратной совместимости со старыми сборками.
 */
export function loadEncryptedMnemonic(): StorageLoadResult<string> {
  const result = loadEncryptedData({ persistent: true, storageKey: MNEMONIC_STORAGE_KEY })
  if (result.data) return result

  const sessionStorageResult = loadEncryptedData({
    persistent: false,
    storageKey: MNEMONIC_STORAGE_KEY,
  })
  if (sessionStorageResult.data) return sessionStorageResult

  return result
}

/**
 * Удаляет данные по ключу. Для MNEMONIC_STORAGE_KEY чистит сразу оба storage —
 * на случай если мнемоника осталась в sessionStorage от старой сборки.
 */
export function clearStoredData(options: StorageOptions = {}): void {
  const { persistent = true, storageKey = MNEMONIC_STORAGE_KEY } = options

  try {
    const storage = persistent
      ? typeof localStorage !== 'undefined'
        ? localStorage
        : null
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null

    if (storage) storage.removeItem(storageKey)

    if (storageKey === MNEMONIC_STORAGE_KEY) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(MNEMONIC_STORAGE_KEY)
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(MNEMONIC_STORAGE_KEY)
    }
  } catch {
    // Игнорируем ошибки
  }
}
