import { describe, it, expect, beforeEach } from 'vitest'
import {
  getBackoffDelay,
  markServerSuccess,
  markServerFailure,
  clearAllBackoffStates,
  getBackoffState,
} from './server-backoff'

beforeEach(() => {
  clearAllBackoffStates()
})

describe('getBackoffDelay', () => {
  it('returns 0 for new server', () => {
    expect(getBackoffDelay('host1', 8080)).toBe(0)
  })

  it('returns 0 after success', () => {
    markServerFailure('host1', 8080)
    markServerFailure('host1', 8080)
    markServerSuccess('host1', 8080)
    expect(getBackoffDelay('host1', 8080)).toBe(0)
  })
})

describe('markServerFailure', () => {
  it('increases fibonacci index on repeated failures', () => {
    markServerFailure('host1', 8080) // first request, sets lastRequestTime
    markServerFailure('host1', 8080) // increments to 1

    const state = getBackoffState('host1', 8080)
    expect(state).not.toBeNull()
    expect(state!.fibonacciIndex).toBe(1)
  })

  it('does not increment on first failure', () => {
    markServerFailure('host1', 8080)
    const state = getBackoffState('host1', 8080)
    expect(state!.fibonacciIndex).toBe(0)
  })

  it('increments delay progressively', () => {
    // Simulate multiple failures
    markServerFailure('h', 80)
    markServerFailure('h', 80) // index 1
    markServerFailure('h', 80) // index 2
    markServerFailure('h', 80) // index 3

    const delay = getBackoffDelay('h', 80)
    expect(delay).toBeGreaterThan(0)
  })
})

describe('markServerSuccess', () => {
  it('resets fibonacci index', () => {
    markServerFailure('host1', 8080)
    markServerFailure('host1', 8080)
    markServerFailure('host1', 8080)
    markServerSuccess('host1', 8080)

    const state = getBackoffState('host1', 8080)
    expect(state!.fibonacciIndex).toBe(0)
  })

  it('sets lastSuccessTime', () => {
    markServerSuccess('host1', 8080)
    const state = getBackoffState('host1', 8080)
    expect(state!.lastSuccessTime).not.toBeNull()
  })
})

describe('clearAllBackoffStates', () => {
  it('clears all states', () => {
    markServerFailure('host1', 8080)
    markServerFailure('host2', 9090)
    clearAllBackoffStates()

    expect(getBackoffState('host1', 8080)).toBeNull()
    expect(getBackoffState('host2', 9090)).toBeNull()
  })
})

describe('getBackoffState', () => {
  it('returns null for unknown server', () => {
    expect(getBackoffState('unknown', 1234)).toBeNull()
  })

  it('returns state for known server', () => {
    markServerFailure('host1', 8080)
    const state = getBackoffState('host1', 8080)
    expect(state).not.toBeNull()
    expect(state).toHaveProperty('fibonacciIndex')
    expect(state).toHaveProperty('lastSuccessTime')
    expect(state).toHaveProperty('lastRequestTime')
  })
})
