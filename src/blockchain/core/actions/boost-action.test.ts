// Буст поста: транзакция `contentBoost` с txid поста, сумма буста уходит
// комиссией (выходов на чужие адреса нет), payload `{ content }`. Сумма от 2,5
// PKOIN; входы, отвергнутые нодой, освобождаются.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { ecPair: {} } as unknown, getUserAddress: 'PMyAddress' as string },
  getUnspents: vi.fn(),
  selectAndLockUnspents: vi.fn(),
  unlockUTXOs: vi.fn(),
  buildTransaction: vi.fn(),
  broadcastTransaction: vi.fn(),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('../transactions/unspents-manager', () => ({
  getUnspents: mocks.getUnspents,
  filterAvailableUnspents: (list: unknown[]) => list,
  selectAndLockUnspents: mocks.selectAndLockUnspents,
  unlockUTXOs: mocks.unlockUTXOs,
}))
vi.mock('../transactions/transaction-builder', () => ({ buildTransaction: mocks.buildTransaction }))
vi.mock('../transactions/transaction-sender', () => ({
  broadcastTransaction: mocks.broadcastTransaction,
}))
vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}))

import { boostPost } from './boost-action'
import { NodeRejectError } from '../transactions/node-reject'

const POST = '6bce6520df694128c10c45b6f20a1028a604ce7e70b170a9362cea183d2d87eb'
const UTXO = { txid: 'aa'.repeat(32), vout: 0, amount: 20, scriptPubKey: '76a9' }

async function failure(promise: Promise<unknown>): Promise<Error> {
  return (await promise.catch((e: unknown) => e)) as Error
}

describe('boostPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.getKeyPair = { ecPair: {} }
    mocks.auth.getUserAddress = 'PMyAddress'
    mocks.getUnspents.mockResolvedValue([UTXO])
    mocks.selectAndLockUnspents.mockReturnValue([UTXO])
    mocks.buildTransaction.mockResolvedValue({ hex: 'beef' })
    mocks.broadcastTransaction.mockResolvedValue('b'.repeat(64))
  })

  it('contentBoost с txid поста: сумма и комиссия уходят комиссией транзакции', async () => {
    await expect(boostPost(POST, 10)).resolves.toBe('b'.repeat(64))

    expect(mocks.selectAndLockUnspents).toHaveBeenCalledWith([UTXO], 10 + 1e-8)
    expect(mocks.buildTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        unspents: [UTXO],
        fromAddress: 'PMyAddress',
        serializedData: POST,
        operationType: 'contentBoost',
        fee: 10 + 1e-8,
      })
    )
    expect(mocks.broadcastTransaction).toHaveBeenCalledWith({
      hex: 'beef',
      messageData: { content: POST },
      operationType: 'contentBoost',
      // Буст ждёт блока в «песочных часах»: пост и сумма.
      pending: { postId: POST, amount: 10 },
    })
  })

  it('меньше 2,5 PKOIN, не число, чужой txid, без входа — до сети не доходит', async () => {
    expect((await failure(boostPost(POST, 2.4))).message).toBe('boost.errMin {"min":"2.5"}')
    expect((await failure(boostPost(POST, Number.NaN))).message).toContain('boost.errMin')
    expect((await failure(boostPost('not-a-txid', 5))).message).toBe('boost.errNoPost')
    mocks.auth.getUserAddress = ''
    expect((await failure(boostPost(POST, 5))).message).toBe('boost.errAuthRequired')
    expect(mocks.getUnspents).not.toHaveBeenCalled()
  })

  it('монет не хватает на сумму с комиссией — «Недостаточно средств», ничего не собирается', async () => {
    mocks.selectAndLockUnspents.mockReturnValue([])
    expect((await failure(boostPost(POST, 30))).message).toBe('boost.errInsufficient')
    expect(mocks.buildTransaction).not.toHaveBeenCalled()
  })

  it('нода отвергла буст — входы освобождаются, ошибка с причиной уходит наверх', async () => {
    const reject = new NodeRejectError(32, 'blocked')
    mocks.broadcastTransaction.mockRejectedValue(reject)
    expect(await failure(boostPost(POST, 5))).toBe(reject)
    expect(mocks.unlockUTXOs).toHaveBeenCalledWith([UTXO])
  })

  it('судьба отправки неизвестна (таймаут) — входы остаются занятыми', async () => {
    mocks.broadcastTransaction.mockRejectedValue(new Error('timeout'))
    await failure(boostPost(POST, 5))
    expect(mocks.unlockUTXOs).not.toHaveBeenCalled()
  })
})
