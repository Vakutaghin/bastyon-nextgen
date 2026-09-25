import { describe, it, expect } from 'vitest'
import { API_ERROR, isRegistrationBlockingError, isCaptchaError } from './error-codes'

describe('isRegistrationBlockingError', () => {
  it('returns true for noproxywithwallet', () => {
    expect(isRegistrationBlockingError(API_ERROR.NO_PROXY_WITH_WALLET)).toBe(true)
  })

  it('returns true for "error"', () => {
    expect(isRegistrationBlockingError(API_ERROR.GENERIC_ERROR)).toBe(true)
  })

  it('returns true for "iplimit"', () => {
    expect(isRegistrationBlockingError(API_ERROR.IP_LIMIT)).toBe(true)
  })

  it('returns true for "uniq"', () => {
    expect(isRegistrationBlockingError(API_ERROR.UNIQUE_VIOLATION)).toBe(true)
  })

  it('returns false for non-blocking error codes', () => {
    expect(isRegistrationBlockingError(API_ERROR.CAPTCHA_REQUIRED)).toBe(false)
    expect(isRegistrationBlockingError(API_ERROR.DOUBLE_SCORE)).toBe(false)
    expect(isRegistrationBlockingError(API_ERROR.TIMEOUT)).toBe(false)
  })

  it('returns false for arbitrary string', () => {
    expect(isRegistrationBlockingError('random string')).toBe(false)
  })
})

describe('isCaptchaError', () => {
  it('detects captcha error message', () => {
    expect(isCaptchaError('captcha')).toBe(true)
  })

  it('detects captcha in mixed-case message', () => {
    expect(isCaptchaError('CAPTCHA required please solve')).toBe(true)
  })

  it('returns false for non-captcha messages', () => {
    expect(isCaptchaError('timeout error')).toBe(false)
  })
})
