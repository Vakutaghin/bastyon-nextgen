// Полифиллы для работы криптобиблиотек в браузере
// Загружаются первыми перед остальными модулями

// Buffer — нужен для bip39 и других библиотек
import { Buffer } from 'buffer'

if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).Buffer = Buffer
}
if (typeof window !== 'undefined') {
  ;(window as any).Buffer = Buffer
}
if (typeof global !== 'undefined') {
  ;(global as any).Buffer = Buffer
}

// process — нужен для btc17.js
if (typeof process === 'undefined') {
  const processPolyfill = {
    env: {},
    browser: true,
    version: 'v16.0.0',
    nextTick: function (callback: () => void) {
      setTimeout(callback, 0)
    },
  }

  if (typeof globalThis !== 'undefined') {
    ;(globalThis as any).process = processPolyfill
  }
  if (typeof window !== 'undefined') {
    ;(window as any).process = processPolyfill
  }
  if (typeof global !== 'undefined') {
    ;(global as any).process = processPolyfill
  }
}
