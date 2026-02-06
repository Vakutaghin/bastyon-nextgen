/**
 * Валидация ключей и мнемонических фраз
 */

// Полифилл для Buffer в браузере
import { Buffer } from 'buffer'
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer
}
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer
}

// Импортируем bip39 - пробуем разные способы для совместимости
import * as bip39Module from 'bip39'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import type { Mnemonic, PrivateKey, PrivateKeyFormat } from '../../types/keys'

// Инициализируем ECPair
const ECPair = ECPairFactory(ecc)

// Получаем bip39 из модуля (может быть default или namespace)
const bip39 = (bip39Module as any).default || bip39Module

// Проверяем, что bip39 правильно импортирован
if (!bip39 || typeof bip39.validateMnemonic !== 'function') {
  console.error('[key-validator] bip39 import failed!', {
    hasDefault: !!(bip39Module as any).default,
    hasModule: !!bip39Module,
    moduleKeys: Object.keys(bip39Module || {}),
    bip39Type: typeof bip39,
    bip39Keys: bip39 ? Object.keys(bip39).slice(0, 10) : null
  })
}

// Импортируем русский wordlist если доступен
let bip39Russian: any = null
let bip39RussianLoaded = false

// Функция для загрузки bip39russian (ленивая загрузка)
export async function loadBip39Russian() {
  if (bip39RussianLoaded) {
    return bip39Russian
  }

  try {
    // Пробуем использовать require (для Node.js)
    if (typeof require !== 'undefined') {
      bip39Russian = require('bip39russian')
      bip39RussianLoaded = true
      return bip39Russian
    }
  } catch (e) {
    // require не доступен или не работает
  }

  try {
    // Пробуем динамический импорт (для браузера/ES модулей)
    const module = await import('bip39russian')
    bip39Russian = module.default || module
    bip39RussianLoaded = true
    return bip39Russian
  } catch (e) {
    console.warn('[bip39russian] Failed to load:', e)
    bip39RussianLoaded = true // Помечаем как загруженный, чтобы не пробовать снова
    return null
  }
}

// Получить загруженный экземпляр bip39russian
export function getBip39Russian() {
  return bip39Russian
}

// Пробуем загрузить синхронно при инициализации (для Node.js)
try {
  if (typeof require !== 'undefined') {
    bip39Russian = require('bip39russian')
    bip39RussianLoaded = true
  }
} catch (e) {
  // Игнорируем ошибки
}

// Также пробуем загрузить через динамический импорт сразу (для браузера)
if (!bip39RussianLoaded && typeof window !== 'undefined') {
  import('bip39russian').then((module) => {
    bip39Russian = module.default || module
    bip39RussianLoaded = true
  }).catch((e) => {
    bip39RussianLoaded = true // Помечаем как загруженный, чтобы не пробовать снова
    bip39Russian = null // Явно устанавливаем в null при ошибке
  })
}

/**
 * Валидирует мнемоническую фразу BIP39 с автоматическим определением языка
 * Пробует разные wordlists (английский, русский и другие)
 * @param mnemonic - Мнемоническая фраза для проверки
 * @returns true если валидна, false иначе
 */
export function validateMnemonic(mnemonic: Mnemonic): boolean {
  if (!mnemonic || typeof mnemonic !== 'string') {
    console.warn('[validateMnemonic] Invalid input:', typeof mnemonic)
    return false
  }

  // Проверяем, что bip39 правильно импортирован
  if (!bip39 || typeof bip39.validateMnemonic !== 'function') {
    console.error('[validateMnemonic] bip39 not properly imported!', typeof bip39, bip39)
    return false
  }

  try {
    // Нормализуем к нижнему регистру для проверки
    const normalized = mnemonic.toLowerCase().trim()
    console.debug('[validateMnemonic] Validating mnemonic (length:', normalized.split(/\s+/).length, 'words)')

    // Если доступен bip39russian, используем его как основной (как в оригинальном приложении)
    // bip39russian поддерживает и английский, и русский wordlists
    // Пробуем загрузить если еще не загружен
    if (!bip39RussianLoaded) {
      loadBip39Russian().catch(() => {})
    }

    if (bip39Russian && bip39Russian.validateMnemonic) {
      try {
        const result = bip39Russian.validateMnemonic(normalized)
        console.debug('[validateMnemonic] bip39Russian result:', result)
        if (result) {
          return true
        }
      } catch (e) {
        console.debug('[validateMnemonic] bip39Russian error:', e)
        // Игнорируем ошибки, пробуем дальше
      }
    } else {
      // Пробуем загрузить синхронно если еще не загружен
      if (!bip39RussianLoaded && typeof require !== 'undefined') {
        try {
          bip39Russian = require('bip39russian')
          bip39RussianLoaded = true
          if (bip39Russian && bip39Russian.validateMnemonic) {
            const result = bip39Russian.validateMnemonic(normalized)
            if (result) {
              return true
            }
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }
    }

    // Пробуем стандартную валидацию (английский wordlist по умолчанию)
    try {
      // Пробуем валидировать через mnemonicToEntropy (более надежный способ)
      // Если mnemonicToEntropy не выбрасывает ошибку, значит мнемоника валидна
      try {
        const entropy = bip39.mnemonicToEntropy(normalized)
        // Если mnemonicToEntropy успешно, значит мнемоника валидна
        return true
      } catch (e) {
        // Игнорируем ошибки, пробуем стандартную валидацию
      }

      // Пробуем стандартную валидацию
      const result = bip39.validateMnemonic(normalized)
      console.debug('[validateMnemonic] Standard validation result:', result)

      // Если не прошла, пробуем с явным указанием английского wordlist
      if (!result && bip39.wordlists && bip39.wordlists.english) {
        const resultWithWordlist = bip39.validateMnemonic(normalized, bip39.wordlists.english)
        console.debug('[validateMnemonic] English wordlist result:', resultWithWordlist)
        if (resultWithWordlist) {
          return true
        }
      }

      if (result) {
        return true
      }
    } catch (e) {
      console.warn('[validateMnemonic] Standard validation error:', e)
      // Игнорируем ошибки
    }

    // Пробуем русский wordlist из bip39russian напрямую через стандартный bip39
    if (bip39Russian && bip39Russian.wordlists && bip39Russian.wordlists.russian) {
      try {
        if (bip39.validateMnemonic(normalized, bip39Russian.wordlists.russian)) {
          return true
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }

    // Пробуем все доступные wordlists из стандартного bip39
    const wordlists = bip39.wordlists || {}
    const availableWordlists = Object.keys(wordlists)

    for (const lang of availableWordlists) {
      if (lang !== 'EN' && lang !== 'english' && wordlists[lang]) {
        try {
          if (bip39.validateMnemonic(normalized, wordlists[lang])) {
            return true
          }
        } catch {
          // Игнорируем ошибки
        }
      }
    }

    console.warn('[validateMnemonic] All validation attempts failed for mnemonic')
    return false
  } catch (error) {
    console.error('[validateMnemonic] Validation error:', error)
    return false
  }
}

/**
 * Определяет формат приватного ключа
 * @param privateKey - Приватный ключ в любом формате
 * @returns Формат ключа или null если не удалось определить
 */
export function detectPrivateKeyFormat(privateKey: PrivateKey): PrivateKeyFormat | null {
  if (!privateKey || typeof privateKey !== 'string') {
    return null
  }

  const normalized = privateKey.toLowerCase().trim()

  // Проверка на мнемонику (12 или 24 слова) - делаем это ПЕРВЫМ
  // чтобы не перепутать с hex или WIF
  // Мнемоника обычно содержит пробелы и состоит из слов
  const words = normalized.split(/\s+/).filter(w => w.length > 0)

  // Если это похоже на мнемонику (12-24 слова), пробуем валидировать
  if (words.length >= 12 && words.length <= 24) {
    const isValidMnemonic = validateMnemonic(normalized)
    if (isValidMnemonic) {
      return 'mnemonic'
    }
    // Если не прошла валидация, но это похоже на мнемонику, все равно возвращаем null
    // чтобы не перепутать с другими форматами
    return null
  }

  // Также пробуем валидировать даже если не 12-24 слова (может быть другая длина)
  // но только если есть пробелы (признак мнемоники)
  if (words.length > 1 && normalized.includes(' ')) {
    const isValidMnemonic = validateMnemonic(normalized)
    if (isValidMnemonic) {
      return 'mnemonic'
    }
  }

  // Проверка на WIF формат (начинается с '5', 'K', 'L' для mainnet или 'c' для testnet)
  try {
    ECPair.fromWIF(normalized)
    return 'wif'
  } catch {
    // Не WIF
  }

  // Проверка на hex формат (64 символа hex)
  const hexPattern = /^[0-9a-f]{64}$/i
  if (hexPattern.test(normalized)) {
    try {
      Buffer.from(normalized, 'hex')
      return 'hex'
    } catch {
      // Не валидный hex
    }
  }

  return null
}

/**
 * Валидирует приватный ключ в любом формате
 * @param privateKey - Приватный ключ для проверки
 * @returns true если валиден, false иначе
 */
export function validatePrivateKey(privateKey: PrivateKey): boolean {
  if (!privateKey || typeof privateKey !== 'string') {
    return false
  }

  const format = detectPrivateKeyFormat(privateKey)
  if (!format) {
    return false
  }

  try {
    switch (format) {
      case 'mnemonic':
        return validateMnemonic(privateKey)

      case 'wif':
        try {
          ECPair.fromWIF(privateKey)
          return true
        } catch {
          return false
        }

      case 'hex':
        const buffer = Buffer.from(privateKey, 'hex')
        // Проверяем что это валидный приватный ключ (32 байта)
        return buffer.length === 32

      default:
        return false
    }
  } catch (error) {
    return false
  }
}

/**
 * Определяет wordlist для мнемонической фразы
 * @param mnemonic - Мнемоническая фраза
 * @returns Wordlist или null если не удалось определить
 */
export function detectMnemonicWordlist(mnemonic: Mnemonic): any {
  if (!mnemonic || typeof mnemonic !== 'string') {
    return null
  }

  try {
    const normalized = mnemonic.toLowerCase().trim()

    // Если доступен bip39russian, пробуем его первым (как в оригинальном приложении)
    if (bip39Russian && bip39Russian.validateMnemonic) {
      try {
        if (bip39Russian.validateMnemonic(normalized)) {
          // Если валидация прошла, возвращаем русский wordlist если доступен
          if (bip39Russian.wordlists && bip39Russian.wordlists.russian) {
            return bip39Russian.wordlists.russian
          }
          return undefined // или стандартный wordlist
        }
      } catch {
        // Игнорируем ошибки
      }
    }

    const wordlists = bip39.wordlists || {}

    // Пробуем стандартный (английский) wordlist
    if (bip39.validateMnemonic(normalized)) {
      return undefined // undefined означает стандартный wordlist
    }

    // Пробуем русский wordlist из bip39russian напрямую
    if (bip39Russian && bip39Russian.wordlists && bip39Russian.wordlists.russian) {
      const russianWordlist = bip39Russian.wordlists.russian
      try {
        if (bip39.validateMnemonic(normalized, russianWordlist)) {
          return russianWordlist
        }
      } catch {
        // Игнорируем ошибки
      }
    }

    // Пробуем все доступные wordlists из стандартного bip39
    const availableWordlists = Object.keys(wordlists)

    for (const lang of availableWordlists) {
      if (lang !== 'EN' && lang !== 'english' && wordlists[lang]) {
        try {
          if (bip39.validateMnemonic(normalized, wordlists[lang])) {
            return wordlists[lang]
          }
        } catch {
          // Игнорируем ошибки
        }
      }
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Нормализует мнемоническую фразу (приводит к нижнему регистру и убирает лишние пробелы)
 * @param mnemonic - Мнемоническая фраза
 * @returns Нормализованная мнемоника
 */
export function normalizeMnemonic(mnemonic: Mnemonic): Mnemonic {
  if (!mnemonic) {
    return ''
  }
  return mnemonic
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .join(' ')
}
