import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger } from './logger'

describe('logger.scope', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an object with debug, info, warn, and error methods', () => {
    const scoped = logger.scope('[Test]')
    expect(typeof scoped.debug).toBe('function')
    expect(typeof scoped.info).toBe('function')
    expect(typeof scoped.warn).toBe('function')
    expect(typeof scoped.error).toBe('function')
  })

  it('scoped debug passes prefix to console.debug', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const scoped = logger.scope('[Feed]')
    scoped.debug('loaded', 42)
    expect(spy).toHaveBeenCalledWith('[Feed]', 'loaded', 42)
  })

  it('scoped info passes prefix to console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const scoped = logger.scope('[API]')
    scoped.info('request sent')
    expect(spy).toHaveBeenCalledWith('[API]', 'request sent')
  })

  it('scoped warn passes prefix to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scoped = logger.scope('[Ratings]')
    scoped.warn('polling error:', 'timeout')
    expect(spy).toHaveBeenCalledWith('[Ratings]', 'polling error:', 'timeout')
  })

  it('scoped error passes prefix to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const scoped = logger.scope('[Critical]')
    scoped.error('crash')
    expect(spy).toHaveBeenCalledWith('[Critical]', 'crash')
  })
})
