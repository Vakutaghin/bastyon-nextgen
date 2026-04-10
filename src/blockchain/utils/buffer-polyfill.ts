/**
 * Buffer polyfill для браузерного окружения.
 * Единая точка настройки — импортируйте этот модуль вместо ручного полифилла.
 */

import { Buffer } from 'buffer'

if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer
}
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer
}

export { Buffer }
