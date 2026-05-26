import { describe, expect, it } from 'vitest'
import { RateLimiter, RateLimitExceededError } from './rate-limiter'

describe('RateLimiter', () => {
  it('allows up to capacity tokens in burst, then rejects', () => {
    const now = 1000
    const rl = new RateLimiter({
      classes: { cheap: { capacity: 3, refillPerSec: 1 } },
      now: () => now,
    })

    rl.consume('app1', 'cheap')
    rl.consume('app1', 'cheap')
    rl.consume('app1', 'cheap')

    expect(() => rl.consume('app1', 'cheap')).toThrow(RateLimitExceededError)
  })

  it('refills tokens over time', () => {
    let now = 0
    const rl = new RateLimiter({
      classes: { normal: { capacity: 2, refillPerSec: 2 } }, // 1 токен / 500мс
      now: () => now,
    })

    rl.consume('a', 'normal')
    rl.consume('a', 'normal')
    expect(() => rl.consume('a', 'normal')).toThrow(RateLimitExceededError)

    now += 600 // > 1 токена
    rl.consume('a', 'normal')
  })

  it('reports retryAfterMs in error', () => {
    const now = 0
    const rl = new RateLimiter({
      classes: { expensive: { capacity: 1, refillPerSec: 1 } },
      now: () => now,
    })

    rl.consume('x', 'expensive')

    try {
      rl.consume('x', 'expensive')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitExceededError)
      expect((e as RateLimitExceededError).retryAfterMs).toBeGreaterThan(0)
      expect((e as RateLimitExceededError).retryAfterMs).toBeLessThanOrEqual(1000)
    }
  })

  it('isolates buckets per appId', () => {
    const now = 0
    const rl = new RateLimiter({
      classes: { cheap: { capacity: 1, refillPerSec: 0.1 } },
      now: () => now,
    })

    rl.consume('app1', 'cheap')
    // app1 пуст, но app2 не затронут
    rl.consume('app2', 'cheap')
    expect(() => rl.consume('app1', 'cheap')).toThrow(RateLimitExceededError)
  })

  it('isolates buckets per class', () => {
    const now = 0
    const rl = new RateLimiter({
      classes: {
        cheap: { capacity: 1, refillPerSec: 0.1 },
        expensive: { capacity: 1, refillPerSec: 0.1 },
      },
      now: () => now,
    })

    rl.consume('app', 'cheap')
    // cheap пуст, expensive ещё нет
    rl.consume('app', 'expensive')
    expect(() => rl.consume('app', 'cheap')).toThrow(RateLimitExceededError)
  })

  it('reset() clears state', () => {
    const now = 0
    const rl = new RateLimiter({
      classes: { cheap: { capacity: 1, refillPerSec: 0.1 } },
      now: () => now,
    })

    rl.consume('a', 'cheap')
    expect(() => rl.consume('a', 'cheap')).toThrow()

    rl.reset()
    rl.consume('a', 'cheap') // снова работает
  })
})
