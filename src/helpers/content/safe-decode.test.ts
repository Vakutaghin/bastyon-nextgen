import { describe, it, expect } from 'vitest'

import { safeDecode } from './safe-decode'

describe('safeDecode (legacy trydecode)', () => {
  it('декодирует %XX, включая кириллицу', () => {
    expect(safeDecode('hello%20world')).toBe('hello world')
    expect(safeDecode('%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82')).toBe('Привет')
  })
  it('плюс — это плюс (encodeURIComponent-семантика, как в legacy)', () => {
    expect(safeDecode('C++%20tips')).toBe('C++ tips')
    expect(safeDecode('a%2Bb')).toBe('a+b')
  })
  it('битая последовательность → исходная строка', () => {
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A')
    expect(safeDecode('100%')).toBe('100%')
  })
  it('пустое/отсутствующее → пустая строка; обычный текст без изменений', () => {
    expect(safeDecode('')).toBe('')
    expect(safeDecode(null)).toBe('')
    expect(safeDecode(undefined)).toBe('')
    expect(safeDecode('plain')).toBe('plain')
  })
})
