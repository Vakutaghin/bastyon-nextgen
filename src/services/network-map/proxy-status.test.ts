// Сводка прокси (`/info`): пул нод, приложения онлайн, нагрузка; одно имя
// сервера не считаем дважды; мёртвый прокси — без сводки.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const appFetch = vi.hoisted(() => vi.fn())
vi.mock('@/helpers/api/request', () => ({ appFetch }))

import { markSameServers, parseProxyInfo, probeProxy } from './proxy-status'
import type { ProxyState } from './network-snapshot'

const INFO = {
  info: {
    nodeManager: {
      count: 79,
      nodes: {
        '5.189.141.204:38081': {
          node: { version: '0.22.21', wssusers: 8 },
          statistic: { percent: 86.8, time: 1320.9 },
          status: { fork: false, difference: 1 },
          users: 8,
        },
        '127.0.0.1:38081': { node: { version: null }, users: 3, status: { fork: true } },
      },
    },
    wss: { clients: 640, users: 429 },
    server: { startedDate: '2026-10-09T08:24:29.744Z', middle: { rate: 22.46 } },
  },
}

function json(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body }
}

describe('proxy-status', () => {
  beforeEach(() => appFetch.mockReset())

  it('пул, приложения онлайн и нагрузка из /info', () => {
    expect(parseProxyInfo('3.pocketnet.app', INFO)).toEqual({
      known: 79,
      pool: [
        {
          ip: '5.189.141.204',
          version: '0.22.21',
          users: 8,
          successPercent: 87,
          avgMs: 1321,
          lag: 1,
          fork: false,
        },
        { ip: 'local@3.pocketnet.app', users: 3, fork: true },
      ],
      clients: 640,
      users: 429,
      rps: 22.5,
      startedAt: '2026-10-09T08:24:29.744Z',
    })
    expect(parseProxyInfo('x', null)).toEqual({ pool: [] })
  })

  it('два имени одного сервера (один момент запуска) — второй помечен', () => {
    const proxies: ProxyState[] = [
      { host: '1.pocketnet.app', port: 8899, ok: true, pool: [], startedAt: 'T1' },
      { host: '2.pocketnet.app', port: 8899, ok: true, pool: [], startedAt: 'T1' },
      { host: '3.pocketnet.app', port: 8899, ok: true, pool: [], startedAt: 'T2' },
      { host: '4.pocketnet.app', port: 8899, ok: false, pool: [] },
    ]
    markSameServers(proxies)
    expect(proxies.map((p) => p.sameAs)).toEqual([
      undefined,
      '1.pocketnet.app',
      undefined,
      undefined,
    ])
  })

  it('живой прокси: /ping, затем /info', async () => {
    appFetch.mockImplementation(async (...args: unknown[]) =>
      String(args[0]).endsWith('/ping')
        ? json({ data: { node: '94.156.128.149:38081', height: 4_083_413 } })
        : json({ data: INFO })
    )
    const state = await probeProxy({ host: '1.pocketnet.app', port: 8899 }, true)
    expect(state).toMatchObject({
      ok: true,
      height: 4_083_413,
      bestNode: '94.156.128.149',
      clients: 640,
    })
    expect(state.latencyMs).toBeGreaterThanOrEqual(0)
    expect(appFetch.mock.calls.map(([url]) => url)).toEqual([
      'https://1.pocketnet.app:8899/ping',
      'https://1.pocketnet.app:8899/info',
    ])
  })

  it('мёртвый прокси — без сводки; сводка не пришла — прокси всё равно живой', async () => {
    appFetch.mockRejectedValueOnce(new Error('timeout'))
    expect(await probeProxy({ host: '4.pocketnet.app', port: 8899 }, true)).toEqual({
      host: '4.pocketnet.app',
      port: 8899,
      ok: false,
      pool: [],
    })
    expect(appFetch).toHaveBeenCalledTimes(1)

    appFetch.mockResolvedValueOnce(json({ data: {} })).mockResolvedValueOnce(json({}, false))
    expect(await probeProxy({ host: '3.pocketnet.app', port: 8899 }, true)).toMatchObject({
      ok: true,
      pool: [],
    })
  })
})
