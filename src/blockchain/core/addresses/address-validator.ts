/**
 * Валидация адресов Pocketnet
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'
// @ts-ignore
import bs58 from 'bs58'
// @ts-ignore
import { bech32 } from 'bech32'
import CryptoJS from 'crypto-js'

import type { Address, AddressType, AddressValidationResult } from '../../types/addresses'

function localHash256(buffer: Buffer): Buffer {
  const wordArray = CryptoJS.enc.Hex.parse(buffer.toString('hex'))
  const hash = CryptoJS.SHA256(CryptoJS.SHA256(wordArray))
  return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
}

function fromBase58Check(address: string): { version: number, hash: Buffer } {
  try {
    const payload = bs58.decode(address)
    if (payload.length < 5) throw new Error('Invalid foundation length')

    const checksum = payload.slice(-4)
    const data = payload.slice(0, -4)

    const newChecksum = localHash256(Buffer.from(data)).slice(0, 4)

    if (Buffer.from(checksum).compare(newChecksum) !== 0) {
      throw new Error('Invalid checksum')
    }

    const version = data[0]
    const hash = Buffer.from(data.slice(1))

    return { version, hash }
  } catch (e) {
    throw new Error('Invalid base58 address')
  }
}

function fromBech32(address: string) {
  try {
    return bech32.decode(address)
  } catch (e) {
    throw new Error('Invalid bech32 address')
  }
}

/**
 * Определяет тип адреса по его префиксу
 * @param address - Адрес для проверки
 * @returns Тип адреса или null если не удалось определить
 */
export function detectAddressType(address: Address): AddressType | null {
  if (!address || typeof address !== 'string') {
    return null
  }

  const trimmed = address.trim()

  // P2PKH адреса начинаются с 'P' (основной тип)
  if (trimmed.startsWith('P')) {
    return 'p2pkh'
  }

  // P2SH адреса начинаются с '3' (кошельки)
  if (trimmed.startsWith('3')) {
    return 'p2sh'
  }

  // P2WPKH адреса (SegWit) начинаются с 'bc1' для Bitcoin, но для Pocketnet могут быть другие
  // Проверяем через локальную функцию
  try {
    const decoded = fromBase58Check(trimmed)
    // Если успешно декодирован, это может быть P2PKH или P2SH
    // Дополнительная проверка через платежи
    return null // Будет определено через валидацию
  } catch {
    // Не base58 адрес
  }

  // Попытка определить через bech32 (SegWit)
  try {
    const decoded = fromBech32(trimmed)
    if (decoded) {
      return 'p2wpkh'
    }
  } catch {
    // Не bech32 адрес
  }

  return null
}

/**
 * Валидирует адрес Pocketnet
 * @param address - Адрес для проверки
 * @returns Результат валидации
 */
export function validateAddress(address: Address): AddressValidationResult {
  if (!address || typeof address !== 'string') {
    return {
      isValid: false,
      error: 'Address is required and must be a string',
    }
  }

  const trimmed = address.trim()

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Address cannot be empty',
    }
  }

  // Проверка через локальные функции
  try {
    // Попытка декодировать как base58 адрес
    try {
      const decoded = fromBase58Check(trimmed)
      if (decoded) {
        // Определяем тип по версии
        const version = decoded.version

        // Версия 0 обычно P2PKH, версия 5 обычно P2SH
        // Но для Pocketnet могут быть другие версии
        let type: AddressType | undefined

        if (trimmed.startsWith('P')) {
          type = 'p2pkh'
        } else if (trimmed.startsWith('3')) {
          type = 'p2sh'
        }

        return {
          isValid: true,
          type: type || 'p2pkh', // По умолчанию P2PKH
        }
      }
    } catch {
      // Не base58 адрес, пробуем bech32
    }

    // Попытка декодировать как bech32 адрес (SegWit)
    try {
      const decoded = fromBech32(trimmed)
      if (decoded) {
        return {
          isValid: true,
          type: 'p2wpkh',
        }
      }
    } catch {
      // Не bech32 адрес
    }

    // Если не удалось декодировать, адрес невалиден
    return {
      isValid: false,
      error: 'Invalid address format',
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    }
  }
}

/**
 * Проверяет, является ли адрес валидным Pocketnet адресом
 * @param address - Адрес для проверки
 * @returns true если валиден, false иначе
 */
export function isValidAddress(address: Address): boolean {
  return validateAddress(address).isValid
}

/**
 * Получает тип адреса (если валиден)
 * @param address - Адрес для проверки
 * @returns Тип адреса или null если адрес невалиден
 */
export function getAddressType(address: Address): AddressType | null {
  const validation = validateAddress(address)
  if (!validation.isValid) {
    return null
  }
  return validation.type || null
}

/**
 * Нормализует адрес (убирает пробелы, приводит к нужному регистру)
 * @param address - Адрес для нормализации
 * @returns Нормализованный адрес
 */
export function normalizeAddress(address: Address): Address {
  if (!address) {
    return ''
  }
  return address.trim()
}
