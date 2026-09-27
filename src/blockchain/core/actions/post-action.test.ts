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

/**
 * Посты из основной сети, опубликованные старым клиентом. `hash` — второй push
 * OP_RETURN их транзакции (getrawtransaction), поля — ответ ноды
 * (getrawtransactionwithmessagebyid). Если serializePost разойдётся с тем, что
 * хэширует нода, эти векторы упадут раньше, чем нода отвергнет живой пост.
 */
const MAINNET: { name: string; txid: string; opType: string; hash: string; post: SharePostData }[] =
  [
    {
      name: 'видео',
      txid: '16d0d9d10ef9ba2d1f4008e4c5396fb593e3e52b7ab0be6b760ab2d772eebc4d',
      opType: 'video',
      hash: 'a64937a5dde99f377309a83aa7e4cbecd19bf4a215e02c086686bb9d1405e1c2',
      post: {
        url: 'peertube://peertube101.pocketnet.app/dc87eb0c-e3ea-4dca-9162-9dbf7dfe89e0',
        caption: 'Чу Ку Ду ',
        tags: ['auto', 'racing'],
        language: 'ru',
      },
    },
    {
      name: 'пост со ссылкой и картинкой',
      txid: '4369a97fbf6095aac061cfb1076366e46573cfc9901019f75541070bb65c076b',
      opType: 'share',
      hash: 'de5f553614f88b395c8dbe6e847b1ad4fcbd7829db72040fbd1662cd29d8c1a8',
      post: {
        url: 'https://t.me/DanDTube/200659',
        message: 'The Architect\nhttps://t.me/DanDTube/200659',
        tags: ['covid', 'lockdowns'],
        images: [
          'https://peertube101.pocketnet.app/images/1c4873603f2ac6170accb6f18fb8cd4d/1c4873603f2ac6170accb6f18fb8cd4d-original.jpg',
        ],
        language: 'en',
      },
    },
    {
      name: 'правка поста',
      txid: '6efeb04fec5efb958b9874fa9d9c6d958aeea3b54893515363ac968f29596ab5',
      opType: 'share',
      hash: 'c1ba252d2cdd0b400015062c8d7c1ac5ee3dfece673fe5dd96beb237866530af',
      post: {
        message:
          'ALL IMAGES GONE NOW \nEVEN VIDEOS DONT SHOW ANY IMAGE \nUPLOADS ARE CANVAS CENSORED - JUST SQUARES IN DIFFERENT COLORS\nITS DEPRESSING',
        tags: ['technology', 'science', 'bastyon', 'pocketnet'],
        language: 'en',
        txidEdit: 'd006ca58936b044a9090347f7b94d9ab870d32cf8442d89a4b5498d7e71e914f',
      },
    },
    {
      name: 'статья',
      txid: '867e8d71171d038ca00193e178fbb4ff343f3bbe761c74dc4974b73bdb2e07d7',
      opType: 'article',
      hash: '043398a7a2dde6664967df53c3928ef2035ce797ba38709dd8910b1d307a429c',
      post: {
        caption: 'Попытка номер 3',
        articleContent: JSON.parse(
          '{"blocks":[{"type":"paragraph","id":"RVpKp-CmcP","data":{"text":"%D0%A2%D1%80%D0%B8."}}],"version":"2.22.2"}'
        ),
        tags: ['население'],
        images: [''],
        language: 'ru',
        settings: { v: 'a', version: 2 },
      },
    },
    {
      name: 'правка статьи',
      txid: '7d2c0b0d01b9a0be8b2ef41d10e5f7889a2552381c794f615cd83e01faf645cc',
      opType: 'article',
      hash: '91e8a1eadceedc2c90aee51de1f37fc3cd03721109f21a7ddccfe05585bc9c97',
      post: {
        caption: 'Равенна ',
        articleContent: JSON.parse(
          '{"blocks":[{"type":"paragraph","id":"9a-AJfv2RI","data":{"text":"Battistero%20degli%20Ariani%26nbsp%3B"}}],"version":"2.22.2"}'
        ),
        tags: ['искусство', 'музыка'],
        images: [
          'https://peertube101.pocketnet.app/images/df2e32c08576fe4f5f42fa4277d794f8/df2e32c08576fe4f5f42fa4277d794f8-original.jpg',
        ],
        language: 'ru',
        settings: { v: 'a', version: 2 },
        txidEdit: 'bb68127cddcfcb33d2e2cc361139b7405052130f3dd35d2860c99962dd243fde',
      },
    },
    {
      name: 'репост без текста',
      txid: '452c488225c9beb0240928d4591dd115c46d18e712843de47212e37334ed158a',
      opType: 'share',
      hash: '50d6f59d30ac97fb0c8221bc8f02f8d42746403e364bac81d9e6960c451b4ce5',
      post: {
        language: 'en',
        txidRepost: '43fde39c036a1b0598caf04516b25c30d21c60f9ed2472a2c0a8462c5e8bddb8',
      },
    },
  ]

describe('совпадает с транзакциями основной сети', () => {
  it.each(MAINNET)('$name ($txid)', ({ post, opType, hash }) => {
    expect(resolvePostOperationType(post)).toBe(opType)
    expect(hash256(Buffer.from(serializePost(post), 'utf8')).toString('hex')).toBe(hash)
  })
})
