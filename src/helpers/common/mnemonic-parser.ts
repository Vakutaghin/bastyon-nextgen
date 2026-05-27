// Универсальный парсер строкового представления мнемоники/ключа в стандартизированную
// форму {mnemonic, privateKeyHex}. Используется header-user'ом и account-switcher'ом.
// Поддерживаемые форматы: mnemonic (BIP39), hex (32-байтный raw), wif (compressed).

import { detectPrivateKeyFormat, recoverKeyPair } from '@/blockchain'

/** Распарсенная пара: одно из полей содержит исходник, другое — пустая строка. */
export interface ParsedMnemonicOrKey {
  mnemonic: string
  privateKeyHex: string
}

/**
 * Определяет формат сырой строки (mnemonic/hex/wif) и приводит к {mnemonic, privateKeyHex}.
 * null если формат не распознан или wif не удалось декодировать.
 */
export function parseMnemonicOrKey(raw: string): ParsedMnemonicOrKey | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const format = detectPrivateKeyFormat(trimmed)

  if (format === 'mnemonic') {
    return { mnemonic: trimmed, privateKeyHex: '' }
  }
  if (format === 'hex') {
    return { mnemonic: '', privateKeyHex: trimmed }
  }
  if (format === 'wif') {
    try {
      const { keyPair } = recoverKeyPair(trimmed)
      const pk = keyPair?.privateKey
      const privateKeyHex = pk ? (Buffer.isBuffer(pk) ? pk.toString('hex') : String(pk)) : ''
      return { mnemonic: '', privateKeyHex }
    } catch {
      return null
    }
  }
  return null
}
