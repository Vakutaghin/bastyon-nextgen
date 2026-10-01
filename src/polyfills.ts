// Polyfills для работы криптобиблиотек в браузере.
// Загружаются ПЕРВЫМИ в main.ts перед остальными модулями.
//
// До 2026-05 эта же логика дублировалась в main.js и inline-скрипте в index.html.
// Консолидация (CODE_AUDIT.md §10/§7) позволяет:
//   - убрать 'unsafe-inline' из CSP script-src (см. index.html);
//   - удалить дубли;
//   - выровнять Buffer/process под единый источник.
//
// Buffer    — bip39, bn.js, bs58, bitcoin-libs.
// process   — btc17.js (вендорный CommonJS).
//
// Глобальные типы process/Buffer уже декларируются @types/node транзитивно
// (через matrix-js-sdk и др.), поэтому используем точечные касты вместо `declare global`
// — иначе TS-конфликт subsequent declarations.

import { Buffer as BufferImpl } from 'buffer'

type ProcessShim = {
  env: Record<string, string | undefined>
  browser: boolean
  version: string
  nextTick: (cb: () => void) => void
}

// Каст через unknown — @types/node транзитивно задаёт `process: Process` на globalThis,
// что несовместимо с нашим частичным shim'ом. Полный Process нам не нужен (только env/nextTick),
// поэтому осознанно «расширяем» тип.
const g = globalThis as unknown as Record<string, unknown>
const w: Record<string, unknown> | undefined =
  typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined

// Код приложения начал выполняться. public/compat-check.js показывает экран
// «приложение не запустилось», только если до этой строки дело не дошло:
// движок не разобрал бандл или упал на нём.
g.__bastyonBooted = true

if (!g.Buffer) g.Buffer = BufferImpl
if (w && !w.Buffer) w.Buffer = BufferImpl

if (typeof g.process === 'undefined') {
  const processPolyfill: ProcessShim = {
    env: {},
    browser: true,
    version: 'v16.0.0',
    nextTick: (cb) => {
      setTimeout(cb, 0)
    },
  }
  g.process = processPolyfill
  if (w) w.process = processPolyfill
}

// crypto.randomUUID: в Safari с 15.4, в Chromium с 92, а приложение работает с
// Safari 15 и Chromium 89 (OLDEST_ENGINES в vite.config.js). Без него, например,
// не начиналось сохранение файла из IPFS. Остальные функции новее движка
// дописывает plugin-legacy, но Web Crypto он не знает.
const webCrypto = g.crypto as Partial<Crypto> | undefined
if (
  webCrypto &&
  typeof webCrypto.getRandomValues === 'function' &&
  typeof webCrypto.randomUUID !== 'function'
) {
  const getRandomValues = webCrypto.getRandomValues.bind(webCrypto)
  Object.defineProperty(webCrypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
      const b = getRandomValues(new Uint8Array(16))
      b[6] = (b[6]! & 0x0f) | 0x40
      b[8] = (b[8]! & 0x3f) | 0x80
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
    },
  })
}

// Ранние глобальные обработчики ошибок — ловят падения ДО монтирования Vue
// (на стадии evaluate других модулей). `installGlobalErrorHandler(app)` ниже
// делает то же самое и добавляет Vue-handler, но регистрируется позже.
// Дублирование безопасно: оба пишут разными префиксами в console.error.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e: ErrorEvent) => {
    console.error('[window.error]', e.message, e.filename, e.lineno, e.colno, e.error)
  })
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    console.error('[unhandledrejection]', e.reason)
  })
}
