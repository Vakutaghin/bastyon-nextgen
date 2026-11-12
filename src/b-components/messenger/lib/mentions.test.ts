// Упоминания в формате прежнего Bastyon и Forta Chat: `@<hex адреса>:<имя>`.
// Находим только те, где после «@» правда адрес; для списка, ответа, поиска и
// буфера обмена — «@имя»; для отправки — тот же формат, что читают те клиенты.

import { describe, expect, it } from 'vitest'
import { addressToHex } from '../services/matrix-service/address-codec'
import {
  encodeMentions,
  findMentions,
  insertMentionAt,
  mentionName,
  mentionQueryAt,
  mentionToken,
  plainMentions,
} from './mentions'

const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const CAROL = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const hex = (a: string) => addressToHex(a)

describe('findMentions', () => {
  it('находит @hex:имя с адресом и местом в тексте; кириллица в имени', () => {
    const text = `Привет, @${hex(BOB)}:bob_ng и @${hex(CAROL)}:Кэрол!`
    const found = findMentions(text)
    expect(found.map(({ address, name }) => ({ address, name }))).toEqual([
      { address: BOB, name: 'bob_ng' },
      { address: CAROL, name: 'Кэрол' },
    ])
    expect(text.slice(found[0]!.start, found[0]!.end)).toBe(`@${hex(BOB)}:bob_ng`)
    // Имя кончается на знаке: «!» — уже текст.
    expect(text.slice(found[1]!.end)).toBe('!')
  })

  it('голый адрес после «@» — тоже упоминание', () => {
    expect(findMentions(`@${BOB}:bob_ng`)[0]?.address).toBe(BOB)
  })

  it('не упоминания: почта, время, hex не адреса, нечётный hex', () => {
    expect(findMentions('mail me@host.ru, встреча в 12:30')).toEqual([])
    expect(findMentions(`@${'ab'.repeat(20)}:nope`)).toEqual([])
    expect(findMentions(`@${hex(BOB).slice(1)}:bob_ng`)).toEqual([])
  })
})

describe('plainMentions', () => {
  it('«@имя» вместо hex; имя из профиля важнее присланного', () => {
    const text = `@${hex(BOB)}:bob_old, глянь`
    expect(plainMentions(text)).toBe('@bob_old, глянь')
    expect(plainMentions(text, (a) => (a === BOB ? 'bob_ng' : undefined))).toBe('@bob_ng, глянь')
  })

  it('текст без упоминаний — тот же', () => {
    expect(plainMentions('просто текст')).toBe('просто текст')
  })
})

describe('mentionToken', () => {
  it('формат прежнего Bastyon: hex адреса и имя без пробелов и знаков', () => {
    expect(mentionToken(BOB, 'Bob Smith!')).toBe(`@${hex(BOB)}:Bob_Smith`)
    // Своё же упоминание находится обратно.
    expect(findMentions(mentionToken(CAROL, 'Кэрол'))[0]).toMatchObject({
      address: CAROL,
      name: 'Кэрол',
    })
  })

  it('имя из одних знаков — начало адреса', () => {
    expect(mentionName('***', BOB)).toBe('PR7srzZt')
  })
})

describe('mentionQueryAt', () => {
  it('«@» в начале слова и буквы до каретки', () => {
    expect(mentionQueryAt('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionQueryAt('привет @бо', 10)).toEqual({ start: 7, query: 'бо' })
    // Каретка в середине: считается то, что до неё.
    expect(mentionQueryAt('hi @bob там', 6)).toEqual({ start: 3, query: 'bo' })
  })

  it('не упоминание: почта, пробел после «@», каретка далеко', () => {
    expect(mentionQueryAt('me@host', 7)).toBeNull()
    expect(mentionQueryAt('@bob ng', 7)).toBeNull()
    expect(mentionQueryAt('текст', 5)).toBeNull()
  })
})

describe('insertMentionAt', () => {
  it('«@бо» → «@имя » и каретка после пробела; текст после каретки — на месте', () => {
    const text = 'привет @бо, как дела'
    const at = mentionQueryAt(text, 10)!
    expect(insertMentionAt(text, at, 10, 'bob_ng', BOB)).toEqual({
      text: 'привет @bob_ng , как дела',
      caret: 15,
    })
    // Пробел после каретки не удваивается.
    const t2 = 'x @b дальше'
    expect(insertMentionAt(t2, mentionQueryAt(t2, 4)!, 4, 'bob_ng', BOB).text).toBe(
      'x @bob_ng дальше'
    )
  })
})

describe('encodeMentions', () => {
  const members = [
    { address: BOB, name: 'bob_ng' },
    { address: CAROL, name: 'Кэрол' },
  ]

  it('«@имя» участника → @hex:имя; набрано другим регистром — имя как в профиле', () => {
    expect(encodeMentions('@bob_ng, привет и @кэрол!', members)).toBe(
      `@${hex(BOB)}:bob_ng, привет и @${hex(CAROL)}:Кэрол!`
    )
    // «@имя:» — тоже упоминание.
    expect(encodeMentions('@bob_ng: глянь', members)).toBe(`@${hex(BOB)}:bob_ng: глянь`)
  })

  it('не трогает: почту, часть слова, чужие имена, готовые упоминания', () => {
    expect(encodeMentions('mail x@bob_ng.ru', members)).toBe('mail x@bob_ng.ru')
    expect(encodeMentions('@bob_ng2 и @dave', members)).toBe('@bob_ng2 и @dave')
    const ready = `@${hex(BOB)}:bob_ng`
    expect(encodeMentions(ready, members)).toBe(ready)
    expect(encodeMentions(`@${BOB}:bob_ng`, members)).toBe(`@${BOB}:bob_ng`)
  })

  it('отправленное читается обратно тем же упоминанием', () => {
    const sent = encodeMentions('@bob_ng привет', members)
    expect(plainMentions(sent)).toBe('@bob_ng привет')
    expect(findMentions(sent)[0]?.address).toBe(BOB)
  })
})
