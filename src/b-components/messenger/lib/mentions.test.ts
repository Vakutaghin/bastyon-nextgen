// Упоминания в формате прежнего Bastyon и Forta Chat: `@<hex адреса>:<имя>`.
// Находим только те, где после «@» правда адрес; для списка, ответа, поиска и
// буфера обмена — «@имя»; для отправки — тот же формат, что читают те клиенты.

import { describe, expect, it } from 'vitest'
import { addressToHex } from '../services/matrix-service/address-codec'
import { findMentions, mentionName, mentionToken, plainMentions } from './mentions'

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
