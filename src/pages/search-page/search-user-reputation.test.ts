import { describe, expect, it } from 'vitest'

import { searchUserReputation } from './search-user-reputation'

describe('searchUserReputation', () => {
  it('formats the number the way the top accounts do', () => {
    expect(searchUserReputation({ reputation: 105878.2 })?.replace(/\s/g, ' ')).toMatch(
      /^105[ ,.]?878[.,]2$/
    )
    expect(searchUserReputation({ reputation: 0 })).toBe('0')
  })

  it('accepts a string from the node and skips a missing value', () => {
    expect(searchUserReputation({ reputation: '12.5' as unknown as number })).toMatch(/^12[.,]5$/)
    expect(searchUserReputation({})).toBeNull()
    expect(searchUserReputation({ reputation: 'x' as unknown as number })).toBeNull()
  })
})
