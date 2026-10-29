// Легенда схемы — она же фильтр: у каждой ноды группа совпадает с одной из
// строк легенды, в каждом режиме раскраски.

import { describe, expect, it } from 'vitest'
import type { NodeRow } from '@/services/network-map/network-stats'
import { buildColoring, COLOR_MODES, type Palette } from './topology-palette'

const PALETTE = new Proxy({} as Palette, { get: (_, key) => `#${String(key)}` })

function row(ip: string, extra: Partial<NodeRow>): NodeRow {
  return {
    ip,
    listening: true,
    answered: true,
    sync: 'synced',
    forked: false,
    kind: 'full',
    degree: 1,
    proxies: [],
    users: 0,
    ...extra,
  }
}

// Восемь стран: шесть получают цвет, остальные — «Другие»; одна нода без страны.
const ROWS: NodeRow[] = [
  ...['DE', 'DE', 'RU', 'US', 'FI', 'NL', 'FR', 'PL', 'CA'].map((country, i) =>
    row(`10.0.0.${i}`, { country, version: `0.22.${i % 3}` })
  ),
  row('10.0.1.1', { country: null, sync: 'behind', listening: false, kind: 'pruned' }),
  row('10.0.1.2', { forked: true, kind: 'unknown' }),
]

describe('buildColoring', () => {
  it.each(COLOR_MODES)('режим %s: группа ноды — строка легенды, счёт сходится', (mode) => {
    const coloring = buildColoring(mode, ROWS, PALETTE, (code) => code)
    const keys = new Set(coloring.legend.map((e) => e.key))
    expect(keys.size).toBe(coloring.legend.length)
    const counts = new Map<string, number>()
    for (const r of ROWS) {
      const group = coloring.groupOf(r)
      expect(keys).toContain(group)
      counts.set(group, (counts.get(group) ?? 0) + 1)
    }
    for (const entry of coloring.legend) expect(counts.get(entry.key)).toBe(entry.count)
  })
})
