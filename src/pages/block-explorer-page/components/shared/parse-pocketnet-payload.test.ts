import { describe, it, expect } from 'vitest'
import { parsePocketnetPayload } from './parse-pocketnet-payload'
import type { Transaction } from '@/types/rpc-responses/get-transactions'

function txOf(
  type: number,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    txid: 'tx',
    type,
    height: 100,
    blockHash: 'b',
    nTime: 0,
    vin: [],
    vout: [],
    ...extra,
  }
}

describe('parsePocketnetPayload', () => {
  it('parses Post (200)', () => {
    const tx = txOf(200, {
      s1: 'PFacV6XJVcV1RZQB2mJUGdofZNa6kUxuzs',
      s2: '0819cbc18671a444f0462a21f93ac57e317deaceac1e92a23838fc30ffe221f8',
      s3: 'd3302d83f2ba83923c14a246e6567dfd508950275a479923990aed27f95c62ce',
    })
    expect(parsePocketnetPayload(tx)).toEqual({
      kind: 'post',
      type: 200,
      author: 'PFacV6XJVcV1RZQB2mJUGdofZNa6kUxuzs',
      postId: '0819cbc18671a444f0462a21f93ac57e317deaceac1e92a23838fc30ffe221f8',
    })
  })

  it('parses Comment (204) with parent post', () => {
    const tx = txOf(204, {
      s1: 'PNnWFFuB2uMCxE3YafUm2uLMBw1AiYuYBY',
      s2: '125782ed771f018675096bcd5e0b1811ac5953af299cab49dff13d14220f2501',
      s3: '99382d92f180cdbf50b2d946f41dc540ea411e5b010611b17ac97e101dfa7fa0',
    })
    const p = parsePocketnetPayload(tx)
    expect(p?.kind).toBe('comment')
    if (p?.kind === 'comment') {
      expect(p.parentPostId).toBe('99382d92f180cdbf50b2d946f41dc540ea411e5b010611b17ac97e101dfa7fa0')
    }
  })

  it('parses UpvoteShare (300) with value', () => {
    const tx = txOf(300, {
      s1: 'P9sjz1CfVvifDXUbq3B3nd2JeNQmCU7sua',
      s2: '6a011c78f3d10a6a0980c1145ee1740e5a46bc2e329d22781d0bab2f4749f147',
      i1: 5,
    })
    const p = parsePocketnetPayload(tx)
    expect(p).toEqual({
      kind: 'upvote-share',
      type: 300,
      voter: 'P9sjz1CfVvifDXUbq3B3nd2JeNQmCU7sua',
      postId: '6a011c78f3d10a6a0980c1145ee1740e5a46bc2e329d22781d0bab2f4749f147',
      value: 5,
    })
  })

  it('parses cScore (301) with positive/negative value', () => {
    const txPos = txOf(301, { s1: 'Pabc', s2: 'commentid', i1: 1 })
    expect(parsePocketnetPayload(txPos)).toMatchObject({ kind: 'c-score', value: 1 })

    const txNeg = txOf(301, { s1: 'Pabc', s2: 'commentid', i1: -1 })
    expect(parsePocketnetPayload(txNeg)).toMatchObject({ kind: 'c-score', value: -1 })
  })

  it('parses subscribe/unsubscribe variants', () => {
    expect(parsePocketnetPayload(txOf(302, { s1: 'PA', s2: 'PB' }))).toMatchObject({
      kind: 'subscribe', isUnsubscribe: false, isPrivate: false, from: 'PA', to: 'PB',
    })
    expect(parsePocketnetPayload(txOf(303, { s1: 'PA', s2: 'PB' }))).toMatchObject({
      kind: 'subscribe', isUnsubscribe: false, isPrivate: true,
    })
    expect(parsePocketnetPayload(txOf(304, { s1: 'PA', s2: 'PB' }))).toMatchObject({
      kind: 'subscribe', isUnsubscribe: true, isPrivate: false,
    })
  })

  it('parses block / unblock', () => {
    expect(parsePocketnetPayload(txOf(305, { s1: 'PA', s2: 'PB' }))).toMatchObject({
      kind: 'block-user', isUnblock: false,
    })
    expect(parsePocketnetPayload(txOf(306, { s1: 'PA', s2: 'PB' }))).toMatchObject({
      kind: 'block-user', isUnblock: true,
    })
  })

  it('parses Boost (307) and picks recipient vout', () => {
    const tx = txOf(307, {
      s1: 'Pbooster',
      s2: 'postid',
      vout: [
        { n: 0, value: 0, scriptPubKey: { addresses: [''], hex: '6a05626f6f7374...' } },
        { n: 1, value: 0.5, scriptPubKey: { addresses: ['Pauthor'], hex: '' } },
      ],
    })
    const p = parsePocketnetPayload(tx)
    expect(p).toMatchObject({ kind: 'boost', booster: 'Pbooster', postId: 'postid', amount: 0.5 })
  })

  it('parses AccountSetting (100)', () => {
    const tx = txOf(100, { s1: 'PAU9mgKzS63ouytAwM8PCEZh4jHBo6ktuz' })
    expect(parsePocketnetPayload(tx)).toMatchObject({
      kind: 'account', isSetting: true, account: 'PAU9mgKzS63ouytAwM8PCEZh4jHBo6ktuz',
    })
  })

  it('returns null for unknown type', () => {
    expect(parsePocketnetPayload(txOf(999, { s1: 'P' }))).toBeNull()
  })

  it('returns null for PoS reward (type=3)', () => {
    // Type 3 не имеет Pocketnet-payload-смысла — это просто стейк.
    expect(parsePocketnetPayload(txOf(3))).toBeNull()
  })

  it('returns null when required slots are missing', () => {
    expect(parsePocketnetPayload(txOf(204, { s1: 'P', s2: 'x' }))).toBeNull() // нет s3
    expect(parsePocketnetPayload(txOf(200, { s1: 'P' }))).toBeNull()           // нет s2
  })

  it('handles nullish tx', () => {
    expect(parsePocketnetPayload(null)).toBeNull()
    expect(parsePocketnetPayload(undefined)).toBeNull()
  })
})
