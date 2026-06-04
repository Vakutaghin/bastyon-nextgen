import { describe, it, expect } from 'vitest'

import { filterTagSuggestions } from './tag-suggestions'

const cloud = ['news', 'crypto', 'newyork', 'tech', 'art', 'newsletter']

describe('filterTagSuggestions', () => {
  it('пустой запрос → верх облака (до limit)', () => {
    expect(filterTagSuggestions(cloud, '', [], 3)).toEqual(['news', 'crypto', 'newyork'])
  })

  it('приоритет совпадений по началу строки над вхождением', () => {
    // 'new' начинают news/newyork/newsletter; 'crypto' не содержит — не попадёт
    const result = filterTagSuggestions(cloud, 'new', [])
    expect(result[0]).toBe('news')
    expect(result).toContain('newyork')
    expect(result).toContain('newsletter')
    expect(result).not.toContain('crypto')
  })

  it('исключает уже выбранные теги (регистронезависимо)', () => {
    const result = filterTagSuggestions(cloud, 'new', ['NEWS'])
    expect(result).not.toContain('news')
    expect(result).toContain('newyork')
  })

  it('регистронезависимый поиск', () => {
    expect(filterTagSuggestions(cloud, 'TECH', [])).toContain('tech')
  })

  it('совпадение по вхождению (не только началу)', () => {
    // 'ews' встречается в news/newsletter в середине/конце
    const result = filterTagSuggestions(cloud, 'ews', [])
    expect(result).toContain('news')
    expect(result).toContain('newsletter')
  })

  it('соблюдает limit', () => {
    expect(filterTagSuggestions(cloud, '', [], 2)).toHaveLength(2)
  })

  it('нет совпадений → пустой массив', () => {
    expect(filterTagSuggestions(cloud, 'zzz', [])).toEqual([])
  })
})
