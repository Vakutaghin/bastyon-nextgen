/**
 * Типы для работы с адресами Pocketnet
 */

import type { Network } from './btc17-types'

export interface Payment {
  name?: string
  network?: Network
  address?: string
  hash?: Buffer
  pubkey?: Buffer
  output?: Buffer
  input?: Buffer
  signature?: Buffer
  /** Redeem script (для P2SH-обёрток, например P2SH(P2WPKH)) */
  redeem?: {
    output?: Buffer
    hash?: Buffer
  }
}

/**
 * Тип адреса Pocketnet
 */
export type AddressType = 'p2pkh' | 'p2wpkh' | 'p2sh'

/**
 * Pocketnet адрес (начинается с 'P', '3', 'T', 'Y', 'Z')
 */
export type Address = string

/**
 * Информация об адресе
 */
export interface AddressInfo {
  /** Адрес в строковом формате */
  address: Address
  /** Тип адреса */
  type: AddressType
  /** Публичный ключ */
  publicKey: Buffer
  /** Payment объект (структура как в btc17) */
  payment: Payment
}

/**
 * Результат генерации адреса
 */
export interface AddressGenerationResult {
  /** Информация об адресе */
  addressInfo: AddressInfo
  /** BIP32 путь использованный для генерации */
  derivationPath?: string
}

/**
 * Опции для генерации адреса
 */
export interface AddressGenerationOptions {
  /** Тип адреса */
  type?: AddressType
  /** Индекс для кошелькового адреса */
  walletIndex?: number
  /** Использовать кеш */
  useCache?: boolean
}

/**
 * Результат валидации адреса
 */
export interface AddressValidationResult {
  /** Валидность адреса */
  isValid: boolean
  /** Тип адреса (если валиден) */
  type?: AddressType
  /** Сообщение об ошибке (если невалиден) */
  error?: string
}
