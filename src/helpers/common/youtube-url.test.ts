import { describe, it, expect } from 'vitest'
import { getYoutubeEmbedUrls } from './youtube-url'

describe('getYoutubeEmbedUrls', () => {
  it('returns empty array for undefined/null', () => {
    expect(getYoutubeEmbedUrls(undefined)).toEqual([])
    expect(getYoutubeEmbedUrls(null as any)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(getYoutubeEmbedUrls('')).toEqual([])
  })

  it('returns empty array for text without youtube links', () => {
    expect(getYoutubeEmbedUrls('hello world')).toEqual([])
  })

  it('extracts from youtube.com/watch?v=ID', () => {
    const result = getYoutubeEmbedUrls('check https://youtube.com/watch?v=dQw4w9WgXcQ ')
    expect(result).toEqual(['https://www.youtube.com/embed/dQw4w9WgXcQ'])
  })

  it('extracts from youtu.be/ID', () => {
    const result = getYoutubeEmbedUrls('see https://youtu.be/dQw4w9WgXcQ ')
    expect(result).toEqual(['https://www.youtube.com/embed/dQw4w9WgXcQ'])
  })

  it('extracts multiple unique IDs', () => {
    const text = 'https://youtube.com/watch?v=abc12345678 and https://youtu.be/def12345678 '
    const result = getYoutubeEmbedUrls(text)
    expect(result).toHaveLength(2)
    expect(result).toContain('https://www.youtube.com/embed/abc12345678')
    expect(result).toContain('https://www.youtube.com/embed/def12345678')
  })

  it('deduplicates same video ID', () => {
    const text = 'https://youtube.com/watch?v=dQw4w9WgXcQ https://youtu.be/dQw4w9WgXcQ '
    const result = getYoutubeEmbedUrls(text)
    expect(result).toHaveLength(1)
  })

  it('handles youtube URL with extra params', () => {
    const result = getYoutubeEmbedUrls('https://youtube.com/watch?v=dQw4w9WgXcQ&t=30 ')
    expect(result).toEqual(['https://www.youtube.com/embed/dQw4w9WgXcQ'])
  })
})

// S31: композер и лента раньше жили на разных парсерах — shorts и хвостовая
// пунктуация вели себя по-разному.
describe('getYoutubeEmbedUrls — общий экстрактор (S31)', () => {
  it('видит shorts и embed, а не только watch?v=', () => {
    expect(getYoutubeEmbedUrls('https://youtube.com/shorts/dQw4w9WgXcQ')).toEqual([
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ])
    expect(getYoutubeEmbedUrls('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual([
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ])
  })

  it('обрезает хвостовую пунктуацию', () => {
    expect(getYoutubeEmbedUrls('смотри https://youtu.be/dQw4w9WgXcQ.')).toEqual([
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ])
  })

  it('не дублирует один и тот же ролик из разных форм ссылки', () => {
    const text = 'https://youtu.be/dQw4w9WgXcQ и https://youtube.com/watch?v=dQw4w9WgXcQ'
    expect(getYoutubeEmbedUrls(text)).toHaveLength(1)
  })
})
