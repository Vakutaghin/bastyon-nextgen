import { describe, expect, it } from 'vitest'

import { decodeArticleContent, decodePostBody, encodeArticleContent } from './article-codec'
import { safeDecode } from './safe-decode'

describe('encode/decodeArticleContent (формат старого клиента)', () => {
  const article = {
    time: 1,
    version: '2.22.2',
    blocks: [
      { id: 'p1', type: 'paragraph', data: { text: 'Три <b>слова</b> & 50%' } },
      { id: 'h1', type: 'header', data: { level: 2, text: 'Глава 1' } },
      { id: 'l1', type: 'list', data: { style: 'ordered', items: ['один', 'два'] } },
      {
        id: 'l2',
        type: 'list',
        data: { style: 'unordered', items: [{ content: 'а', items: [{ content: 'б' }] }] },
      },
      {
        id: 'i1',
        type: 'image',
        data: { caption: 'Фото', file: { url: 'https://h/a b.jpg' }, stretched: true },
      },
      { id: 'q1', type: 'quote', data: { text: 'Цитата', caption: 'Автор', alignment: 'left' } },
      { id: 'c1', type: 'code', data: { code: 'a && b' } },
      { id: 'd1', type: 'delimiter', data: {} },
    ],
  }

  it('кодирует текстовые поля каждого блока через encodeURIComponent', () => {
    const out = encodeArticleContent(article)
    const [p, h, l1, l2, img, q, c, d] = out.blocks as {
      data: Record<string, unknown>
    }[]
    expect(p!.data.text).toBe(encodeURIComponent('Три <b>слова</b> & 50%'))
    expect(h!.data).toEqual({ level: 2, text: encodeURIComponent('Глава 1') })
    expect(l1!.data.items).toEqual(['один', 'два'].map(encodeURIComponent))
    expect(l2!.data.items).toEqual([
      { content: encodeURIComponent('а'), items: [{ content: encodeURIComponent('б') }] },
    ])
    expect(img!.data).toEqual({
      caption: encodeURIComponent('Фото'),
      file: { url: encodeURIComponent('https://h/a b.jpg') },
      stretched: true,
    })
    expect(q!.data).toEqual({
      text: encodeURIComponent('Цитата'),
      caption: encodeURIComponent('Автор'),
      alignment: 'left',
    })
    expect(c!.data.code).toBe(encodeURIComponent('a && b'))
    expect(d!.data).toEqual({})
    expect(out.version).toBe('2.22.2')
    expect((out.blocks[0] as { id: string }).id).toBe('p1')
  })

  it('исходный объект не меняется', () => {
    const copy = JSON.parse(JSON.stringify(article))
    encodeArticleContent(article)
    expect(article).toEqual(copy)
  })

  it('decode(encode(x)) возвращает исходную статью', () => {
    expect(decodeArticleContent(encodeArticleContent(article))).toEqual(article)
  })

  it('раскодирует статью, опубликованную старым клиентом (867e8d71…)', () => {
    const fromChain = JSON.parse(
      '{"blocks":[{"type":"paragraph","id":"RVpKp-CmcP","data":{"text":"%D0%A2%D1%80%D0%B8."}}],"version":"2.22.2"}'
    )
    const decoded = decodeArticleContent(fromChain)
    expect((decoded.blocks[0] as { data: { text: string } }).data.text).toBe('Три.')
  })

  it('некодированный текст с «%» (наши статьи до исправления) остаётся как есть', () => {
    const raw = { blocks: [{ type: 'paragraph', data: { text: 'скидка 50% сегодня' } }] }
    expect(decodeArticleContent(raw)).toEqual(raw)
  })
})

describe('decodePostBody', () => {
  // Статья в том виде, в каком её хранит нода после старого клиента: ссылка,
  // кавычки и перевод строки внутри полей закодированы.
  const stored = JSON.stringify(
    encodeArticleContent({
      blocks: [
        { type: 'paragraph', data: { text: 'Читайте <a href="https://ex.com/a">здесь</a>' } },
        { type: 'quote', data: { text: 'Он сказал: "да"\nи ушёл', caption: 'Автор' } },
        { type: 'image', data: { caption: '', file: { url: 'https://h/i.png' } } },
      ],
      version: '2.22.2',
    })
  )

  it('раскодированная целиком строка перестаёт быть JSON — так было раньше', () => {
    expect(() => JSON.parse(safeDecode(stored))).toThrow()
  })

  it('статья раскодируется по полям и остаётся валидным JSON', () => {
    const article = JSON.parse(decodePostBody(stored))
    expect(article.blocks[0].data.text).toBe('Читайте <a href="https://ex.com/a">здесь</a>')
    expect(article.blocks[1].data.text).toBe('Он сказал: "да"\nи ушёл')
    expect(article.blocks[2].data.file.url).toBe('https://h/i.png')
    expect(article.version).toBe('2.22.2')
  })

  it('обычный пост раскодируется целиком, как раньше', () => {
    expect(decodePostBody('Hello%20world')).toBe('Hello world')
    expect(decodePostBody('50% off')).toBe('50% off')
    expect(decodePostBody('')).toBe('')
  })

  it('JSON без blocks — не статья', () => {
    expect(decodePostBody('{"a":"b%20c"}')).toBe('{"a":"b c"}')
  })
})
