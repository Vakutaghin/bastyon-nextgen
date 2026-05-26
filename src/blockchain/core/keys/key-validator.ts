/**
 * Валидация ключей и мнемонических фраз
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'

import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import type { Mnemonic, PrivateKey, PrivateKeyFormat } from '../../types/keys'
import { bip39, loadBip39Russian, getBip39Russian, isBip39RussianLoaded } from './bip39-loader'
import { logger } from '@/services/logger'

// Re-export для обратной совместимости
export { loadBip39Russian, getBip39Russian }

const log = logger.scope('[key-validator]')

// Инициализируем ECPair
const ECPair = ECPairFactory(ecc)

// Проверяем, что bip39 правильно импортирован
if (!bip39 || typeof bip39.validateMnemonic !== 'function') {
  log.error('bip39 import failed!', { bip39Type: typeof bip39 })
}

/**
 * Валидирует мнемоническую фразу BIP39 с автоматическим определением языка
 * Пробует разные wordlists (английский, русский и другие)
 * @param mnemonic - Мнемоническая фраза для проверки
 * @returns true если валидна, false иначе
 */
export function validateMnemonic(mnemonic: Mnemonic): boolean {
  if (!mnemonic || typeof mnemonic !== 'string') {
    log.warn('Invalid input:', typeof mnemonic)
    return false
  }

  if (!bip39 || typeof bip39.validateMnemonic !== 'function') {
    log.error('bip39 not properly imported!', typeof bip39)
    return false
  }

  try {
    const normalized = mnemonic.toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ')
    log.debug('Validating mnemonic (length:', normalized.split(/\s+/).length, 'words)')

    const bip39Russian = getBip39Russian()

    if (!isBip39RussianLoaded()) {
      loadBip39Russian().catch(() => {})
    }

    if (bip39Russian && bip39Russian.validateMnemonic) {
      try {
        const result = bip39Russian.validateMnemonic(normalized)
        log.debug('bip39Russian result:', result)
        if (result) return true
      } catch (e) {
        log.debug('bip39Russian error:', e)
      }
    } else if (!isBip39RussianLoaded()) {
      // Попытка eager-загрузки через loadBip39Russian уже запущена выше
    }

    // Сначала пробуем с явным английским wordlist
    const wl = bip39.wordlists || {}
    if (wl.english && Array.isArray(wl.english)) {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, wl.english)
          return true
        }
        if (bip39.validateMnemonic(normalized, wl.english)) return true
      } catch (e) {
        log.debug('English wordlist (explicit) failed:', e)
      }
    }
    if (wl.EN && Array.isArray(wl.EN)) {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, wl.EN)
          return true
        }
        if (bip39.validateMnemonic(normalized, wl.EN)) return true
      } catch {
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
      } catch {
        // пробуем validateMnemonic
      }
      const result = bip39.validateMnemonic(normalized)
      log.debug('Standard validation result:', result)
      if (result) return true
      if (wl.english && bip39.validateMnemonic(normalized, wl.english)) return true
      if (wl.EN && bip39.validateMnemonic(normalized, wl.EN)) return true
    } catch (e) {
      log.warn('Standard validation error:', e)
    }

    // Русский wordlist из bip39russian
    const russianWlFresh = getBip39Russian()?.wordlists?.russian
    if (russianWlFresh && Array.isArray(russianWlFresh)) {
      try {
        if (bip39.mnemonicToEntropy) {
          bip39.mnemonicToEntropy(normalized, russianWlFresh)
          return true
        }
        if (bip39.validateMnemonic(normalized, russianWlFresh)) return true
      } catch {
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

    return false
  } catch (error) {
    log.error('Validation error:', error)
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
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0)

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

      case 'hex': {
        const buffer = Buffer.from(privateKey, 'hex')
        // Проверяем что это валидный приватный ключ (32 байта)
        return buffer.length === 32
      }

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
    const bip39Russian = getBip39Russian()

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
        if (bip39.mnemonicToEntropy?.(normalized, bip39Russian.wordlists.russian))
          return bip39Russian.wordlists.russian
        if (bip39.validateMnemonic(normalized, bip39Russian.wordlists.russian))
          return bip39Russian.wordlists.russian
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
  return mnemonic.toLowerCase().trim().split(/\s+/).join(' ')
}
