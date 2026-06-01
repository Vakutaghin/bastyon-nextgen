/**
 * Shared BIP39 module loading and initialization.
 * Centralizes bip39 + bip39russian imports so that key-validator.ts
 * and key-generator.ts don't duplicate the same bootstrap code.
 */

import * as bip39Module from 'bip39'

/** Публичный API модуля bip39 (namespace или default-экспорт). */
export type Bip39Module = typeof import('bip39')

/**
 * bip39russian — форк bip39 с тем же API плюс русский wordlist.
 * Описываем только используемые поля поверх базового модуля.
 */
export type Bip39RussianModule = Bip39Module & {
  wordlists?: Bip39Module['wordlists'] & { russian?: string[] }
}

// Получаем bip39 из модуля (может быть default или namespace)
export const bip39: Bip39Module =
  (bip39Module as { default?: Bip39Module }).default || bip39Module

// --- bip39russian lazy-loading ---

let bip39Russian: Bip39RussianModule | null = null
let bip39RussianLoaded = false

/**
 * Асинхронно загружает bip39russian модуль (ленивая загрузка)
 */
export async function loadBip39Russian(): Promise<Bip39RussianModule | null> {
  if (bip39RussianLoaded) {
    return bip39Russian
  }

  try {
    if (typeof require !== 'undefined') {
      bip39Russian = require('bip39russian') as Bip39RussianModule
      bip39RussianLoaded = true
      return bip39Russian
    }
  } catch {
    // require не доступен или не работает
  }

  try {
    const mod = (await import('bip39russian')) as { default?: Bip39RussianModule }
    bip39Russian = mod.default ?? (mod as unknown as Bip39RussianModule)
    bip39RussianLoaded = true
    return bip39Russian
  } catch {
    bip39RussianLoaded = true // Помечаем как загруженный, чтобы не пробовать снова
    return null
  }
}

/** Возвращает загруженный экземпляр bip39russian (или null) */
export function getBip39Russian(): Bip39RussianModule | null {
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
    bip39Russian = require('bip39russian') as Bip39RussianModule
    bip39RussianLoaded = true
  }
} catch {
  // Игнорируем ошибки
}

// Также пробуем загрузить через динамический импорт сразу (для браузера)
if (!bip39RussianLoaded && typeof window !== 'undefined') {
  import('bip39russian')
    .then((mod) => {
      const m = mod as { default?: Bip39RussianModule }
      bip39Russian = m.default ?? (m as unknown as Bip39RussianModule)
      bip39RussianLoaded = true
    })
    .catch(() => {
      bip39RussianLoaded = true
      bip39Russian = null
    })
}
