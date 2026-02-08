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
  }).catch(() => {
    bip39RussianLoaded = true
    bip39Russian = null
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
    // Нормализация как в normalizeMnemonic: нижний регистр + схлопывание пробелов (bip39 разбивает по одному пробелу)
    const normalized = mnemonic.toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ')
    console.debug('[validateMnemonic] Validating mnemonic (length:', normalized.split(/\s+/).length, 'words)')

    if (!bip39RussianLoaded) {
      loadBip39Russian().catch(() => {})
    }

    if (bip39Russian && bip39Russian.validateMnemonic) {
      try {
        const result = bip39Russian.validateMnemonic(normalized)
        console.debug('[validateMnemonic] bip39Russian result:', result)
        if (result) return true
      } catch (e) {
        console.debug('[validateMnemonic] bip39Russian error:', e)
      }
    } else if (!bip39RussianLoaded && typeof require !== 'undefined') {
      try {
        bip39Russian = require('bip39russian')
        bip39RussianLoaded = true
        if (bip39Russian?.validateMnemonic?.(normalized)) return true
      } catch (e) {
        // игнорируем
      }
    }

    // Сначала пробуем с явным английским wordlist (в сборке Vite default может быть не задан или не EN)
    const wl = bip39.wordlists || {}
    if (wl.english && Array.isArray(wl.english)) {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, wl.english)
          return true
        }
        if (bip39.validateMnemonic(normalized, wl.english)) return true
      } catch (e) {
        console.debug('[validateMnemonic] English wordlist (explicit) failed:', e)
      }
    }
    if (wl.EN && Array.isArray(wl.EN)) {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, wl.EN)
          return true
        }
        if (bip39.validateMnemonic(normalized, wl.EN)) return true
      } catch (e) {
        // игнорируем
      }
    }

    // Стандартная валидация (default wordlist в bip39)
    try {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized)
          return true
        }
      } catch (e) {
        // пробуем validateMnemonic
      }
      const result = bip39.validateMnemonic(normalized)
      console.debug('[validateMnemonic] Standard validation result:', result)
      if (result) return true
      if (wl.english && bip39.validateMnemonic(normalized, wl.english)) return true
      if (wl.EN && bip39.validateMnemonic(normalized, wl.EN)) return true
    } catch (e) {
      console.warn('[validateMnemonic] Standard validation error:', e)
    }

    // Русский wordlist из bip39russian
    const russianWl = bip39Russian?.wordlists?.russian
    if (russianWl && Array.isArray(russianWl)) {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, russianWl)
          return true
        }
        if (bip39.validateMnemonic(normalized, russianWl)) return true
      } catch (e) {
        // игнорируем
      }
    }

    // Все остальные wordlists из bip39
    for (const lang of Object.keys(wl)) {
      if (lang === 'EN' || lang === 'english') continue
      const list = wl[lang]
      if (!list || !Array.isArray(list)) continue
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, list)
          return true
        }
        if (bip39.validateMnemonic(normalized, list)) return true
      } catch {
        // игнорируем
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

  const trimmed = privateKey.toLowerCase().trim()
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)

  // Проверка на мнемонику (12 или 24 слова) — нормализуем как при восстановлении (схлопывание пробелов)
  if (words.length >= 12 && words.length <= 24) {
    const normalizedMnemonic = words.join(' ')
    const isValidMnemonic = validateMnemonic(normalizedMnemonic)
    if (isValidMnemonic) {
      return 'mnemonic'
    }
    // Если не прошла валидация, но это похоже на мнемонику, все равно возвращаем null
    // чтобы не перепутать с другими форматами
    return null
  }

  if (words.length > 1 && trimmed.includes(' ')) {
    const normalizedMnemonic2 = words.join(' ')
    if (validateMnemonic(normalizedMnemonic2)) return 'mnemonic'
  }

  // Проверка на WIF формат
  try {
    ECPair.fromWIF(trimmed)
    return 'wif'
  } catch {
    // Не WIF
  }

  // Проверка на hex формат (64 символа hex)
  const hexPattern = /^[0-9a-f]{64}$/i
  if (hexPattern.test(trimmed)) {
    try {
      Buffer.from(trimmed, 'hex')
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
  if (!mnemonic || typeof mnemonic !== 'string') return null
  try {
    const normalized = normalizeMnemonic(mnemonic)
    if (!normalized) return null

    const wl = bip39.wordlists || {}

    if (bip39Russian?.validateMnemonic?.(normalized) && bip39Russian?.wordlists?.russian) {
      return bip39Russian.wordlists.russian
    }
    // Явно английский первым (как в validateMnemonic)
    if (wl.english && Array.isArray(wl.english)) {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, wl.english)
          return wl.english
        }
        if (bip39.validateMnemonic(normalized, wl.english)) return wl.english
      } catch {
        // пробуем дальше
      }
    }
    if (wl.EN && Array.isArray(wl.EN)) {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, wl.EN)
          return wl.EN
        }
        if (bip39.validateMnemonic(normalized, wl.EN)) return wl.EN
      } catch {
        // пробуем дальше
      }
    }
    try {
      if (bip39.validateMnemonic(normalized)) return undefined
    } catch {
      // пробуем дальше
    }
    if (bip39Russian?.wordlists?.russian) {
      try {
        if (bip39.mnemonicToEntropy?.(normalized, bip39Russian.wordlists.russian)) return bip39Russian.wordlists.russian
        if (bip39.validateMnemonic(normalized, bip39Russian.wordlists.russian)) return bip39Russian.wordlists.russian
      } catch {
        // игнорируем
      }
    }
    for (const lang of Object.keys(wl)) {
      if (lang === 'EN' || lang === 'english') continue
      const list = wl[lang]
      if (!list || !Array.isArray(list)) continue
      try {
        if (bip39.mnemonicToEntropy?.(normalized, list)) return list
        if (bip39.validateMnemonic(normalized, list)) return list
      } catch {
        // игнорируем
      }
    }
    return null
  } catch {
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
