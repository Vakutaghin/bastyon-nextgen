import { describe, it, expect } from 'vitest'

import {
  isArticleSource,
  parseArticleContent,
  postToComposerData,
  sourceId,
  type ComposerSource,
} from './composer-source'

describe('sourceId', () => {
  it('приоритет txid > hash > id', () => {
    expect(sourceId({ txid: 'TX', hash: 'H', id: 1 })).toBe('TX')
    expect(sourceId({ hash: 'H', id: 1 })).toBe('H')
    expect(sourceId({ id: 42 })).toBe('42')
  })

  it('пустая строка, если идентификаторов нет', () => {
    expect(sourceId({})).toBe('')
  })
})

describe('postToComposerData', () => {
  it('предпочитает сырые message/caption нормализованным content/title', () => {
    const src: ComposerSource = {
      message: 'raw msg',
      content: 'rendered',
      caption: 'raw cap',
      title: 'rendered title',
    }
    expect(postToComposerData(src)).toEqual({
      message: 'raw msg',
      caption: 'raw cap',
      tags: [],
      images: [],
    })
  })

  it('падает на content/title, если сырых нет', () => {
    const src: ComposerSource = { content: 'body', title: 'Title', tags: ['a'], images: ['u1'] }
    expect(postToComposerData(src)).toEqual({
      message: 'body',
      caption: 'Title',
      tags: ['a'],
      images: ['u1'],
    })
  })

  it('копирует массивы (не возвращает ссылки на исходные)', () => {
    const tags = ['x']
    const images = ['i']
    const result = postToComposerData({ tags, images })
    expect(result.tags).toEqual(['x'])
    expect(result.images).toEqual(['i'])
    expect(result.tags).not.toBe(tags)
    expect(result.images).not.toBe(images)
  })

  it('дефолты для пустого источника', () => {
    expect(postToComposerData({})).toEqual({ message: '', caption: '', tags: [], images: [] })
  })

  it('объектный content (статья) не попадает в message', () => {
    const src: ComposerSource = { content: { blocks: [] }, title: 'T' }
    expect(postToComposerData(src).message).toBe('')
  })
})

describe('isArticleSource', () => {
  it('по type === article', () => {
    expect(isArticleSource({ type: 'article' })).toBe(true)
  })
  it('по объектному content с blocks', () => {
    expect(isArticleSource({ content: { blocks: [] } })).toBe(true)
  })
  it('по строковому content, начинающемуся с {"blocks"', () => {
    expect(isArticleSource({ content: '{"blocks":[]}' })).toBe(true)
  })
  it('обычный пост → false', () => {
    expect(isArticleSource({ content: 'plain text' })).toBe(false)
    expect(isArticleSource({ type: 'share' })).toBe(false)
  })
})

describe('parseArticleContent', () => {
  it('парсит строковый JSON в { blocks }', () => {
    const out = parseArticleContent({
      content: '{"blocks":[{"type":"paragraph","data":{"text":"hi"}}]}',
    })
    expect(out?.blocks).toHaveLength(1)
  })
  it('возвращает объектный content как есть', () => {
    const obj = { blocks: [{ type: 'header', data: { text: 'T', level: 2 } }] }
    expect(parseArticleContent({ content: obj })).toEqual(obj)
  })
  it('null для битого/не-статьи', () => {
    expect(parseArticleContent({ content: 'not json' })).toBeNull()
    expect(parseArticleContent({ content: '{"foo":1}' })).toBeNull()
    expect(parseArticleContent({})).toBeNull()
  })
})
