// upvoteShare: serializedData = id поста + оценка, в OP_RETURN — «адрес
// автора оценка» (по нему нода считает репутацию), комиссия 1 сатоши.
// Без ключа, автора или монет транзакция не собирается.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { privateKey: 'priv' } as unknown, getUserAddress: 'PMe' as string | null },
  getUnspents: vi.fn(),
  selectBestUnspents: vi.fn(),
  lockUTXOs: vi.fn(),
  buildTransaction: vi.fn(),
  broadcastTransaction: vi.fn(),
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/blockchain/core/transactions/transaction-builder', () => ({
  buildTransaction: mocks.buildTransaction,
}))
vi.mock('@/blockchain/core/transactions/unspents-manager', () => ({
  getUnspents: mocks.getUnspents,
  filterAvailableUnspents: (u: unknown) => u,
  selectBestUnspents: mocks.selectBestUnspents,
  lockUTXOs: mocks.lockUTXOs,
}))
vi.mock('@/blockchain/core/transactions/transaction-sender', () => ({
  broadcastTransaction: mocks.broadcastTransaction,
}))

import { sendUpvoteTransaction } from './star-rating-transaction'

const UTXO = [{ txid: 'u1', vout: 0 }]

describe('sendUpvoteTransaction', () => {
  beforeEach(() => {
    mocks.auth.getKeyPair = { privateKey: 'priv' }
    mocks.auth.getUserAddress = 'PMe'
    mocks.getUnspents.mockReset().mockResolvedValue(UTXO)
    mocks.selectBestUnspents.mockReset().mockImplementation((u: unknown) => u)
    mocks.lockUTXOs.mockReset()
    mocks.buildTransaction.mockReset().mockResolvedValue({ hex: 'cafe' })
    mocks.broadcastTransaction.mockReset().mockResolvedValue('tx-vote')
  })

  it('собирает upvoteShare в формате старого клиента', async () => {
    await expect(sendUpvoteTransaction('post1', 4, 'PAuthor')).resolves.toBe('tx-vote')

    const build = mocks.buildTransaction.mock.lastCall![0]
    expect(build).toMatchObject({
      unspents: UTXO,
      fromAddress: 'PMe',
      serializedData: 'post14',
      operationType: 'upvoteShare',
      fee: 0.00000001,
    })
    expect(build.opReturnData[0].toString('utf8')).toBe('PAuthor 4')
    expect(mocks.lockUTXOs).toHaveBeenCalledWith(UTXO)
    expect(mocks.broadcastTransaction).toHaveBeenCalledWith({
      hex: 'cafe',
      messageData: { share: 'post1', value: '4' },
      operationType: 'upvoteShare',
      pending: false,
    })
  })

  it.each([
    ['не вошёл', () => (mocks.auth.getKeyPair = null), 'User not authenticated', 'PAuthor'],
    ['нет автора', () => {}, 'Content author address is required', ''],
    [
      'нет монет',
      () => mocks.getUnspents.mockResolvedValue([]),
      'No unspents available',
      'PAuthor',
    ],
    [
      'монеты не подобрались',
      () => mocks.selectBestUnspents.mockReturnValue([]),
      'No suitable unspents available for transaction',
      'PAuthor',
    ],
  ])('%s — ошибка, транзакция не отправлена', async (_name, arrange, message, author) => {
    arrange()
    await expect(sendUpvoteTransaction('post1', 5, author)).rejects.toThrow(message)
    expect(mocks.broadcastTransaction).not.toHaveBeenCalled()
  })
})
