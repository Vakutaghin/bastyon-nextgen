/**
 * Генерация ключей и мнемонических фраз
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'

import { bip39, getBip39Russian } from './bip39-loader'
import * as bip32Module from 'bip32'
import type { BIP32API } from 'bip32'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { POCKETNET_NETWORK } from '../../constants/network'

// Инициализируем ECPair
const ECPair = ECPairFactory(ecc)

// Инициализируем BIP32 с криптографической библиотекой
// В новой версии bip32 нужно использовать BIP32Factory.
// Форма модуля (namespace / default / factory) меняется между сборками,
// поэтому читаем поля через узкий локальный тип вместо `any`.
type Bip32ModuleShape = {
  BIP32Factory?: (ecc: unknown) => BIP32API
  default?: (Partial<BIP32API> & { BIP32Factory?: (ecc: unknown) => BIP32API }) | undefined
} & Partial<BIP32API>

let BIP32: BIP32API | null = null
const bip32Shape = bip32Module as unknown as Bip32ModuleShape
try {
  const bip32Factory = bip32Shape.BIP32Factory || bip32Shape.default?.BIP32Factory
  if (bip32Factory) {
    BIP32 = bip32Factory(ecc)
  } else {
    BIP32 = (bip32Shape.default as BIP32API | undefined) || (bip32Shape as unknown as BIP32API)
  }
} catch (e) {
  console.error('[key-generator] Failed to initialize BIP32:', e)
  BIP32 = (bip32Shape.default as BIP32API | undefined) || (bip32Shape as unknown as BIP32API)
}
import type {
  Mnemonic,
  Seed,
  KeyPair,
  KeyGenerationResult,
  KeyGenerationOptions,
} from '../../types/keys'
import { getMainAddressPath } from '../../constants/paths'
import { detectMnemonicWordlist, validateMnemonic } from './key-validator'

// Кеш для оптимизации (в памяти)
const seedCache = new Map<string, Seed>()
const keyPairCache = new Map<string, KeyPair>()

/**
 * Генерирует ключи для мессенджера (12 ключей)
 * Использует legacy путь m/33'/0'/0'/n'
 * @param privateKey - Приватный ключ (32 байта)
 * @returns Массив ключей (private/public hex)
 */
export function deriveMessengerKeys(privateKey: Buffer): { private: string; public: string }[] {
  if (!BIP32) {
    throw new Error('BIP32 not initialized')
  }

  const root = BIP32.fromSeed(privateKey)
  const keys: { private: string; public: string }[] = []

  for (let i = 1; i <= 12; i++) {
    const path = `m/33'/0'/0'/${i}'`
    const child = root.derivePath(path)

    if (child.privateKey) {
      keys.push({
        private: Buffer.from(child.privateKey).toString('hex'),
        public: Buffer.from(child.publicKey).toString('hex')
      })
    }
  }

  return keys
}

export function generateMnemonic(): Mnemonic {
  // Генерируем 128 бит энтропии для 12 слов
  return bip39.generateMnemonic(128)
}

/**
 * Конвертирует мнемоническую фразу в seed (512 бит)
 * @param mnemonic - Мнемоническая фраза
 * @param useCache - Использовать кеш (по умолчанию true)
 * @param wordlist - Wordlist для мнемоники (опционально, определяется автоматически)
 * @returns Seed (512 бит Buffer)
 */
export function mnemonicToSeed(mnemonic: Mnemonic, useCache: boolean = true, wordlist?: string[]): Seed {
  if (!mnemonic) {
    throw new Error('Mnemonic is required')
  }

  const normalized = mnemonic.toLowerCase().trim()

  // Проверка кеша
  if (useCache && seedCache.has(normalized)) {
    return seedCache.get(normalized)!
  }

  // Получаем bip39russian из валидатора (если он там загружен)
  const bip39Russian = getBip39Russian()

  // Определяем wordlist если не указан
  const detectedWordlist = wordlist || detectMnemonicWordlist(normalized)

  // Валидация мнемоники с правильным wordlist
  if (detectedWordlist === null) {
    // Если wordlist не определен, пробуем стандартную валидацию
    if (!validateMnemonic(normalized)) {
      throw new Error('Invalid mnemonic phrase')
    }
  } else {
    // Валидируем с определенным wordlist
    const isValid = detectedWordlist
      ? bip39.validateMnemonic(normalized, detectedWordlist)
      : bip39.validateMnemonic(normalized)

    if (!isValid) {
      throw new Error('Invalid mnemonic phrase')
    }
  }

  // Генерация seed через PBKDF2 (2048 итераций)
  // Если используется русский wordlist и доступен bip39russian, используем его
  let seed: Seed
  if (bip39Russian && bip39Russian.mnemonicToSeedSync && detectedWordlist) {
    // Проверяем, является ли это русским wordlist
    const isRussian = detectedWordlist === bip39Russian.wordlists?.russian
    if (isRussian) {
      seed = bip39Russian.mnemonicToSeedSync(normalized)
    } else {
      seed = bip39.mnemonicToSeedSync(normalized)
    }
  } else {
    seed = bip39.mnemonicToSeedSync(normalized)
  }

  // Сохранение в кеш
  if (useCache) {
    seedCache.set(normalized, seed)
  }

  return seed
}

/**
 * Генерирует ключевую пару из seed по BIP32 пути
 * @param seed - Seed из мнемоники
 * @param derivationPath - BIP32 путь (по умолчанию m/44'/0'/0'/0')
 * @param useCache - Использовать кеш (по умолчанию true)
 * @returns Ключевая пара
 */
export function seedToKeyPair(
  seed: Seed,
  derivationPath: string = getMainAddressPath(0),
  useCache: boolean = true
): KeyPair {
  if (!seed || !Buffer.isBuffer(seed)) {
    throw new Error('Valid seed is required')
  }

  const cacheKey = `${seed.toString('hex')}:${derivationPath}`

  // Проверка кеша
  if (useCache && keyPairCache.has(cacheKey)) {
    return keyPairCache.get(cacheKey)!
  }

  try {
    // Проверяем, что BIP32 инициализирован
    if (!BIP32 || typeof BIP32.fromSeed !== 'function') {
      throw new Error('BIP32 is not properly initialized. fromSeed is not a function.')
    }

    // Создаем корневой узел BIP32 из seed с сетью Pocketnet
    const root = BIP32.fromSeed(seed, POCKETNET_NETWORK)

    // Деривируем по указанному пути
    const derived = root.derivePath(derivationPath)

    // ВАЖНО: Используем .toWIF() как в оригинальном коде Pocketnet
    // Это критично для совместимости с оригинальным приложением
    // Оригинальный код: bitcoin.bip32.fromSeed(seed).derivePath(path).toWIF()
    if (!derived.privateKey) {
      throw new Error('Failed to derive private key from BIP32 node')
    }

    // Получаем WIF из BIP32 узла (как в оригинале)
    // Если метод toWIF() существует, используем его, иначе создаем ECPair и получаем WIF
    let wif: string
    if (typeof derived.toWIF === 'function') {
      // Старая версия BIP32 с методом toWIF()
      wif = derived.toWIF()
    } else {
      // Новая версия BIP32 - создаем ECPair из приватного ключа и получаем WIF
      const privateKeyRaw = derived.privateKey
      // Конвертируем в Uint8Array для ECPair
      const privateKeyArray = Buffer.isBuffer(privateKeyRaw)
        ? new Uint8Array(privateKeyRaw)
        : privateKeyRaw instanceof Uint8Array
        ? privateKeyRaw
        : new Uint8Array(privateKeyRaw)
      // ВАЖНО: Используем сеть Pocketnet для генерации WIF
      const tempEcPair = ECPair.fromPrivateKey(privateKeyArray, { network: POCKETNET_NETWORK })
      wif = tempEcPair.toWIF()
    }

    // Создаем ECPair из WIF с сетью Pocketnet (как в оригинале: bitcoin.ECPair.fromWIF(d))
    const ecPair = ECPair.fromWIF(wif, POCKETNET_NETWORK)

    // Получаем приватный и публичный ключи из ECPair
    const privateKey = Buffer.isBuffer(ecPair.privateKey)
      ? ecPair.privateKey
      : Buffer.from(ecPair.privateKey as Uint8Array)
    const publicKey = Buffer.isBuffer(ecPair.publicKey)
      ? ecPair.publicKey
      : Buffer.from(ecPair.publicKey as Uint8Array)

    const keyPair: KeyPair = {
      privateKey,
      publicKey,
      ecPair,
    }

    // Сохранение в кеш
    if (useCache) {
      keyPairCache.set(cacheKey, keyPair)
    }

    return keyPair
  } catch (error) {
    throw new Error(`Failed to generate key pair: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Генерирует ключевую пару из мнемонической фразы
 * @param mnemonic - Мнемоническая фраза
 * @param options - Опции генерации
 * @returns Результат генерации с мнемоникой, seed и ключевой парой
 */
export function generateKeyPairFromMnemonic(
  mnemonic: Mnemonic,
  options: KeyGenerationOptions = {}
): KeyPair {
  const { useCache = true, derivationPath = getMainAddressPath(0) } = options

  // Конвертируем мнемонику в seed
  const seed = mnemonicToSeed(mnemonic, useCache)

  // Генерируем ключевую пару из seed
  return seedToKeyPair(seed, derivationPath, useCache)
}

/**
 * Полная генерация: создает новую мнемонику и ключевую пару
 * @param options - Опции генерации
 * @returns Результат генерации
 */
export function generateKeys(
  options: KeyGenerationOptions = {}
): KeyGenerationResult {
  const { useCache = true, derivationPath = getMainAddressPath(0) } = options

  // Генерируем новую мнемоническую фразу
  const mnemonic = generateMnemonic()

  // Конвертируем в seed
  const seed = mnemonicToSeed(mnemonic, useCache)

  // Генерируем ключевую пару
  const keyPair = seedToKeyPair(seed, derivationPath, useCache)

  return {
    mnemonic,
    seed,
    keyPair,
  }
}

/**
 * Очищает кеш ключей и seed
 */
export function clearKeyCache(): void {
  seedCache.clear()
  keyPairCache.clear()
}
