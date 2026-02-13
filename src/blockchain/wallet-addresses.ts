/**
 * Деривация и хранение адресов кошелька (как в старом приложении: sdk.addresses.storage.addresses).
 * Для каждого аккаунта хранится список производных P2SH-адресов (wallet 0, 1, 2, ...).
 */

import type { Address } from './types/addresses'
import { mnemonicToSeed } from './core/keys/key-generator'
import { generateWalletAddress } from './core/addresses/address-generator'
import { getWalletAddressesList, saveWalletAddressesList } from './storage'

const DEFAULT_WALLET_ADDRESSES_COUNT = 10

/**
 * Деривирует адреса кошелька из мнемоники и сохраняет список для аккаунта.
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
