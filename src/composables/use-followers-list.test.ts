// Порядок списков подписчиков и подписок и запрос поиска: нода отдаёт в
// строках репутацию ×10 и высоту блока подписки, по ним и сортируем.

import { describe, expect, it } from 'vitest'
import { normalizeRelationQuery, sortRelations } from './use-followers-list'

const row = (address: string, reputation: number | null, height: number) => ({
  address,
  reputation,
  height,
})

describe('sortRelations', () => {
  const list = [row('A', 5, 100), row('B', 300, 50), row('C', null, 200), row('D', 300, 70)]

  it('сначала новые — по высоте блока подписки', () => {
    expect(sortRelations(list, 'new').map((r) => r.address)).toEqual(['C', 'A', 'D', 'B'])
  })

  it('по репутации; при равной — кто подписался позже; без репутации — в конце', () => {
    expect(sortRelations(list, 'reputation').map((r) => r.address)).toEqual(['D', 'B', 'A', 'C'])
  })

  it('без высот порядок ноды сохраняется', () => {
    const flat = [row('X', 1, 0), row('Y', 1, 0), row('Z', 1, 0)]
    expect(sortRelations(flat, 'new').map((r) => r.address)).toEqual(['X', 'Y', 'Z'])
  })
})

describe('normalizeRelationQuery', () => {
  it('без пробелов по краям, @ и регистра', () => {
    expect(normalizeRelationQuery('  @@Anna_NG ')).toBe('anna_ng')
    expect(normalizeRelationQuery('   ')).toBe('')
  })
})
