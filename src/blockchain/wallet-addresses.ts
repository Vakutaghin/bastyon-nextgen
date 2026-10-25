/**
 * Деривация и хранение адресов кошелька — как в прежнем приложении Bastyon
 * (pocketnet.gui, sdk.addresses и sdk.address.wallet): P2SH-P2WPKH по пути
 * m/44'/0'/0'/n', где зерно BIP32 — приватный ключ аккаунта, а не зерно
 * мнемоники (оттуда же ключи мессенджера, deriveMessengerKeys). Прежнее
 * приложение заводит 10 таких адресов и переводит «в кошелёк» на случайный.
 *
 * С 0.3.0 по 0.13.4 зерном здесь было зерно мнемоники (V7): адреса не
 * совпадали с прежним приложением, и монеты в его «Кошельке» тут не было
 * видно («было 44, стало 0.86»). Принимать на эти адреса это приложение не
 * давало (V6), но сохранённые тогда адреса не выбрасываются: они в списке
 * прежних (getLegacyWalletAddressesList), и баланс показывает их, если на них
 * что-то есть.
 */

import { Buffer } from './utils/buffer-polyfill'
import type { Address } from './types/addresses'
import { mnemonicToSeed, seedToKeyPair } from './core/keys/key-generator'
import { generateWalletAddress } from './core/addresses/address-generator'
import { getMainAddressPath } from './constants/paths'
import {
  getWalletAddressesList,
  saveWalletAddressesList,
  getAdditionalWalletAddressesList,
  saveAdditionalWalletAddressesList,
  getLegacyWalletAddressesList,
  saveLegacyWalletAddressesList,
  loadEncryptedData,
} from './storage'
import { ACCOUNT_STORAGE_PREFIX } from './constants/storage'
import { t } from '@/i18n'

/** Адреса для мини-приложений (BST_WALLET_ADDRS_). */
const DEFAULT_WALLET_ADDRESSES_COUNT = 3

/** Дополнительные кошельки по умолчанию: 10, как в прежнем приложении. */
export const DEFAULT_ADDITIONAL_WALLET_COUNT = 10

/** Максимум дополнительных кошельков (индексы 0, 1, 2, …). */
const MAX_ADDITIONAL_WALLET_ADDRESSES = 20

type PrivateKeyLike = Buffer | Uint8Array | null | undefined

/** Приватный ключ аккаунта из мнемоники: путь m/44'/0'/0'/0', как у входа. */
function accountKeyFromMnemonic(mnemonic: string): Buffer {
  const seed = mnemonicToSeed(mnemonic, true)
  const seedBuffer = Buffer.isBuffer(seed) ? seed : Buffer.from(seed as Uint8Array)
  const keyPair = seedToKeyPair(seedBuffer, getMainAddressPath(0))
  if (!keyPair.privateKey) throw new Error('no account private key')
  return Buffer.from(keyPair.privateKey as unknown as Uint8Array)
}

/** Адреса кошелька с индексами [from, to) от приватного ключа аккаунта. */
function walletAddresses(accountKey: Buffer, from: number, to: number): string[] {
  const out: string[] = []
  for (let i = from; i < to; i++) {
    const address = generateWalletAddress(i, accountKey, true)?.addressInfo?.address
    if (!address) throw new Error(t('appMsg.wallet.deriveFailed'))
    out.push(address)
  }
  return out
}

/**
 * Деривирует адреса кошелька для мини-приложений и сохраняет их. Вызывать при
 * входе и восстановлении сессии, когда мнемоника в памяти. Список прежней
 * деривации заменяется.
 */
export function deriveAndSaveWalletAddresses(
  mnemonic: string,
  accountAddress: Address
): { success: boolean; count: number; error?: string } {
  try {
    const expected = walletAddresses(
      accountKeyFromMnemonic(mnemonic),
      0,
      DEFAULT_WALLET_ADDRESSES_COUNT
    )
    const existing = getWalletAddressesList(accountAddress)
    if (expected.every((a, i) => existing[i] === a)) {
      return { success: true, count: existing.length }
    }
    const result = saveWalletAddressesList(accountAddress, expected)
    return result.success
      ? { success: true, count: expected.length }
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

/**
 * Приватный ключ аккаунта — зерно адресов кошелька. Переданный ключ (из
 * keyPair входа) важнее; без него — из мнемоники в хранилище.
 */
function getAccountKey(
  accountAddress: Address,
  privateKey?: PrivateKeyLike
): { key: Buffer; error?: string } {
  if (privateKey && privateKey.length === 32) {
    return { key: Buffer.from(privateKey as unknown as Uint8Array) }
  }
  const mnemonicResult = loadEncryptedData({
    persistent: true,
    storageKey: `${ACCOUNT_STORAGE_PREFIX}${accountAddress}`,
  })
  if (!mnemonicResult.success || !mnemonicResult.data) {
    return { key: Buffer.alloc(0), error: t('appMsg.wallet.needAuth') }
  }
  try {
    return { key: accountKeyFromMnemonic(mnemonicResult.data) }
  } catch (e) {
    console.error('[wallet-addresses] account key from mnemonic failed:', e)
    return { key: Buffer.alloc(0), error: t('appMsg.wallet.seedFailed') }
  }
}

/**
 * Доводит список дополнительных кошельков до десяти адресов прежнего
 * приложения (BST_ADDITIONAL_WALLETS_LIST). Список другой деривации (0.3.0–
 * 0.13.4) заменяется, а его адреса уходят в прежние.
 */
export async function ensureDefaultAdditionalWallet(
  accountAddress: Address,
  privateKey?: PrivateKeyLike
): Promise<{ success: boolean; error?: string }> {
  const { key, error: keyError } = getAccountKey(accountAddress, privateKey)
  if (keyError || key.length === 0) {
    return { success: false, error: keyError }
  }
  try {
    const list = getAdditionalWalletAddressesList(accountAddress)
    const [first] = walletAddresses(key, 0, 1)
    if (list[0] === first) {
      if (list.length >= DEFAULT_ADDITIONAL_WALLET_COUNT) return { success: true }
      const more = walletAddresses(key, list.length, DEFAULT_ADDITIONAL_WALLET_COUNT)
      const saved = saveAdditionalWalletAddressesList(accountAddress, [...list, ...more])
      return saved.success ? { success: true } : { success: false, error: saved.error }
    }

    const expected = walletAddresses(key, 0, DEFAULT_ADDITIONAL_WALLET_COUNT)
    const legacy = list.filter((a) => !expected.includes(a))
    if (legacy.length) {
      const known = getLegacyWalletAddressesList(accountAddress)
      saveLegacyWalletAddressesList(accountAddress, [...new Set([...known, ...legacy])])
    }
    const saved = saveAdditionalWalletAddressesList(accountAddress, expected)
    return saved.success ? { success: true } : { success: false, error: saved.error }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Добавляет один дополнительный кошелёк: следующий индекс от приватного ключа
 * аккаунта, в BST_ADDITIONAL_WALLETS_LIST.
 */
export async function addOneWalletAddress(
  accountAddress: Address,
  privateKey?: PrivateKeyLike
): Promise<AddWalletResult> {
  const list = getAdditionalWalletAddressesList(accountAddress)
  if (list.length >= MAX_ADDITIONAL_WALLET_ADDRESSES) {
    return {
      success: false,
      error: t('appMsg.wallet.maxWallets', { n: MAX_ADDITIONAL_WALLET_ADDRESSES }),
    }
  }

  const { key, error: keyError } = getAccountKey(accountAddress, privateKey)
  if (keyError || key.length === 0) {
    return { success: false, error: keyError }
  }

  try {
    const [address] = walletAddresses(key, list.length, list.length + 1)
    const saveResult = saveAdditionalWalletAddressesList(accountAddress, [...list, address!])
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }
    return { success: true, address }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
