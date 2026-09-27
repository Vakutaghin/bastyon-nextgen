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
