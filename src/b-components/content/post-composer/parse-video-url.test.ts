import { describe, it, expect } from 'vitest'

import { extractVimeoId, extractYoutubeId, firstVideoUrl, parseVideoUrl } from './parse-video-url'

describe('extractYoutubeId', () => {
  it('watch?v=', () => {
    expect(extractYoutubeId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('youtu.be/', () => {
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('shorts / embed', () => {
    expect(extractYoutubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('не youtube → null', () => {
    expect(extractYoutubeId('https://example.com/x')).toBeNull()
  })
})

describe('extractVimeoId', () => {
  it('vimeo.com/123', () => {
    expect(extractVimeoId('https://vimeo.com/123456789')).toBe('123456789')
  })
  it('vimeo.com/video/123', () => {
    expect(extractVimeoId('https://vimeo.com/video/123456789')).toBe('123456789')
  })
  it('не vimeo → null', () => {
    expect(extractVimeoId('https://example.com')).toBeNull()
  })
})

describe('parseVideoUrl', () => {
  it('youtube → embedUrl', () => {
    expect(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      kind: 'youtube',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    })
  })
  it('vimeo → embedUrl', () => {
    expect(parseVideoUrl('https://vimeo.com/123456789').embedUrl).toBe(
      'https://player.vimeo.com/video/123456789'
    )
  })
  it('peertube видео', () => {
    const r = parseVideoUrl('peertube://host.app/abc123')
    expect(r.kind).toBe('peertube')
    expect(r.embedUrl).toBeUndefined()
  })
  it('peertube аудио', () => {
    expect(parseVideoUrl('peertube://host.app/abc123/audio').kind).toBe('audio')
  })
  it('обычная ссылка → kind null', () => {
    expect(parseVideoUrl('https://example.com/page').kind).toBeNull()
  })
  it('пустая строка', () => {
    expect(parseVideoUrl('')).toEqual({ kind: null, url: '' })
  })
})

describe('firstVideoUrl', () => {
  it('находит youtube среди текста', () => {
    expect(firstVideoUrl('смотри это https://youtu.be/dQw4w9WgXcQ круто')).toBe(
      'https://youtu.be/dQw4w9WgXcQ'
    )
  })
  it('возвращает первую видео-ссылку, пропуская невидео', () => {
    expect(firstVideoUrl('сайт https://example.com и видео https://vimeo.com/123456789')).toBe(
      'https://vimeo.com/123456789'
    )
  })
  it('peertube://', () => {
    expect(firstVideoUrl('пост peertube://h.app/xyz конец')).toBe('peertube://h.app/xyz')
  })
  it('нет видео → пустая строка', () => {
    expect(firstVideoUrl('просто текст без ссылок')).toBe('')
    expect(firstVideoUrl('')).toBe('')
  })
})
