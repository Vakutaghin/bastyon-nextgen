// «Крупные кошельки»: стейкеры блоков и активные адреса с балансами, строки
// по убыванию баланса; при повторном заходе проверенные блоки и свежие
// балансы берутся из localStorage — спрашиваются только новые блоки.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({
  getByPRC: vi.fn(),
  blocks: [] as string[],
  stakers: {} as Record<string, string>,
  balances: {} as Record<string, number>,
}))

vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.getByPRC }))
vi.mock('./use-explorer-preferred-node', () => ({ getExplorerRpcConfig: () => undefined }))
vi.mock('./use-active-addresses', () => ({
  useActiveAddresses: () => ({
    data: ref({
      addresses: [
        { address: 'PActive', appearances: 9, txCount: 9, volumeIn: 0, volumeOut: 0 },
        { address: 'PStakerA', appearances: 2, txCount: 2, volumeIn: 0, volumeOut: 0 },
      ],
    }),
    isLoading: ref(false),
  }),
}))
vi.mock('./use-block-explorer-queries', () => ({
  useCoinInfo: () => ({ data: ref({ data: { emission: 1000 } }) }),
}))

function coinstake(staker: string) {
  return {
    txid: `cs-${staker}`,
    type: 3,
    height: 1,
    blockHash: 'b',
    nTime: 0,
    vin: [{ txid: 'p', vout: 1, address: staker, value: 10 }],
    vout: [
      { n: 0, value: 0, scriptPubKey: { addresses: [''], hex: '' } },
      { n: 1, value: 12, scriptPubKey: { addresses: [staker], hex: '' } },
    ],
  }
}

function calls(method: string): unknown[][] {
  return mocks.getByPRC.mock.calls
    .map((c) => c[0] as { method: string; parameters: unknown[] })
    .filter((c) => c.method === method)
    .map((c) => c.parameters)
}

async function load() {
  vi.resetModules()
  const { useLargeWallets } = await import('./use-large-wallets')
  const wallets = useLargeWallets()
  await vi.waitFor(() => expect(wallets.loading.value).toBe(false))
  return wallets
}

describe('useLargeWallets', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.getByPRC.mockReset()
    mocks.blocks = ['h1', 'h2', 'h3']
    mocks.stakers = { h1: 'PStakerA', h2: 'PStakerB', h3: 'PStakerA', h4: 'PStakerC' }
    mocks.balances = { PStakerA: 300, PStakerB: 50, PStakerC: 5, PActive: 120 }
    mocks.getByPRC.mockImplementation(async (req: { method: string; parameters: unknown[] }) => {
      const [first] = req.parameters
      if (req.method === 'getlastblocks') {
        return { data: [...mocks.blocks].reverse().map((hash) => ({ hash, height: 1, time: 0 })) }
      }
      if (req.method === 'getblocktransactions') {
        return { data: [coinstake(mocks.stakers[first as string]!)] }
      }
      if (req.method === 'getaddressinfo') {
        return { data: { balance: mocks.balances[first as string], lastChange: -1 } }
      }
      throw new Error(`unexpected ${req.method}`)
    })
  })

  it('stakers and active addresses, richest first, with blocks staked and share', async () => {
    const wallets = await load()
    expect(wallets.rows.value.map((r) => [r.address, r.balance, r.stakedBlocks, r.active])).toEqual(
      [
        ['PStakerA', 300, 2, true],
        ['PActive', 120, 0, true],
        ['PStakerB', 50, 1, false],
      ]
    )
    expect(wallets.rows.value[0]!.share).toBe(30)
    expect(wallets.blocksDone.value).toBe(3)
    expect(
      calls('getblocktransactions')
        .map((p) => p[0])
        .sort()
    ).toEqual(['h1', 'h2', 'h3'])
    // Каждый баланс — один раз, даже если адрес и стейкер, и активный.
    expect(
      calls('getaddressinfo')
        .map((p) => p[0])
        .sort()
    ).toEqual(['PActive', 'PStakerA', 'PStakerB'])
  })

  it('a revisit asks only for new blocks and stale balances', async () => {
    await load()
    mocks.getByPRC.mockClear()
    mocks.blocks = ['h2', 'h3', 'h4']

    const wallets = await load()
    expect(calls('getblocktransactions')).toEqual([['h4', 0, 1]])
    expect(calls('getaddressinfo')).toEqual([['PStakerC']])
    expect(wallets.rows.value.map((r) => [r.address, r.stakedBlocks])).toEqual([
      ['PStakerA', 1],
      ['PActive', 0],
      ['PStakerB', 1],
      ['PStakerC', 1],
    ])
  })

  it('a block that did not come does not break the list', async () => {
    const ok = mocks.getByPRC.getMockImplementation()!
    mocks.getByPRC.mockImplementation(async (req: { method: string; parameters: unknown[] }) => {
      if (req.method === 'getblocktransactions' && req.parameters[0] === 'h2') {
        throw new Error('sql request timeout')
      }
      return ok(req)
    })
    const wallets = await load()
    expect(wallets.blocksDone.value).toBe(3)
    expect(wallets.rows.value.map((r) => r.address)).toEqual(['PStakerA', 'PActive'])
    expect(wallets.failed.value).toBe(false)
  })

  it('no block list — an error, not an endless spinner', async () => {
    mocks.getByPRC.mockRejectedValue(new Error('down'))
    const wallets = await load()
    expect(wallets.failed.value).toBe(true)
    expect(wallets.rows.value).toEqual([])
  })
})
