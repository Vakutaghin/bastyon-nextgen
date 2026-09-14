import { describe, it, expect } from 'vitest'

import { pendingForAddress } from './use-registration-flow'

const pending = { nickname: 'bob', address: 'PB', step: 2, timestamp: 1 }

describe('pendingForAddress (V10)', () => {
  it('отдаёт запись только для того же адреса', () => {
    expect(pendingForAddress(pending, 'PB')).toBe(pending)
    expect(pendingForAddress(pending, 'PC')).toBeNull()
    expect(pendingForAddress(pending, null)).toBeNull()
    expect(pendingForAddress(null, 'PB')).toBeNull()
  })
})
