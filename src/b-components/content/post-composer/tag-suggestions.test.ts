import { describe, it, expect } from 'vitest'

import { filterTagSuggestions, NO_ACTIVE_SUGGESTION, resolveTagOnEnter } from './tag-suggestions'

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

describe('filterTagSuggestions: по умолчанию показываем весь список', () => {
  const big = Array.from({ length: 60 }, (_, i) => `tag${i}`)

  it('без явного limit отдаёт всё облако', () => {
    expect(filterTagSuggestions(big, '', [])).toHaveLength(60)
  })

  it('без явного limit отдаёт все совпадения', () => {
    expect(filterTagSuggestions(big, 'tag1', [])).toHaveLength(11) // tag1 + tag10..tag19
  })
})

describe('resolveTagOnEnter (N16)', () => {
  const list = ['vuejs', 'vue3', 'vite']

  it('без выбора стрелками добавляет набранное слово, а не первую подсказку', () => {
    expect(resolveTagOnEnter(list, NO_ACTIVE_SUGGESTION, 'vue')).toBe('vue')
  })

  it('пустое поле по Enter ничего не добавляет, даже при открытом списке', () => {
    expect(resolveTagOnEnter(list, NO_ACTIVE_SUGGESTION, '')).toBeNull()
    expect(resolveTagOnEnter(list, NO_ACTIVE_SUGGESTION, '   ')).toBeNull()
  })

  it('выбранная стрелками подсказка побеждает набранный текст', () => {
    expect(resolveTagOnEnter(list, 1, 'vu')).toBe('vue3')
  })

  it('индекс за пределами списка — набранное слово', () => {
    expect(resolveTagOnEnter([], 0, 'vue')).toBe('vue')
  })
})
