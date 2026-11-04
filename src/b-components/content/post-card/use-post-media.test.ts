import { describe, expect, it } from 'vitest'

import type { Post } from './post-card.types'
import { usePostMedia } from './use-post-media'

const author = { name: 'a', address: 'P1', reputation: 0, letter: 'A' }
const post = (fields: Partial<Post>): Post => ({ author, timestamp: '', ...fields })
const linkOf = (fields: Partial<Post>): string =>
  usePostMedia(() => post(fields)).linkPreviewUrl.value

describe('usePostMedia.linkPreviewUrl', () => {
  it('обычная ссылка поста — под карточку', () => {
    expect(linkOf({ type: 'share', videoUrl: 'https://cairnsnews.org/a' })).toBe(
      'https://cairnsnews.org/a'
    )
  })

  it('целиком закодированная ссылка старых постов раскодируется', () => {
    expect(linkOf({ type: 'share', videoUrl: 'https%3A%2F%2Fsite.org%2Fa%3Fb%3D1' })).toBe(
      'https://site.org/a?b=1'
    )
  })

  it('видео, YouTube, картинка и статья — без карточки', () => {
    expect(linkOf({ type: 'video', videoUrl: 'peertube://h/uuid' })).toBe('')
    expect(linkOf({ type: 'share', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })).toBe('')
    expect(linkOf({ type: 'share', videoUrl: 'https://h/pic.png' })).toBe('')
    expect(linkOf({ type: 'article', videoUrl: 'https://site.org/' })).toBe('')
    expect(linkOf({ type: 'share' })).toBe('')
  })
})

describe('usePostMedia.videoEmbeds', () => {
  const embedsOf = (fields: Partial<Post>) =>
    usePostMedia(() => post(fields)).videoEmbeds.value.map((e) => e.embedUrl)

  it('YouTube из ссылки поста и Vimeo из текста', () => {
    expect(
      embedsOf({
        type: 'share',
        videoUrl: 'https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ',
        content: 'и ещё https://vimeo.com/76979871',
      })
    ).toEqual([
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://player.vimeo.com/video/76979871',
    ])
  })

  it('у поста со своим видео эмбедов нет — один плеер', () => {
    expect(
      embedsOf({
        type: 'video',
        videoUrl: 'peertube://h/uuid',
        content: 'https://youtu.be/dQw4w9WgXcQ',
      })
    ).toEqual([])
  })
})

describe('usePostMedia.videoLinkCards', () => {
  const cardsOf = (fields: Partial<Post>) => usePostMedia(() => post(fields)).videoLinkCards.value
  const embedsOf = (fields: Partial<Post>) =>
    usePostMedia(() => post(fields)).videoEmbeds.value.length

  it('пост без вложений — большой плеер, карточек нет', () => {
    const fields = { type: 'share', content: 'смотрите https://youtu.be/dQw4w9WgXcQ' }
    expect(embedsOf(fields)).toBe(1)
    expect(cardsOf(fields)).toEqual([])
  })

  it('с картинкой — ролик карточкой ссылки, плеера нет', () => {
    const fields = {
      type: 'share',
      images: ['https://h/pic.png'],
      content: 'смотрите https://youtu.be/dQw4w9WgXcQ и https://vimeo.com/76979871',
    }
    expect(embedsOf(fields)).toBe(0)
    expect(cardsOf(fields)).toEqual([
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://vimeo.com/76979871',
    ])
  })

  it('со своим видео — ссылка на YouTube тоже карточкой', () => {
    expect(
      cardsOf({
        type: 'video',
        videoUrl: 'peertube://h/uuid',
        content: 'оригинал: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      })
    ).toEqual(['https://www.youtube.com/watch?v=dQw4w9WgXcQ'])
  })
})
