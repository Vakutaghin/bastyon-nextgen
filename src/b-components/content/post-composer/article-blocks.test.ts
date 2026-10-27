import { describe, it, expect } from 'vitest'

import { flattenListItems } from './article-blocks'

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
