// Управление списком аккаунтов в localStorage (зашифрованный BST_ACCOUNTS_LIST).
// Каждый аккаунт хранит address/name/lastUsed; одна запись помечена как currentAccount.

import type { AccountInfo, AccountsList } from '../types/auth'
import type { Address } from '../types/addresses'
import type { StorageSaveResult, StorageLoadResult } from '../types/storage'

import { encryptData, decryptData } from './encryption'
import { getVaultSecret, getVaultLegacyKey } from './vault/crypto-vault'
import { looksLikeAccountsList } from './vault/plausibility'
import { ACCOUNTS_LIST_KEY } from './storage-constants'

/** Сохраняет зашифрованный список аккаунтов. */
export function saveAccountsList(accountsList: AccountsList): StorageSaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'localStorage is not available' }
    }

    // P0-1: ключ — секрет сейфа (bare-шифротекст, без {data,…}-конверта).
    const encrypted = encryptData(JSON.stringify(accountsList), getVaultSecret())
    localStorage.setItem(ACCOUNTS_LIST_KEY, encrypted)

    return { success: true, storageType: 'localStorage' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Загружает и расшифровывает список аккаунтов. */
export function loadAccountsList(): StorageLoadResult<AccountsList> {
  try {
    if (typeof localStorage === 'undefined') {
      return { success: false, data: null, error: 'localStorage is not available' }
    }

    const encrypted = localStorage.getItem(ACCOUNTS_LIST_KEY)
    if (!encrypted) {
      return {
        success: true,
        data: { accounts: [], currentAccount: null },
        storageType: 'localStorage',
      }
    }

    // P0-1 heal-ветка (bare): под S, иначе под legacy fingerprint + перешифровать под S.
    const key = getVaultSecret()
    const legacy = getVaultLegacyKey()
    let decrypted: string
    try {
      decrypted = decryptData(encrypted, key)
      // Отсекаем ~1/256 ложную «расшифровку» fingerprint-списка под S (см. storage-keys).
      if (legacy && !looksLikeAccountsList(decrypted))
        throw new Error('vault: implausible accounts-list decrypt under S')
    } catch (e) {
      if (!legacy) throw e
      decrypted = decryptData(encrypted, legacy)
      try {
        localStorage.setItem(ACCOUNTS_LIST_KEY, encryptData(decrypted, key))
      } catch {
        /* quota и пр.: чтение не проваливаем */
      }
    }
    const accountsList = JSON.parse(decrypted) as AccountsList

    return { success: true, data: accountsList, storageType: 'localStorage' }
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Добавляет аккаунт или обновляет существующий по address. Делает аккаунт текущим.
 * Обновляет lastUsed = Date.now() для добавляемого/обновляемого аккаунта.
 */
export function addAccountToStore(accountInfo: AccountInfo): StorageSaveResult {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return { success: false, error: 'Failed to load accounts list' }
  }

  const accountsList = result.data
  const existingIndex = accountsList.accounts.findIndex(
    (acc) => acc.address === accountInfo.address
  )

  if (existingIndex >= 0) {
    accountsList.accounts[existingIndex] = { ...accountInfo, lastUsed: Date.now() }
  } else {
    accountsList.accounts.push({ ...accountInfo, lastUsed: Date.now() })
  }
  accountsList.currentAccount = accountInfo.address

  return saveAccountsList(accountsList)
}

/** Удаляет аккаунт. Если удалили текущий — текущим становится первый из оставшихся (или null). */
export function removeAccountFromStore(address: Address): StorageSaveResult {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return { success: false, error: 'Failed to load accounts list' }
  }

  const accountsList = result.data
  accountsList.accounts = accountsList.accounts.filter((acc) => acc.address !== address)

  if (accountsList.currentAccount === address) {
    accountsList.currentAccount =
      accountsList.accounts.length > 0 ? accountsList.accounts[0]!.address : null
  }

  return saveAccountsList(accountsList)
}

/** Возвращает AccountInfo по адресу или null. */
export function getAccountInfo(address: Address): StorageLoadResult<AccountInfo> {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return { success: false, data: null, error: 'Failed to load accounts list' }
  }

  const account = result.data.accounts.find((acc) => acc.address === address)
  return { success: true, data: account || null, storageType: 'localStorage' }
}

/**
 * Обновляет кэшированный ник аккаунта (AccountInfo.name).
 * UI использует этот ник как мгновенно доступную подпись до того,
 * как fetchUserState вернёт свежий профиль.
 */
export function updateAccountName(address: Address, name: string): StorageSaveResult {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return { success: false, error: 'Failed to load accounts list' }
  }
  const accountsList = result.data
  const idx = accountsList.accounts.findIndex((acc) => acc.address === address)
  if (idx < 0) return { success: false, error: 'Account not found' }
  if (accountsList.accounts[idx].name === name) {
    return { success: true, storageType: 'localStorage' }
  }
  accountsList.accounts[idx] = { ...accountsList.accounts[idx], name }
  return saveAccountsList(accountsList)
}

/** Устанавливает текущий аккаунт + обновляет lastUsed. */
export function setCurrentAccount(address: Address): StorageSaveResult {
  const result = loadAccountsList()
  if (!result.success || !result.data) {
    return { success: false, error: 'Failed to load accounts list' }
  }

  const accountsList = result.data
  const account = accountsList.accounts.find((acc) => acc.address === address)
  if (!account) {
    return { success: false, error: 'Account not found' }
  }

  accountsList.currentAccount = address
  account.lastUsed = Date.now()

  return saveAccountsList(accountsList)
}
