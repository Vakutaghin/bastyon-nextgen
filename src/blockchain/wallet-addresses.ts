/**
 * Деривация и хранение адресов кошелька (как в старом приложении: sdk.addresses.storage.addresses).
 * Для каждого аккаунта хранится список производных P2SH-адресов (wallet 0, 1, 2, ...).
 */

import type { Address } from './types/addresses'
import { mnemonicToSeed } from './core/keys/key-generator'
import { generateWalletAddress } from './core/addresses/address-generator'
import {
  getWalletAddressesList,
  saveWalletAddressesList,
  getAdditionalWalletAddressesList,
  saveAdditionalWalletAddressesList,
  loadEncryptedData,
} from './storage'
import { ACCOUNT_STORAGE_PREFIX } from './constants/storage'
import { t } from '@/i18n'

/** По умолчанию создаём 3 кошелька (старый ключ BST_WALLET_ADDRS_, для обратной совместимости). */
const DEFAULT_WALLET_ADDRESSES_COUNT = 3

/** По умолчанию создаём 3 дополнительных кошелька (индексы 0, 1, 2). */
const DEFAULT_ADDITIONAL_WALLET_COUNT = 3

/** Максимум дополнительных кошельков (индексы 0, 1, 2, …). */
const MAX_ADDITIONAL_WALLET_ADDRESSES = 20

/**
 * Деривирует адреса кошелька из мнемоники и сохраняет в старый ключ (обратная совместимость).
 * Вызывать при входе/восстановлении, когда мнемоника доступна в памяти.
 */
export function deriveAndSaveWalletAddresses(
  mnemonic: string,
  accountAddress: Address
): { success: boolean; count: number; error?: string } {
  const existing = getWalletAddressesList(accountAddress)
  if (existing.length >= DEFAULT_WALLET_ADDRESSES_COUNT) {
    return { success: true, count: existing.length }
  }

  try {
    const seed = mnemonicToSeed(mnemonic, true)
    const seedBuffer = Buffer.isBuffer(seed) ? seed : Buffer.from(seed as ArrayBuffer)
    const addresses: string[] = []

    for (let i = 0; i < DEFAULT_WALLET_ADDRESSES_COUNT; i++) {
      const result = generateWalletAddress(i, seedBuffer as Buffer, true)
      if (result?.addressInfo?.address) {
        addresses.push(result.addressInfo.address)
      }
    }

    const result = saveWalletAddressesList(accountAddress, addresses)
    return result.success
      ? { success: true, count: addresses.length }
      : { success: false, count: 0, error: result.error }
  } catch (e) {
    return {
      success: false,
      count: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export type AddWalletResult = { success: boolean; address?: string; error?: string }

/** Дополнительные кошельки — индексы 0, 1, 2, … */
function deriveAdditionalWalletIndex(listLength: number): number {
  return listLength
}

/**
 * Возвращает seed (Buffer) для деривации: либо из мнемоники в хранилище, либо переданный приватный ключ (32 байта).
 * При входе по приватному ключу тот же ключ используется как seed для BIP32 — дополнительные кошельки выводятся детерминированно.
 */
function getSeedForDerivation(
  accountAddress: Address,
  privateKeyAsSeed?: Buffer | null
): { seed: Buffer; error?: string } {
  if (privateKeyAsSeed && Buffer.isBuffer(privateKeyAsSeed) && privateKeyAsSeed.length >= 16) {
    return { seed: privateKeyAsSeed }
  }
  const mnemonicResult = loadEncryptedData({
    persistent: true,
    storageKey: `${ACCOUNT_STORAGE_PREFIX}${accountAddress}`,
  })
  if (!mnemonicResult.success || !mnemonicResult.data) {
    return { seed: Buffer.alloc(0), error: t('appMsg.wallet.needAuth') }
  }
  try {
    const seed = mnemonicToSeed(mnemonicResult.data, true)
    const seedBuffer = Buffer.isBuffer(seed) ? seed : Buffer.from(seed as ArrayBuffer)
    return { seed: seedBuffer }
  } catch (e) {
    console.error('[wallet-addresses] mnemonicToSeed failed:', e)
    return { seed: Buffer.alloc(0), error: t('appMsg.wallet.seedFailed') }
  }
}

/**
 * Инициализирует список дополнительных кошельков до трёх адресов (индексы 0, 1, 2), если их меньше.
 * Сохраняет в BST_ADDITIONAL_WALLETS_LIST.
 * При входе по приватному ключу передайте keyPair.privateKey вторым аргументом — тогда деривация идёт от него.
 */
export async function ensureDefaultAdditionalWallet(
  accountAddress: Address,
  privateKeyAsSeed?: Buffer | null
): Promise<{ success: boolean; error?: string }> {
  const list = getAdditionalWalletAddressesList(accountAddress)
  if (list.length >= DEFAULT_ADDITIONAL_WALLET_COUNT) {
    return { success: true }
  }

  const { seed, error: seedError } = getSeedForDerivation(accountAddress, privateKeyAsSeed)
  if (seedError || seed.length === 0) {
    return { success: false, error: seedError }
  }

  try {
    const addresses = [...list]
    for (let i = list.length; i < DEFAULT_ADDITIONAL_WALLET_COUNT; i++) {
      const result = generateWalletAddress(i, seed, true)
      if (result?.addressInfo?.address) {
        addresses.push(result.addressInfo.address)
      }
    }
    const saveResult = saveAdditionalWalletAddressesList(accountAddress, addresses)
    return saveResult.success ? { success: true } : { success: false, error: saveResult.error }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Добавляет один дополнительный кошелёк (деривирует индекс 0, 1, 2, … и сохраняет в BST_ADDITIONAL_WALLETS_LIST).
 * Работает при входе по мнемонике (берётся из хранилища) или по приватному ключу (передайте keyPair.privateKey вторым аргументом).
 */
export async function addOneWalletAddress(
  accountAddress: Address,
  privateKeyAsSeed?: Buffer | null
): Promise<AddWalletResult> {
  const list = getAdditionalWalletAddressesList(accountAddress)
  if (list.length >= MAX_ADDITIONAL_WALLET_ADDRESSES) {
    return { success: false, error: t('appMsg.wallet.maxWallets', { n: MAX_ADDITIONAL_WALLET_ADDRESSES }) }
  }

  const { seed, error: seedError } = getSeedForDerivation(accountAddress, privateKeyAsSeed)
  if (seedError || seed.length === 0) {
    return { success: false, error: seedError }
  }

  try {
    const nextIndex = deriveAdditionalWalletIndex(list.length)
    const result = generateWalletAddress(nextIndex, seed, true)
    if (!result?.addressInfo?.address) {
      return { success: false, error: t('appMsg.wallet.deriveFailed') }
    }
    const newList = [...list, result.addressInfo.address]
    const saveResult = saveAdditionalWalletAddressesList(accountAddress, newList)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }
    return { success: true, address: result.addressInfo.address }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
