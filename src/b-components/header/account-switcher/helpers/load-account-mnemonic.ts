// Поднятие сид-фразы / приватного ключа для конкретного аккаунта в свитчере.
// Сначала пробуем account-specific ключ (BST_ACCOUNT_<address>), fallback на общий
// (для аккаунтов, сохранённых до появления per-account ключей) — но только если
// из общего секрета выводится именно этот адрес: раньше «Показать сид» для A
// отдавал сид B, если у A не было своего ключа (S10).

import { ACCOUNT_STORAGE_PREFIX } from '@/blockchain/constants/storage'
import { generateAddressFromKeyPair } from '@/blockchain/core/addresses'
import { recoverKeyPair } from '@/blockchain/core/keys'
import { parseMnemonicOrKey, type ParsedMnemonicOrKey } from '@/helpers/common/mnemonic-parser'
import type { Address } from '@/blockchain/types/addresses'
import { t } from '@/i18n'

/** Адрес, который выводится из секрета (мнемоника или hex-ключ); null — не разобрать. */
export function addressOfSecret(secret: string): Address | null {
  try {
    const recovered = recoverKeyPair(secret)
    if (!recovered?.keyPair) return null
    return generateAddressFromKeyPair(recovered.keyPair).addressInfo.address as Address
  } catch {
    return null
  }
}

/** Загружает и парсит мнемонику аккаунта. Бросает с человекочитаемым сообщением. */
export async function loadAccountMnemonic(address: Address): Promise<ParsedMnemonicOrKey> {
  const { loadEncryptedData, loadEncryptedMnemonic } = await import('@/blockchain/storage')

  const accountResult = loadEncryptedData({
    persistent: true,
    storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
  })

  let rawData: string | null =
    accountResult.success && accountResult.data ? accountResult.data : null
  if (!rawData) {
    const generalResult = loadEncryptedMnemonic()
    const shared = generalResult.success && generalResult.data ? generalResult.data : null
    // Общий секрет — только если это секрет ЭТОГО адреса.
    if (shared && addressOfSecret(shared) === address) rawData = shared
  }

  if (!rawData || !rawData.trim()) {
    throw new Error(t('accountMsg.noSavedSeedOrKey'))
  }

  const parsed = parseMnemonicOrKey(rawData)
  if (!parsed) throw new Error(t('accountMsg.unknownDataFormat'))
  return parsed
}
