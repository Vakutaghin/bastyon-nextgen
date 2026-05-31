// Поднятие сид-фразы / приватного ключа для конкретного аккаунта в свитчере.
// Сначала пробуем account-specific ключ (BST_ACCOUNT_<address>), fallback на общий
// (для аккаунтов, сохранённых до появления per-account ключей).

import { ACCOUNT_STORAGE_PREFIX } from '@/blockchain/constants/storage'
import { parseMnemonicOrKey, type ParsedMnemonicOrKey } from '@/helpers/common/mnemonic-parser'
import type { Address } from '@/blockchain/types/addresses'
import { t } from '@/i18n'

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
    if (generalResult.success && generalResult.data) rawData = generalResult.data
  }

  if (!rawData || !rawData.trim()) {
    throw new Error(t('accountMsg.noSavedSeedOrKey'))
  }

  const parsed = parseMnemonicOrKey(rawData)
  if (!parsed) throw new Error(t('accountMsg.unknownDataFormat'))
  return parsed
}
