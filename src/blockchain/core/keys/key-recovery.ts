/**
 * Восстановление ключей из различных форматов
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'

// Импортируем bip39 - пробуем разные способы для совместимости
import * as bip39Module from 'bip39'
const bip39: typeof import('bip39') =
  (bip39Module as { default?: typeof import('bip39') }).default || bip39Module
void bip39 // импорт сохранён ради side-effect совместимости
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { POCKETNET_NETWORK } from '../../constants/network'

// Инициализируем ECPair
const ECPair = ECPairFactory(ecc)
import type {
  PrivateKey,
  KeyPair,
  KeyRecoveryResult,
  KeyRecoveryOptions,
  PrivateKeyFormat,
} from '../../types/keys'
import { getMainAddressPath } from '../../constants/paths'
import { detectPrivateKeyFormat, normalizeMnemonic, validateMnemonic, detectMnemonicWordlist } from './key-validator'
import { mnemonicToSeed, seedToKeyPair } from './key-generator'

/**
 * Восстанавливает ключевую пару из мнемонической фразы
 * @param mnemonic - Мнемоническая фраза
 * @param derivationPath - BIP32 путь (по умолчанию m/44'/0'/0'/0')
 * @param useCache - Использовать кеш (по умолчанию true)
 * @returns Ключевая пара
 */
export function recoverKeyPairFromMnemonic(
  mnemonic: PrivateKey,
  derivationPath: string = getMainAddressPath(0),
  useCache: boolean = true
): KeyPair {
  if (!mnemonic) {
    throw new Error('Mnemonic is required')
  }

  const normalized = normalizeMnemonic(mnemonic)

  const isValid = validateMnemonic(normalized)

  if (!isValid) {
    console.error('[recoverKeyPairFromMnemonic] Invalid mnemonic phrase. Words count:', normalized.split(/\s+/).length)
    throw new Error('Invalid mnemonic phrase')
  }

  // Определяем wordlist для правильной конвертации
  const wordlist = detectMnemonicWordlist(normalized)

  // Конвертируем мнемонику в seed с правильным wordlist
  const seed = mnemonicToSeed(normalized, useCache, wordlist || undefined)

  // Генерируем ключевую пару из seed
  return seedToKeyPair(seed, derivationPath, useCache)
}

/**
 * Восстанавливает ключевую пару из приватного ключа в hex формате
 * @param hexKey - Приватный ключ в hex формате (64 символа)
 * @returns Ключевая пара
 */
export function recoverKeyPairFromHex(hexKey: PrivateKey): KeyPair {
  if (!hexKey) {
    throw new Error('Hex private key is required')
  }

  const normalized = hexKey.toLowerCase().trim()

  // Проверка формата hex
  const hexPattern = /^[0-9a-f]{64}$/i
  if (!hexPattern.test(normalized)) {
    throw new Error('Invalid hex private key format (must be 64 hex characters)')
  }

  try {
    const privateKeyBuffer = Buffer.from(normalized, 'hex')

    // Проверка длины (32 байта)
    if (privateKeyBuffer.length !== 32) {
      throw new Error('Invalid private key length')
    }

    // Создаем ключевую пару из приватного ключа с сетью Pocketnet
    const ecPair = ECPair.fromPrivateKey(privateKeyBuffer, { network: POCKETNET_NETWORK })

    // Убеждаемся, что ключи являются Buffer
    const privateKey = Buffer.isBuffer(ecPair.privateKey) 
      ? ecPair.privateKey 
      : Buffer.from(ecPair.privateKey!)
    const publicKey = Buffer.isBuffer(ecPair.publicKey) 
      ? ecPair.publicKey 
      : Buffer.from(ecPair.publicKey)

    return {
      privateKey,
      publicKey,
      ecPair,
    }
  } catch (error) {
    throw new Error(
      `Failed to recover key pair from hex: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Восстанавливает ключевую пару из приватного ключа в WIF формате
 * @param wifKey - Приватный ключ в WIF формате
 * @returns Ключевая пара
 */
export function recoverKeyPairFromWIF(wifKey: PrivateKey): KeyPair {
  if (!wifKey) {
    throw new Error('WIF private key is required')
  }

  try {
    // Создаем ключевую пару из WIF с сетью Pocketnet
    const ecPair = ECPair.fromWIF(wifKey, POCKETNET_NETWORK)

    // Убеждаемся, что ключи являются Buffer
    const privateKey = Buffer.isBuffer(ecPair.privateKey) 
      ? ecPair.privateKey 
      : Buffer.from(ecPair.privateKey!)
    const publicKey = Buffer.isBuffer(ecPair.publicKey) 
      ? ecPair.publicKey 
      : Buffer.from(ecPair.publicKey)

    return {
      privateKey,
      publicKey,
      ecPair,
    }
  } catch (error) {
    throw new Error(
      `Failed to recover key pair from WIF: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Восстанавливает ключевую пару из приватного ключа в любом формате
 * Автоматически определяет формат и восстанавливает ключи
 * @param privateKey - Приватный ключ в любом формате (мнемоника, hex, WIF)
 * @param options - Опции восстановления
 * @returns Результат восстановления
 */
export function recoverKeyPair(
  privateKey: PrivateKey,
  options: KeyRecoveryOptions = {}
): KeyRecoveryResult {
  if (!privateKey) {
    throw new Error('Private key is required')
  }

  const {
    format,
    derivationPath = getMainAddressPath(0),
    useCache = true,
  } = options

  // Определяем формат если не указан
  const detectedFormat = format || detectPrivateKeyFormat(privateKey)

  if (!detectedFormat) {
    throw new Error('Unable to detect private key format')
  }

  let keyPair: KeyPair

  try {
    switch (detectedFormat) {
      case 'mnemonic': {
        keyPair = recoverKeyPairFromMnemonic(privateKey, derivationPath, useCache)
        break
      }

      case 'hex': {
        keyPair = recoverKeyPairFromHex(privateKey)
        break
      }

      case 'wif': {
        keyPair = recoverKeyPairFromWIF(privateKey)
        break
      }

      default: {
        throw new Error(`Unsupported private key format: ${detectedFormat}`)
      }
    }

    return {
      keyPair,
      format: detectedFormat,
      source: privateKey,
    }
  } catch (error) {
    throw new Error(
      `Failed to recover key pair: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
