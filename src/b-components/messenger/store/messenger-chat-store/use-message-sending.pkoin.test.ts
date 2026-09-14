import { describe, it, expect, vi, beforeEach } from 'vitest'

const { matrix, tx } = vi.hoisted(() => ({
  matrix: {
    getRoom: vi.fn(() => ({ roomId: '!dm:host' })),
    sendPkoinTransaction: vi.fn(async () => ({ event_id: '$e' })),
  },
  tx: {
    getUnspents: vi.fn(async () => [{ txid: 'u', vout: 0, amount: 5 }]),
    filterAvailableUnspents: vi.fn((u: unknown[]) => u),
    selectAndLockUnspents: vi.fn((u: unknown[]) => u),
    buildTransferTransaction: vi.fn(async () => ({ hex: 'HEX', messageData: {} })),
    sendTransactionWithMessage: vi.fn(async () => 'TXID1'),
  },
}))

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('../../services/matrix-service', () => ({ matrixService: matrix }))
vi.mock('../../services/encryption-service', () => ({ encryptTextWithSecret: vi.fn() }))
vi.mock('../../helpers', () => ({
  isTetatetchat: () => true,
  getAddressFromMatrixId: () => 'PPARTNER',
  getMatrixId: (a: string) => a,
}))
vi.mock('../../room-helpers', () => ({ getPartnerMatrixId: () => '@peer:host' }))
vi.mock('@/blockchain/core/transactions/unspents-manager', () => ({
  getUnspents: tx.getUnspents,
  filterAvailableUnspents: tx.filterAvailableUnspents,
  selectAndLockUnspents: tx.selectAndLockUnspents,
}))
vi.mock('@/blockchain/core/transactions/transaction-builder', () => ({
  buildTransferTransaction: tx.buildTransferTransaction,
}))
vi.mock('@/blockchain/core/transactions/transaction-sender', () => ({
  sendTransactionWithMessage: tx.sendTransactionWithMessage,
}))
vi.mock('@/blockchain/constants/transactions', () => ({ DEFAULT_TX_FEE: 0.01 }))

import { PkoinMessageDeliveryError, useMessageSending } from './use-message-sending'

function sending() {
  const ctx = {
    messages: {},
    currentUser: { value: { id: '@me:host', name: 'me' } },
    authStore: { isUserAuthenticated: true, address: 'PME', keyPair: { privateKey: 'k' } },
    uiStore: { isInitInProgress: false },
    profileCache: { userProfiles: {} },
  }
  const crypto = {
    ensurePcryptoInitialized: vi.fn(),
    waitForPcrypto: vi.fn(),
    pcryptoService: { value: {} },
    getOrderedMemberIds: vi.fn(() => []),
    collectPcryptoUsers: vi.fn(async () => []),
    pickRoomBlock: vi.fn(async () => 10),
  }
  return useMessageSending(ctx as never, crypto as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendPkoin — две фазы (V2)', () => {
  it('успех: одна транзакция, одно сообщение, возвращает txid', async () => {
    const txid = await sending().sendPkoin('!dm:host', 1.5, 'hi')
    expect(txid).toBe('TXID1')
    expect(tx.sendTransactionWithMessage).toHaveBeenCalledTimes(1)
    expect(matrix.sendPkoinTransaction).toHaveBeenCalledWith('!dm:host', {
      txid: 'TXID1',
      amount: 1.5,
      fromAddress: 'PME',
      toAddress: 'PPARTNER',
      message: 'hi',
    })
  })

  it('сообщение не доставлено → PkoinMessageDeliveryError с txid и payload; повтор шлёт только сообщение', async () => {
    matrix.sendPkoinTransaction.mockRejectedValueOnce(new Error('matrix down'))
    const api = sending()
    const err = await api.sendPkoin('!dm:host', 2, undefined).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PkoinMessageDeliveryError)
    const e = err as PkoinMessageDeliveryError
    expect(e.txid).toBe('TXID1')
    expect(e.payload).toMatchObject({ txid: 'TXID1', amount: 2, toAddress: 'PPARTNER' })
    expect(tx.sendTransactionWithMessage).toHaveBeenCalledTimes(1)

    await api.sendPkoinMessage('!dm:host', e.payload)
    expect(matrix.sendPkoinTransaction).toHaveBeenCalledTimes(2)
    expect(tx.sendTransactionWithMessage).toHaveBeenCalledTimes(1) // второй транзакции нет
  })

  it('нет входов → ошибка до бродкаста, сообщение не шлётся', async () => {
    tx.selectAndLockUnspents.mockReturnValueOnce([])
    await expect(sending().sendPkoin('!dm:host', 1)).rejects.toThrow(
      'appMsg.messenger.insufficientFunds'
    )
    expect(tx.sendTransactionWithMessage).not.toHaveBeenCalled()
    expect(matrix.sendPkoinTransaction).not.toHaveBeenCalled()
  })
})
