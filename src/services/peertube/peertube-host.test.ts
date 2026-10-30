import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchHttpMock } = vi.hoisted(() => ({ fetchHttpMock: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ fetchHttp: fetchHttpMock }))

import {
  fetchPeertubeHostAllowlist,
  knownPeertubeHosts,
  parseAllServers,
  parseRoyHosts,
  resetPeertubeHostAllowlistCache,
  resolvePeertubeHost,
  resolvePeertubeHosts,
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

describe('parseRoyHosts', () => {
  it('объект роёв (ответ peertube/roys) → хосты по порядку', () => {
    expect(
      parseRoyHosts({ '0': 'peertube101.pocketnet.app', '1': 'peertube1000.pocketnet.app' })
    ).toEqual(['peertube101.pocketnet.app', 'peertube1000.pocketnet.app'])
  })

  it('массив тоже годится; повторы, пустые и не-строки отбрасываются', () => {
    expect(parseRoyHosts([' a.app ', 'a.app', '', 7, null, 'b.app'])).toEqual(['a.app', 'b.app'])
  })

  it('мусор → пустой список', () => {
    expect(parseRoyHosts(null)).toEqual([])
    expect(parseRoyHosts('host')).toEqual([])
  })
})

describe('хосты загрузки без прокси', () => {
  beforeEach(() => {
    localStorage.removeItem('bastyon_peertube_roys')
    fetchHttpMock.mockReset()
  })

  it('прокси ответил — список запоминается; потом не ответил — берётся он', async () => {
    fetchHttpMock.mockResolvedValueOnce({ 0: 'a.example', 1: 'b.example' })
    expect(await resolvePeertubeHosts('upload')).toEqual(['a.example', 'b.example'])
    fetchHttpMock.mockRejectedValue(new Error('Proxy servers are unreachable'))
    expect(await resolvePeertubeHosts('upload')).toEqual(['a.example', 'b.example'])
    expect(await resolvePeertubeHost('upload')).toBe('a.example')
  })

  it('до первого ответа — встроенный список; «мест нет» от прокси — ошибка', async () => {
    fetchHttpMock.mockRejectedValue(new Error('Proxy servers are unreachable'))
    expect(knownPeertubeHosts('upload')).toContain('peertube800.pocketnet.app')
    expect(await resolvePeertubeHost('upload')).toBe('peertube800.pocketnet.app')
    fetchHttpMock.mockReset().mockResolvedValue({})
    await expect(resolvePeertubeHost('upload')).rejects.toThrow('peertube_no_host')
  })
})
