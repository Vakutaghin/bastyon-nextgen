// Топ аккаунтов: самые репутационные подписчики самых подписываемых
// аккаунтов, объединённые по адресу, плюс сами эти аккаунты. Узел, который не
// ответил, не валит топ; не ответил никто — ошибка.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpcCall: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ rpcCall: mocks.rpcCall }))

import {
  TOP_HUBS,
  TOP_SIZE,
  fetchTopByReputation,
  mergeTop,
  subscriberToEntry,
} from './top-accounts'

describe('mergeTop и subscriberToEntry', () => {
  it('у адреса — наибольшая репутация, по убыванию, при равной — по адресу', () => {
    const top = mergeTop([
      [
        { address: 'B', reputation: 50 },
        { address: 'A', reputation: 10 },
      ],
      [
        { address: 'A', reputation: 70 },
        { address: 'C', reputation: 50 },
      ],
    ])
    expect(top).toEqual([
      { address: 'A', reputation: 70 },
      { address: 'B', reputation: 50 },
      { address: 'C', reputation: 50 },
    ])
    expect(
      mergeTop(
        [
          [
            { address: 'A', reputation: 1 },
            { address: 'B', reputation: 2 },
          ],
        ],
        1
      )
    ).toEqual([{ address: 'B', reputation: 2 }])
  })

  it('репутация подписчика у ноды ×10; поле с опечаткой тоже читается', () => {
    expect(subscriberToEntry({ address: 'A', reputation: 1523371 })).toEqual({
      address: 'A',
      reputation: 152337.1,
    })
    expect(subscriberToEntry({ adddress: 'B', reputation: '20' })).toEqual({
      address: 'B',
      reputation: 2,
    })
    expect(subscriberToEntry({ reputation: 5 })).toBeNull()
  })
})

describe('fetchTopByReputation', () => {
  beforeEach(() => {
    mocks.rpcCall.mockReset()
  })

  it('спрашивает каждый узел по репутации сразу на весь топ и добавляет сами узлы', async () => {
    mocks.rpcCall.mockImplementation(async (req: { method: string; parameters: unknown[] }) => {
      if (req.method === 'getuserprofile') {
        return [{ address: TOP_HUBS[0], name: 'founder', reputation: 100 }]
      }
      if (req.parameters[0] === TOP_HUBS[1]) throw new Error('sql request timeout')
      return [
        { address: 'PTop', reputation: 5000 },
        { address: `P-${req.parameters[0]}`, reputation: 20 },
      ]
    })
    const { entries, profiles } = await fetchTopByReputation()
    const hubCalls = mocks.rpcCall.mock.calls.filter(([r]) => r.method === 'getusersubscribers')
    expect(hubCalls.map(([r]) => r.parameters)).toEqual(
      TOP_HUBS.map((hub) => [hub, 'reputation', true, 0, TOP_SIZE])
    )
    expect(entries[0]).toEqual({ address: 'PTop', reputation: 500 })
    expect(entries[1]).toEqual({ address: TOP_HUBS[0], reputation: 100 })
    expect(entries.map((e) => e.address)).not.toContain(`P-${TOP_HUBS[1]}`)
    expect(profiles[0]?.name).toBe('founder')
  })

  it('не ответил ни один узел — ошибка, а не пустой топ', async () => {
    mocks.rpcCall.mockImplementation(async (req: { method: string }) => {
      if (req.method === 'getuserprofile') return []
      throw new Error('offline')
    })
    await expect(fetchTopByReputation()).rejects.toThrow('offline')
  })
})
