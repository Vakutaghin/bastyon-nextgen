import { describe, it, expect } from 'vitest'

import { flattenListItems, isEmptyArticle, normalizeArticleBlocks } from './article-blocks'

describe('flattenListItems', () => {
  it('v1: массив строк остаётся как есть', () => {
    expect(flattenListItems(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('v2: [{content}] → [content]', () => {
    expect(flattenListItems([{ content: 'a' }, { content: 'b' }])).toEqual(['a', 'b'])
  })

  it('v2 вложенные подпункты разворачиваются плоско', () => {
    expect(
      flattenListItems([{ content: 'a', items: [{ content: 'a1' }, { content: 'a2' }] }])
    ).toEqual(['a', 'a1', 'a2'])
  })

  it('игнорирует мусор / не-строки', () => {
    expect(flattenListItems([{ foo: 1 }, null, 'ok'])).toEqual(['ok'])
    expect(flattenListItems('not-array')).toEqual([])
  })
})

describe('normalizeArticleBlocks', () => {
  it('нормализует list-блок в items: string[]', () => {
    const input = {
      blocks: [
        { type: 'list', data: { style: 'unordered', items: [{ content: 'a' }, { content: 'b' }] } },
      ],
    }
    const out = normalizeArticleBlocks(input)
    expect(out.blocks[0]).toEqual({ type: 'list', data: { style: 'unordered', items: ['a', 'b'] } })
  })

  it('не трогает не-list блоки', () => {
    const input = { blocks: [{ type: 'paragraph', data: { text: 'hi' } }] }
    expect(normalizeArticleBlocks(input).blocks[0]).toEqual({
      type: 'paragraph',
      data: { text: 'hi' },
    })
  })

  it('сохраняет служебные поля (time/version)', () => {
    const out = normalizeArticleBlocks({ time: 123, version: '2.31.0', blocks: [] })
    expect(out.time).toBe(123)
    expect(out.version).toBe('2.31.0')
    expect(out.blocks).toEqual([])
  })

  it('мусор → { blocks: [] }', () => {
    expect(normalizeArticleBlocks(null)).toEqual({ blocks: [] })
    expect(normalizeArticleBlocks('x')).toEqual({ blocks: [] })
  })
})

describe('isEmptyArticle', () => {
  it('null / без блоков → true', () => {
    expect(isEmptyArticle(null)).toBe(true)
    expect(isEmptyArticle({ blocks: [] })).toBe(true)
  })
  it('с блоками → false', () => {
    expect(isEmptyArticle({ blocks: [{ type: 'paragraph', data: {} }] })).toBe(false)
  })
})
