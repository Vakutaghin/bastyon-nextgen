// Блокировка и подписки: что именно подписывается и уходит в ноду (OP_RETURN,
// сдача, тело сообщения, тип операции), проверки до сети, лок монет между
// операциями подряд и отказ ноды. Транзакция собирается НАСТОЯЩЕЙ btc17 с
// ключом стандартного BIP39-вектора; замокана только сеть.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Buffer } from 'buffer'
import { createHash } from 'node:crypto'
import { POCKETNET_NETWORK } from '@/blockchain/constants/network'
import type { UTXO } from '@/composables/use-wallet-queries'
import { generateKeyPairFromMnemonic } from '../keys/key-generator'
import { onTransactionBroadcast } from '../transactions/broadcast-events'
import { NodeRejectError } from '../transactions/node-reject'
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
// Сеть: txunspent и бродкаст. Остальное (выбор монет, сборка, подпись) — настоящее.
vi.mock('@/helpers/api/request', () => ({
  rpcCall: mocks.rpcCall,
  rpcCallWithAuth: mocks.rpcCallWithAuth,
  getByPRC: vi.fn(),
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: () => {} }))

import {
  blockUser,
  subscribeUser,
  subscribeUserPrivate,
  unblockUser,
  unsubscribeUser,
} from './user-relations-action'

// btc17 и typeforce живут с одним Buffer — npm-полифиллом (см. boost-transaction.test.ts).
;(globalThis as unknown as { Buffer: unknown }).Buffer = Buffer

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const KEY = generateKeyPairFromMnemonic(MNEMONIC)
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const TARGET = 'PUUAaAByj6BEey5CSYxJoGXr1KishVyC3A'
const MY_SCRIPT: string = payments
  .p2pkh({ pubkey: KEY.publicKey, network: POCKETNET_NETWORK })
  .output.toString('hex')

let txidSeq = 0
/** Монета на нашем адресе. Уникальный txid: лок монет живёт между тестами. */
function coin(amount: number, extra: Partial<UTXO> = {}): UTXO {
  txidSeq += 1
  return {
    txid: txidSeq.toString(16).padStart(64, '0'),
    vout: 0,
    amount,
    scriptPubKey: MY_SCRIPT,
    confirmations: 50,
    ...extra,
  }
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest()
const hash256 = (s: string) => sha256(sha256(Buffer.from(s, 'utf8')))
const txidOf = (hex: string) =>
  sha256(sha256(Buffer.from(hex, 'hex')))
    .reverse()
    .toString('hex')

interface Decoded {
  inputs: Array<{ txid: string; vout: number; pubkey: string }>
  opReturn: string[]
  outputs: Array<{ address: string; value: number }>
}

/** Разбирает подписанный hex так, как его увидит нода. */
function decode(hex: string): Decoded {
  const tx = Transaction.fromHex(hex)
  const inputs = tx.ins.map((i: { hash: Uint8Array; index: number; script: Uint8Array }) => {
    const chunks = bscript.decompile(Buffer.from(i.script)) as Uint8Array[]
    return {
      txid: Buffer.from(i.hash).reverse().toString('hex'),
      vout: i.index,
      pubkey: Buffer.from(chunks[1]!).toString('hex'),
    }
  })
  let opReturn: string[] = []
  const outputs: Decoded['outputs'] = []
  for (const o of tx.outs as Array<{ script: Uint8Array; value: number }>) {
    const script = Buffer.from(o.script)
    if (script[0] === bscript.OPS.OP_RETURN) {
      opReturn = (bscript.decompile(script) as Array<Uint8Array | number>)
        .slice(1)
        .map((c) => Buffer.from(c as Uint8Array).toString('hex'))
      continue
    }
    const { address } = payments.p2pkh({ output: script, network: POCKETNET_NETWORK })
    outputs.push({ address, value: o.value })
  }
  return { inputs, opReturn, outputs }
}

/** Последний бродкаст: параметры sendrawtransactionwithmessage и разобранная транзакция. */
function lastBroadcast() {
  const call = mocks.rpcCallWithAuth.mock.lastCall?.[0] as {
    method: string
    parameters: [string, Record<string, unknown>, string]
    options: Record<string, unknown>
  }
  const [hex, messageData, operationType] = call.parameters
  return { call, hex, messageData, operationType, tx: decode(hex) }
}

const hex = (s: string) => Buffer.from(s, 'utf8').toString('hex')

beforeEach(() => {
  mocks.auth.getKeyPair = KEY
  mocks.auth.getUserAddress = ME
  mocks.unspents = [coin(1)]
  mocks.rpcCall.mockReset().mockImplementation(async (p: { method: string }) => {
    if (p.method === 'txunspent') return mocks.unspents
    throw new Error(`unexpected rpc ${p.method}`)
  })
  // Нода принимает транзакцию и отвечает её txid.
  mocks.rpcCallWithAuth
    .mockReset()
    .mockImplementation(async (p: { parameters: [string] }) => txidOf(p.parameters[0]))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('отношения между пользователями: блокировка и подписки', () => {
  it.each([
    { name: 'blockUser', action: blockUser, op: 'blocking', payload: { address: TARGET } },
    { name: 'unblockUser', action: unblockUser, op: 'unblocking', payload: { address: TARGET } },
    { name: 'subscribeUser', action: subscribeUser, op: 'subscribe', payload: { address: TARGET } },
    {
      name: 'subscribeUserPrivate',
      action: subscribeUserPrivate,
      op: 'subscribePrivate',
      payload: { address: TARGET },
    },
    // У отписки legacy добавляет поле type (kit.js:129-132).
    {
      name: 'unsubscribeUser',
      action: unsubscribeUser,
      op: 'unsubscribe',
      payload: { type: 'unsubscribe', address: TARGET },
    },
  ])(
    '$name подписывает транзакцию «$op» нашим ключом и отправляет её в ноду',
    async ({ action, op, payload }) => {
      const input = coin(1.5)
      mocks.unspents = [input]

      const txid = await action(TARGET)

      const { call, hex: raw, messageData, operationType, tx } = lastBroadcast()
      expect(txid).toBe(txidOf(raw))
      expect(call.method).toBe('sendrawtransactionwithmessage')
      // Бродкаст — одна нода, без перебора (повтор на вторую дал бы дубль).
      expect(call.options).toMatchObject({ auth: true, noFailover: true })
      expect(operationType).toBe(op)
      expect(messageData).toEqual(payload)

      // OP_RETURN: тип операции + hash256 адреса цели; сдача — себе минус 1 сатоши.
      expect(tx.opReturn).toEqual([hex(op), hash256(TARGET).toString('hex')])
      expect(tx.outputs).toEqual([{ address: ME, value: 150_000_000 - 1 }])
      expect(tx.inputs).toEqual([
        { txid: input.txid, vout: 0, pubkey: KEY.publicKey.toString('hex') },
      ])
    }
  )

  it('отправленная транзакция появляется в «песочных часах» с адресом цели', async () => {
    const seen = vi.fn()
    const off = onTransactionBroadcast(seen)
    try {
      const txid = await subscribeUser(TARGET)
      expect(seen).toHaveBeenCalledWith({
        txid,
        operationType: 'subscribe',
        meta: { address: TARGET },
      })
    } finally {
      off()
    }
  })

  it('гость не может ни заблокировать, ни подписаться — до сети не доходит', async () => {
    mocks.auth.getKeyPair = null
    await expect(blockUser(TARGET)).rejects.toThrow('commentsMsg.errAuthRequiredBlock')
    await expect(subscribeUser(TARGET)).rejects.toThrow('subscriptions.errAuthRequired')

    // Ключ есть, а адреса нет (недовосстановленная сессия) — тоже гость.
    mocks.auth.getKeyPair = KEY
    mocks.auth.getUserAddress = null
    await expect(unsubscribeUser(TARGET)).rejects.toThrow('subscriptions.errAuthRequired')

    expect(mocks.rpcCall).not.toHaveBeenCalled()
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()
  })

  it('нельзя заблокировать себя или подписаться на себя, и нельзя без адреса цели', async () => {
    await expect(blockUser(ME)).rejects.toThrow('commentsMsg.errBlockSelf')
    await expect(subscribeUserPrivate(ME)).rejects.toThrow('subscriptions.errSubscribeSelf')
    await expect(unblockUser('')).rejects.toThrow('commentsMsg.errAuthorAddressRequired')
    expect(mocks.rpcCall).not.toHaveBeenCalled()
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()
  })

  it('тратит только подтверждённые и зрелые монеты; если таких нет — понятная ошибка', async () => {
    mocks.unspents = [
      coin(0),
      coin(5, { pockettx: true, confirmations: 3 }), // награда ещё не созрела
      coin(5, { coinbase: true, confirmations: 99 }),
    ]
    await expect(blockUser(TARGET)).rejects.toThrow('commentsMsg.errNoUnspents')
    expect(mocks.rpcCall).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'txunspent', parameters: [[ME], 1, 9999999] }),
      undefined
    )
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()
  })

  it('две операции подряд не тратят одну и ту же монету, пока нода не увидела первую', async () => {
    const a = coin(1)
    const b = coin(1)
    // txunspent ещё отдаёт обе монеты — первая транзакция не дошла до mempool.
    mocks.unspents = [a, b]

    await blockUser(TARGET)
    const first = lastBroadcast().tx.inputs[0]!.txid
    await subscribeUser('PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM')
    const second = lastBroadcast().tx.inputs[0]!.txid

    expect([first, second].sort()).toEqual([a.txid, b.txid].sort())

    // Третьей монеты нет: вместо двойной траты — ошибка «нет монет».
    await expect(unblockUser(TARGET)).rejects.toThrow('commentsMsg.errNoUnspents')
    expect(mocks.rpcCallWithAuth).toHaveBeenCalledTimes(2)
  })

  it('отказ ноды доходит до вызывающего с кодом консенсуса, «часы» не запускаются', async () => {
    mocks.rpcCallWithAuth.mockRejectedValue({ code: 23, message: 'AlreadyBlocked' })
    const seen = vi.fn()
    const off = onTransactionBroadcast(seen)
    try {
      const err = await blockUser(TARGET).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(NodeRejectError)
      expect(err).toMatchObject({ code: 23, message: 'nodeReject.alreadyBlocked' })
      expect(seen).not.toHaveBeenCalled()
    } finally {
      off()
    }
  })

  it('сетевой сбой при отправке отдаётся как есть, без обёрток', async () => {
    const network = new TypeError('Failed to fetch')
    mocks.rpcCallWithAuth.mockRejectedValue(network)
    await expect(unsubscribeUser(TARGET)).rejects.toBe(network)
  })

  it('нода не отдала список монет — ошибка наверх, транзакция не собирается', async () => {
    mocks.rpcCall.mockRejectedValue(new Error('No RPC servers available'))
    await expect(subscribeUser(TARGET)).rejects.toThrow('No RPC servers available')
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()
  })
})
