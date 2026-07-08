// Шифрование/расшифровка пользовательских секретов (мнемоника, произвольные данные).
// Транспорт — localStorage или sessionStorage в зависимости от опции persistent.

import type {
  StorageOptions,
  StorageSaveResult,
  StorageLoadResult,
  EncryptedData,
} from '../types/storage'
import { encryptData, decryptData } from './encryption'
import { getVaultSecret, getVaultLegacyKey } from './vault/crypto-vault'
import { looksLikeSecret } from './vault/plausibility'
import { MNEMONIC_STORAGE_KEY } from '../constants/storage'

/**
 * Сохраняет зашифрованные данные в хранилище.
 * options.persistent определяет storage (localStorage/sessionStorage), default — sessionStorage.
 */
export function saveEncryptedData(data: string, options: StorageOptions = {}): StorageSaveResult {
  const { persistent = false, storageKey = MNEMONIC_STORAGE_KEY } = options

  try {
    // P0-1: ключ шифрования — секрет сейфа (не device-fingerprint). Бросит
    // VaultLockedError, если сейф не разлочен → ниже перехватится в {success:false}
    // (non-destructive). Пишущие пути (register/signIn) заранее делают ensureInitialized.
    const encrypted = encryptData(data, getVaultSecret())

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
    const blob = encryptedData.data
    // P0-1 heal-ветка: сначала под секретом сейфа S; если не расшифровалось и есть
    // legacy device-fingerprint (ещё не мигрировано) — под ним, и перешифровываем
    // под S (ленивая миграция на чтении). getVaultSecret бросит, если сейф заблокирован.
    const key = getVaultSecret()
    const legacy = getVaultLegacyKey()
    let decrypted: string
    try {
      decrypted = decryptData(blob, key)
      // Во время миграционного окна (fingerprint ещё есть) неаутентифицированный
      // AES-CBC может ~1/256 «расшифровать» fingerprint-данные под S в мусор —
      // отсекаем по форме, чтобы уйти в legacy-ветку, а не вернуть мусор.
      if (legacy && !looksLikeSecret(decrypted))
        throw new Error('vault: implausible decrypt under S')
    } catch (e) {
      if (!legacy) throw e
      decrypted = decryptData(blob, legacy) // бросит при настоящем повреждении
      try {
        storage.setItem(
          storageKey,
          JSON.stringify({
            data: encryptData(decrypted, key),
            timestamp: Date.now(),
            version: '2.0',
          })
        )
      } catch {
        /* quota и пр.: возвращаем расшифрованное, чтение не проваливаем [C4] */
      }
    }

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
