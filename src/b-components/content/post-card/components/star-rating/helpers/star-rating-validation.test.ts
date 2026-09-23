// S18: правила голосования не падают на пустом профиле и знают про свой пост.

import { describe, it, expect } from 'vitest'
import {
  isNewUser,
  isReputationBlocked,
  isLowRatingBlocked,
  isOwnContent,
} from './star-rating-validation'
import type { UserProfile } from '@/types/rpc-responses/user-get'

const profile = (over: Partial<UserProfile> = {}): UserProfile =>
  ({ address: 'PA', id: 1, regdate: 1, reputation: 0, ...over }) as UserProfile

describe('star-rating validation (S18)', () => {
  it('does not throw when the profile has not loaded yet', () => {
    expect(() => isLowRatingBlocked(1, null)).not.toThrow()
    expect(isLowRatingBlocked(1, null)).toBe(true)
    expect(isLowRatingBlocked(5, undefined)).toBe(false)
  })

  it('allows low stars from reputable accounts only', () => {
    expect(isLowRatingBlocked(3, profile({ reputation: 99 }))).toBe(true)
    expect(isLowRatingBlocked(3, profile({ reputation: 100 }))).toBe(false)
    expect(isLowRatingBlocked(4, profile({ reputation: 0 }))).toBe(false)
  })

  it('blocks a brand-new account and a deeply negative reputation', () => {
    expect(isNewUser(profile({ regdate: Math.floor(Date.now() / 1000) }))).toBe(true)
    expect(isNewUser(profile({ regdate: 1 }))).toBe(false)
    expect(isReputationBlocked(profile({ reputation: -12 }))).toBe(true)
    expect(isReputationBlocked(profile({ reputation: -11 }))).toBe(false)
  })

  it('recognises the user rating their own content', () => {
    expect(isOwnContent('PA', 'PA')).toBe(true)
    expect(isOwnContent('PA', 'PB')).toBe(false)
    expect(isOwnContent('', 'PA')).toBe(false)
    expect(isOwnContent('PA', null)).toBe(false)
  })
})
