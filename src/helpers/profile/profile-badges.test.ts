import { describe, it, expect } from 'vitest'
import { getProfileBadges } from './profile-badges'

describe('getProfileBadges', () => {
  it('пустой для null/пустого профиля', () => {
    expect(getProfileBadges(null)).toEqual([])
    expect(getProfileBadges({})).toEqual([])
  })

  it('verified по badges', () => {
    expect(getProfileBadges({ badges: ['verificated'] })).toEqual(['verified'])
    expect(getProfileBadges({ badges: ['verified'] })).toEqual(['verified'])
  })

  it('verified по flags.real / real', () => {
    expect(getProfileBadges({ flags: { real: 1 } })).toEqual(['verified'])
    expect(getProfileBadges({ real: 'true' })).toEqual(['verified'])
  })

  it('established при reputation >= 100', () => {
    expect(getProfileBadges({ reputation: 100 })).toEqual(['established'])
    expect(getProfileBadges({ reputation: 99 })).toEqual([])
    expect(getProfileBadges({ reputation: '250' })).toEqual(['established'])
  })

  it('оба бейджа вместе', () => {
    expect(getProfileBadges({ badges: ['verified'], reputation: 500 })).toEqual([
      'verified',
      'established',
    ])
  })
})
