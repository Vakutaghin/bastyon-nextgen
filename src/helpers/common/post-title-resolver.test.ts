// N13: заголовок статьи берётся из Editor.js-блока (`data.text`), а не из
// несуществующего `blocks[0].text`.

import { describe, it, expect } from 'vitest'
import { resolvePostTitleFromPost } from './post-title-resolver'
import { t } from '@/i18n'

describe('resolvePostTitleFromPost', () => {
  it('prefers the explicit title', () => {
    expect(resolvePostTitleFromPost({ title: 'Заголовок', content: 'x' })).toEqual({
      title: 'Заголовок',
      usedContent: false,
    })
  })

  it('reads an Editor.js article from data.text (N13)', () => {
    const content = JSON.stringify({
      blocks: [{ type: 'header', data: { text: 'Первый блок' } }],
    })
    expect(resolvePostTitleFromPost({ content })).toEqual({
      title: 'Первый блок',
      usedContent: true,
    })
  })

  it('falls back to an image caption', () => {
    const content = JSON.stringify({
      blocks: [{ type: 'image', data: { caption: 'Подпись' } }],
    })
    expect(resolvePostTitleFromPost({ content }).title).toBe('Подпись')
  })

  it('uses plain content when it is not Editor.js JSON', () => {
    expect(resolvePostTitleFromPost({ content: 'просто текст' }).title).toBe('просто текст')
  })

  it('trims a long article title to 200 characters', () => {
    const long = 'a'.repeat(300)
    const content = JSON.stringify({ blocks: [{ data: { text: long } }] })
    const { title } = resolvePostTitleFromPost({ content })
    expect(title.endsWith('...')).toBe(true)
    expect(title).toHaveLength(203)
  })

  it('names a video with no title at all', () => {
    expect(resolvePostTitleFromPost({ type: 'video' }).title).toBe(t('postCard.videoTitle'))
  })
})
