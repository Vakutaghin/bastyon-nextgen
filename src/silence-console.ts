/**
 * Globally silences chatty console calls and quiets the matrix-js-sdk logger.
 *
 * To restore full output for debugging:
 *   localStorage.setItem('debug', '1') and reload,
 *   or open the app with `?debug=1` in the URL.
 *
 * Imported FIRST in `main.js` to take effect before any other module's
 * boot-time logs.
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
  // eslint-disable-next-line no-console
  console.info = noop
  // eslint-disable-next-line no-console
  console.debug = noop

  // Filter known-noisy `console.warn` patterns; keep real warnings.
  const origWarn = console.warn.bind(console)
  // eslint-disable-next-line no-console
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
  } catch {}
}
