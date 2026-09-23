// S18: отказ ноды «оценка своего поста» (код 5) классифицируется и показывается.

import { describe, it, expect, vi } from 'vitest'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('@/b-components/app-toast', () => ({ appToast: toast }))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { classifyVoteError, handleVoteError } from './star-rating-errors'

describe('classifyVoteError (S18)', () => {
  it('recognises SelfScore by code and by message', () => {
    expect(classifyVoteError({ error: { code: 5 } }).isSelfScore).toBe(true)
    expect(classifyVoteError({ message: 'SelfScore' }).isSelfScore).toBe(true)
    expect(classifyVoteError({ error: { code: 4 } }).isSelfScore).toBe(false)
  })

  it('still separates the other known verdicts', () => {
    expect(classifyVoteError({ error: { code: 4 } }).isDoubleScore).toBe(true)
    expect(classifyVoteError({ error: { code: 32 } }).isBlocking).toBe(true)
    expect(classifyVoteError({ error: { code: 12 } }).isNotFound).toBe(true)
  })
})

describe('handleVoteError (S18)', () => {
  it('tells the user a post of theirs cannot be rated', () => {
    toast.error.mockClear()
    const emit = vi.fn()
    handleVoteError(classifyVoteError({ error: { code: 5 } }), emit as never)
    expect(toast.error).toHaveBeenCalledWith({ message: 'postCard.ratingOwnPost' })
    expect(emit).not.toHaveBeenCalled()
  })
})
