/**
 * Подавляет шум `console.log` и приглушает matrix-js-sdk logger.
 *
 * Раскрыть обратно:
 *   localStorage.setItem('debug', '1') + reload,
 *   или открыть приложение с `?debug=1` в URL.
 *
 * Импортируется ПЕРВЫМ в `main.ts`, чтобы зацепить и boot-time логи модулей.
 *
 * Намеренно НЕ глушим `console.info` и `console.debug` — DevTools по умолчанию их прячет,
 * но при включении уровней они помогают диагностике. `console.log` — основной источник
 * мусора (legacy `console.log('foo')` из вендоров). См. CODE_AUDIT.md §7.
 */

// @ts-expect-error — deep import has no types but resolves at runtime.
import { logger as matrixLogger } from 'matrix-js-sdk/lib/logger'

function shouldKeepVerbose(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (/\bdebug=1\b/.test(window.location.search)) return true
    return localStorage.getItem('debug') === '1'
  } catch {
    return false
  }
}

const NOISY_WARN_PATTERNS: RegExp[] = [
  /^Adding default global (override|underride) push rule/,
  /^Module ".+" has been externalized for browser compatibility/,
]

if (!shouldKeepVerbose()) {
  const noop = () => {}
  // eslint-disable-next-line no-console
  console.log = noop

  // Filter known-noisy `console.warn` patterns; keep real warnings.
  const origWarn = console.warn.bind(console)
  console.warn = (...args: unknown[]) => {
    const first = args[0]
    if (typeof first === 'string') {
      for (const re of NOISY_WARN_PATTERNS) {
        if (re.test(first)) return
      }
    }
    origWarn(...args)
  }

  // matrix-js-sdk uses loglevel under the hood; bump it to ERROR.
  try {
    ;(matrixLogger as { setLevel?: (lvl: string) => void }).setLevel?.('error')
  } catch {
    // ignore — logger may be missing in some matrix-js-sdk versions
  }
}
