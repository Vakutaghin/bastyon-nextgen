import { describe, it, expect } from 'vitest'

import { isUserVerified } from './is-user-verified'

describe('isUserVerified', () => {
  it('нет профиля → false', () => {
    expect(isUserVerified(null)).toBe(false)
    expect(isUserVerified(undefined)).toBe(false)
    expect(isUserVerified({})).toBe(false)
  })
  it('бейджи verificated / verified', () => {
    expect(isUserVerified({ badges: ['verificated'] })).toBe(true)
    expect(isUserVerified({ badges: ['shark', 'verified'] })).toBe(true)
    expect(isUserVerified({ badges: ['shark'] })).toBe(false)
  })
  it('flags.real / real в любом из принятых представлений', () => {
    expect(isUserVerified({ flags: { real: 1 } })).toBe(true)
    expect(isUserVerified({ flags: { real: '1' } })).toBe(true)
    expect(isUserVerified({ real: true })).toBe(true)
    expect(isUserVerified({ real: 'true' })).toBe(true)
    expect(isUserVerified({ flags: { real: 0 } })).toBe(false)
    expect(isUserVerified({ flags: null, real: '0' })).toBe(false)
  })
  it('пустой массив бейджей не блокирует проверку по флагу (фикс ленты/post-mapper)', () => {
    expect(isUserVerified({ badges: [], flags: { real: 1 } })).toBe(true)
    expect(isUserVerified({ badges: [], flags: {} })).toBe(false)
  })
})
