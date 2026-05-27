// Поднятие зашифрованной мнемоники/ключа из общего хранилища для показа после регистрации.

import { parseMnemonicOrKey, type ParsedMnemonicOrKey } from '@/helpers/common/mnemonic-parser'

/** Совместимость по форме — реэкспорт. */
export type PendingMnemonicResult = ParsedMnemonicOrKey

/**
 * Поднимает зашифрованную мнемонику/ключ из общего MNEMONIC_STORAGE_KEY
 * и приводит к {mnemonic, privateKeyHex}. null если данных нет / не распарсилось.
 *
 * shouldShowMnemonic(address) и сам показ модалки делает вызывающий код —
 * этот хелпер только готовит данные.
 */
export async function loadPendingMnemonic(): Promise<PendingMnemonicResult | null> {
  const { loadEncryptedMnemonic } = await import('@/blockchain/storage')
  const result = loadEncryptedMnemonic()
  if (!result.success || !result.data || !result.data.trim()) return null
  return parseMnemonicOrKey(result.data)
}
