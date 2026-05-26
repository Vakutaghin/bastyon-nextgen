import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ActionRegistry } from './registry'
import { RPC_ACTIONS, clearRpcCache } from './rpc'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

type RpcMock = Mock<
  (method: string, params?: unknown[], options?: unknown, signal?: AbortSignal) => Promise<unknown>
>

function setup(callRpc: RpcMock = vi.fn(async () => ({ ok: true })) as RpcMock) {
  const host = makeMockHost({ callRpc })
  const resolver = makeResolver()
  const reg = new ActionRegistry({ host, resolver, actions: RPC_ACTIONS })
  return { reg, host, callRpc }
}

describe('rpc action', () => {
  beforeEach(() => {
    setupTestPinia()
    clearRpcCache()
  })

  it('calls host.callRpc with method/params/options', async () => {
    const { reg, callRpc } = setup()
    await reg.execute(
      'rpc',
      TEST_APP,
      { method: 'getnodeinfo', parameters: [1, 'abc'], options: { fnode: 'n:8081' } },
      new AbortController().signal
    )

    expect(callRpc).toHaveBeenCalledOnce()
    const firstCall = callRpc.mock.calls[0] as unknown as [
      string,
      unknown[],
      Record<string, unknown>,
    ]
    expect(firstCall[0]).toBe('getnodeinfo')
    expect(firstCall[1]).toEqual([1, 'abc'])
    expect(firstCall[2]).toEqual({ fnode: 'n:8081' })
  })

  it('returns RPC result as-is', async () => {
    const { reg } = setup(vi.fn(async () => ({ height: 12345 })) as RpcMock)
    const r = await reg.execute(
      'rpc',
      TEST_APP,
      { method: 'getcoininfo' },
      new AbortController().signal
    )
    expect(r).toEqual({ height: 12345 })
  })

  it('rejects on missing method (schema)', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('rpc', TEST_APP, { parameters: [] }, new AbortController().signal)
    ).rejects.toThrow(/invalid_params/)
  })

  // ─── cachetime ──────────────────────────────────────────────────────────

  it('cachetime>0 deduplicates within TTL', async () => {
    const { reg, callRpc } = setup(vi.fn(async () => ({ v: 1 })) as RpcMock)
    const opts = { method: 'getnodeinfo', options: { cachetime: 60 } }
    const r1 = await reg.execute('rpc', TEST_APP, opts, new AbortController().signal)
    const r2 = await reg.execute('rpc', TEST_APP, opts, new AbortController().signal)
    expect(r1).toEqual({ v: 1 })
    expect(r2).toEqual({ v: 1 })
    expect(callRpc).toHaveBeenCalledOnce()
  })

  it('cachetime=0 always re-fetches', async () => {
    const { reg, callRpc } = setup()
    const opts = { method: 'x', options: { cachetime: 0 } }
    await reg.execute('rpc', TEST_APP, opts, new AbortController().signal)
    await reg.execute('rpc', TEST_APP, opts, new AbortController().signal)
    expect(callRpc).toHaveBeenCalledTimes(2)
  })

  it('omitted cachetime always re-fetches', async () => {
    const { reg, callRpc } = setup()
    await reg.execute('rpc', TEST_APP, { method: 'x' }, new AbortController().signal)
    await reg.execute('rpc', TEST_APP, { method: 'x' }, new AbortController().signal)
    expect(callRpc).toHaveBeenCalledTimes(2)
  })

  it('different parameters cache separately', async () => {
    const { reg, callRpc } = setup(
      vi.fn(async (_m: string, params?: unknown[]) => ({ p: params?.[0] })) as RpcMock
    )
    await reg.execute(
      'rpc',
      TEST_APP,
      { method: 'x', parameters: ['a'], options: { cachetime: 60 } },
      new AbortController().signal
    )
    await reg.execute(
      'rpc',
      TEST_APP,
      { method: 'x', parameters: ['b'], options: { cachetime: 60 } },
      new AbortController().signal
    )
    expect(callRpc).toHaveBeenCalledTimes(2)
  })

  it('expired entry triggers re-fetch', async () => {
    const callRpc = vi.fn(async () => ({ v: 1 })) as RpcMock
    const { reg } = setup(callRpc)

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      await reg.execute(
        'rpc',
        TEST_APP,
        { method: 'x', options: { cachetime: 60 } },
        new AbortController().signal
      )
      // 61 секунда спустя — кэш протух
      vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
      await reg.execute(
        'rpc',
        TEST_APP,
        { method: 'x', options: { cachetime: 60 } },
        new AbortController().signal
      )
      expect(callRpc).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('errors are NOT cached — next call retries', async () => {
    let attempts = 0
    const callRpc = vi.fn(async () => {
      attempts++
      if (attempts === 1) throw new Error('temporary')
      return { ok: true }
    }) as RpcMock
    const { reg } = setup(callRpc)
    const opts = { method: 'x', options: { cachetime: 60 } }

    await expect(reg.execute('rpc', TEST_APP, opts, new AbortController().signal)).rejects.toThrow(
      /temporary/
    )

    const r = await reg.execute('rpc', TEST_APP, opts, new AbortController().signal)
    expect(r).toEqual({ ok: true })
    expect(attempts).toBe(2)
  })

  it('clearRpcCache empties the cache', async () => {
    const { reg, callRpc } = setup(vi.fn(async () => ({ v: 1 })) as RpcMock)
    const opts = { method: 'x', options: { cachetime: 60 } }
    await reg.execute('rpc', TEST_APP, opts, new AbortController().signal)
    clearRpcCache()
    await reg.execute('rpc', TEST_APP, opts, new AbortController().signal)
    expect(callRpc).toHaveBeenCalledTimes(2)
  })

  it('no authorization needed (rpc — публичный chain data)', async () => {
    const host = makeMockHost({
      isUserAuthenticated: () => false,
      callRpc: vi.fn(async () => ({ height: 1 })),
    })
    const reg = new ActionRegistry({ host, resolver: makeResolver(), actions: RPC_ACTIONS })
    await expect(
      reg.execute('rpc', TEST_APP, { method: 'getcoininfo' }, new AbortController().signal)
    ).resolves.toEqual({ height: 1 })
  })
})
