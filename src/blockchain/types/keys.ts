/**
 * Типы для работы с криптографическими ключами
 */

import type { ECPairInterface } from 'ecpair'

/**
 * Мнемоническая фраза (12 слов BIP39)
 */
export type Mnemonic = string

/**
 * Приватный ключ в различных форматах
 */
export type PrivateKey = string // hex, WIF, или мнемоника

/**
 * Публичный ключ в hex формате
 */
export type PublicKey = string

/**
 * Seed (512 бит) полученный из мнемоники
 */
export type Seed = Buffer

/**
 * Ключевая пара (приватный + публичный ключ)
 */
export interface KeyPair {
  /** Приватный ключ */
  privateKey: Buffer
  /** Публичный ключ */
  publicKey: Buffer
  /** ECPair интерфейс из ecpair */
  ecPair: ECPairInterface
}

/**
 * Формат приватного ключа
 */
export type PrivateKeyFormat = 'mnemonic' | 'hex' | 'wif'

/**
 * Результат генерации ключей
 */
export interface KeyGenerationResult {
  /** Мнемоническая фраза */
  mnemonic: Mnemonic
  /** Seed */
  seed: Seed
  /** Ключевая пара */
  keyPair: KeyPair
}

/**
 * Результат восстановления ключей
 */
export interface KeyRecoveryResult {
  /** Ключевая пара */
  keyPair: KeyPair
  /** Формат входных данных */
  format: PrivateKeyFormat
  /** Исходные данные (для валидации) */
  source: PrivateKey
}

/**
 * Опции для генерации ключей
 */
export interface KeyGenerationOptions {
  /** Использовать кеш для оптимизации */
  useCache?: boolean
  /** BIP32 путь для деривации */
  derivationPath?: string
}

/**
 * Опции для восстановления ключей
 */
export interface KeyRecoveryOptions {
  /** Формат входных данных (автоопределение если не указан) */
  format?: PrivateKeyFormat
  /** BIP32 путь для деривации */
  derivationPath?: string
  /** Использовать кеш */
  useCache?: boolean
}
