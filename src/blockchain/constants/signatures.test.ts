import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SIGNATURE_VERSION,
  DEFAULT_SIGNATURE_EXPIRATION,
  DEFAULT_SIGNATURE_EXPIRATION_SHIFT,
  DEFAULT_SIGNATURE_DATA,
  MIN_SIGNATURE_EXPIRATION,
  MAX_SIGNATURE_EXPIRATION,
} from './signatures'

describe('signature constants', () => {
  it('has version 1', () => {
    expect(DEFAULT_SIGNATURE_VERSION).toBe(1)
  })

  it('has default expiration of 360 seconds', () => {
    expect(DEFAULT_SIGNATURE_EXPIRATION).toBe(360)
  })

  it('has expiration shift of 160 seconds', () => {
    expect(DEFAULT_SIGNATURE_EXPIRATION_SHIFT).toBe(160)
  })

  it('has correct signature data', () => {
    expect(DEFAULT_SIGNATURE_DATA).toBe('pocketnetproxy')
  })

  it('has min expiration of 60 seconds', () => {
    expect(MIN_SIGNATURE_EXPIRATION).toBe(60)
  })

  it('has max expiration of 24 hours', () => {
    expect(MAX_SIGNATURE_EXPIRATION).toBe(86400)
  })

  it('min < default < max', () => {
    expect(MIN_SIGNATURE_EXPIRATION).toBeLessThan(DEFAULT_SIGNATURE_EXPIRATION)
    expect(DEFAULT_SIGNATURE_EXPIRATION).toBeLessThan(MAX_SIGNATURE_EXPIRATION)
  })
})
