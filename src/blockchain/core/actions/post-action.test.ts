import { createHash } from 'node:crypto'
import { describe, it, expect } from 'vitest'

import { Buffer } from '../../utils/buffer-polyfill'
import { hash256 } from '../../utils/crypto-hash'
import {
  exportPost,
  resolvePostOperationType,
  serializePost,
  type SharePostData,
} from './post-action'

/** Независимый оракул двойного SHA-256 (node:crypto) — не зависит от CryptoJS-пути продакшна. */
function refDoubleSha256Hex(input: string): string {
  const first = createHash('sha256').update(input, 'utf8').digest()
  const second = createHash('sha256').update(first).digest()
  return second.toString('hex')
}

describe('serializePost', () => {
  it('конкатенирует поля в фиксированном порядке: url+caption+message+tags+images+txidEdit+txidRepost', () => {
    const post: SharePostData = {
      url: 'https://x',
      caption: 'Title',
      message: 'Body',
      tags: ['news', 'tech'],
      images: ['https://i/1.jpg', 'https://i/2.jpg'],
      language: 'en',
    }

    expect(serializePost(post)).toBe(
      'https://x' + 'Title' + 'Body' + 'news,tech' + 'https://i/1.jpg,https://i/2.jpg' + '' + ''
    )
  })

  it('простой текстовый пост: только message + теги', () => {
    expect(serializePost({ message: 'Hello world', tags: ['news', 'tech'], language: 'en' })).toBe(
      'Hello worldnews,tech'
    )
  })

  it('картиночный пост: message + tag + images.join(",")', () => {
    expect(
      serializePost({
        message: 'pic',
        tags: ['a'],
        images: ['https://i/1.jpg', 'https://i/2.jpg'],
        language: 'ru',
      })
    ).toBe('pica' + 'https://i/1.jpg,https://i/2.jpg')
  })

  it('репост: только txidRepost в конце', () => {
    expect(serializePost({ language: 'en', txidRepost: 'ABC123' })).toBe('ABC123')
  })

  it('редактирование: txidEdit перед txidRepost', () => {
    expect(
      serializePost({ message: 'edited', tags: ['t'], language: 'en', txidEdit: 'EDIT99' })
    ).toBe('editedtEDIT99')
  })

  it('пустые поля дают пустую строку', () => {
    expect(serializePost({ language: 'en' })).toBe('')
  })
})

describe('OP_RETURN hash (double-sha256 от serialize)', () => {
  const post: SharePostData = {
    message: 'Hello world',
    tags: ['news', 'tech'],
    language: 'en',
  }

  it('hash256(serialize) совпадает с независимым эталоном node:crypto', () => {
    const serialized = serializePost(post)
    const ours = hash256(Buffer.from(serialized, 'utf8')).toString('hex')
    expect(ours).toBe(refDoubleSha256Hex(serialized))
  })

  it('хэш — 64 hex-символа и детерминирован', () => {
    const h1 = hash256(Buffer.from(serializePost(post), 'utf8')).toString('hex')
    const h2 = hash256(Buffer.from(serializePost(post), 'utf8')).toString('hex')
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
    expect(h1).toBe(h2)
  })

  it('изменение любого поля меняет хэш', () => {
    const h = hash256(Buffer.from(serializePost(post), 'utf8')).toString('hex')
    const changed = hash256(
      Buffer.from(serializePost({ ...post, message: 'Hello world!' }), 'utf8')
    ).toString('hex')
    expect(changed).not.toBe(h)
  })
})

describe('resolvePostOperationType', () => {
  it('обычный пост → share', () => {
    expect(resolvePostOperationType({ message: 'hi', language: 'en' })).toBe('share')
  })

  it('peertube-видео → video', () => {
    expect(
      resolvePostOperationType({ url: 'peertube://host/video/abc', caption: 'V', language: 'en' })
    ).toBe('video')
  })

  it('peertube-аудио (последний сегмент audio) → audio', () => {
    expect(
      resolvePostOperationType({ url: 'peertube://host/track/audio', caption: 'A', language: 'en' })
    ).toBe('audio')
  })

  it('youtube-ссылка НЕ становится video (только peertube) → share', () => {
    expect(
      resolvePostOperationType({
        url: 'https://youtube.com/watch?v=x',
        message: 'm',
        language: 'en',
      })
    ).toBe('share')
  })

  it('статья v2 → article', () => {
    expect(
      resolvePostOperationType({ message: 'x', language: 'en', settings: { v: 'a', version: 2 } })
    ).toBe('article')
  })
})

describe('exportPost', () => {
  it('краткий формат: короткие ключи c/m/u/p/t/i/s/l + txidEdit/txidRepost', () => {
    const post: SharePostData = {
      caption: '',
      message: 'Hello world',
      tags: ['news', 'tech'],
      images: [],
      language: 'en',
    }

    expect(exportPost(post)).toEqual({
      c: '',
      m: 'Hello world',
      u: '',
      p: {},
      t: ['news', 'tech'],
      i: [],
      s: { a: ['cm', 'r', 'i', 'u', 'p'], v: 'p', videos: [], image: 'a', f: '0', c: '' },
      l: 'en',
      txidEdit: '',
      txidRepost: '',
    })
  })

  it('пробрасывает настройки видимости и отложенную публикацию', () => {
    const result = exportPost({
      message: 'm',
      tags: ['t'],
      language: 'ru',
      settings: { f: '1', t: 1_900_000_000 },
    })
    expect(result.s).toMatchObject({ f: '1', t: 1_900_000_000 })
  })

  it('extended=true: полные ключи + type:share + poll', () => {
    const post: SharePostData = {
      caption: 'C',
      message: 'M',
      tags: ['t'],
      images: ['u1'],
      language: 'en',
      poll: { title: 'Q', list: ['a', 'b'] },
    }
    const result = exportPost(post, true)
    expect(result).toMatchObject({
      type: 'share',
      caption: 'C',
      message: 'M',
      url: '',
      tags: ['t'],
      images: ['u1'],
      language: 'en',
      txidEdit: '',
      txidRepost: '',
      poll: { title: 'Q', list: ['a', 'b'] },
    })
  })
})

describe('article (Editor.js, message-как-объект)', () => {
  const article: SharePostData = {
    caption: 'My Title',
    articleContent: { blocks: [{ type: 'paragraph', data: { text: 'hi' } }] },
    tags: ['news'],
    language: 'en',
    settings: { v: 'a', version: 2 },
  }

  it('operationType = article', () => {
    expect(resolvePostOperationType(article)).toBe('article')
  })

  it('serialize: позиция message = JSON.stringify(articleContent) (один раз)', () => {
    const json = JSON.stringify(article.articleContent)
    // url('') + caption('My Title') + json + tags('news') + images('') + edit('') + repost('')
    expect(serializePost(article)).toBe('My Title' + json + 'news')
  })

  it('export: m — это ОБЪЕКТ Editor.js (не строка), c = заголовок, s.v=a/version=2', () => {
    const out = exportPost(article)
    expect(out.m).toEqual({ blocks: [{ type: 'paragraph', data: { text: 'hi' } }] })
    expect(typeof out.m).toBe('object')
    expect(out.c).toBe('My Title')
    expect(out.s).toMatchObject({ v: 'a', version: 2 })
  })

  it('пустой articleContent → serialize использует { blocks: [] }', () => {
    const empty: SharePostData = { caption: 'T', language: 'en', settings: { v: 'a', version: 2 } }
    expect(serializePost(empty)).toBe('T' + JSON.stringify({ blocks: [] }))
  })
})
