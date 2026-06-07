import { describe, it, expect } from 'vitest'
import { detectMentionToken } from './use-composer-mentions'

describe('detectMentionToken', () => {
  it('детектит токен в начале строки', () => {
    expect(detectMentionToken('@bob', 4)).toEqual({ query: 'bob', start: 0, end: 4 })
  })

  it('детектит токен после пробела', () => {
    expect(detectMentionToken('hi @al', 6)).toEqual({ query: 'al', start: 3, end: 6 })
  })

  it('пустой query сразу после @', () => {
    expect(detectMentionToken('hi @', 4)).toEqual({ query: '', start: 3, end: 4 })
  })

  it('не ловит e-mail (@ не после пробела)', () => {
    expect(detectMentionToken('mail@host', 9)).toBeNull()
  })

  it('null, если перед курсором нет @-токена', () => {
    expect(detectMentionToken('just text', 9)).toBeNull()
  })

  it('обрывается на пробеле после токена', () => {
    expect(detectMentionToken('@bob ', 5)).toBeNull()
  })

  it('берёт query до позиции курсора (середина токена)', () => {
    expect(detectMentionToken('@bobby', 4)).toEqual({ query: 'bob', start: 0, end: 4 })
  })

  it('null при выходе курсора за границы', () => {
    expect(detectMentionToken('@bob', 99)).toBeNull()
  })
})
