import { describe, expect, it } from 'vitest'

import { userMark } from './user-mark'

// Bastyon_Team: в списке проверенных, а узел отдаёт ему ['shark', 'moderator'].
const TEAM = 'PEj7QNjKdDPqE9kMDRboKoCtp8V6vZeZPd'
const OTHER = 'PQb6pDXHTt3xsUsgPVy3mb7xqt9Q9Kzt8X'

describe('userMark — старшинство как у markUser старого приложения', () => {
  it('проверенный аккаунт важнее бейджей узла', () => {
    expect(userMark({ address: TEAM, badges: ['shark', 'moderator'] })).toBe('verified')
    expect(userMark(null, TEAM)).toBe('verified')
  })

  it('модератор важнее «акулы», порядок в badges не важен', () => {
    expect(userMark({ address: OTHER, badges: ['shark', 'moderator'] })).toBe('moderator')
    expect(userMark({ address: OTHER, badges: ['moderator'] })).toBe('moderator')
    expect(userMark({ address: OTHER, badges: ['shark'] })).toBe('shark')
  })

  it('без значащих бейджей — ничего', () => {
    expect(userMark({ address: OTHER, badges: [] })).toBeNull()
    expect(userMark({ address: OTHER, badges: ['whale', 'developer'] })).toBeNull()
    expect(userMark(null, OTHER)).toBeNull()
    expect(userMark(undefined)).toBeNull()
  })

  it('бейджи из кэша — когда в профиле их нет', () => {
    expect(userMark(null, OTHER, ['shark'])).toBe('shark')
    expect(userMark({ address: OTHER }, null, ['moderator'])).toBe('moderator')
    // Бейджи, пришедшие с самим профилем, свежее кэша.
    expect(userMark({ address: OTHER, badges: [] }, null, ['shark'])).toBeNull()
  })
})
