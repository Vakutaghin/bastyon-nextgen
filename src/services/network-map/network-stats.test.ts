// Цифры вкладки «Сеть»: строки нод с пулами прокси, страны, версии и итоги.

import { describe, expect, it } from 'vitest'
import { applyNodeInfo, emptySnapshot, linkKey } from './network-snapshot'
import {
  buildNodeRows,
  compareVersions,
  countryShares,
  networkTotals,
  versionShares,
} from './network-stats'

function snapshot() {
  const snap = emptySnapshot()
  const add = (ip: string, extra: object) =>
    snap.nodes.set(ip, { ip, listening: true, answered: false, ...extra })
  add('a', { country: 'RU', version: '0.22.21', height: 100, services: 1033, answered: true })
  add('b', { country: 'RU', version: '0.22.21', height: 99, services: 1032 })
  add('c', { country: 'DE', version: '0.22.20', height: 80, listening: false })
  add('d', { country: null })
  snap.links.set(linkKey('a', 'b'), {})
  snap.links.set(linkKey('a', 'c'), {})
  snap.proxies = [
    {
      host: '1.pocketnet.app',
      port: 8899,
      ok: true,
      pool: [{ ip: 'a', users: 30, successPercent: 95, avgMs: 200, fork: false }],
    },
    {
      host: '2.pocketnet.app',
      port: 8899,
      ok: true,
      sameAs: '1.pocketnet.app',
      pool: [{ ip: 'a', users: 30, fork: false }],
    },
  ]
  return snap
}

describe('network-stats', () => {
  it('версии сравниваются по числам, а не по буквам', () => {
    expect(compareVersions('0.22.21', '0.22.4')).toBeGreaterThan(0)
    expect(compareVersions('0.20.19', '0.22.4')).toBeLessThan(0)
    expect(compareVersions('0.22', '0.22.0')).toBe(0)
  })

  it('строка ноды: отставание, связи, тип, прокси и приложения через неё', () => {
    const rows = buildNodeRows(snapshot())
    const a = rows.find((r) => r.ip === 'a')!
    expect(a).toMatchObject({
      sync: 'synced',
      lag: 0,
      degree: 2,
      kind: 'full',
      proxies: ['1.pocketnet.app', '2.pocketnet.app'],
      users: 60,
      successPercent: 95,
    })
    expect(rows.find((r) => r.ip === 'b')).toMatchObject({ kind: 'pruned', lag: 1 })
    expect(rows.find((r) => r.ip === 'c')).toMatchObject({ sync: 'behind', lag: 20 })
    expect(rows.find((r) => r.ip === 'd')).toMatchObject({ sync: 'unknown', proxies: [] })
  })

  it('страны и версии по убыванию, неизвестные — отдельно', () => {
    const rows = buildNodeRows(snapshot())
    expect(countryShares(rows)).toEqual({
      known: [
        { key: 'RU', count: 2, share: 0.5 },
        { key: 'DE', count: 1, share: 0.25 },
      ],
      unknown: 1,
    })
    const versions = versionShares(rows)
    expect(versions.latest).toBe('0.22.21')
    expect(versions.versions.map((v) => [v.key, v.count])).toEqual([
      ['0.22.21', 2],
      ['0.22.20', 1],
    ])
    expect(versions.unknown).toBe(1)
  })

  it('итоги для карточек сверху; чужая ветка видна отдельно', () => {
    const snap = snapshot()
    applyNodeInfo(snap, 'a', { lastblock: { height: 100, hash: 'x' } })
    applyNodeInfo(snap, 'b', { lastblock: { height: 100, hash: 'x' } })
    applyNodeInfo(snap, 'd', { lastblock: { height: 100, hash: 'y' } })
    const totals = networkTotals(snap, buildNodeRows(snap))
    expect(totals).toMatchObject({
      nodes: 4,
      answered: 1,
      listening: 3,
      links: 2,
      countries: 2,
      synced: 3,
      behind: 1,
      forked: 1,
      full: 1,
      pruned: 1,
      latest: '0.22.21',
      onLatest: 2,
      tip: 100,
    })
    expect(totals.syncedShare).toBeCloseTo(0.75)
  })
})
