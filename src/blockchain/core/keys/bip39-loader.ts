/**
 * Shared BIP39 module loading and initialization.
 * Centralizes bip39 + bip39russian imports so that key-validator.ts
 * and key-generator.ts don't duplicate the same bootstrap code.
 */

import * as bip39Module from 'bip39'

// Получаем bip39 из модуля (может быть default или namespace)
export const bip39 = (bip39Module as any).default || bip39Module

// --- bip39russian lazy-loading ---

let bip39Russian: any = null
let bip39RussianLoaded = false

/**
 * Асинхронно загружает bip39russian модуль (ленивая загрузка)
 */
export async function loadBip39Russian(): Promise<any> {
  if (bip39RussianLoaded) {
    return bip39Russian
  }

  try {
    if (typeof require !== 'undefined') {
      bip39Russian = require('bip39russian')
      bip39RussianLoaded = true
      return bip39Russian
    }
  } catch {
    // require не доступен или не работает
  }

  try {
    const module = await import('bip39russian')
    bip39Russian = module.default || module
    bip39RussianLoaded = true
    return bip39Russian
  } catch {
    bip39RussianLoaded = true // Помечаем как загруженный, чтобы не пробовать снова
    return null
  }
}

/** Возвращает загруженный экземпляр bip39russian (или null) */
export function getBip39Russian(): any {
  return bip39Russian
}

/** Загружен ли bip39russian */
export function isBip39RussianLoaded(): boolean {
  return bip39RussianLoaded
}

// --- Eager init ---

// Пробуем загрузить синхронно при инициализации (для Node.js)
try {
  if (typeof require !== 'undefined') {
    bip39Russian = require('bip39russian')
    bip39RussianLoaded = true
  }
} catch {
  // Игнорируем ошибки
}

// Также пробуем загрузить через динамический импорт сразу (для браузера)
if (!bip39RussianLoaded && typeof window !== 'undefined') {
  import('bip39russian')
    .then((module) => {
      bip39Russian = module.default || module
      bip39RussianLoaded = true
    })
    .catch(() => {
      bip39RussianLoaded = true
      bip39Russian = null
    })
}
