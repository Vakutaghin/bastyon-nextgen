/**
 * Утилиты для работы с BIP32 путями
 */

import { getMainAddressPath, getCryptoKeyPath } from '../constants/paths'

/**
 * Валидирует BIP32 путь
 * @param path - Путь для проверки
 * @returns true если валиден, false иначе
 */
export function validateBip32Path(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false
  }

  // Базовый формат BIP32 пути: m/44'/0'/0'/0'
  const bip32PathPattern = /^m(\/\d+'?)+$/
  return bip32PathPattern.test(path)
}

/**
 * Парсит BIP32 путь и возвращает компоненты
 * @param path - BIP32 путь
 * @returns Массив компонентов пути
 */
export function parseBip32Path(path: string): number[] {
  if (!validateBip32Path(path)) {
    throw new Error('Invalid BIP32 path format')
  }

  // Убираем 'm' и разбиваем по '/'
  const parts = path.substring(2).split('/')
  
  return parts.map((part) => {
    // Убираем ' если есть
    const cleanPart = part.replace(/'/g, '')
    return parseInt(cleanPart, 10)
  })
}

/**
 * Создает BIP32 путь из массива индексов
 * @param indices - Массив индексов
 * @param hardened - Массив флагов hardened (true для hardened индексов)
 * @returns BIP32 путь
 */
export function createBip32Path(indices: number[], hardened: boolean[] = []): string {
  if (indices.length === 0) {
    throw new Error('At least one index is required')
  }

  const parts = indices.map((index, i) => {
    const isHardened = hardened[i] || false
    return `${index}${isHardened ? "'" : ''}`
  })

  return `m/${parts.join('/')}`
}

/**
 * Получает родительский путь BIP32
 * @param path - BIP32 путь
 * @returns Родительский путь или null если это корневой путь
 */
export function getParentBip32Path(path: string): string | null {
  if (!validateBip32Path(path)) {
    throw new Error('Invalid BIP32 path format')
  }

  const parts = path.split('/')
  if (parts.length <= 2) {
    // Корневой путь или только 'm'
    return null
  }

  // Убираем последний компонент
  parts.pop()
  return parts.join('/')
}

/**
 * Получает последний индекс из BIP32 пути
 * @param path - BIP32 путь
 * @returns Последний индекс
 */
export function getLastIndexFromPath(path: string): number {
  if (!validateBip32Path(path)) {
    throw new Error('Invalid BIP32 path format')
  }

  const parts = path.split('/')
  const lastPart = parts[parts.length - 1]
  const cleanPart = lastPart.replace(/'/g, '')
  return parseInt(cleanPart, 10)
}

/**
 * Проверяет, является ли путь hardened (заканчивается на ')
 * @param path - BIP32 путь
 * @returns true если hardened, false иначе
 */
export function isHardenedPath(path: string): boolean {
  if (!validateBip32Path(path)) {
    return false
  }

  return path.endsWith("'")
}
