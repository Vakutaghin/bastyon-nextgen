import { describe, it, expect } from 'vitest'
import { computeAbilityGating } from './use-ability-increase'

describe('computeAbilityGating', () => {
  it('trial: достаточно баланса и репутации → не заблокировано', () => {
    const g = computeAbilityGating({ balance: 1_000_000_000, reputation: 100 }, 'trial')
    expect(g).toEqual({ balance: false, reputation: false, blocked: false })
  })

  it('trial: мало баланса → блокирует balance', () => {
    const g = computeAbilityGating({ balance: 500_000_000, reputation: 100 }, 'trial')
    expect(g.balance).toBe(true)
    expect(g.reputation).toBe(false)
    expect(g.blocked).toBe(true)
  })

  it('trial: мало репутации → блокирует reputation', () => {
    const g = computeAbilityGating({ balance: 2_000_000_000, reputation: 50 }, 'trial')
    expect(g.balance).toBe(false)
    expect(g.reputation).toBe(true)
    expect(g.blocked).toBe(true)
  })

  it('video: порог баланса ниже (5e8)', () => {
    const ok = computeAbilityGating({ balance: 500_000_000, reputation: 100 }, 'video')
    expect(ok.blocked).toBe(false)
    const blocked = computeAbilityGating({ balance: 499_999_999, reputation: 100 }, 'video')
    expect(blocked.balance).toBe(true)
  })

  it('пустое/невалидное состояние → заблокировано по обоим факторам', () => {
    expect(computeAbilityGating(null).blocked).toBe(true)
    expect(computeAbilityGating({}).balance).toBe(true)
    expect(computeAbilityGating({ balance: 'x', reputation: 'y' }).blocked).toBe(true)
  })
})
