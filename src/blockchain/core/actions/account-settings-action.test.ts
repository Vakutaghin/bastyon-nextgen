// Настройки аккаунта (`accSet`): цена подписки меняется поверх обложки и
// закреплённого поста, строка — байт в байт как у старого клиента.

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { ecPair: {} } as unknown, getUserAddress: 'PMyAddress' as string },
  fetchAccountSettings: vi.fn(),
  getUnspents: vi.fn(),
  selectAndLockUnspents: vi.fn(),
  buildTransaction: vi.fn(),
  send: vi.fn(),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/helpers/api/account-settings', () => ({
  fetchAccountSettings: mocks.fetchAccountSettings,
}))
vi.mock('../transactions/unspents-manager', () => ({
  getUnspents: mocks.getUnspents,
  filterAvailableUnspents: (list: unknown[]) => list,
  selectAndLockUnspents: mocks.selectAndLockUnspents,
}))
vi.mock('../transactions/transaction-builder', () => ({ buildTransaction: mocks.buildTransaction }))
vi.mock('../transactions/transaction-sender', () => ({ sendTransactionWithMessage: mocks.send }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import {
  normalizeAccountSettings,
  saveAccountSettings,
  serializeAccountSettings,
} from './account-settings-action'

const UTXO = { txid: 'aa'.repeat(32), vout: 0, amount: 1, scriptPubKey: '76a9' }
const hash256 = (text: string) =>
  createHash('sha256').update(createHash('sha256').update(text).digest()).digest('hex')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.getUserAddress = 'PMyAddress'
  mocks.getUnspents.mockResolvedValue([UTXO])
  mocks.selectAndLockUnspents.mockReturnValue([UTXO])
  mocks.buildTransaction.mockResolvedValue({ hex: 'beef' })
  mocks.send.mockResolvedValue('c'.repeat(64))
})

describe('accSet', () => {
  it('строка — как в сети: хэш совпадает с OP_RETURN настоящей транзакции', () => {
    // mainnet, c20223267341c6148b73c63517402f149115b1438aea302170f856a0b7bd37d9:
    // OP_RETURN 'accSet' 1b379891…ff94, getaccountsetting отдаёт эту строку.
    const fromNode = {
      pin: '18d5f91ba737157ae31b41d99248bdc5fd3c7e8caed4b7062723be0bfb787253',
      monetization: '',
      paidsubscription: 50,
      cover: '',
    }
    const serialized = serializeAccountSettings(normalizeAccountSettings(fromNode))
    expect(serialized).toBe(JSON.stringify(fromNode))
    expect(hash256(serialized)).toBe(
      '1b379891e8631dbcf15a21bf23fd5c2b0b8a8600b27dbfccc6eb9a69a377ff94'
    )
  })

  it('пустые и чужие значения — подстановки старого клиента', () => {
    expect(normalizeAccountSettings({})).toEqual({
      pin: '',
      monetization: '',
      paidsubscription: 0,
      cover: '',
    })
    expect(normalizeAccountSettings({ monetization: 'yes', paidsubscription: '7' })).toMatchObject({
      monetization: '',
      paidsubscription: 7,
    })
  })

  it('новая цена ложится поверх обложки и закреплённого поста', async () => {
    mocks.fetchAccountSettings.mockResolvedValue({
      pin: 'abc',
      monetization: true,
      paidsubscription: 5,
      cover: 'https://img/c.jpg',
    })
    const result = await saveAccountSettings(
      { paidsubscription: 12 },
      { kind: 'paidSubscriptionPrice' }
    )

    const expected =
      '{"pin":"abc","monetization":true,"paidsubscription":12,"cover":"https://img/c.jpg"}'
    expect(mocks.buildTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ serializedData: expected, operationType: 'accSet' })
    )
    expect(mocks.send).toHaveBeenCalledWith({
      hex: 'beef',
      messageData: { d: expected },
      operationType: 'accSet',
      pending: { kind: 'paidSubscriptionPrice' },
    })
    expect(result).toEqual({ txid: 'c'.repeat(64), settings: JSON.parse(expected) })
  })

  it('текущие настройки не прочитали — не отправляем, иначе стёрли бы обложку', async () => {
    mocks.fetchAccountSettings.mockRejectedValue(new Error('offline'))
    await expect(saveAccountSettings({ paidsubscription: 12 })).rejects.toThrow(
      'paidSubscriptions.errReadSettings'
    )
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
