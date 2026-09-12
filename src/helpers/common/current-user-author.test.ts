import { describe, it, expect, vi } from 'vitest'

// resolveImageUrl мокаем: тест про сборку author, не про трансформацию URL.
vi.mock('@/helpers/common/url-transformer', () => ({
  resolveImageUrl: (v: string) => `resolved:${v}`,
}))

import { buildCurrentUserAuthor } from './current-user-author'

describe('buildCurrentUserAuthor', () => {
  it('полный профиль → имя/аватар/репутация/буква', () => {
    expect(buildCurrentUserAuthor({ name: 'Alice', i: 'ava.png', reputation: 42 }, 'PABC')).toEqual(
      {
        name: 'Alice',
        address: 'PABC',
        avatar: 'resolved:ava.png',
        reputation: 42,
        letter: 'A',
      }
    )
  })

  it('без профиля → имя падает на адрес, аватар null, репутация 0', () => {
    expect(buildCurrentUserAuthor(null, 'PXYZ')).toEqual({
      name: 'PXYZ',
      address: 'PXYZ',
      avatar: null,
      reputation: 0,
      letter: 'P',
    })
  })

  it('reputation строкой парсится в число', () => {
    expect(buildCurrentUserAuthor({ reputation: '7' }, 'P1').reputation).toBe(7)
  })

  it('пустой адрес и без профиля → letter "?"', () => {
    expect(buildCurrentUserAuthor(null, '').letter).toBe('?')
  })
})
