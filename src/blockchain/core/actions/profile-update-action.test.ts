// Правка профиля: транзакция userInfo с хешем полей в OP_RETURN, тело
// сообщения в формате legacy (n/a/s/l/i/b/r/k), сохранение ключей мессенджера
// и адресов для пожертвований, проверки до сети и отказ ноды. Транзакция
// собирается НАСТОЯЩЕЙ btc17 с ключом стандартного BIP39-вектора; замокана сеть.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Buffer } from 'buffer'
import { createHash } from 'node:crypto'
import { POCKETNET_NETWORK } from '@/blockchain/constants/network'
import type { UTXO } from '@/composables/use-wallet-queries'
import { deriveMessengerKeys, generateKeyPairFromMnemonic } from '../keys/key-generator'
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
vi.mock('@/helpers/api/request', () => ({
  rpcCall: mocks.rpcCall,
  rpcCallWithAuth: mocks.rpcCallWithAuth,
  getByPRC: vi.fn(),
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: () => {} }))

import { updateUserProfileInfo } from './profile-update-action'
;(globalThis as unknown as { Buffer: unknown }).Buffer = Buffer

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const KEY = generateKeyPairFromMnemonic(MNEMONIC)
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const MY_SCRIPT: string = payments
  .p2pkh({ pubkey: KEY.publicKey, network: POCKETNET_NETWORK })
  .output.toString('hex')
/** Ключи мессенджера: детерминированы из приватного ключа. */
const MESSENGER_KEYS = deriveMessengerKeys(KEY.privateKey).map((k) => k.public)

let txidSeq = 0
function coin(amount: number, extra: Partial<UTXO> = {}): UTXO {
  txidSeq += 1
  return {
    txid: (0xe0000 + txidSeq).toString(16).padStart(64, '0'),
    vout: 0,
    amount,
    scriptPubKey: MY_SCRIPT,
    confirmations: 5,
    ...extra,
  }
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest()
const hash256 = (s: string) => sha256(sha256(Buffer.from(s, 'utf8'))).toString('hex')
const txidOf = (hex: string) =>
  sha256(sha256(Buffer.from(hex, 'hex')))
    .reverse()
    .toString('hex')

function decode(hex: string) {
  const tx = Transaction.fromHex(hex)
  const inputs = (tx.ins as Array<{ hash: Uint8Array }>).map((i) =>
    Buffer.from(i.hash).reverse().toString('hex')
  )
  let opReturn: string[] = []
  const outputs: Array<{ address: string; value: number }> = []
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

function lastBroadcast() {
  const call = mocks.rpcCallWithAuth.mock.lastCall?.[0] as {
    parameters: [string, Record<string, string>, string]
  }
  const [hex, messageData, operationType] = call.parameters
  return { hex, messageData, operationType, tx: decode(hex) }
}

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

describe('updateUserProfileInfo', () => {
  it('сохраняет все поля профиля транзакцией userInfo, подписанной нашим ключом', async () => {
    const input = coin(2)
    mocks.unspents = [input]
    const addresses = [{ currency: 'btc', address: 'bc1qexampleexampleexample' }]
    const seen = vi.fn()
    const off = onTransactionBroadcast(seen)

    const txid = await updateUserProfileInfo({
      name: 'Alice',
      about: 'Пишу о горах',
      site: 'https://alice.example',
      language: 'ru',
      image: 'https://img.example/a.png',
      addresses,
    }).finally(off)

    const { hex, messageData, operationType, tx } = lastBroadcast()
    expect(txid).toBe(txidOf(hex))
    expect(operationType).toBe('userInfo')
    const k = MESSENGER_KEYS.join(',')
    expect(messageData).toEqual({
      n: 'Alice',
      a: 'Пишу о горах',
      s: 'https://alice.example',
      l: 'ru',
      i: 'https://img.example/a.png',
      b: JSON.stringify(addresses),
      r: '',
      k,
    })
    // Хеш в OP_RETURN — от полей в порядке legacy serialize(): name+site+lang+about+image+b+ref+keys.
    const serialized =
      'Alice' +
      'https://alice.example' +
      'ru' +
      'Пишу о горах' +
      'https://img.example/a.png' +
      JSON.stringify(addresses) +
      k
    expect(tx.opReturn).toEqual([Buffer.from('userInfo').toString('hex'), hash256(serialized)])
    // Социальная транзакция: комиссия 1 сатоши, остальное — сдачей себе.
    expect(tx.inputs).toEqual([input.txid])
    expect(tx.outputs).toEqual([{ address: ME, value: 200_000_000 - 1 }])
    expect(seen).toHaveBeenCalledWith({
      txid,
      operationType: 'userInfo',
      meta: { title: 'Alice' },
    })
  })

  it('ключи мессенджера всегда уходят заново — правка не стирает их (иначе не расшифровать чаты)', async () => {
    await updateUserProfileInfo({ name: 'Alice' })
    const keys = lastBroadcast().messageData.k!.split(',')
    expect(keys).toHaveLength(12)
    expect(new Set(keys).size).toBe(12)
    for (const key of keys) expect(key).toMatch(/^0[23][0-9a-f]{64}$/)
    expect(keys).toEqual(MESSENGER_KEYS)
  })

  it('имя обрезается по краям, незаполненные поля уходят пустыми', async () => {
    await updateUserProfileInfo({ name: '  Bob  ' })
    const { messageData, tx } = lastBroadcast()
    expect(messageData).toMatchObject({ n: 'Bob', a: '', s: '', l: '', i: '', b: '[]', r: '' })
    expect(tx.opReturn[1]).toBe(hash256('Bob' + '[]' + MESSENGER_KEYS.join(',')))
  })

  it.each(['', '   '])('имя «%s» — отказ до сети', async (name) => {
    await expect(updateUserProfileInfo({ name })).rejects.toThrow('editProfile.errNameRequired')
    expect(mocks.rpcCall).not.toHaveBeenCalled()
  })

  it('гость не может править профиль — до сети не доходит', async () => {
    mocks.auth.getUserAddress = null
    await expect(updateUserProfileInfo({ name: 'Alice' })).rejects.toThrow(
      'editProfile.errAuthRequired'
    )
    expect(mocks.rpcCall).not.toHaveBeenCalled()
  })

  it('может тратить ещё не подтверждённую сдачу прошлой транзакции', async () => {
    const fresh = coin(0.3, { confirmations: 0 })
    mocks.unspents = [fresh]
    await updateUserProfileInfo({ name: 'Alice' })
    expect(mocks.rpcCall).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'txunspent', parameters: [[ME], 0, 9999999] }),
      undefined
    )
    expect(lastBroadcast().tx.inputs).toEqual([fresh.txid])
  })

  it('нет свободных монет (или единственная занята прошлой правкой) — понятная ошибка', async () => {
    mocks.unspents = []
    await expect(updateUserProfileInfo({ name: 'Alice' })).rejects.toThrow(
      'editProfile.errNoUnspents'
    )

    mocks.unspents = [coin(1)]
    await updateUserProfileInfo({ name: 'Alice' })
    await expect(updateUserProfileInfo({ name: 'Alice 2' })).rejects.toThrow(
      'editProfile.errNoUnspents'
    )
    expect(mocks.rpcCallWithAuth).toHaveBeenCalledTimes(1)
  })

  it('лимит правок профиля на ноде — отказ с кодом и текстом для человека', async () => {
    mocks.rpcCallWithAuth.mockRejectedValue({ code: 6, message: 'ChangeInfoLimit' })
    const err = await updateUserProfileInfo({ name: 'Alice' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NodeRejectError)
    expect(err).toMatchObject({ code: 6, message: 'nodeReject.profileEditLimit' })
  })

  it('сетевой сбой — ошибка «не удалось отправить», повторной отправки нет', async () => {
    mocks.rpcCallWithAuth.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(updateUserProfileInfo({ name: 'Alice' })).rejects.toThrow(
      'Failed to send transaction: Failed to fetch'
    )
    expect(mocks.rpcCallWithAuth).toHaveBeenCalledTimes(1)
  })
})
