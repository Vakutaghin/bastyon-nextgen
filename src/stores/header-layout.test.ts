// Раскладка шапки и меню: сохранённое сводится с пунктами по умолчанию так,
// что новые пункты из новых версий встают рядом со своими соседями, а
// испорченная запись не ломает шапку.

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MENU_LAYOUT,
  isDefaultLayout,
  mergeLayout,
  moveEntry,
  type LayoutEntry,
} from './header-layout'

type Id = 'a' | 'b' | 'c' | 'd'
const DEFAULTS: LayoutEntry<Id>[] = [
  { id: 'a', visible: true },
  { id: 'b', visible: true },
  { id: 'c', visible: false },
  { id: 'd', visible: true },
]
const ids = (list: LayoutEntry[]) => list.map((e) => `${e.id}${e.visible ? '' : '-'}`)

describe('mergeLayout', () => {
  it('свой порядок и видимость сохраняются', () => {
    const saved = [
      { id: 'd', visible: true },
      { id: 'a', visible: false },
      { id: 'c', visible: true },
      { id: 'b', visible: true },
    ]
    expect(ids(mergeLayout(saved, DEFAULTS))).toEqual(['d', 'a-', 'c', 'b'])
  })

  it('новый пункт встаёт за своим соседом по умолчанию, со своей видимостью', () => {
    // В сохранённом нет «c» (его добавили в новой версии): он идёт за «b».
    const saved = [
      { id: 'b', visible: true },
      { id: 'd', visible: true },
      { id: 'a', visible: true },
    ]
    expect(ids(mergeLayout(saved, DEFAULTS))).toEqual(['b', 'c-', 'd', 'a'])
  })

  it('новый первый пункт — в начало', () => {
    expect(ids(mergeLayout([{ id: 'b', visible: true }], DEFAULTS))).toEqual(['a', 'b', 'c-', 'd'])
  })

  it('незнакомое, повторы и мусор отбрасываются', () => {
    const saved = [
      { id: 'gone', visible: true },
      { id: 'a', visible: false },
      { id: 'a', visible: true },
      null,
      'b',
      { id: 7 },
    ]
    expect(ids(mergeLayout(saved, DEFAULTS))).toEqual(['a-', 'b', 'c-', 'd'])
    expect(ids(mergeLayout('испорчено', DEFAULTS))).toEqual(['a', 'b', 'c-', 'd'])
  })

  it('закреплённый пункт всегда виден', () => {
    const saved = DEFAULT_MENU_LAYOUT.map((e) => ({ ...e, visible: false }))
    const merged = mergeLayout(saved, DEFAULT_MENU_LAYOUT, ['settings'])
    expect(merged.find((e) => e.id === 'settings')?.visible).toBe(true)
    expect(merged.filter((e) => e.visible)).toHaveLength(1)
  })
})

describe('moveEntry и isDefaultLayout', () => {
  it('переставляет вниз и вверх; за пределами списка — без изменений', () => {
    expect(moveEntry(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveEntry(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveEntry(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })

  it('раскладка, совпавшая с умолчанием, — «по умолчанию»', () => {
    expect(
      isDefaultLayout(
        DEFAULTS.map((e) => ({ ...e })),
        DEFAULTS
      )
    ).toBe(true)
    expect(isDefaultLayout(moveEntry(DEFAULTS, 0, 1), DEFAULTS)).toBe(false)
  })
})
