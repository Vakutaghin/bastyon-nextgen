import { describe, it, expect, vi } from 'vitest'
import { withRetry, isTimeoutError } from './retry'

describe('withRetry', () => {
  it('succeeds on first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelay: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, { maxAttempts: 5, baseDelay: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('exhausts all retries and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelay: 1 })
    ).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('respects shouldRetry predicate and aborts early', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'))
    const shouldRetry = vi.fn().mockReturnValue(false)

    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelay: 1, shouldRetry })
    ).rejects.toThrow('fatal')
    // Called once, shouldRetry returned false so no more attempts
    expect(fn).toHaveBeenCalledTimes(1)
    expect(shouldRetry).toHaveBeenCalledTimes(1)
  })

  it('calls onRetry callback on each retry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('err'))
      .mockResolvedValue('ok')

    const onRetry = vi.fn()
    await withRetry(fn, { maxAttempts: 3, baseDelay: 1, onRetry })

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number))
  })
})

describe('isTimeoutError', () => {
  it('returns true for code 408', () => {
    expect(isTimeoutError({ code: 408 })).toBe(true)
  })

  it('returns true for code 500', () => {
    expect(isTimeoutError({ code: 500 })).toBe(true)
  })

  it('returns true for message containing "timeout"', () => {
    expect(isTimeoutError({ message: 'Request timeout exceeded' })).toBe(true)
  })

  it('returns true for nested error with timeout code', () => {
    expect(isTimeoutError({ error: { code: 408 } })).toBe(true)
  })

  it('returns true for nested error with timeout message', () => {
    expect(isTimeoutError({ error: { message: 'Connection Timeout' } })).toBe(true)
  })

  it('returns false for null/undefined', () => {
    expect(isTimeoutError(null)).toBe(false)
    expect(isTimeoutError(undefined)).toBe(false)
  })

  it('returns false for non-object values', () => {
    expect(isTimeoutError('string')).toBe(false)
    expect(isTimeoutError(42)).toBe(false)
  })

  it('returns false for unrelated error', () => {
    expect(isTimeoutError({ code: 404, message: 'Not found' })).toBe(false)
  })
})
