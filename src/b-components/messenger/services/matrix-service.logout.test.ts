// N21: остановка клиента отзывает серверную сессию (best-effort, с таймаутом).

import { describe, expect, it, vi } from 'vitest'

import { MatrixService } from './matrix-service'

describe('MatrixService.revokeSession (N21)', () => {
  it('вызывает client.logout(false) и резолвится true', async () => {
    const logout = vi.fn(async () => ({}))
    await expect(MatrixService.revokeSession({ logout })).resolves.toBe(true)
    expect(logout).toHaveBeenCalledWith(false)
  })

  it('без клиента / без logout — false, без исключений', async () => {
    await expect(MatrixService.revokeSession(null)).resolves.toBe(false)
    await expect(MatrixService.revokeSession({})).resolves.toBe(false)
  })

  it('зависший logout не блокирует: таймаут → false', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = MatrixService.revokeSession({ logout: () => new Promise(() => {}) }, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
