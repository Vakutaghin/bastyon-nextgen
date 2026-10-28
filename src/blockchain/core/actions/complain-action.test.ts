// Право жаловаться: нода принимает флаг только от «акулы» (бейдж shark).

import { describe, expect, it, vi } from 'vitest'

import { accountCanFlag } from './complain-action'

const ME = 'PMeAddress11111111111111111111111'

describe('accountCanFlag', () => {
  it('«акула» — может, лёгкий профиль одним запросом', async () => {
    const request = vi.fn(
      async (_p: unknown): Promise<unknown> => [{ address: ME, badges: ['shark', 'moderator'] }]
    )
    expect(await accountCanFlag(ME, request as never)).toBe(true)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'getuserprofile', parameters: [[ME], '1'] })
    )
  })

  it('модератор без «акулы» и аккаунт без бейджей — нет', async () => {
    const moderator = vi.fn(async () => ({ data: [{ address: ME, badges: ['moderator'] }] }))
    const plain = vi.fn(async () => [{ address: ME }])
    expect(await accountCanFlag(ME, moderator as never)).toBe(false)
    expect(await accountCanFlag(ME, plain as never)).toBe(false)
  })

  it('профиля нет — аккаунт не зарегистрирован, нельзя', async () => {
    const request = vi.fn(async () => [])
    expect(await accountCanFlag(ME, request as never)).toBe(false)
  })

  it('нода не ответила — неизвестно, решит сеть', async () => {
    const request = vi.fn(async () => {
      throw new Error('timeout')
    })
    expect(await accountCanFlag(ME, request as never)).toBeNull()
  })
})
