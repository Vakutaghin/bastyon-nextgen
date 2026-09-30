// Счётчик публикаций в профиле равен числу постов в ленте профиля. Числа —
// из живых ответов ноды 30.09.2026: `postcnt` там расходился с лентой, а сумма
// `content` по типам совпадала с ней у всех проверенных авторов.

import { describe, expect, it } from 'vitest'

import { publicationsCount } from './publications-count'

describe('publicationsCount', () => {
  it('один пост, а postcnt ноды — 0: показываем 1', () => {
    expect(publicationsCount({ postcnt: 0, content: { 200: 1 } })).toBe(1)
  })

  it('postcnt на один меньше ленты: считаем по content (61 пост + 27 видео)', () => {
    expect(publicationsCount({ postcnt: 87, content: { 200: 61, 201: 27, 207: 53 } })).toBe(88)
  })

  it('аудио, статьи и стримы — тоже публикации; удаления (207) — нет', () => {
    expect(publicationsCount({ content: { 200: 7, 210: 2 } })).toBe(9)
    expect(publicationsCount({ content: { 200: 136, 201: 179, 202: 1, 207: 43 } })).toBe(316)
    expect(publicationsCount({ content: { 209: 3, 207: 5 } })).toBe(3)
  })

  it('без content — postcnt или publications_count', () => {
    expect(publicationsCount({ postcnt: 12 })).toBe(12)
    expect(publicationsCount({ publications_count: 4, postcnt: 12 })).toBe(4)
    expect(publicationsCount({ content: {}, postcnt: 2 })).toBe(2)
    expect(publicationsCount({ content: { 207: 3 }, postcnt: 0 })).toBe(0)
  })

  it('нет профиля или мусор в числах — 0, а не NaN', () => {
    expect(publicationsCount(null)).toBe(0)
    expect(publicationsCount(undefined)).toBe(0)
    expect(publicationsCount({ postcnt: Number.NaN })).toBe(0)
    expect(publicationsCount({ content: { 200: Number.NaN, 201: -1, 202: 2 } })).toBe(2)
  })
})
