import { describe, it, expect } from 'vitest'

import type { SharePostData } from '@/blockchain/core/actions/post-action'

import { ARTICLE_SIZE_LIMIT, POST_SIZE_LIMIT } from './consts'
import { postSize, postSizeLimit, validatePost } from './validate-post'

const valid: SharePostData = { message: 'Hello world', tags: ['news'], language: 'en' }

describe('validatePost', () => {
  it('валидный текстовый пост → null', () => {
    expect(validatePost(valid)).toBeNull()
  })

  it('пустой пост (нет message/caption/repost) → empty', () => {
    expect(validatePost({ language: 'en', tags: ['t'] })).toBe('empty')
  })

  it('нет языка → language', () => {
    expect(validatePost({ message: 'hi', tags: ['t'] } as SharePostData)).toBe('language')
  })

  it('видео без заголовка → videoCaption', () => {
    expect(
      validatePost({ url: 'peertube://h/video/x', message: 'm', tags: ['t'], language: 'en' })
    ).toBe('videoCaption')
  })

  it('ссылка с малым текстом и без картинок → urlSpam', () => {
    expect(validatePost({ url: 'https://x.com', message: 'hi', tags: ['t'], language: 'en' })).toBe(
      'urlSpam'
    )
  })

  it('ссылка с достаточным текстом → валидно', () => {
    expect(
      validatePost({
        url: 'https://x.com',
        message: 'here is a long enough description about this link',
        tags: ['t'],
        language: 'en',
      })
    ).toBeNull()
  })

  it('ссылка с картинкой проходит даже при коротком тексте', () => {
    expect(
      validatePost({
        url: 'https://x.com',
        message: 'hi',
        images: ['https://i/1.jpg'],
        tags: ['t'],
        language: 'en',
      })
    ).toBeNull()
  })

  it('settings.t === 1 → scheduledInvalid', () => {
    expect(validatePost({ ...valid, settings: { t: 1 } })).toBe('scheduledInvalid')
  })

  it('нет тегов и не репост → tags', () => {
    expect(validatePost({ message: 'm', tags: [], language: 'en' })).toBe('tags')
  })

  it('репост без тегов → валидно', () => {
    expect(validatePost({ language: 'en', txidRepost: 'ABC123' })).toBeNull()
  })

  it('больше 5 тегов → tooManyTags', () => {
    expect(validatePost({ ...valid, tags: ['1', '2', '3', '4', '5', '6'] })).toBe('tooManyTags')
  })

  it('больше 10 картинок → tooManyImages', () => {
    const images = Array.from({ length: 11 }, (_, i) => `https://i/${i}.jpg`)
    expect(validatePost({ ...valid, images })).toBe('tooManyImages')
  })

  it('тег pkoin_commerce с другими тегами → exchangeTag', () => {
    expect(validatePost({ ...valid, tags: ['pkoin_commerce', 'other'] })).toBe('exchangeTag')
  })

  it('тег pkoin_commerce в одиночку без конфликтов → валидно', () => {
    expect(validatePost({ message: 'm', tags: ['pkoin_commerce'], language: 'en' })).toBeNull()
  })

  it('превышение размера payload → tooLarge', () => {
    expect(validatePost({ ...valid, message: 'x'.repeat(POST_SIZE_LIMIT + 1) })).toBe('tooLarge')
  })

  it('валидный опрос → null', () => {
    expect(validatePost({ ...valid, poll: { title: 'Q', list: ['a', 'b'] } })).toBeNull()
  })

  it('опрос без вопроса → pollTitle', () => {
    expect(validatePost({ ...valid, poll: { title: '', list: ['a', 'b'] } })).toBe('pollTitle')
  })

  it('опрос с <2 вариантами → pollOptions', () => {
    expect(validatePost({ ...valid, poll: { title: 'Q', list: ['a'] } })).toBe('pollOptions')
  })

  it('опрос считается контентом — пост без текста, но с опросом валиден', () => {
    expect(
      validatePost({ tags: ['t'], language: 'en', poll: { title: 'Q', list: ['a', 'b'] } })
    ).toBeNull()
  })
})

describe('postSizeLimit', () => {
  it('обычный пост → POST_SIZE_LIMIT', () => {
    expect(postSizeLimit(valid)).toBe(POST_SIZE_LIMIT)
  })

  it('статья v2 → ARTICLE_SIZE_LIMIT', () => {
    expect(postSizeLimit({ ...valid, settings: { v: 'a', version: 2 } })).toBe(ARTICLE_SIZE_LIMIT)
  })
})

describe('postSize', () => {
  it('возвращает длину JSON payload (> 0)', () => {
    expect(postSize(valid)).toBeGreaterThan(0)
  })
})
