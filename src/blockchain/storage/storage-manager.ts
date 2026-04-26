/**
 * Управление хранилищем (localStorage/sessionStorage)
 */

import type {
  StorageOptions,
  StorageSaveResult,
  StorageLoadResult,
  EncryptedData,
} from '../types/storage'
import type { AccountInfo, AccountsList } from '../types/auth'
import type { Address } from '../types/addresses'
import { encryptData, decryptData } from './encryption'
import { getDeviceFingerprint } from './device-fingerprint'

import {
  MNEMONIC_STORAGE_KEY,
  USER_ADDRESS_STORAGE_KEY,
  WAS_LOGGED_KEY,
  ACCOUNT_STORAGE_PREFIX,
  WALLET_ADDRESSES_PREFIX,
  ADDITIONAL_WALLETS_LIST_KEY,
} from '../constants/storage'

/**
 * Ключ для хранения списка аккаунтов
 */
const ACCOUNTS_LIST_KEY = 'BST_ACCOUNTS_LIST'

/**
 * Ключ для хранения текущего активного аккаунта
 */
const CURRENT_ACCOUNT_KEY = 'BST_CURRENT_ACCOUNT'

/**
 * Сохраняет зашифрованные данные в хранилище
 * @param data - Данные для сохранения
 * @param options - Опции сохранения
 * @returns Результат сохранения
 */
export function saveEncryptedData(
  data: string,
  options: StorageOptions = {}
): StorageSaveResult {
  const {
    persistent = true,
    encryptionKey,
    storageKey = MNEMONIC_STORAGE_KEY,
  } = options

  try {
    // Получаем ключ шифрования
    const key = encryptionKey || getDeviceFingerprint()

    // Шифруем данные
    const encrypted = encryptData(data, key)

    // Определяем тип хранилища
    const storage = persistent
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null

    if (!storage) {
      return {
        success: false,
        error: 'Storage is not available',
      }
    }

    // Сохраняем
    storage.setItem(storageKey, encrypted)

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
 * Загружает и расшифровывает данные из хранилища
 * @param options - Опции загрузки
 * @returns Результат загрузки
 */
export function loadEncryptedData(
  options: StorageOptions = {}
): StorageLoadResult<string> {
  const {
    persistent = true,
    encryptionKey,
    storageKey = MNEMONIC_STORAGE_KEY,
  } = options

  try {
    // Определяем тип хранилища
    const storage = persistent
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null

    if (!storage) {
      return {
        success: false,
        data: null,
        error: 'Storage is not available',
      }
    }

    // Загружаем зашифрованные данные
    const encrypted = storage.getItem(storageKey)

    if (!encrypted) {
      return {
        success: true,
        data: null,
        storageType: persistent ? 'localStorage' : 'sessionStorage',
      }
    }

    // Получаем ключ шифрования
    const key = encryptionKey || getDeviceFingerprint()

    // Расшифровываем
    const decrypted = decryptData(encrypted, key)

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

/**
 * Сохраняет зашифрованную мнемоническую фразу
 * @param mnemonic - Мнемоническая фраза
 * @returns Результат сохранения
 */
export function saveEncryptedMnemonic(
  mnemonic: string
): StorageSaveResult {
  return saveEncryptedData(mnemonic, {
    persistent: true,
    storageKey: MNEMONIC_STORAGE_KEY,
  })
}

/**
 * Загружает и расшифровывает мнемоническую фразу
 * @returns Результат загрузки
 */
export function loadEncryptedMnemonic(): StorageLoadResult<string> {
  // Сначала пробуем загрузить из localStorage (основное хранилище)
  let result = loadEncryptedData({
    persistent: true,
    storageKey: MNEMONIC_STORAGE_KEY,
  })

  // Если не найдено, пробуем sessionStorage (для обратной совместимости)
  if (!result.data) {
    const sessionStorageResult = loadEncryptedData({
      persistent: false,
      storageKey: MNEMONIC_STORAGE_KEY,
    })
    if (sessionStorageResult.data) {
      return sessionStorageResult
    }
  }

  return result
}

/**
 * Удаляет сохраненные данные из хранилища
 * @param options - Опции удаления
 */
export function clearStoredData(options: StorageOptions = {}): void {
  const { persistent = true, storageKey = MNEMONIC_STORAGE_KEY } = options

  try {
    const storage = persistent
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null

    if (storage) {
      storage.removeItem(storageKey)
    }

    // Также очищаем оба хранилища если нужно
    if (storageKey === MNEMONIC_STORAGE_KEY) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(MNEMONIC_STORAGE_KEY)
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(MNEMONIC_STORAGE_KEY)
      }
    }
  } catch (error) {
    // Игнорируем ошибки
  }
}

/**
 * Сохраняет адрес пользователя
 * @param address - Адрес пользователя
 */
export function saveUserAddress(address: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_ADDRESS_STORAGE_KEY, address)
    }
  } catch (error) {
    // Игнорируем ошибки
  }
}

/**
 * Загружает адрес пользователя
 * @returns Адрес пользователя или null
 */
export function loadUserAddress(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(USER_ADDRESS_STORAGE_KEY)
    }
  } catch (error) {
    // Игнорируем ошибки
  }
  return null
}

/**
 * Сохраняет флаг "был авторизован"
 * @param wasLogged - Значение флага
 */
export function saveWasLogged(wasLogged: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WAS_LOGGED_KEY, wasLogged ? 'true' : '')
    }
  } catch (error) {
    // Игнорируем ошибки
  }
}

/**
 * Очищает все данные пользователя из хранилища
 */
export function clearAllUserData(): void {
  try {
    // Очищаем мнемонику
    clearStoredData({ persistent: true })
    clearStoredData({ persistent: false })

    // Очищаем другие данные
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USER_ADDRESS_STORAGE_KEY)
      localStorage.removeItem(WAS_LOGGED_KEY)
      // Очищаем список аккаунтов
      localStorage.removeItem(ACCOUNTS_LIST_KEY)
    }

    // Очищаем из sessionStorage тоже
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(ACCOUNTS_LIST_KEY)
    }
  } catch (error) {
    // Игнорируем ошибки
  }
}

/**
 * Сохраняет список аккаунтов
 */
export function saveAccountsList(accountsList: AccountsList): StorageSaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        success: false,
        error: 'localStorage is not available',
      }
    }

    const encrypted = encryptData(
      JSON.stringify(accountsList), getDeviceFingerprint()
    )

    localStorage.setItem(ACCOUNTS_LIST_KEY, encrypted)

    return {
      success: true,
      storageType: 'localStorage',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Загружает список аккаунтов
 */
export function loadAccountsList(): StorageLoadResult<AccountsList> {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        success: false,
        data: null,
        error: 'localStorage is not available',
      }
    }

    const encrypted = localStorage.getItem(ACCOUNTS_LIST_KEY)
    if (!encrypted) {
      return {
        success: true,
        data: { accounts: [], currentAccount: null },
        storageType: 'localStorage',
      }
    }

    const decrypted = decryptData(encrypted, getDeviceFingerprint())
    const accountsList = JSON.parse(decrypted) as AccountsList

    return {
      success: true,
      data: accountsList,
      storageType: 'localStorage',
    }
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Добавляет аккаунт в список
 */
export function addAccountToStore(
  accountInfo: AccountInfo
): StorageSaveResult {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return {
      success: false,
      error: 'Failed to load accounts list',
    }
  }

  const accountsList = result.data

  // Проверяем, не существует ли уже аккаунт с таким адресом
  const existingIndex = accountsList.accounts.findIndex(
    (acc) => acc.address === accountInfo.address
  )

  if (existingIndex >= 0) {
    // Обновляем существующий аккаунт
    accountsList.accounts[existingIndex] = {
      ...accountInfo,
      lastUsed: Date.now(),
    }
  } else {
    // Добавляем новый аккаунт
    accountsList.accounts.push({
      ...accountInfo,
      lastUsed: Date.now(),
    })
  }

  // Устанавливаем как текущий аккаунт
  accountsList.currentAccount = accountInfo.address

  return saveAccountsList(accountsList)
}

/**
 * Удаляет аккаунт из списка
 */
export function removeAccountFromStore(address: Address): StorageSaveResult {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return {
      success: false,
      error: 'Failed to load accounts list',
    }
  }

  const accountsList = result.data
  accountsList.accounts = accountsList.accounts.filter(
    (acc) => acc.address !== address
  )

  // Если удаляемый аккаунт был текущим, выбираем первый из оставшихся
  if (accountsList.currentAccount === address) {
    accountsList.currentAccount =
      accountsList.accounts.length > 0 ? accountsList.accounts[0]!.address : null
  }

  return saveAccountsList(accountsList)
}

/**
 * Получает информацию об аккаунте по адресу
 */
export function getAccountInfo(address: Address): StorageLoadResult<AccountInfo> {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return {
      success: false,
      data: null,
      error: 'Failed to load accounts list',
    }
  }

  const account = result.data.accounts.find(
    (acc) => acc.address === address
  )

  return {
    success: true,
    data: account || null,
    storageType: 'localStorage',
  }
}

/**
 * Устанавливает текущий активный аккаунт
 */
export function setCurrentAccount(address: Address): StorageSaveResult {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return {
      success: false,
      error: 'Failed to load accounts list',
    }
  }

  const accountsList = result.data

  // Проверяем, существует ли аккаунт
  const accountExists = accountsList.accounts.some(
    (acc) => acc.address === address
  )

  if (!accountExists) {
    return {
      success: false,
      error: 'Account not found',
    }
  }

  accountsList.currentAccount = address

  // Обновляем время последнего использования
  const account = accountsList.accounts.find(
    (acc) => acc.address === address
  )

  if (account) {
    account.lastUsed = Date.now()
  }

  return saveAccountsList(accountsList)
}

/**
 * Ключ localStorage для списка адресов кошелька по адресу аккаунта
 */
function walletAddressesKey(address: Address): string {
  return WALLET_ADDRESSES_PREFIX + address
}

/**
 * Загружает список адресов кошелька (производные P2SH) для аккаунта.
 * Как в старом приложении: sdk.addresses.storage.addresses (wallets2).
 */
export function getWalletAddressesList(address: Address): string[] {
  try {
    const key = walletAddressesKey(address)
    const raw =
      (typeof localStorage !== 'undefined' && localStorage.getItem(key)) || null
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((a: unknown) => typeof a === 'string') : []
  } catch {
    return []
  }
}

/**
 * Сохраняет список адресов кошелька для аккаунта.
 */
export function saveWalletAddressesList(address: Address, addresses: string[]): StorageSaveResult {
  try {
    const key = walletAddressesKey(address)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(addresses))
    }
    return { success: true }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/** Читает объект дополнительных кошельков из LS: { [accountAddress]: string[] } */
function getAdditionalWalletsMap(): Record<string, string[]> {
  try {
    const raw =
      (typeof localStorage !== 'undefined' && localStorage.getItem(ADDITIONAL_WALLETS_LIST_KEY)) ||
      null
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Загружает список адресов дополнительных кошельков (индексы 1, 2, …) для аккаунта.
 * Хранится в ключе BST_ADDITIONAL_WALLETS_LIST.
 */
export function getAdditionalWalletAddressesList(address: Address): string[] {
  const map = getAdditionalWalletsMap()
  const list = map[address]
  return Array.isArray(list) ? list.filter((a: unknown) => typeof a === 'string') : []
}

/**
 * Сохраняет список адресов дополнительных кошельков для аккаунта.
 */
export function saveAdditionalWalletAddressesList(
  address: Address,
  addresses: string[]
): StorageSaveResult {
  try {
    const map = getAdditionalWalletsMap()
    map[address] = addresses
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADDITIONAL_WALLETS_LIST_KEY, JSON.stringify(map))
    }
    return { success: true }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
