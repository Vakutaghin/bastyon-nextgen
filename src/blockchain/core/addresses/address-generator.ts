/**
 * Генерация адресов Pocketnet
 */

import { Buffer } from 'buffer'
// @ts-ignore
import bs58 from 'bs58'
// @ts-ignore
import bech32 from 'bech32'
import CryptoJS from 'crypto-js'

// Полифилл Buffer для браузера (на всякий случай)
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer
}
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer
}

import type {
  Address,
  AddressInfo,
  AddressType,
  AddressGenerationResult,
  AddressGenerationOptions,
} from '../../types/addresses'
import type { KeyPair } from '../../types/keys'
import { getMainAddressPath } from '../../constants/paths'
import { seedToKeyPair } from '../keys/key-generator'
import { POCKETNET_NETWORK } from '../../constants/network'

// Кеш для оптимизации (в памяти)
const addressCache = new Map<string, AddressInfo>()

function localHash256(buffer: Buffer): Buffer {
  const wordArray = CryptoJS.enc.Hex.parse(buffer.toString('hex'))
  const hash = CryptoJS.SHA256(CryptoJS.SHA256(wordArray))
  return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
}

function localHash160(buffer: Buffer): Buffer {
  const wordArray = CryptoJS.enc.Hex.parse(buffer.toString('hex'))
  const sha256 = CryptoJS.SHA256(wordArray)
  const ripemd160 = CryptoJS.RIPEMD160(sha256)
  return Buffer.from(ripemd160.toString(CryptoJS.enc.Hex), 'hex')
}

// Helper for manual Base58Check encoding to avoid bitcoinjs-lib internal typeforce checks
function toBase58Check(hash: Buffer, version: number): string {
  const payload = Buffer.allocUnsafe(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  const checksum = localHash256(payload).slice(0, 4)
  const data = Buffer.concat([payload, checksum])

  return bs58.encode(data)
}

function toBech32(hash: Buffer, version: number, prefix: string): string {
  const words = bech32.toWords(hash)
  words.unshift(version)
  return bech32.encode(prefix, words)
}

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
      `Failed to generate P2PKH address: ${error instanceof Error ? error.message : String(error)}`
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
      `Failed to generate P2WPKH address: ${error instanceof Error ? error.message : String(error)}`
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
    const redeemScript = Buffer.concat([
      Buffer.from([0x00, 0x14]),
      pubKeyHash
    ])

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
        hash: pubKeyHash
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
      `Failed to generate P2SH address: ${error instanceof Error ? error.message : String(error)}`
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
      `Failed to generate wallet address: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Очищает кеш адресов
 */
export function clearAddressCache(): void {
  addressCache.clear()
}
