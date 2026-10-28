// Коллекция: транзакция `collection` с payload и хешем из модели, правка —
// с txidEdit, удаление — `contentDelete`. Неверный черновик до сети не доходит,
// входы, отвергнутые нодой, освобождаются.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { ecPair: {} } as unknown, getUserAddress: 'PMyAddress' as string },
  getUnspents: vi.fn(),
  selectBestUnspents: vi.fn(),
  lockUTXOs: vi.fn(),
  unlockUTXOs: vi.fn(),
  buildTransaction: vi.fn(),
  broadcastTransaction: vi.fn(),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('../transactions/unspents-manager', () => ({
  getUnspents: mocks.getUnspents,
  filterAvailableUnspents: (list: unknown[]) => list,
  selectBestUnspents: mocks.selectBestUnspents,
  lockUTXOs: mocks.lockUTXOs,
  unlockUTXOs: mocks.unlockUTXOs,
}))
vi.mock('../transactions/transaction-builder', () => ({ buildTransaction: mocks.buildTransaction }))
vi.mock('../transactions/transaction-sender', () => ({
  broadcastTransaction: mocks.broadcastTransaction,
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { CollectionDraftInvalid, deleteCollection, sendCollection } from './collection-action'
import { NodeRejectError } from '../transactions/node-reject'

const ROOT = 'f1a1bc0f4d6f3d1f460418a5a0ccb3216c8051b85e58b5019782b29c845c85c3'
const ITEM = '1cabe401c0bf8f98137109d9a49fd33a074f3b9eb31d5f1bfdb752417f67b2a5'
const UTXO = { txid: 'aa'.repeat(32), vout: 0, amount: 1, scriptPubKey: '76a9' }

const draft = {
  kind: 'audio' as const,
  caption: 'Альбом',
  description: 'Песни',
  image: '',
  lang: 'ru',
  contentIds: [ITEM],
}

beforeEach(() => {
  Object.values(mocks).forEach(
    (m) => typeof m === 'function' && (m as ReturnType<typeof vi.fn>).mockReset()
  )
  mocks.getUnspents.mockResolvedValue([UTXO])
  mocks.selectBestUnspents.mockReturnValue([UTXO])
  mocks.buildTransaction.mockResolvedValue({ hex: 'deadbeef' })
  mocks.broadcastTransaction.mockResolvedValue('bb'.repeat(32))
})

describe('collection-action', () => {
  it('новая: OP_RETURN от строки хеша, payload с типом элементов', async () => {
    const { txid, payload } = await sendCollection(draft)
    expect(txid).toBe('bb'.repeat(32))
    const build = mocks.buildTransaction.mock.calls[0]![0]
    expect(build.operationType).toBe('collection')
    expect(build.serializedData).toBe(`210${ITEM}ruАльбом{"m":"Песни"}`)
    const sent = mocks.broadcastTransaction.mock.calls[0]![0]
    expect(sent.messageData).toEqual(payload)
    expect(sent.messageData).toMatchObject({ contentTypes: 210, contentIds: [ITEM], txidEdit: '' })
    expect(sent.pending).toEqual({ kind: 'collection', title: 'Альбом' })
  })

  it('правка — с root txid в начале строки хеша и в txidEdit', async () => {
    await sendCollection({ ...draft, rootTxid: ROOT })
    expect(mocks.buildTransaction.mock.calls[0]![0].serializedData.startsWith(`${ROOT}210`)).toBe(
      true
    )
    expect(mocks.broadcastTransaction.mock.calls[0]![0].pending.kind).toBe('collectionEdit')
  })

  it('неверный черновик до сети не доходит', async () => {
    await expect(sendCollection({ ...draft, contentIds: [] })).rejects.toBeInstanceOf(
      CollectionDraftInvalid
    )
    expect(mocks.getUnspents).not.toHaveBeenCalled()
  })

  it('удаление — contentDelete с txid коллекции', async () => {
    await deleteCollection(ROOT, 'Альбом')
    const build = mocks.buildTransaction.mock.calls[0]![0]
    expect(build).toMatchObject({ operationType: 'contentDelete', serializedData: ROOT })
    expect(mocks.broadcastTransaction.mock.calls[0]![0]).toMatchObject({
      messageData: { txidEdit: ROOT },
      pending: { kind: 'collectionDelete', title: 'Альбом' },
    })
  })

  it('отказ ноды освобождает входы', async () => {
    mocks.broadcastTransaction.mockRejectedValue(new NodeRejectError(39, 'limit'))
    await expect(sendCollection(draft)).rejects.toBeInstanceOf(NodeRejectError)
    expect(mocks.unlockUTXOs).toHaveBeenCalledWith([UTXO])
  })

  it('без свободных монет — понятная ошибка', async () => {
    mocks.selectBestUnspents.mockReturnValue([])
    await expect(sendCollection(draft)).rejects.toThrow('collections.errNoCoins')
  })
})
