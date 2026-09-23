// S21 (решение Р3): контент заблокированных авторов не попадает в ленту,
// продвигаемые и рекомендации — как фильтрует legacy на клиенте.

import { describe, it, expect } from 'vitest'
import { isPostFromBlockedAuthor } from './use-blocked-authors'

const blocked = new Set(['PBAD'])

describe('isPostFromBlockedAuthor (S21)', () => {
  it('hides a post written by a blocked author', () => {
    expect(isPostFromBlockedAuthor({ author: { address: 'PBAD' } }, blocked)).toBe(true)
    expect(isPostFromBlockedAuthor({ author: { address: 'PGOOD' } }, blocked)).toBe(false)
  })

  it('reads a flat address too (raw post shape)', () => {
    expect(isPostFromBlockedAuthor({ address: 'PBAD' }, blocked)).toBe(true)
  })

  it('hides a repost of a blocked author', () => {
    expect(
      isPostFromBlockedAuthor(
        { author: { address: 'PGOOD' }, repostAuthor: { address: 'PBAD' } },
        blocked
      )
    ).toBe(true)
  })

  it('does nothing when the block list is empty', () => {
    expect(isPostFromBlockedAuthor({ author: { address: 'PBAD' } }, new Set())).toBe(false)
  })
})
