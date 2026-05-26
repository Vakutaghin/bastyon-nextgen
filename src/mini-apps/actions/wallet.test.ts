import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { WALLET_ACTIONS } from './wallet'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

function setup(hostOverrides = {}, resolverOpts = {}) {
  const host = makeMockHost(hostOverrides)
  const resolver = makeResolver(resolverOpts)
  const reg = new ActionRegistry({ host, resolver, actions: WALLET_ACTIONS })
  return { reg, host, resolver }
}

describe('balance action', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('returns balance from host', async () => {
    const balance = { available: 1.5, frozen: 0.2 }
    const { reg } = setup({ getUserBalance: vi.fn(async () => balance) })
    const r = await reg.execute('balance', TEST_APP, {}, new AbortController().signal)
    expect(r).toEqual(balance)
  })

  it('returns {} when user not logged in', async () => {
    const { reg } = setup({ getUserBalance: vi.fn(async () => ({})) })
    const r = await reg.execute('balance', TEST_APP, {}, new AbortController().signal)
    expect(r).toEqual({})
  })

  it('requires authorization', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    await expect(
      reg.execute('balance', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/required_authorization/)
  })

  it('requires account permission', async () => {
    const { reg } = setup({}, { auto: false })
    await expect(
      reg.execute('balance', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/permission_denied/)
  })
})

describe('fromToTransactions action', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('calls RPC with correct legacy parameters', async () => {
    const callRpc = vi.fn(async () => [])
    const { reg } = setup({ callRpc })
    await reg.execute(
      'fromToTransactions',
      TEST_APP,
      {
        addressFrom: 'A',
        addressTo: 'B',
        update: true,
        depth: 10,
        opreturn: false,
      },
      new AbortController().signal
    )

    expect(callRpc).toHaveBeenCalledOnce()
    const firstCall = callRpc.mock.calls[0] as [string, unknown[]] | undefined
    expect(firstCall?.[0]).toBe('getfromtotransactions')
    expect(firstCall?.[1]).toEqual(['A', 'B', true, 10, false])
  })

  it('returns RPC result when no confirmations filter', async () => {
    const txs = [
      { height: 100, txid: 't1' },
      { height: 200, txid: 't2' },
    ]
    const { reg } = setup({ callRpc: vi.fn(async () => txs) })
    const r = await reg.execute(
      'fromToTransactions',
      TEST_APP,
      { addressFrom: 'A', addressTo: 'B' },
      new AbortController().signal
    )
    expect(r).toEqual(txs)
  })

  it('filters by confirmations when requested', async () => {
    const txs = [
      { height: 990_995, txid: 'old' }, // 5 confirmations
      { height: 999_999, txid: 'one-conf' }, // 1 confirmation
      { height: 999_500, txid: 'pending' }, // 500 confirmations
    ]
    const callRpc = vi.fn(async () => txs)
    const getCurrentBlockHeight = vi.fn(async () => 1_000_000)
    const { reg } = setup({ callRpc, getCurrentBlockHeight })

    const r = (await reg.execute(
      'fromToTransactions',
      TEST_APP,
      { addressFrom: 'A', addressTo: 'B', confirmations: 6 },
      new AbortController().signal
    )) as Array<{ txid: string }>

    expect(r.map((t) => t.txid).sort()).toEqual(['old', 'pending'])
    expect(getCurrentBlockHeight).toHaveBeenCalledOnce()
  })

  it('confirmations=0 skips filter even if RPC returns data', async () => {
    const txs = [{ height: 100, txid: 't1' }]
    const getCurrentBlockHeight = vi.fn()
    const { reg } = setup({ callRpc: vi.fn(async () => txs), getCurrentBlockHeight })

    await reg.execute(
      'fromToTransactions',
      TEST_APP,
      { addressFrom: 'A', addressTo: 'B', confirmations: 0 },
      new AbortController().signal
    )

    expect(getCurrentBlockHeight).not.toHaveBeenCalled()
  })

  it('returns empty array if RPC returns non-array', async () => {
    const { reg } = setup({ callRpc: vi.fn(async () => null) })
    const r = await reg.execute(
      'fromToTransactions',
      TEST_APP,
      { addressFrom: 'A', addressTo: 'B' },
      new AbortController().signal
    )
    expect(r).toEqual([])
  })

  it('rejects missing addressFrom/addressTo at schema validation', async () => {
    const { reg } = setup()
    await expect(
      reg.execute(
        'fromToTransactions',
        TEST_APP,
        { addressFrom: 'A' },
        new AbortController().signal
      )
    ).rejects.toThrow(/invalid_params/)
  })

  it('propagates RPC error', async () => {
    const { reg } = setup({
      callRpc: vi.fn(async () => {
        throw new Error('rpc_down')
      }),
    })
    await expect(
      reg.execute(
        'fromToTransactions',
        TEST_APP,
        { addressFrom: 'A', addressTo: 'B' },
        new AbortController().signal
      )
    ).rejects.toThrow(/rpc_down/)
  })

  it('does NOT require permission (legacy permissions: [])', async () => {
    // Permission resolver denies — но fromToTransactions всё равно проходит
    const { reg } = setup({ callRpc: vi.fn(async () => []) }, { auto: false })
    await expect(
      reg.execute(
        'fromToTransactions',
        TEST_APP,
        { addressFrom: 'A', addressTo: 'B' },
        new AbortController().signal
      )
    ).resolves.toEqual([])
  })

  it('still requires authorization', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    await expect(
      reg.execute(
        'fromToTransactions',
        TEST_APP,
        { addressFrom: 'A', addressTo: 'B' },
        new AbortController().signal
      )
    ).rejects.toThrow(/required_authorization/)
  })
})
