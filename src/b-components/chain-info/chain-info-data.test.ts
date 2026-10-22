import { describe, expect, it } from 'vitest'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import {
  averageScore,
  chatKeyCount,
  commentCoins,
  contentVersions,
  flagCount,
  parseCommentMessage,
  storedContent,
  textLength,
  uniqueActors,
  type ChainContent,
} from './chain-info-data'

// Формы ответов — как у mainnet 23.10.2026.
const ROOT = '1f008001b099165e75aaceb4f7ee63fba48cb82c4e03fa4333288109531550eb'
const EDIT1 = '8a9e21e2f44fa1625e5ec9b4ff403a75dcc4025127e9dba370ee210b1c9fcbad'
const CURRENT = 'd936a678087c7c855d38e9bcf1e10efb91a78fb5db58789e8560f735c143a4ff'

describe('contentVersions', () => {
  it('правленый пост: публикация, правки, текущая версия', () => {
    const versions = contentVersions({
      txid: ROOT,
      hash: CURRENT,
      versions: [
        { h: 3940721, hs: ROOT },
        { h: 3941657, hs: EDIT1 },
      ],
    })
    expect(versions).toEqual([
      { txid: ROOT, height: 3940721, index: 0, current: false },
      { txid: EDIT1, height: 3941657, index: 1, current: false },
      { txid: CURRENT, index: 2, current: true },
    ])
  })

  it('без правок — одна версия, она же текущая', () => {
    expect(contentVersions({ txid: ROOT, hash: ROOT, versions: [] })).toEqual([
      { txid: ROOT, index: 0, current: true },
    ])
  })

  it('нода не дала список версий, но hash ≠ txid — публикация всё равно первая', () => {
    expect(contentVersions({ txid: ROOT, hash: CURRENT })).toEqual([
      { txid: ROOT, index: 0, current: false },
      { txid: CURRENT, index: 1, current: true },
    ])
  })
})

describe('uniqueActors', () => {
  it('одна запись на адрес; имя — только если во всех версиях профиля одно', () => {
    const actors = uniqueActors(
      [
        { address: 'PA', name: 'Gonhar', value: 5 },
        { address: 'PA', name: 'Gonhar', avatar: 'https://a/1.jpg', value: 5 },
        { address: 'PA', name: 'Gonrfk', value: 5 },
        { address: 'PB', name: 'almas66', value: 4 },
        { name: 'без адреса', value: 5 },
      ],
      true
    )
    expect(actors).toEqual([
      { address: 'PA', name: undefined, avatar: 'https://a/1.jpg', value: 5 },
      { address: 'PB', name: 'almas66', avatar: undefined, value: 4 },
    ])
  })

  it('у бустов и монет сумму не берём: нода её переполняет', () => {
    expect(uniqueActors([{ address: 'PA', name: 'Saturas', value: 438392524 }], false)).toEqual([
      { address: 'PA', name: 'Saturas', avatar: undefined, value: undefined },
    ])
  })
})

describe('commentCoins', () => {
  const tx = (vout: { address: string; value: number }[]): Transaction =>
    ({
      txid: 'c',
      type: 204,
      height: 1,
      blockHash: '',
      nTime: 0,
      vin: [],
      vout: vout.map((o, n) => ({
        n,
        value: o.value,
        scriptPubKey: { addresses: [o.address], hex: '' },
      })),
    }) as Transaction

  it('монеты — выходы не автору комментария; сдача и OP_RETURN не в счёт', () => {
    expect(
      commentCoins(
        tx([
          { address: '', value: 0 },
          { address: 'PPostAuthor', value: 1 },
          { address: 'PCommenter', value: 0.1 },
        ]),
        'PCommenter'
      )
    ).toBe(1)
  })

  it('обычный комментарий — ноль', () => {
    expect(
      commentCoins(
        tx([
          { address: '', value: 0 },
          { address: 'PCommenter', value: 0.99999 },
        ]),
        'PCommenter'
      )
    ).toBe(0)
    expect(commentCoins(undefined, 'PCommenter')).toBe(0)
  })
})

describe('мелочи', () => {
  it('parseCommentMessage: JSON-строка ноды и битый текст', () => {
    expect(
      parseCommentMessage(
        '{"message":"Гениально!","url":"","images":["https://i/1.jpg"],"info":""}'
      )
    ).toEqual({ message: 'Гениально!', url: '', images: ['https://i/1.jpg'] })
    expect(parseCommentMessage('не JSON')).toEqual({ message: 'не JSON', url: '', images: [] })
    expect(parseCommentMessage(undefined)).toEqual({ message: '', url: '', images: [] })
  })

  it('averageScore и textLength', () => {
    expect(averageScore({ scoreCnt: 3, scoreSum: 14 })).toBe(4.7)
    expect(averageScore({ scoreCnt: 0, scoreSum: 0 })).toBe(0)
    expect(textLength('Осень 🍁')).toBe(7)
    expect(textLength(undefined)).toBe(0)
  })

  it('chatKeyCount и flagCount', () => {
    expect(chatKeyCount({ k: '03e6,034b,039e' })).toBe(3)
    expect(chatKeyCount({ k: '' })).toBe(0)
    expect(chatKeyCount(null)).toBe(0)
    expect(flagCount({ '1': 2, '3': 1 })).toBe(3)
    expect(flagCount(undefined)).toBe(0)
  })

  it('storedContent убирает то, что нода приложила от себя', () => {
    const content = {
      txid: ROOT,
      hash: ROOT,
      address: 'PA',
      type: 'share',
      time: 1,
      m: 'text',
      userprofile: { name: 'A' },
      lastComment: null,
    } as ChainContent
    expect(storedContent(content)).toEqual({
      txid: ROOT,
      hash: ROOT,
      address: 'PA',
      type: 'share',
      time: 1,
      m: 'text',
    })
  })
})
