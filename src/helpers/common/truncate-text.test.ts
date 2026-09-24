import { describe, it, expect } from 'vitest'
import { truncateTextKeepingLinks } from './truncate-text'

describe('truncateTextKeepingLinks', () => {
  it('короткий текст не трогает', () => {
    expect(truncateTextKeepingLinks('привет', 100)).toBe('привет')
    expect(truncateTextKeepingLinks('ровно десять', 12)).toBe('ровно десять')
  })

  it('режет обычный текст по границе', () => {
    expect(truncateTextKeepingLinks('раз два три четыре', 7)).toBe('раз два...')
  })

  it('не разрывает ссылку: граница уезжает к её началу', () => {
    const text = 'Смотрите тут https://www.youtube.com/@BELOGOR/videos и подписывайтесь'
    // Граница пришлась бы на середину URL.
    const out = truncateTextKeepingLinks(text, 30)
    expect(out).toBe('Смотрите тут...')
    expect(out).not.toContain('youtube')
  })

  it('оставляет ссылку целиком, если она стоит в самом начале', () => {
    const url = 'https://www.youtube.com/@BELOGOR/videos'
    const out = truncateTextKeepingLinks(`${url} и дальше текст`, 10)
    expect(out).toBe(`${url}...`)
  })

  it('ссылку, уместившуюся целиком, сохраняет', () => {
    const text = 'https://a.io потом очень длинный хвост текста, который не влезет'
    const out = truncateTextKeepingLinks(text, 20)
    expect(out.startsWith('https://a.io')).toBe(true)
    expect(out.endsWith('...')).toBe(true)
  })

  it('работает со схемами bastyon, ipfs и www', () => {
    for (const url of [
      'bastyon://post?s=abcdef0123456789',
      'ipfs://QmHashHashHash',
      'www.example.com/path',
    ]) {
      const out = truncateTextKeepingLinks(`начало ${url} конец`, 10)
      expect(out).toBe('начало...')
    }
  })

  it('не оставляет пробел перед многоточием', () => {
    expect(truncateTextKeepingLinks('раз   два', 5)).toBe('раз...')
  })

  it('нулевой лимит ничего не режет', () => {
    expect(truncateTextKeepingLinks('текст', 0)).toBe('текст')
  })
})
