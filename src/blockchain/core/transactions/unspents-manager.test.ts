import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  selectBestUnspents,
  filterAvailableUnspents,
  lockUTXOs,
  getUnspents,
} from './unspents-manager'
import type { UTXO } from '@/composables/use-wallet-queries'
import { DUST_VALUE } from '@/blockchain/constants/transactions'

// ---------------------------------------------------------------------------
// Сетевые зависимости модуля мокаем, чтобы импорт не тянул реальный RPC/конфиг.
// ---------------------------------------------------------------------------

const _rpcCall = vi.hoisted(() => vi.fn())

vi.mock('@/helpers/api/request', () => ({ rpcCall: _rpcCall }))
vi.mock('@/helpers/api/rpc-endpoints', () => ({ rpcEndpoints: { txUnspent: 'txunspent' } }))

let txCounter = 0
function makeUTXO(amount: number, extra: Partial<UTXO> = {}): UTXO {
  return { txid: `tx${txCounter++}`, vout: 0, amount, ...extra }
}

const keyOf = (u: UTXO) => `${u.txid}:${u.vout}`

describe('selectBestUnspents', () => {
  it('возвращает [] для пустого/невалидного входа', () => {
    expect(selectBestUnspents([], 1)).toEqual([])
    expect(selectBestUnspents(null as unknown as UTXO[], 1)).toEqual([])
  })

  it('набирает достаточно для покрытия суммы и берёт только входы из исходного набора', () => {
    const utxos = [makeUTXO(0.1), makeUTXO(0.2), makeUTXO(0.3), makeUTXO(0.4)]
    const inputKeys = new Set(utxos.map(keyOf))

    const selected = selectBestUnspents(utxos, 0.5)
    const sum = selected.reduce((s, u) => s + u.amount, 0)

    expect(sum).toBeGreaterThanOrEqual(0.5 - 1e-12)
    selected.forEach((u) => expect(inputKeys.has(keyOf(u))).toBe(true))
  })

  it('не возвращает дубликатов', () => {
    const utxos = Array.from({ length: 8 }, () => makeUTXO(0.05))

    const selected = selectBestUnspents(utxos, 0.2)
    const keys = selected.map(keyOf)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('при нехватке средств возвращает все доступные unspents', () => {
    const utxos = [makeUTXO(0.1), makeUTXO(0.2)]

    const selected = selectBestUnspents(utxos, 100)

    expect(selected).toHaveLength(2)
  })

  it('при requiredAmount=0 всё равно покрывает dust-порог, когда средств хватает', () => {
    const utxos = Array.from({ length: 5 }, () => makeUTXO(DUST_VALUE))

    const selected = selectBestUnspents(utxos, 0)
    const sum = selected.reduce((s, u) => s + u.amount, 0)

    expect(selected.length).toBeGreaterThan(0)
    expect(sum).toBeGreaterThanOrEqual(DUST_VALUE - 1e-12)
  })
})

describe('filterAvailableUnspents', () => {
  it('исключает unspents с нулевой/отрицательной суммой', () => {
    const utxos = [makeUTXO(0), makeUTXO(-1), makeUTXO(0.5)]

    const res = filterAvailableUnspents(utxos)

    expect(res).toHaveLength(1)
    expect(res[0].amount).toBe(0.5)
  })

  it('onlyConfirmed=true отсекает unspents без подтверждений', () => {
    const confirmed = makeUTXO(1, { confirmations: 3 })
    const utxos = [confirmed, makeUTXO(1, { confirmations: 0 }), makeUTXO(1)]

    const res = filterAvailableUnspents(utxos, true)

    expect(res).toEqual([confirmed])
  })

  it('исключает незрелые coinbase (confirmations < 100) и пропускает зрелые', () => {
    const immature = makeUTXO(1, { coinbase: true, confirmations: 50 })
    const mature = makeUTXO(1, { coinbase: true, confirmations: 100 })

    const res = filterAvailableUnspents([immature, mature])

    expect(res).toEqual([mature])
  })

  it('исключает незрелые pockettx (confirmations < 10) и пропускает зрелые', () => {
    const immature = makeUTXO(1, { pockettx: true, confirmations: 5 })
    const mature = makeUTXO(1, { pockettx: true, confirmations: 10 })

    const res = filterAvailableUnspents([immature, mature])

    expect(res).toEqual([mature])
  })
})

describe('lockUTXOs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runAllTimers() // снимаем все блокировки, чтобы не протекли в другие тесты
    vi.useRealTimers()
  })

  it('заблокированные unspents исключаются из filterAvailableUnspents', () => {
    const u = makeUTXO(1)

    lockUTXOs([u])

    expect(filterAvailableUnspents([u])).toHaveLength(0)
  })

  it('блокировка снимается автоматически по истечении TTL', () => {
    const u = makeUTXO(1)

    lockUTXOs([u], 60000)
    expect(filterAvailableUnspents([u])).toHaveLength(0)

    vi.advanceTimersByTime(60000)
    expect(filterAvailableUnspents([u])).toHaveLength(1)
  })
})

describe('getUnspents', () => {
  beforeEach(() => _rpcCall.mockReset())

  it('вызывает txunspent с корректными параметрами и возвращает результат', async () => {
    const utxos = [makeUTXO(1)]
    _rpcCall.mockResolvedValue(utxos)

    const res = await getUnspents('Paddr', 2, 500)

    expect(res).toBe(utxos)
    expect(_rpcCall).toHaveBeenCalledWith(
      {
        method: 'txunspent',
        parameters: [['Paddr'], 2, 500],
        options: { auth: false },
      },
      undefined
    )
  })

  it('пробрасывает server-параметр', async () => {
    _rpcCall.mockResolvedValue([])
    const server = { host: 'node1', port: 8899 }

    await getUnspents('Paddr', 1, 9999999, server)

    expect(_rpcCall).toHaveBeenCalledWith(expect.anything(), server)
  })

  it('пробрасывает ошибку rpc', async () => {
    _rpcCall.mockRejectedValueOnce(new Error('rpc down'))

    await expect(getUnspents('Paddr')).rejects.toThrow('rpc down')
  })
})
