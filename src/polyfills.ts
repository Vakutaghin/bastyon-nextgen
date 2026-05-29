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
