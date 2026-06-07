// Сессия пользователя: адрес, флаг wasLogged, список адресов кошелька + общий клин-ап.
// Шифрование/мнемоника → storage-keys.ts; список аккаунтов → storage-accounts.ts.

import type { Address } from '../types/addresses'
import type { StorageSaveResult } from '../types/storage'

import {
  MNEMONIC_STORAGE_KEY,
  USER_ADDRESS_STORAGE_KEY,
  WALLET_LABELS_KEY,
  WAS_LOGGED_KEY,
  WALLET_ADDRESSES_PREFIX,
  ADDITIONAL_WALLETS_LIST_KEY,
} from '../constants/storage'
import { ACCOUNTS_LIST_KEY } from './storage-constants'
import { clearStoredData } from './storage-keys'

/** Сохраняет адрес текущего пользователя в localStorage (не шифруется — публичный). */
export function saveUserAddress(address: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_ADDRESS_STORAGE_KEY, address)
    }
  } catch {
    // Игнорируем ошибки
  }
}

export function loadUserAddress(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(USER_ADDRESS_STORAGE_KEY)
    }
  } catch {
    // Игнорируем ошибки
  }
  return null
}

/**
 * Синхронная проверка: есть ли в localStorage следы сохранённой сессии.
 * Не расшифровывает данные — только смотрит на наличие ключей.
 * Используется на старте, чтобы UI знал «нужно ли ждать restoreSession»
 * и показывал скелетон вместо мерцающей кнопки «Войти».
 */
export function hasStoredSession(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    if (localStorage.getItem(ACCOUNTS_LIST_KEY)) return true
    if (localStorage.getItem(WAS_LOGGED_KEY) === 'true') return true
    if (localStorage.getItem(MNEMONIC_STORAGE_KEY)) return true
  } catch {
    return false
  }
  return false
}

export function saveWasLogged(wasLogged: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WAS_LOGGED_KEY, wasLogged ? 'true' : '')
    }
  } catch {
    // Игнорируем ошибки
  }
}

/** Очищает все данные пользователя из обоих storage. Вызывается при signOut. */
export function clearAllUserData(): void {
  try {
    // Шифрованная мнемоника
    clearStoredData({ persistent: true })
    clearStoredData({ persistent: false })

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USER_ADDRESS_STORAGE_KEY)
      localStorage.removeItem(WAS_LOGGED_KEY)
      localStorage.removeItem(ACCOUNTS_LIST_KEY)
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(ACCOUNTS_LIST_KEY)
    }
  } catch {
    // Игнорируем ошибки
  }
}

// --- Wallet addresses (P2SH-производные для одного аккаунта) ---

function walletAddressesKey(address: Address): string {
  return WALLET_ADDRESSES_PREFIX + address
}

/**
 * Список адресов кошелька (производные P2SH) для аккаунта.
 * Как в старом приложении: sdk.addresses.storage.addresses (wallets2).
 */
export function getWalletAddressesList(address: Address): string[] {
  try {
    const key = walletAddressesKey(address)
    const raw = (typeof localStorage !== 'undefined' && localStorage.getItem(key)) || null
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((a: unknown) => typeof a === 'string') : []
  } catch {
    return []
  }
}

export function saveWalletAddressesList(address: Address, addresses: string[]): StorageSaveResult {
  try {
    const key = walletAddressesKey(address)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(addresses))
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Читает объект дополнительных кошельков из LS: { [accountAddress]: string[] }. */
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
 * Список адресов дополнительных кошельков (индексы 1, 2, …) для аккаунта.
 * Хранится в общем ключе BST_ADDITIONAL_WALLETS_LIST.
 */
export function getAdditionalWalletAddressesList(address: Address): string[] {
  const map = getAdditionalWalletsMap()
  const list = map[address]
  return Array.isArray(list) ? list.filter((a: unknown) => typeof a === 'string') : []
}

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
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ─── Ярлыки кошельков (локальные, косметические) ──────────────────────────────

function getWalletLabelsMap(): Record<string, Record<string, string>> {
  try {
    const raw =
      (typeof localStorage !== 'undefined' && localStorage.getItem(WALLET_LABELS_KEY)) || null
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/** Ярлык конкретного кошелька аккаунта (пустая строка, если не задан). */
export function getWalletLabel(accountAddress: Address, walletAddress: string): string {
  const perAccount = getWalletLabelsMap()[accountAddress]
  const label = perAccount?.[walletAddress]
  return typeof label === 'string' ? label : ''
}

/** Устанавливает/снимает ярлык кошелька. Пустой `label` удаляет запись. */
export function setWalletLabel(
  accountAddress: Address,
  walletAddress: string,
  label: string
): StorageSaveResult {
  try {
    const map = getWalletLabelsMap()
    const perAccount = { ...(map[accountAddress] ?? {}) }
    const trimmed = label.trim().slice(0, 40)
    if (trimmed) perAccount[walletAddress] = trimmed
    else delete perAccount[walletAddress]
    map[accountAddress] = perAccount
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WALLET_LABELS_KEY, JSON.stringify(map))
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}
