/**
 * Константы для типов адресов Pocketnet
 */

import type { AddressType } from '../types/addresses'

/**
 * Префиксы адресов по типам
 */
export const ADDRESS_PREFIXES: Record<AddressType, string[]> = {
  /** P2PKH адреса (основной тип для пользователей) */
  p2pkh: ['P', 'T'],
  /** P2WPKH адреса (SegWit) */
  p2wpkh: ['bc1'], // Для Bitcoin, для Pocketnet могут быть другие
  /** P2SH адреса (кошельки) */
  p2sh: ['3', 'Y', 'Z'],
}

/**
 * Тип адреса по умолчанию
 */
export const DEFAULT_ADDRESS_TYPE: AddressType = 'p2pkh'

/**
 * Определяет тип адреса по префиксу
 * @param address - Адрес для проверки
 * @returns Тип адреса или null
 */
export function getAddressTypeByPrefix(address: string): AddressType | null {
  if (!address || typeof address !== 'string') {
    return null
  }

  const trimmed = address.trim()

  for (const [type, prefixes] of Object.entries(ADDRESS_PREFIXES)) {
    for (const prefix of prefixes) {
      if (trimmed.startsWith(prefix)) {
        return type as AddressType
      }
    }
  }

  return null
}

/**
 * Проверяет, является ли адрес P2PKH
 * @param address - Адрес для проверки
 * @returns true если P2PKH
 */
export function isP2PKHAddress(address: string): boolean {
  return getAddressTypeByPrefix(address) === 'p2pkh'
}

/**
 * Проверяет, является ли адрес P2SH
 * @param address - Адрес для проверки
 * @returns true если P2SH
 */
export function isP2SHAddress(address: string): boolean {
  return getAddressTypeByPrefix(address) === 'p2sh'
}

/**
 * Проверяет, является ли адрес P2WPKH
 * @param address - Адрес для проверки
 * @returns true если P2WPKH
 */
export function isP2WPKHAddress(address: string): boolean {
  return getAddressTypeByPrefix(address) === 'p2wpkh'
}
