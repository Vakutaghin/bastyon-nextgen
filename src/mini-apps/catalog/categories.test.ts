import { describe, expect, it } from 'vitest'

import { BUILT_IN_APPS } from '@/mini-apps/registry/built-in'
import {
  BUILT_IN_CATEGORIES,
  MINI_APP_CATEGORIES,
  categoriesOfTags,
  categoryQueryTags,
  isShelfAllowed,
} from './categories'

describe('разделы каталога', () => {
  it('теги на разных языках и в разном регистре сводятся в один раздел', () => {
    expect(categoriesOfTags(['music', 'radio'])).toEqual(['music'])
    expect(categoriesOfTags(['Музыка'])).toEqual(['music'])
    expect(categoriesOfTags(['игры', 'тетрис'])).toEqual(['games'])
    expect(categoriesOfTags(['education', 'game'])).toEqual(['games', 'learning'])
    expect(categoriesOfTags(['анимация', 'архитектура'])).toEqual([])
  })

  it('в запрос к ноде уходят и варианты с заглавной буквы', () => {
    const tags = categoryQueryTags('games')
    expect(tags).toContain('игры')
    expect(tags).toContain('Игры')
    expect(tags).toContain('Game')
  })

  it('теги разделов записаны в нижнем регистре и не повторяются между разделами', () => {
    const seen = new Set<string>()
    for (const c of MINI_APP_CATEGORIES) {
      for (const tag of c.tags) {
        expect(tag).toBe(tag.toLowerCase())
        expect(seen.has(tag), tag).toBe(false)
        seen.add(tag)
      }
    }
  })

  it('у каждого встроенного приложения есть раздел', () => {
    for (const app of BUILT_IN_APPS) expect(BUILT_IN_CATEGORIES[app.id], app.id).toBeTruthy()
  })

  it('VPN не попадает на полку в ленте', () => {
    expect(isShelfAllowed(['vpn', 'впн'])).toBe(false)
    expect(isShelfAllowed(['VPN'])).toBe(false)
    expect(isShelfAllowed(['security', 'privacy'])).toBe(true)
    expect(isShelfAllowed([])).toBe(true)
  })
})
