import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildTransaction, buildTransferTransaction } from './transaction-builder'
import type { KeyPair } from '../../types/keys'
import type { UTXO } from '@/composables/use-wallet-queries'

// ---------------------------------------------------------------------------
// btc17.js (кастомный bitcoinjs-lib) мокаем целиком: FakeTxBuilder фиксирует
// все вызовы (addInput/addOutput/sign/addNTime/...), crypto/payments —
// заглушки. Проверяем логику сборки (суммы, dust, sequence, выходы), а не
// реальную сериализацию. Реальные константы (toSatoshis/DUST) не мокаем.
// ---------------------------------------------------------------------------

const { FakeTxBuilder, _embed, _sha256 } = vi.hoisted(() => {
  class FakeTxBuilder {
    static instances: FakeTxBuilder[] = []
    network: unknown
    calls = {
      addNTime: [] as number[],
      setLockTime: [] as number[],
      setNTime: [] as number[],
      addInput: [] as unknown[][],
      addOutput: [] as unknown[][],
      sign: [] as unknown[][],
    }
    constructor(network: unknown) {
      this.network = network
      FakeTxBuilder.instances.push(this)
    }
    addNTime(t: number) { this.calls.addNTime.push(t) }
    setLockTime(t: number) { this.calls.setLockTime.push(t) }
    setNTime(t: number) { this.calls.setNTime.push(t) }
    addInput(...a: unknown[]) { this.calls.addInput.push(a) }
    addOutput(...a: unknown[]) { this.calls.addOutput.push(a) }
    sign(...a: unknown[]) { this.calls.sign.push(a) }
    build() { return { toHex: () => 'deadbeefhex' } }
  }
  return {
    FakeTxBuilder,
    _embed: vi.fn(() => ({ output: globalThis.Buffer.from([0x6a, 0x00]) })),
    _sha256: vi.fn(() => globalThis.Buffer.from([0x01])),
  }
})

vi.mock('../../lib/pocketnet/btc17.js', () => {
  const api = {
    TransactionBuilder: FakeTxBuilder,
    crypto: { sha256: _sha256 },
    payments: { embed: _embed },
  }
  // Source читает `module.default ?? module`, поэтому нужен и default-экспорт.
  return { ...api, default: api }
})

const KEY_PAIR = { ecPair: { sign: vi.fn() }, publicKey: globalThis.Buffer.from([2]) } as unknown as KeyPair

function utxo(over: Partial<UTXO> = {}): UTXO {
  return { txid: 'aa', vout: 0, amount: 1, scriptPubKey: '00', ...over }
}

/** Последний созданный FakeTxBuilder. */
const lastTxb = () => FakeTxBuilder.instances.at(-1)!

beforeEach(() => {
  FakeTxBuilder.instances = []
  _embed.mockClear()
  _sha256.mockClear()
})

describe('buildTransaction', () => {
  const base = () => ({
    unspents: [utxo()],
    fromAddress: 'PFrom',
    keyPair: KEY_PAIR,
    serializedData: '{"k":1}',
    operationType: 'userInfo',
  })

  it('бросает при отсутствии unspents', async () => {
    await expect(buildTransaction({ ...base(), unspents: [] })).rejects.toThrow('No unspents provided')
  })

  it('бросает при невалидном keyPair', async () => {
    await expect(
      buildTransaction({ ...base(), keyPair: {} as KeyPair })
    ).rejects.toThrow('Valid key pair is required')
  })

  it('бросает при нехватке средств на комиссию', async () => {
    // вход 1 сатоши, комиссия 2 сатоши
    const params = { ...base(), unspents: [utxo({ amount: 0.00000001 })], fee: 0.00000002 }
    await expect(buildTransaction(params)).rejects.toThrow('Insufficient funds')
  })

  it('бросает при отсутствии scriptPubKey у входа', async () => {
    const params = { ...base(), unspents: [utxo({ scriptPubKey: undefined })] }
    await expect(buildTransaction(params)).rejects.toThrow('Missing scriptPubKey')
  })

  it('собирает транзакцию: hex, суммы, входы/подписи, OP_RETURN + change', async () => {
    const res = await buildTransaction(base())

    expect(res.hex).toBe('deadbeefhex')
    expect(res.totalInputAmount).toBe(1)
    expect(res.usedUnspents).toHaveLength(1)
    // OP_RETURN (deleted) + change output
    expect(res.outputs[0]).toEqual({ address: 'PFrom', amount: 0, deleted: true })
    expect(res.outputs[1]).toEqual({ address: 'PFrom', amount: 0.99999999 })
    expect(res.totalOutputAmount).toBeCloseTo(0.99999999, 8)

    const txb = lastTxb()
    expect(txb.calls.addNTime).toEqual([0])
    expect(txb.calls.addInput).toHaveLength(1)
    expect(txb.calls.addInput[0].slice(0, 3)).toEqual(['aa', 0, null]) // txid, vout, sequence
    // Объектная форма TxbSignArg (p2pkh), а не позиционная sign(index, keyPair)
    expect(txb.calls.sign).toEqual([
      [{ prevOutScriptType: 'p2pkh', vin: 0, keyPair: KEY_PAIR.ecPair }],
    ])
    // первый addOutput — OP_RETURN с amount 0
    expect(txb.calls.addOutput[0][1]).toBe(0)
    // второй — change в сатоши
    expect(txb.calls.addOutput[1]).toEqual(['PFrom', 99999999])
  })

  it('не создаёт change output, если сдача меньше dust', async () => {
    // вход 700 сатоши, комиссия 1 → сдача 699 < dust(700)
    const res = await buildTransaction({ ...base(), unspents: [utxo({ amount: 0.000007 })] })

    expect(res.outputs).toHaveLength(1) // только OP_RETURN
    expect(res.totalOutputAmount).toBe(0)
    // addOutput вызван только для OP_RETURN
    expect(lastTxb().calls.addOutput).toHaveLength(1)
  })

  it('передаёт timeDifference в addNTime', async () => {
    await buildTransaction({ ...base(), timeDifference: 42 })
    expect(lastTxb().calls.addNTime).toEqual([42])
  })

  it('для delayedNtime ставит lockTime/nTime и sequence 0xFFFFFFFE', async () => {
    await buildTransaction({ ...base(), delayedNtime: 1000, timeDifference: 5 })

    const txb = lastTxb()
    expect(txb.calls.setLockTime).toEqual([1005]) // delayedNtime + timeDifference
    expect(txb.calls.setNTime).toEqual([1000])
    expect(txb.calls.addInput[0][2]).toBe(4294967294) // sequence
  })

  it('добавляет opReturnData (массив) в payload OP_RETURN', async () => {
    const extra = globalThis.Buffer.from([0xde])
    await buildTransaction({ ...base(), opReturnData: [extra] })

    const embedArg = _embed.mock.calls[0][0] as { data: Buffer[] }
    // [operationType, dataHash, ...extra] → минимум 3 элемента
    expect(embedArg.data.length).toBeGreaterThanOrEqual(3)
  })
})

describe('buildTransferTransaction', () => {
  const base = () => ({
    unspents: [utxo({ amount: 2, address: 'Psrc' })],
    fromAddress: 'PFrom',
    sourceAddresses: [] as string[],
    keyPair: KEY_PAIR,
    outputs: [{ address: 'Pdest', amount: 1 }],
  })

  it('бросает при отсутствии unspents / keyPair', async () => {
    await expect(buildTransferTransaction({ ...base(), unspents: [] })).rejects.toThrow(
      'No unspents provided'
    )
    await expect(
      buildTransferTransaction({ ...base(), keyPair: {} as KeyPair })
    ).rejects.toThrow('Valid key pair is required')
  })

  it('бросает при нехватке средств с учётом комиссии', async () => {
    // вход 1, выход 1, плюс комиссия → отрицательная сдача
    const params = { ...base(), unspents: [utxo({ amount: 1, address: 'Psrc' })], fee: 0.001 }
    await expect(buildTransferTransaction(params)).rejects.toThrow('Insufficient funds')
  })

  it('собирает перевод: выходы получателю + change, messageData', async () => {
    const res = await buildTransferTransaction(base())

    expect(res.hex).toBe('deadbeefhex')
    expect(res.totalInputAmount).toBe(2)
    expect(res.totalOutputAmount).toBe(1)
    expect(res.outputs).toEqual([{ address: 'Pdest', amount: 1 }])

    const txb = lastTxb()
    // получатель в сатоши, затем change
    expect(txb.calls.addOutput[0]).toEqual(['Pdest', 100000000])
    expect(txb.calls.addOutput[1]).toEqual(['PFrom', 99999999])

    expect(res.messageData).toEqual({
      source: { v: ['Psrc'] }, // derived из unspents.address
      reciever: { v: [{ address: 'Pdest', amount: 1 }] },
      message: { v: '' },
      feemode: { v: 'include' },
    })
  })

  it('использует переданные sourceAddresses, если они есть', async () => {
    const res = await buildTransferTransaction({
      ...base(),
      sourceAddresses: ['PexplicitA', 'PexplicitB'],
    })
    expect(res.messageData.source).toEqual({ v: ['PexplicitA', 'PexplicitB'] })
  })

  it('падает обратно на fromAddress, если ни sourceAddresses, ни address в unspents нет', async () => {
    const res = await buildTransferTransaction({
      ...base(),
      unspents: [utxo({ amount: 2, address: undefined })],
    })
    expect(res.messageData.source).toEqual({ v: ['PFrom'] })
  })

  it('не создаёт change output, если сдача меньше dust', async () => {
    // вход 1.000007, выход 1, комиссия 1 сат → сдача 699 сат < dust
    await buildTransferTransaction({
      ...base(),
      unspents: [utxo({ amount: 1.000007, address: 'Psrc' })],
    })
    // только выход получателю, change нет
    expect(lastTxb().calls.addOutput).toHaveLength(1)
    expect(lastTxb().calls.addOutput[0]).toEqual(['Pdest', 100000000])
  })
})
