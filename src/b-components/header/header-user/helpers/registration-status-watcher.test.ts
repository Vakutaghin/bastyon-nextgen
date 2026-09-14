// S13: поллинг статуса регистрации не бесконечен — потолок останавливает его.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getRegistrationStatus: vi.fn() }))
vi.mock('@/blockchain/api/registration-status', () => ({
  getRegistrationStatus: mocks.getRegistrationStatus,
  isRegistrationInProgress: (s: string) => s.startsWith('in_progress'),
}))

import { createRegistrationStatusWatcher } from './registration-status-watcher'

describe('createRegistrationStatusWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.getRegistrationStatus.mockReset().mockResolvedValue('in_progress_transaction')
  })
  afterEach(() => vi.useRealTimers())

  it('по потолку останавливается и зовёт onTimeout', async () => {
    const onTimeout = vi.fn()
    const onComplete = vi.fn()
    const w = createRegistrationStatusWatcher({
      onStatusUpdate: vi.fn(),
      onComplete,
      onTimeout,
      intervalMs: 1000,
      maxDurationMs: 3500,
    })
    await w.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(mocks.getRegistrationStatus).toHaveBeenCalledTimes(4) // старт + 3 тика
    await vi.advanceTimersByTimeAsync(600)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(w.isActive()).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(mocks.getRegistrationStatus).toHaveBeenCalledTimes(4)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('завершение до потолка: onComplete, onTimeout не зовётся', async () => {
    const onTimeout = vi.fn()
    const onComplete = vi.fn()
    mocks.getRegistrationStatus
      .mockResolvedValueOnce('in_progress_transaction')
      .mockResolvedValueOnce('registered')
    const w = createRegistrationStatusWatcher({
      onStatusUpdate: vi.fn(),
      onComplete,
      onTimeout,
      intervalMs: 1000,
      maxDurationMs: 10_000,
    })
    await w.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(onComplete).toHaveBeenCalledWith('registered')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
