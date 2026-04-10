/**
 * Unified retry strategy with exponential backoff.
 *
 * Usage:
 *   import { withRetry } from '@/services/retry'
 *   const data = await withRetry(() => fetchSomething(), { maxAttempts: 3 })
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number
  /** Base delay in ms (default: 1000) */
  baseDelay?: number
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number
  /** Multiplier for each subsequent attempt (default: 2) */
  factor?: number
  /** Optional predicate — return false to abort retries immediately */
  shouldRetry?: (error: unknown, attempt: number) => boolean
  /** Called on each retry (for logging) */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

/**
 * Executes `fn` with exponential backoff retries.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30_000,
    factor = 2,
    shouldRetry,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts) break
      if (shouldRetry && !shouldRetry(error, attempt)) break

      const jitter = Math.random() * 0.3 + 0.85 // 0.85–1.15
      const delay = Math.min(baseDelay * factor ** (attempt - 1) * jitter, maxDelay)

      onRetry?.(error, attempt, delay)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Helper: returns true if the error looks like a network timeout.
 */
export function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const o = err as Record<string, unknown>
  const code = o.code ?? (o.error && typeof o.error === 'object' && (o.error as Record<string, unknown>).code)
  const msg = String(o.message ?? (o.error && typeof o.error === 'object' && (o.error as Record<string, unknown>).message) ?? '')
  return code === 408 || code === 500 || /timeout/i.test(msg)
}
