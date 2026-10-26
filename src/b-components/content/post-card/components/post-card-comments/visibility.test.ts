import { describe, it, expect } from 'vitest'

import {
  isHiddenByReputation,
  isHiddenByPostAuthor,
  isHiddenForExternalLink,
  isBlockedByMe,
  getCommentPostingDisableReason,
  getCommentScoringDisableReason,
  shouldShowScamWarningOnDislike,
  SELF_REP_BLOCK_THRESHOLD,
} from './visibility'
import type { UserState } from '@/types/rpc-responses/user-state'
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

const state = (fields: Record<string, number>) => fields as unknown as UserState

describe('getCommentPostingDisableReason', () => {
  it('гостю — «войдите», без состояния аккаунта — можно', () => {
    expect(getCommentPostingDisableReason(false, null)?.kind).toBe('unauthenticated')
    expect(getCommentPostingDisableReason(true, null)).toBeNull()
  })

  it('исчерпан дневной лимит комментариев', () => {
    expect(getCommentPostingDisableReason(true, state({ comment_unspent: 0 }))?.kind).toBe(
      'limit-exhausted'
    )
    expect(getCommentPostingDisableReason(true, state({ comment_unspent: 3 }))).toBeNull()
  })

  it('репутация ниже порога блокирует, ровно на пороге — нет', () => {
    const below = state({ reputation: SELF_REP_BLOCK_THRESHOLD - 1 })
    const at = state({ reputation: SELF_REP_BLOCK_THRESHOLD })
    expect(getCommentPostingDisableReason(true, below)?.kind).toBe('reputation-blocked')
    expect(getCommentPostingDisableReason(true, at)).toBeNull()
  })
})

describe('getCommentScoringDisableReason', () => {
  it('гость, лимит оценок и репутация — каждая причина со своим видом', () => {
    expect(getCommentScoringDisableReason(false, null)?.kind).toBe('unauthenticated')
    expect(getCommentScoringDisableReason(true, state({ comment_score_unspent: 0 }))?.kind).toBe(
      'limit-exhausted'
    )
    expect(
      getCommentScoringDisableReason(true, state({ reputation: SELF_REP_BLOCK_THRESHOLD - 1 }))
        ?.kind
    ).toBe('reputation-blocked')
  })

  it('лимит комментариев на оценки не влияет', () => {
    expect(
      getCommentScoringDisableReason(true, state({ comment_unspent: 0, comment_score_unspent: 5 }))
    ).toBeNull()
  })
})

describe('shouldShowScamWarningOnDislike', () => {
  it('предупреждает только при отрицательной репутации и израсходованных >80% комментариев', () => {
    expect(
      shouldShowScamWarningOnDislike(
        state({ reputation: -1, comment_spent: 9, comment_unspent: 1 })
      )
    ).toBe(true)
  })

  it.each([
    ['репутация не отрицательная', { reputation: 0, comment_spent: 9, comment_unspent: 1 }],
    ['активность ровно 80%', { reputation: -1, comment_spent: 8, comment_unspent: 2 }],
    ['лимит неизвестен', { reputation: -1 }],
    ['лимит нулевой', { reputation: -1, comment_spent: 0, comment_unspent: 0 }],
  ])('не предупреждает: %s', (_name, fields) => {
    expect(shouldShowScamWarningOnDislike(state(fields))).toBe(false)
  })

  it('без состояния аккаунта — не предупреждает', () => {
    expect(shouldShowScamWarningOnDislike(null)).toBe(false)
  })
})

describe('isHiddenByPostAuthor (legacy hiddenComment: blck_cnt_cmt)', () => {
  it('скрывает комментарий того, кого заблокировал автор поста', () => {
    expect(isHiddenByPostAuthor(makeComment({ blck_cnt_cmt: 1 }), 'PREADER')).toBe(true)
  })

  it('не скрывает без пометки ноды, у самого комментатора и у удалённого', () => {
    expect(isHiddenByPostAuthor(makeComment(), 'PREADER')).toBe(false)
    expect(isHiddenByPostAuthor(makeComment({ blck_cnt_cmt: 1 }), 'PAUTHOR')).toBe(false)
    expect(isHiddenByPostAuthor(makeComment({ blck_cnt_cmt: 1, deleted: true }))).toBe(false)
  })
})

describe('isHiddenForExternalLink (legacy hiddenCommentLabelLink: rep < 20 + чужая ссылка)', () => {
  const withText = (message: string, reputation: number) =>
    makeComment({
      msg: JSON.stringify({ message }),
      userprofile: { ...makeComment().userprofile, reputation },
    })

  it('скрывает ссылку на чужой сайт, в том числе без схемы', () => {
    expect(isHiddenForExternalLink(withText('заходите https://spam.shop/x', 5))).toBe(true)
    expect(isHiddenForExternalLink(withText('заходите spam.shop', 19.9))).toBe(true)
  })

  it('свои домены и bastyon:// не прячет', () => {
    expect(isHiddenForExternalLink(withText('https://bastyon.com/post?s=abc', 1))).toBe(false)
    expect(isHiddenForExternalLink(withText('bastyon.com/user и pocketnet.app', 1))).toBe(false)
    expect(isHiddenForExternalLink(withText('bastyon://post?s=abc', 1))).toBe(false)
  })

  it('репутация от 20, свой комментарий и текст без ссылок — не скрывает', () => {
    expect(isHiddenForExternalLink(withText('https://spam.shop', 20))).toBe(false)
    expect(isHiddenForExternalLink(withText('https://spam.shop', 1), 'PAUTHOR')).toBe(false)
    expect(isHiddenForExternalLink(withText('просто текст', 1))).toBe(false)
    expect(isHiddenForExternalLink(makeComment({ msg: '{"message":"https://spam.shop"}' }))).toBe(
      false
    )
  })
})
