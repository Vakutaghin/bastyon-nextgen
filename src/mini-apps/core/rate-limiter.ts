/**
 * Rate limiter для action-вызовов миниапп (этап 8).
 *
 * Token bucket per `(appId, rateLimitClass)`. На каждый RPC-вызов action'а
 * `ActionRegistry.execute` пытается списать 1 токен; если бакет пуст —
 * выбрасывает `RateLimitExceededError` с подсказкой `retryAfterMs`.
 *
 * Классы соответствуют [actions/types.ts:14](../actions/types.ts):
 * - `cheap`     — appinfo / getLocale / userstate (read-only локальные данные)
 * - `normal`    — большинство actions (chat.send, content.openPost, ...)
 * - `expensive` — RPC (любой node-call), payment, barteron tx-actions
 *
 * Конкретные числа подобраны так, чтобы добропорядочные миниаппы не упирались
 * (Barteron при загрузке каталога делает ~50 RPC за секунду — это
 * `expensive: capacity 60, refill 10/s`), но runaway loop в один поток
 * быстро выберет лимит. Если в проде понадобится тюнинг — передать опции
 * в `new RateLimiter({classes: {...}})`.
 */

import type { RateLimitClass } from '../actions/types'

export interface BucketConfig {
  /** Сколько токенов помещается. */
  readonly capacity: number
  /** Скорость восполнения, токенов в секунду. */
  readonly refillPerSec: number
}

export const DEFAULT_RATE_LIMITS: Record<RateLimitClass, BucketConfig> = {
  cheap: { capacity: 60, refillPerSec: 30 },
  normal: { capacity: 30, refillPerSec: 10 },
  expensive: { capacity: 60, refillPerSec: 10 },
}

export class RateLimitExceededError extends Error {
  readonly code = 'rate_limit_exceeded'
  constructor(public readonly retryAfterMs: number) {
    super(`rate_limit_exceeded: retry after ${retryAfterMs}ms`)
    this.name = 'RateLimitExceededError'
  }
}

interface BucketState {
  tokens: number
  lastRefillMs: number
}

export interface RateLimiterOptions {
  classes?: Partial<Record<RateLimitClass, BucketConfig>>
  /** Внедряется в тестах для детерминированности. */
  now?: () => number
}

export class RateLimiter {
  private readonly config: Record<RateLimitClass, BucketConfig>
  private readonly buckets = new Map<string, BucketState>()
  private readonly now: () => number

  constructor(opts: RateLimiterOptions = {}) {
    this.config = {
      cheap: { ...DEFAULT_RATE_LIMITS.cheap, ...(opts.classes?.cheap ?? {}) },
      normal: { ...DEFAULT_RATE_LIMITS.normal, ...(opts.classes?.normal ?? {}) },
      expensive: {
        ...DEFAULT_RATE_LIMITS.expensive,
        ...(opts.classes?.expensive ?? {}),
      },
    }
    this.now = opts.now ?? (() => Date.now())
  }

  /**
   * Пытается списать 1 токен для `(appId, cls)`. При успехе — `undefined`.
   * При исчерпании бакета — выбрасывает `RateLimitExceededError`.
   */
  consume(appId: string, cls: RateLimitClass): void {
    const cfg = this.config[cls]
    const key = `${appId}:${cls}`
    const now = this.now()
    const state = this.buckets.get(key) ?? { tokens: cfg.capacity, lastRefillMs: now }

    // Refill
    const elapsedSec = (now - state.lastRefillMs) / 1000
    const refilled = Math.min(cfg.capacity, state.tokens + elapsedSec * cfg.refillPerSec)
    state.tokens = refilled
    state.lastRefillMs = now

    if (state.tokens >= 1) {
      state.tokens -= 1
      this.buckets.set(key, state)
      return
    }

    // Empty bucket — сохраняем для следующего refill и кидаем
    this.buckets.set(key, state)
    const needed = 1 - state.tokens
    const retryAfterMs = Math.ceil((needed / cfg.refillPerSec) * 1000)
    throw new RateLimitExceededError(retryAfterMs)
  }

  /** Сбрасывает все buckets. Используется в тестах и при unload. */
  reset(): void {
    this.buckets.clear()
  }
}
