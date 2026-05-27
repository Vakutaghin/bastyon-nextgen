/**
 * Генерация адресов Pocketnet
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'

import type {
  AddressInfo,
  AddressType,
  AddressGenerationResult,
  AddressGenerationOptions,
} from '../../types/addresses'
import type { KeyPair } from '../../types/keys'
import { getMainAddressPath } from '../../constants/paths'
import { seedToKeyPair } from '../keys/key-generator'
import { POCKETNET_NETWORK } from '../../constants/network'
import { localHash160, toBase58Check, toBech32 } from './address-hash-utils'

// Кеш для оптимизации (в памяти)
const addressCache = new Map<string, AddressInfo>()

/**
 * Генерирует P2PKH адрес из публичного ключа
 * Адреса начинаются с 'P' (основной тип для пользователей)
 * @param publicKey - Публичный ключ
 * @returns Информация об адресе
 */
export function generateP2PKHAddress(publicKey: Buffer): AddressInfo {
  if (!publicKey || !Buffer.isBuffer(publicKey)) {
    throw new Error('Valid public key is required')
  }

  const cacheKey = `p2pkh:${publicKey.toString('hex')}`

  // Проверка кеша
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey)!
  }

  try {
    // ВАЖНО: Используем сеть Pocketnet для генерации адресов с префиксом 'P'

    const hash = localHash160(publicKey)

    // Manual Base58Check encoding
    const address = toBase58Check(hash, POCKETNET_NETWORK.pubKeyHash)

    const payment: any = {
      name: 'p2pkh',
      network: POCKETNET_NETWORK,
      address,
      hash,
      pubkey: publicKey,
    }

    const addressInfo: AddressInfo = {
      address,
      type: 'p2pkh',
      publicKey,
      payment,
    }

    // Сохранение в кеш
    addressCache.set(cacheKey, addressInfo)

    return addressInfo
  } catch (error) {
    throw new Error(
      `Failed to generate P2PKH address: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

/**
 * Генерирует P2WPKH адрес из публичного ключа (SegWit)
 * @param publicKey - Публичный ключ
 * @returns Информация об адресе
 */
export function generateP2WPKHAddress(publicKey: Buffer): AddressInfo {
  if (!publicKey || !Buffer.isBuffer(publicKey)) {
    throw new Error('Valid public key is required')
  }

  const cacheKey = `p2wpkh:${publicKey.toString('hex')}`

  // Проверка кеша
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey)!
  }

  try {
    // Используем сеть Pocketnet
    // Ручная генерация P2WPKH для надежности
    const hash = localHash160(publicKey)
    // Manual Bech32 encoding
    const address = toBech32(hash, 0, POCKETNET_NETWORK.bech32)

    const payment: any = {
      name: 'p2wpkh',
      network: POCKETNET_NETWORK,
      address,
      hash,
      pubkey: publicKey,
    }

    const addressInfo: AddressInfo = {
      address,
      type: 'p2wpkh',
      publicKey,
      payment,
    }

    // Сохранение в кеш
    addressCache.set(cacheKey, addressInfo)

    return addressInfo
  } catch (error) {
    throw new Error(
      `Failed to generate P2WPKH address: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

/**
 * Генерирует P2SH адрес из публичного ключа (для кошельков)
 * Адреса начинаются с '3'
 * @param publicKey - Публичный ключ
 * @returns Информация об адресе
 */
export function generateP2SHAddress(publicKey: Buffer): AddressInfo {
  if (!publicKey || !Buffer.isBuffer(publicKey)) {
    throw new Error('Valid public key is required')
  }

  const cacheKey = `p2sh:${publicKey.toString('hex')}`

  // Проверка кеша
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey)!
  }

  try {
    // Ручная генерация P2SH(P2WPKH)
    // 1. Генерируем P2WPKH script (redeem script)
    const pubKeyHash = localHash160(publicKey)

    // Redeem script: 0x00 <20-byte pubKeyHash>
    const redeemScript = Buffer.concat([Buffer.from([0x00, 0x14]), pubKeyHash])

    // 2. Hash160 от redeem script
    const scriptHash = localHash160(redeemScript)

    // 3. Адрес P2SH
    const address = toBase58Check(scriptHash, POCKETNET_NETWORK.scriptHash)

    const payment: any = {
      name: 'p2sh-p2wpkh',
      network: POCKETNET_NETWORK,
      address,
      hash: scriptHash,
      redeem: {
        output: redeemScript,
        hash: pubKeyHash,
      },
      pubkey: publicKey,
    }

    const addressInfo: AddressInfo = {
      address,
      type: 'p2sh',
      publicKey,
      payment,
    }

    // Сохранение в кеш
    addressCache.set(cacheKey, addressInfo)

    return addressInfo
  } catch (error) {
    throw new Error(
      `Failed to generate P2SH address: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

/**
 * Генерирует Pocketnet адрес из публичного ключа
 * По умолчанию использует P2PKH (основной тип)
 * @param publicKey - Публичный ключ
 * @param type - Тип адреса (по умолчанию 'p2pkh')
 * @returns Информация об адресе
 */
export function generatePocketnetAddress(
  publicKey: Buffer,
  type: AddressType = 'p2pkh'
): AddressInfo {
  if (!publicKey || !Buffer.isBuffer(publicKey)) {
    throw new Error('Valid public key is required')
  }
  switch (type) {
    case 'p2pkh':
      return generateP2PKHAddress(publicKey)
    case 'p2wpkh':
      return generateP2WPKHAddress(publicKey)
    case 'p2sh':
      return generateP2SHAddress(publicKey)
    default:
      throw new Error(`Unsupported address type: ${type}`)
  }
}

/**
 * Генерирует адрес из ключевой пары
 * @param keyPair - Ключевая пара
 * @param options - Опции генерации
 * @returns Результат генерации адреса
 */
export function generateAddressFromKeyPair(
  keyPair: KeyPair,
  options: AddressGenerationOptions = {}
): AddressGenerationResult {
  const { type = 'p2pkh' } = options

  const addressInfo = generatePocketnetAddress(keyPair.publicKey, type)

  return {
    addressInfo,
  }
}

/**
 * Генерирует кошельковый адрес (P2SH) по индексу
 * @param walletIndex - Индекс кошелька
 * @param privateKey - Приватный ключ (seed) для деривации
 * @param useCache - Использовать кеш (по умолчанию true)
 * @returns Результат генерации адреса
 */
export function generateWalletAddress(
  walletIndex: number,
  privateKey: Buffer,
  useCache: boolean = true
): AddressGenerationResult {
  if (walletIndex < 0) {
    throw new Error('Wallet index must be non-negative')
  }

  if (!privateKey || !Buffer.isBuffer(privateKey)) {
    throw new Error('Valid private key (seed) is required')
  }

  const derivationPath = getMainAddressPath(walletIndex)
  const cacheKey = `wallet:${privateKey.toString('hex')}:${walletIndex}`

  // Проверка кеша
  if (useCache && addressCache.has(cacheKey)) {
    const addressInfo = addressCache.get(cacheKey)!
    return {
      addressInfo,
      derivationPath,
    }
  }

  try {
    // Генерируем ключевую пару для кошелька
    const keyPair = seedToKeyPair(privateKey, derivationPath, useCache)

    // Генерируем P2SH адрес (кошельки всегда используют P2SH)
    const addressInfo = generateP2SHAddress(keyPair.publicKey)

    // Сохранение в кеш
    if (useCache) {
      addressCache.set(cacheKey, addressInfo)
    }

    return {
      addressInfo,
      derivationPath,
    }
  } catch (error) {
    throw new Error(
      `Failed to generate wallet address: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

/**
 * Очищает кеш адресов
 */
export function clearAddressCache(): void {
  addressCache.clear()
}
