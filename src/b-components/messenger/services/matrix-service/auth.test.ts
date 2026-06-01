import { describe, it, expect } from 'vitest'

import { deriveMatrixPassword, normalizeLoginAddress } from './auth'

describe('deriveMatrixPassword', () => {
  it('детерминирован и даёт 64-символьный hex (двойной SHA256)', () => {
    const p = deriveMatrixPassword('abcd1234')
    expect(p).toMatch(/^[0-9a-f]{64}$/)
    expect(deriveMatrixPassword('abcd1234')).toBe(p)
  })

  it('разные приватные ключи → разные пароли', () => {
    expect(deriveMatrixPassword('aa')).not.toBe(deriveMatrixPassword('bb'))
  })
})

describe('normalizeLoginAddress', () => {
  it('пустая строка возвращается как есть', () => {
    expect(normalizeLoginAddress('')).toBe('')
  })

  it('обрезает пробелы у не-hex входа (обычный адрес)', () => {
    expect(normalizeLoginAddress('  PEa7Xv9kE2bN1qS  ')).toBe('PEa7Xv9kE2bN1qS')
  })

  it('hex нечётной длины не декодируется — возвращается as-is', () => {
    expect(normalizeLoginAddress('abc')).toBe('abc')
  })

  it('even-hex, декодирующийся в невалидный адрес, возвращается as-is', () => {
    expect(normalizeLoginAddress('deadbeef')).toBe('deadbeef')
  })
})
