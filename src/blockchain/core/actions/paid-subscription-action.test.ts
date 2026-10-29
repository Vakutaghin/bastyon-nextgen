// Оплата подписки: перевод автору с меткой `a:subscription`, комиссия — на
// подписчике, автору приходит ровно цена срока.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { ecPair: {} } as unknown, getUserAddress: 'PMyAddress' as string },
  getUnspents: vi.fn(),
  selectAndLockUnspents: vi.fn(),
  buildTransferTransaction: vi.fn(),
  send: vi.fn(),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('../transactions/unspents-manager', () => ({
  getUnspents: mocks.getUnspents,
  filterAvailableUnspents: (list: unknown[]) => list,
  selectAndLockUnspents: mocks.selectAndLockUnspents,
}))
vi.mock('../transactions/transaction-builder', () => ({
  buildTransferTransaction: mocks.buildTransferTransaction,
}))
vi.mock('../transactions/transaction-sender', () => ({ sendTransactionWithMessage: mocks.send }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { payForSubscription } from './paid-subscription-action'
import { transferFee } from '../transactions/transfer-fee'

const UTXO = { txid: 'aa'.repeat(32), vout: 0, amount: 100, scriptPubKey: '76a9' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.getUserAddress = 'PMyAddress'
  mocks.getUnspents.mockResolvedValue([UTXO])
  mocks.selectAndLockUnspents.mockReturnValue([UTXO])
  mocks.buildTransferTransaction.mockResolvedValue({ hex: 'beef', messageData: { m: 1 } })
  mocks.send.mockResolvedValue('d'.repeat(64))
})

describe('payForSubscription', () => {
  it('перевод автору с меткой подписки, комиссия сверху суммы', async () => {
    await expect(payForSubscription('PAuthor', 5_500_000_000)).resolves.toBe('d'.repeat(64))
    // Комиссия берётся по размеру транзакции, а не фиксированным сатоши:
    // денежный перевод с одним сатоши сеть отклоняет (-26).
    const fee = transferFee({ inputs: 1, outputs: 1, messageBytes: 'a:subscription'.length })
    expect(mocks.selectAndLockUnspents).toHaveBeenCalledWith([UTXO], 55 + fee)
    expect(mocks.buildTransferTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        outputs: [{ address: 'PAuthor', amount: 55 }],
        message: 'a:subscription',
        feemode: 'exclude',
      })
    )
    expect(mocks.send).toHaveBeenCalledWith({
      hex: 'beef',
      messageData: { m: 1 },
      operationType: 'transaction',
      pending: { kind: 'paidSubscription', address: 'PAuthor', amount: 55 },
    })
  })

  it('себе, без суммы, без денег — до сети не доходит', async () => {
    await expect(payForSubscription('PMyAddress', 100)).rejects.toThrow('errSelf')
    await expect(payForSubscription('PAuthor', 0)).rejects.toThrow('errAmount')
    mocks.selectAndLockUnspents.mockReturnValue([])
    await expect(payForSubscription('PAuthor', 100)).rejects.toThrow('errInsufficient')
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
