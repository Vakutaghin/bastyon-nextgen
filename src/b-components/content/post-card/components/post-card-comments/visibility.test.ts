import { describe, it, expect } from 'vitest'

import { isHiddenByReputation, isBlockedByMe } from './visibility'
import type { GetComment } from '@/types/rpc-responses/get-comments'

/** Минимальный валидный GetComment с переопределяемыми полями. */
function makeComment(overrides: Partial<GetComment> = {}): GetComment {
  const reputation = overrides.userprofile?.reputation
  return {
    type: 204,
    id: 'cid',
    postid: 'pid',
    address: 'PAUTHOR',
    time: 0,
    timeUpd: 0,
    block: 0,
    msg: '{"message":"hi"}',
    scoreUp: 0,
    scoreDown: 0,
    children: 0,
    deleted: false,
    edit: false,
    flags: {},
    userprofile: {
      hash: 'h',
      address: 'PAUTHOR',
      id: 1,
      name: 'author',
      i: '',
      reputation,
    },
    ...overrides,
  }
}

describe('isHiddenByReputation (legacy hiddenComment: rep <= -0.5 && scoreDown >= 5)', () => {
  it('скрывает: низкая репутация И достаточно дизлайков', () => {
    const c = makeComment({
      scoreDown: 5,
      userprofile: { ...makeComment().userprofile, reputation: -0.5 },
    })
    expect(isHiddenByReputation(c)).toBe(true)
  })

  it('не скрывает: низкая репутация, но мало дизлайков', () => {
    const c = makeComment({
      scoreDown: 4,
      userprofile: { ...makeComment().userprofile, reputation: -10 },
    })
    expect(isHiddenByReputation(c)).toBe(false)
  })

  it('не скрывает: много дизлайков, но репутация выше порога', () => {
    const c = makeComment({
      scoreDown: 50,
      userprofile: { ...makeComment().userprofile, reputation: 0 },
    })
    expect(isHiddenByReputation(c)).toBe(false)
  })

  it('не скрывает собственный комментарий, даже при низкой репутации и дизлайках', () => {
    const c = makeComment({
      scoreDown: 9,
      userprofile: { ...makeComment().userprofile, reputation: -5 },
    })
    expect(isHiddenByReputation(c, 'PAUTHOR')).toBe(false)
  })

  it('не скрывает удалённый комментарий', () => {
    const c = makeComment({
      deleted: true,
      scoreDown: 9,
      userprofile: { ...makeComment().userprofile, reputation: -5 },
    })
    expect(isHiddenByReputation(c)).toBe(false)
  })

  it('не скрывает при отсутствии данных о репутации', () => {
    const c = makeComment({
      scoreDown: 9,
      userprofile: { ...makeComment().userprofile, reputation: undefined },
    })
    expect(isHiddenByReputation(c)).toBe(false)
  })
})

describe('isBlockedByMe', () => {
  it('true, если адрес автора в блок-сете', () => {
    const c = makeComment({ address: 'PBAD' })
    expect(isBlockedByMe(c, new Set(['PBAD']))).toBe(true)
  })

  it('false для пустого/отсутствующего блок-сета', () => {
    const c = makeComment({ address: 'PBAD' })
    expect(isBlockedByMe(c, new Set())).toBe(false)
    expect(isBlockedByMe(c, null)).toBe(false)
    expect(isBlockedByMe(c, undefined)).toBe(false)
  })

  it('false, если автор не в блок-сете', () => {
    const c = makeComment({ address: 'PGOOD' })
    expect(isBlockedByMe(c, new Set(['PBAD']))).toBe(false)
  })
})
