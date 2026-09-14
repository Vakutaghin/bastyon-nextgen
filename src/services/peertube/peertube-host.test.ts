import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  fetchPeertubeHostAllowlist,
  parseAllServers,
  resetPeertubeHostAllowlistCache,
} from './peertube-host'

beforeEach(() => resetPeertubeHostAllowlistCache())

describe('parseAllServers', () => {
  it('рои как объект массивов (ответ ноды) → плоский набор хостов в нижнем регистре', () => {
    const set = parseAllServers({ '0': ['A.host', 'b.host'], '1': ['b.host', 'C.host'] })
    expect([...set].sort()).toEqual(['a.host', 'b.host', 'c.host'])
  })
  it('рои как массив массивов и как объекты { host: {...} } тоже читаются; мусор — пусто', () => {
    expect([...parseAllServers([['x.host'], { 'y.host': { host: 'y.host' } }])].sort()).toEqual([
      'x.host',
      'y.host',
    ])
    expect(parseAllServers(null).size).toBe(0)
    expect(parseAllServers('nope').size).toBe(0)
  })
})

describe('fetchPeertubeHostAllowlist', () => {
  it('берёт data из ответа, кэширует на 10 минут', async () => {
    const fetch = vi.fn(async () => ({ result: 'success', data: { '0': ['h1'] } }))
    let now = 1_000
    const a = await fetchPeertubeHostAllowlist(fetch as never, () => now)
    expect(a.has('h1')).toBe(true)
    now += 60_000
    await fetchPeertubeHostAllowlist(fetch as never, () => now)
    expect(fetch).toHaveBeenCalledTimes(1)
    now += 10 * 60_000
    await fetchPeertubeHostAllowlist(fetch as never, () => now)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('пустой список — ошибка (fail-closed у вызывающего)', async () => {
    await expect(fetchPeertubeHostAllowlist((async () => ({ data: {} })) as never)).rejects.toThrow(
      'peertube_allowlist_empty'
    )
  })
})
