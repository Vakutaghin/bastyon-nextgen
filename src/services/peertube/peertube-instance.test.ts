import { describe, it, expect } from 'vitest'
import { serializeForm, peertubeInstanceUrl } from './peertube-instance'

describe('serializeForm', () => {
  it('кодирует пары ключ=значение через &', () => {
    expect(serializeForm({ a: '1', b: 'two' })).toBe('a=1&b=two')
  })

  it('url-энкодит ключи и значения', () => {
    expect(serializeForm({ s: 'a b&c=d' })).toBe('s=a%20b%26c%3Dd')
  })

  it('пропускает undefined/null, но сохраняет пустую строку и 0', () => {
    expect(serializeForm({ a: undefined, b: null, c: '', d: 0 })).toBe('c=&d=0')
  })
})

describe('peertubeInstanceUrl', () => {
  it('строит путь с host и нормализует ведущий слэш', () => {
    const url = peertubeInstanceUrl('example.host', '/api/v1/users/me')
    expect(url).toContain('example.host')
    expect(url).toContain('api/v1/users/me')
    // без двойного слэша перед api
    expect(url).not.toContain('host//api')
  })
})
