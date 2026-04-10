/**
 * Logger utility with configurable log levels.
 * In production builds, debug/info are suppressed.
 *
 * Usage:
 *   import { logger } from '@/services/logger'
 *   logger.debug('[Feed]', 'loaded', items.length)
 *   logger.warn('[PendingRatings]', 'Polling error:', e)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const isProduction =
  typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'production'

const minLevel: LogLevel = isProduction ? 'warn' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel]
}

export const logger = {
  debug(...args: unknown[]): void {
    if (shouldLog('debug')) console.debug(...args)
  },

  info(...args: unknown[]): void {
    if (shouldLog('info')) console.info(...args)
  },

  warn(...args: unknown[]): void {
    if (shouldLog('warn')) console.warn(...args)
  },

  error(...args: unknown[]): void {
    if (shouldLog('error')) console.error(...args)
  },

  /** Create a scoped logger with a fixed prefix */
  scope(prefix: string) {
    return {
      debug: (...args: unknown[]) => logger.debug(prefix, ...args),
      info: (...args: unknown[]) => logger.info(prefix, ...args),
      warn: (...args: unknown[]) => logger.warn(prefix, ...args),
      error: (...args: unknown[]) => logger.error(prefix, ...args),
    }
  },
}
