// Донат автору: перевод с меткой `a:donate` в OP_RETURN, комиссию платит
// получатель (feemode include), проверки до сети, нехватка денег без лока
// монет, отказ ноды и сетевой сбой. Транзакция собирается НАСТОЯЩЕЙ btc17 с
// ключом стандартного BIP39-вектора; замокана только сеть.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Buffer } from 'buffer'
import { createHash } from 'node:crypto'
import { POCKETNET_NETWORK } from '@/blockchain/constants/network'
import type { UTXO } from '@/composables/use-wallet-queries'
import { generateKeyPairFromMnemonic } from '../keys/key-generator'
import { onTransactionBroadcast } from '../transactions/broadcast-events'
import { NodeRejectError } from '../transactions/node-reject'
import { transferFeeSatoshis } from '../transactions/transfer-fee'
// @ts-expect-error legacy js module without types
import { Transaction } from '../../lib/pocketnet/modules/transaction.js'
// @ts-expect-error legacy js module without types
import * as payments from '../../lib/pocketnet/modules/payments/index.js'
// @ts-expect-error legacy js module without types
import * as bscript from '../../lib/pocketnet/modules/script.js'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: null as unknown, getUserAddress: null as string | null },
  unspents: [] as unknown[],
  rpcCall: vi.fn(),
  rpcCallWithAuth: vi.fn(),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/helpers/api/request', () => ({
  rpcCall: mocks.rpcCall,
  rpcCallWithAuth: mocks.rpcCallWithAuth,
  getByPRC: vi.fn(),
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: () => {} }))

import { donateToAuthor } from './donate-action'
;(globalThis as unknown as { Buffer: unknown }).Buffer = Buffer

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const KEY = generateKeyPairFromMnemonic(MNEMONIC)
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const AUTHOR = 'PUUAaAByj6BEey5CSYxJoGXr1KishVyC3A'
const MY_SCRIPT: string = payments
  .p2pkh({ pubkey: KEY.publicKey, network: POCKETNET_NETWORK })
  .output.toString('hex')
const SAT = 100_000_000

let txidSeq = 0
function coin(amount: number, extra: Partial<UTXO> = {}): UTXO {
  txidSeq += 1
  return {
    txid: (0xd0000 + txidSeq).toString(16).padStart(64, '0'),
    vout: 1,
    amount,
    scriptPubKey: MY_SCRIPT,
    confirmations: 50,
    ...extra,
  }
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest()
const txidOf = (hex: string) =>
  sha256(sha256(Buffer.from(hex, 'hex')))
    .reverse()
    .toString('hex')

/** Разбирает подписанный hex: входы, текст OP_RETURN, выходы по адресам. */
function decode(hex: string) {
  const tx = Transaction.fromHex(hex)
  const inputs = (tx.ins as Array<{ hash: Uint8Array }>).map((i) =>
    Buffer.from(i.hash).reverse().toString('hex')
  )
  let message: string | null = null
  const outputs: Array<{ address: string; value: number }> = []
  for (const o of tx.outs as Array<{ script: Uint8Array; value: number }>) {
    const script = Buffer.from(o.script)
    if (script[0] === bscript.OPS.OP_RETURN) {
      const [, data] = bscript.decompile(script) as [number, Uint8Array]
      message = Buffer.from(data).toString('utf8')
      expect(o.value).toBe(0)
      continue
    }
    const { address } = payments.p2pkh({ output: script, network: POCKETNET_NETWORK })
    outputs.push({ address, value: o.value })
  }
  return { inputs, message, outputs }
}

function lastBroadcast() {
  const call = mocks.rpcCallWithAuth.mock.lastCall?.[0] as {
    parameters: [string, Record<string, unknown>, string]
  }
  const [hex, messageData, operationType] = call.parameters
  return { hex, messageData, operationType, tx: decode(hex) }
}

const donateFee = (inputs: number) => transferFeeSatoshis({ inputs, outputs: 1, messageBytes: 8 })

beforeEach(() => {
  mocks.auth.getKeyPair = KEY
  mocks.auth.getUserAddress = ME
  mocks.unspents = [coin(1)]
  mocks.rpcCall.mockReset().mockImplementation(async (p: { method: string }) => {
    if (p.method === 'txunspent') return mocks.unspents
    throw new Error(`unexpected rpc ${p.method}`)
  })
  mocks.rpcCallWithAuth
    .mockReset()
    .mockImplementation(async (p: { parameters: [string] }) => txidOf(p.parameters[0]))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('donateToAuthor', () => {
  it('переводит автору сумму минус комиссию с меткой a:donate, сдачу — себе', async () => {
    const input = coin(1)
    mocks.unspents = [input]
    const seen = vi.fn()
    const off = onTransactionBroadcast(seen)

    const txid = await donateToAuthor(AUTHOR, 0.5).finally(off)

    const { hex, messageData, operationType, tx } = lastBroadcast()
    const fee = donateFee(1)
    expect(txid).toBe(txidOf(hex))
    expect(operationType).toBe('transaction')
    // Метка в самой транзакции: по ней нода считает перевод чаевыми.
    expect(tx.message).toBe('a:donate')
    expect(tx.inputs).toEqual([input.txid])
    expect(tx.outputs).toEqual([
      { address: AUTHOR, value: 0.5 * SAT - fee },
      { address: ME, value: 0.5 * SAT },
    ])
    expect(messageData).toEqual({
      source: { v: [ME] },
      reciever: { v: [{ address: AUTHOR, amount: 0.5 - fee / SAT }] },
      message: { v: 'a:donate' },
      feemode: { v: 'include' },
    })
    // «Песочные часы» показывают донат с полной суммой.
    expect(seen).toHaveBeenCalledWith({
      txid,
      operationType: 'transaction',
      meta: { kind: 'donate', address: AUTHOR, amount: 0.5 },
    })
  })

  it('донатер тратит ровно сумму доната, даже когда входов несколько и комиссия выше', async () => {
    const inputs = [coin(0.2), coin(0.2), coin(0.2)]
    mocks.unspents = inputs

    await donateToAuthor(AUTHOR, 0.5)

    const { tx } = lastBroadcast()
    const fee = donateFee(3)
    expect(fee).toBeGreaterThan(donateFee(1)) // три входа — транзакция больше
    expect(tx.inputs.sort()).toEqual(inputs.map((i) => i.txid).sort())
    expect(tx.outputs).toEqual([
      { address: AUTHOR, value: 0.5 * SAT - fee },
      { address: ME, value: 0.1 * SAT },
    ])
  })

  it('тратит только подтверждённые монеты', async () => {
    await donateToAuthor(AUTHOR, 0.1)
    expect(mocks.rpcCall).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'txunspent', parameters: [[ME], 1, 9999999] }),
      undefined
    )
  })

  it('гостю, себе и без получателя — отказ до сети', async () => {
    await expect(donateToAuthor(ME, 0.1)).rejects.toThrow('donate.errSelf')
    await expect(donateToAuthor('', 0.1)).rejects.toThrow('donate.errNoRecipient')
    mocks.auth.getKeyPair = null
    await expect(donateToAuthor(AUTHOR, 0.1)).rejects.toThrow('donate.errAuthRequired')
    expect(mocks.rpcCall).not.toHaveBeenCalled()
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, donateFee(1) / SAT])(
    'сумма %s не больше комиссии или не число — отказ до сети',
    async (amount) => {
      await expect(donateToAuthor(AUTHOR, amount)).rejects.toThrow('donate.errAmountTooSmall')
      expect(mocks.rpcCall).not.toHaveBeenCalled()
    }
  )

  it('автору досталась бы пыль — отказ без отправки, монеты свободны', async () => {
    // Сумма чуть больше комиссии за один вход: автору пришло бы меньше 700 сатоши.
    mocks.unspents = [coin(1)]
    await expect(donateToAuthor(AUTHOR, (donateFee(1) + 100) / SAT)).rejects.toThrow(
      'donate.errAmountTooSmall'
    )
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()
    // Те же монеты сразу годятся для обычного доната.
    await donateToAuthor(AUTHOR, 0.01)
    expect(mocks.rpcCallWithAuth).toHaveBeenCalledTimes(1)
  })

  it('мелкие монеты: комиссия за все входы съела бы сумму — отказ, а не выход в 0', async () => {
    mocks.unspents = [coin(0.000004), coin(0.000004), coin(0.000004)]
    await expect(donateToAuthor(AUTHOR, 0.0000105)).rejects.toThrow('donate.errAmountTooSmall')
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()
  })

  it('автору ровно порог пыли — уходит', async () => {
    await donateToAuthor(AUTHOR, (donateFee(1) + 700) / SAT)
    const { tx } = lastBroadcast()
    expect(tx.outputs.find((o) => o.address === AUTHOR)?.value).toBe(700)
  })

  it('денег не хватает — ошибка, а монеты остаются свободными для следующей попытки', async () => {
    const small = coin(0.1)
    mocks.unspents = [small]

    await expect(donateToAuthor(AUTHOR, 0.5)).rejects.toThrow('donate.errInsufficient')
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()

    await donateToAuthor(AUTHOR, 0.05)
    expect(lastBroadcast().tx.inputs).toEqual([small.txid])
  })

  it('отказ ноды отдаётся с её кодом, «часы» не запускаются', async () => {
    mocks.rpcCallWithAuth.mockRejectedValue({ code: -26, message: 'min relay fee not met' })
    const seen = vi.fn()
    const off = onTransactionBroadcast(seen)

    const err = await donateToAuthor(AUTHOR, 0.1)
      .catch((e: unknown) => e)
      .finally(off)

    expect(err).toBeInstanceOf(NodeRejectError)
    expect(err).toMatchObject({ code: -26 })
    expect(seen).not.toHaveBeenCalled()
  })

  it('сетевой сбой — «не удалось отправить», без повторной отправки той же транзакции', async () => {
    mocks.rpcCallWithAuth.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(donateToAuthor(AUTHOR, 0.1)).rejects.toThrow(
      'Failed to send transaction: Failed to fetch'
    )
    expect(mocks.rpcCallWithAuth).toHaveBeenCalledTimes(1)
  })
})
