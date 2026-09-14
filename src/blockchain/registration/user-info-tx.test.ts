// S13/S15: единый путь userInfo-транзакции — исход виден вызывающему, pending
// помечается только для своего адреса, фатальный отказ ноды не глотается.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'

const mocks = vi.hoisted(() => ({
  getUnspents: vi.fn(),
  sendTransactionWithMessage: vi.fn(),
  waitForUnspents: vi.fn(),
}))
vi.mock('@/blockchain/core/actions/user-info-action', () => ({
  serializeUserInfo: () => 'serialized',
  exportUserInfo: () => ({ name: 'x' }),
}))
vi.mock('@/blockchain/core/transactions/unspents-manager', () => ({
  getUnspents: mocks.getUnspents,
  filterAvailableUnspents: (u: unknown[]) => u,
  selectAndLockUnspents: (u: unknown[]) => u,
}))
vi.mock('@/blockchain/core/transactions/transaction-builder', () => ({
  buildTransaction: async () => ({ hex: 'deadbeef' }),
}))
vi.mock('@/blockchain/core/transactions/transaction-sender', () => ({
  sendTransactionWithMessage: mocks.sendTransactionWithMessage,
}))
vi.mock('@/blockchain/constants/transactions', () => ({ DEFAULT_TX_FEE: 1 }))
vi.mock('@/blockchain/core/keys/key-generator', () => ({
  deriveMessengerKeys: () => [{ public: 'pub' }],
}))
vi.mock('@/b-components/header/register-modal/helpers/wait-for-unspents', () => ({
  waitForUnspents: mocks.waitForUnspents,
}))
vi.mock('@/blockchain/api/proxy-with-wallet', () => ({
  getProxyWithWalletCached: async () => null,
}))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: vi.fn() }))

import {
  loadPendingRegistration,
  savePendingRegistration,
} from '@/blockchain/storage/pending-registration'
import { isFatalRegistrationError, sendRegistrationUserInfoTx } from './user-info-tx'

const keyPair = { privateKey: 'k' } as never
const utxo = [{ txid: 't', vout: 0, amount: 1 }]

describe('sendRegistrationUserInfoTx', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memStorage())
    mocks.getUnspents.mockReset().mockResolvedValue(utxo)
    mocks.sendTransactionWithMessage.mockReset().mockResolvedValue('txid1')
    mocks.waitForUnspents.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('отправляет и переводит СВОЙ pending в step=3', async () => {
    savePendingRegistration({ nickname: 'bob', address: 'PA', step: 2, timestamp: Date.now() })
    const r = await sendRegistrationUserInfoTx({ address: 'PA', keyPair, nickname: 'bob' })
    expect(r).toEqual({ outcome: 'sent', txid: 'txid1' })
    expect(loadPendingRegistration()?.step).toBe(3)
  })

  it('чужой pending (другой адрес) не трогает (S15)', async () => {
    savePendingRegistration({ nickname: 'ann', address: 'PB', step: 2, timestamp: Date.now() })
    await sendRegistrationUserInfoTx({ address: 'PA', keyPair, nickname: 'bob' })
    expect(loadPendingRegistration()).toMatchObject({ address: 'PB', step: 2 })
  })

  it('отказ ноды (code 19) → fatal, pending помечен ошибкой, не стёрт', async () => {
    savePendingRegistration({ nickname: 'bob', address: 'PA', step: 2, timestamp: Date.now() })
    mocks.sendTransactionWithMessage.mockRejectedValue(
      new Error('{"code":19,"message":"NicknameDouble"}')
    )
    const r = await sendRegistrationUserInfoTx({ address: 'PA', keyPair, nickname: 'bob' })
    expect(r.outcome).toBe('fatal')
    const pending = loadPendingRegistration()
    expect(pending?.step).toBe(2)
    expect(pending?.error).toContain('NicknameDouble')
  })

  it('сетевая ошибка → transient, pending без изменений', async () => {
    savePendingRegistration({ nickname: 'bob', address: 'PA', step: 2, timestamp: Date.now() })
    mocks.sendTransactionWithMessage.mockRejectedValue(new Error('RPC request timeout'))
    const r = await sendRegistrationUserInfoTx({ address: 'PA', keyPair, nickname: 'bob' })
    expect(r.outcome).toBe('transient')
    expect(loadPendingRegistration()).toMatchObject({ step: 2 })
    expect(loadPendingRegistration()?.error).toBeUndefined()
  })

  it('без UTXO: одна проба → no-funds; waitForFunds → ждёт через waitForUnspents', async () => {
    mocks.getUnspents.mockResolvedValue([])
    expect(await sendRegistrationUserInfoTx({ address: 'PA', keyPair, nickname: 'bob' })).toEqual({
      outcome: 'no-funds',
    })
    expect(mocks.waitForUnspents).not.toHaveBeenCalled()

    mocks.waitForUnspents.mockResolvedValue(utxo)
    const r = await sendRegistrationUserInfoTx({
      address: 'PA',
      keyPair,
      nickname: 'bob',
      waitForFunds: true,
    })
    expect(r.outcome).toBe('sent')
  })

  it('без ключей — transient', async () => {
    const r = await sendRegistrationUserInfoTx({ address: null, keyPair: null, nickname: 'bob' })
    expect(r.outcome).toBe('transient')
  })

  it('isFatalRegistrationError узнаёт коды 18/19 и NicknameLong', () => {
    expect(isFatalRegistrationError(new Error('NicknameLong'))).toBe(true)
    expect(isFatalRegistrationError(new Error('{"code":18}'))).toBe(true)
    expect(isFatalRegistrationError(new Error('ECONNRESET'))).toBe(false)
  })
})
