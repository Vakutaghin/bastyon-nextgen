import { describe, it, expect, vi, beforeEach } from 'vitest'

const { matrix, tx, encryptKey } = vi.hoisted(() => ({
  matrix: {
    getRoom: vi.fn(() => ({ roomId: '!dm:host', loadMembersIfNeeded: async () => {} })),
    joinIfInvited: vi.fn(async () => {}),
    makeTxnId: vi.fn(() => 'm1.1'),
    getClient: () => ({ getUserId: () => '@me:host' }),
    sendEncryptedDirectMessage: vi.fn(async () => ({ event_id: '$e' })),
  },
  encryptKey: vi.fn(async () => ({ keys: 'CIPHER', block: 10 })),
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
    pcryptoService: { value: { encryptKey } },
    getOrderedMemberIds: vi.fn(() => ['@me:host', '@peer:host']),
    collectPcryptoUsers: vi.fn(async () => [{ id: '@me:host' }, { id: '@peer:host' }]),
    pickRoomBlock: vi.fn(async () => 10),
    decryptionCache: { get: vi.fn(), has: vi.fn(() => false), set: vi.fn(), persist: vi.fn() },
  }
  return useMessageSending(ctx as never, crypto as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendPkoin — две фазы (V2)', () => {
  it('успех: одна транзакция, одно зашифрованное сообщение, возвращает txid', async () => {
    const txid = await sending().sendPkoin('!dm:host', 1.5, 'За кофе')
    expect(txid).toBe('TXID1')
    expect(tx.sendTransactionWithMessage).toHaveBeenCalledTimes(1)
    // Заметка — только в зашифрованном теле; открыто лежит то, что видно в блокчейне.
    expect(encryptKey).toHaveBeenCalledWith('💎 1.5 PKOIN · За кофе', expect.any(Array), 10, 2)
    expect(matrix.sendEncryptedDirectMessage).toHaveBeenCalledWith(
      '!dm:host',
      { body: 'CIPHER', block: 10, version: 2 },
      { pocketnet_transaction: { txid: 'TXID1', amount: 1.5, from: 'PME', to: 'PPARTNER' } },
      'm1.1'
    )
    expect(JSON.stringify(matrix.sendEncryptedDirectMessage.mock.calls)).not.toContain('кофе')
    // Текст чата в транзакцию не попадает: OP_RETURN публичен.
    expect(tx.buildTransferTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ message: '' })
    )
  })

  it('сообщение не доставлено → PkoinMessageDeliveryError с txid и payload; повтор шлёт только сообщение', async () => {
    matrix.sendEncryptedDirectMessage.mockRejectedValueOnce(new Error('matrix down'))
    const api = sending()
    const err = await api.sendPkoin('!dm:host', 2, undefined).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PkoinMessageDeliveryError)
    const e = err as PkoinMessageDeliveryError
    expect(e.txid).toBe('TXID1')
    expect(e.payload).toMatchObject({ txid: 'TXID1', amount: 2, toAddress: 'PPARTNER' })
    expect(tx.sendTransactionWithMessage).toHaveBeenCalledTimes(1)

    await api.sendPkoinMessage('!dm:host', e.payload)
    expect(matrix.sendEncryptedDirectMessage).toHaveBeenCalledTimes(2)
    expect(tx.sendTransactionWithMessage).toHaveBeenCalledTimes(1) // второй транзакции нет
  })

  it('нет входов → ошибка до бродкаста, сообщение не шлётся', async () => {
    tx.selectAndLockUnspents.mockReturnValueOnce([])
    await expect(sending().sendPkoin('!dm:host', 1)).rejects.toThrow(
      'appMsg.messenger.insufficientFunds'
    )
    expect(tx.sendTransactionWithMessage).not.toHaveBeenCalled()
    expect(matrix.sendEncryptedDirectMessage).not.toHaveBeenCalled()
  })
})
