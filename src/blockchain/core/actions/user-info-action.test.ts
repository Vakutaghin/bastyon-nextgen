import { describe, it, expect } from 'vitest'
import { serializeUserInfo, exportUserInfo } from './user-info-action'
import type { UserInfoData } from './user-info-action'

describe('serializeUserInfo', () => {
  it('конкатенирует поля в фиксированном порядке: name+site+language+about+image+addresses+ref+keys', () => {
    const info: UserInfoData = {
      name: 'Alice',
      site: 'site.io',
      language: 'en',
      about: 'bio',
      image: 'img',
      addresses: ['P1', 'P2'],
      ref: 'refX',
      keys: ['k1', 'k2'],
    }

    expect(serializeUserInfo(info)).toBe(
      'Alice' + 'site.io' + 'en' + 'bio' + 'img' + JSON.stringify(['P1', 'P2']) + 'refX' + 'k1,k2'
    )
  })

  it('подставляет дефолты для отсутствующих полей (addresses → "[]", keys → "")', () => {
    expect(serializeUserInfo({ name: 'Bob' })).toBe('Bob' + '[]')
  })

  it('пустой объект сериализуется в "[]" (только дефолт addresses)', () => {
    expect(serializeUserInfo({} as UserInfoData)).toBe('[]')
  })
})

describe('exportUserInfo', () => {
  it('по умолчанию (краткий формат) использует короткие ключи n/a/s/l/i/b/r/k', () => {
    const info: UserInfoData = {
      name: 'Alice',
      about: 'bio',
      site: 'site.io',
      language: 'en',
      image: 'img',
      addresses: ['P1'],
      ref: 'r',
      keys: ['k1', 'k2'],
    }

    expect(exportUserInfo(info)).toEqual({
      n: 'Alice',
      a: 'bio',
      s: 'site.io',
      l: 'en',
      i: 'img',
      b: JSON.stringify(['P1']),
      r: 'r',
      k: 'k1,k2',
    })
  })

  it('extended=true использует полные ключи + type:userInfo', () => {
    const info: UserInfoData = { name: 'Alice', addresses: ['P1'], keys: ['k1'] }

    expect(exportUserInfo(info, true)).toEqual({
      type: 'userInfo',
      name: 'Alice',
      about: '',
      site: '',
      language: '',
      image: '',
      addresses: JSON.stringify(['P1']),
      ref: '',
      keys: 'k1',
    })
  })

  it('краткий формат: дефолты для пропущенных полей', () => {
    expect(exportUserInfo({ name: 'Bob' })).toEqual({
      n: 'Bob',
      a: '',
      s: '',
      l: '',
      i: '',
      b: '[]',
      r: '',
      k: '',
    })
  })
})
