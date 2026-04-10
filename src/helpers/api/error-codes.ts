/**
 * Structured error codes for API responses.
 * Replaces fragile string matching against raw error messages.
 *
 * Usage:
 *   import { API_ERROR, matchApiError } from '@/helpers/api/error-codes'
 *   const code = matchApiError(errorMessage)
 *   if (code === API_ERROR.IP_LIMIT) { ... }
 */

export const API_ERROR = {
  NO_PROXY_WITH_WALLET: 'noproxywithwallet',
  GENERIC_ERROR: 'error',
  IP_LIMIT: 'iplimit',
  UNIQUE_VIOLATION: 'uniq',
  CAPTCHA_REQUIRED: 'captcha',
  DOUBLE_SCORE: 'DoubleScore',
  BLOCKING: 'Blocking',
  NOT_FOUND: 'NotFound',
  MEMPOOL_CONFLICT: 'MempoolConflict',
  TIMEOUT: 'timeout',
} as const

export type ApiErrorCode = typeof API_ERROR[keyof typeof API_ERROR]

/** Registration-blocking error codes that the user cannot resolve by retrying. */
const REGISTRATION_BLOCKING_ERRORS: ReadonlySet<string> = new Set([
  API_ERROR.NO_PROXY_WITH_WALLET,
  API_ERROR.GENERIC_ERROR,
  API_ERROR.IP_LIMIT,
  API_ERROR.UNIQUE_VIOLATION,
])

/**
 * Match an error message string to a known API error code.
 * Returns the matched code or null if no match.
 */
export function matchApiError(message: string): ApiErrorCode | null {
  if (!message) return null
  const lower = message.toLowerCase()
  for (const code of Object.values(API_ERROR)) {
    if (lower.includes(code.toLowerCase())) return code
  }
  return null
}

/**
 * Returns true if the error message indicates a registration-blocking error.
 */
export function isRegistrationBlockingError(message: string): boolean {
  return REGISTRATION_BLOCKING_ERRORS.has(message)
}

/**
 * Returns true if the error message indicates a captcha is required.
 */
export function isCaptchaError(message: string): boolean {
  return message.toLowerCase().includes(API_ERROR.CAPTCHA_REQUIRED)
}
