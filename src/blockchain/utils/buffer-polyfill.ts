/**
 * Buffer polyfill для браузерного окружения.
 * Единая точка настройки — импортируйте этот модуль вместо ручного полифилла.
 */

import { Buffer } from 'buffer'

// Narrow shim type: only the Buffer slot we touch, without widening to `any`.
type BufferGlobal = { Buffer?: typeof Buffer }

if (typeof globalThis !== 'undefined' && !(globalThis as BufferGlobal).Buffer) {
  (globalThis as BufferGlobal).Buffer = Buffer
}
if (typeof window !== 'undefined' && !(window as unknown as BufferGlobal).Buffer) {
  (window as unknown as BufferGlobal).Buffer = Buffer
}

export { Buffer }
