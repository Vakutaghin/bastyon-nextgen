import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  exportPost,
  serializePost,
  type SharePostData,
} from '@/blockchain/core/actions/post-action'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'

import { POST_TX_FEE } from './consts'

// --- Моки IO-границ (pure serialize/export/validate — реальные) ---
const mocks = vi.hoisted(() => ({
  keyPair: { ecPair: {} } as unknown,
  address: 'PSenderAddr' as unknown,
  buildTransaction: vi.fn(),
  getUnspents: vi.fn(),
  filterAvailableUnspents: vi.fn(),
  selectBestUnspents: vi.fn(),
  lockUTXOs: vi.fn(),
  getByPRCWithAuth: vi.fn(),
}))

vi.mock('@/blockchain', () => ({
  useAuthStore: () => ({ getKeyPair: mocks.keyPair, getUserAddress: mocks.address }),
}))
vi.mock('@/blockchain/core/transactions/transaction-builder', () => ({
  buildTransaction: mocks.buildTransaction,
}))
vi.mock('@/blockchain/core/transactions/unspents-manager', () => ({
  getUnspents: mocks.getUnspents,
  filterAvailableUnspents: mocks.filterAvailableUnspents,
  selectBestUnspents: mocks.selectBestUnspents,
  lockUTXOs: mocks.lockUTXOs,
}))
vi.mock('@/helpers/api/request', () => ({ getByPRCWithAuth: mocks.getByPRCWithAuth }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { sendPost } from './post-sender'

const utxos = [{ txid: 'u1', vout: 0, amount: 1, scriptPubKey: '00' }]
const validPost: SharePostData = { message: 'Hello world', tags: ['news'], language: 'en' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.keyPair = { ecPair: {} }
  mocks.address = 'PSenderAddr'
  mocks.getUnspents.mockResolvedValue(utxos)
  mocks.filterAvailableUnspents.mockReturnValue(utxos)
  mocks.selectBestUnspents.mockReturnValue(utxos)
  mocks.buildTransaction.mockResolvedValue({
    hex: 'deadbeef',
    totalInputAmount: 1,
    totalOutputAmount: 1,
    usedUnspents: utxos,
    outputs: [],
  })
  mocks.getByPRCWithAuth.mockResolvedValue('txid-happy')
})

describe('sendPost', () => {
  it('бросает ошибку авторизации без keyPair', async () => {
    mocks.keyPair = null
    await expect(sendPost(validPost)).rejects.toThrow('postMsg.errAuthRequired')
  })

  it('бросает ошибку авторизации без адреса', async () => {
    mocks.address = null
    await expect(sendPost(validPost)).rejects.toThrow('postMsg.errAuthRequired')
  })

  it('бросает ошибку валидации (пустой пост)', async () => {
    await expect(sendPost({ language: 'en', tags: ['t'] })).rejects.toThrow(
      'postMsg.validation.empty'
    )
    expect(mocks.buildTransaction).not.toHaveBeenCalled()
  })

  it('нет доступных unspents → errNoUnspents', async () => {
    mocks.filterAvailableUnspents.mockReturnValue([])
    await expect(sendPost(validPost)).rejects.toThrow('postMsg.errNoUnspents')
  })

  it('не удалось подобрать unspents → errSelectUnspents', async () => {
    mocks.selectBestUnspents.mockReturnValue([])
    await expect(sendPost(validPost)).rejects.toThrow('postMsg.errSelectUnspents')
  })

  it('happy path: собирает транзакцию с корректными serialize/operationType/fee', async () => {
    const txid = await sendPost(validPost)
    expect(txid).toBe('txid-happy')

    expect(mocks.lockUTXOs).toHaveBeenCalledWith(utxos)
    expect(mocks.buildTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAddress: 'PSenderAddr',
        serializedData: serializePost(validPost),
        operationType: 'share',
        fee: POST_TX_FEE,
      })
    )
  })

  it('happy path: отправляет sendrawtransactionwithmessage с [hex, payload, operationType]', async () => {
    await sendPost(validPost)
    expect(mocks.getByPRCWithAuth).toHaveBeenCalledWith({
      method: rpcEndpoints.sendRawTransactionWithMessage,
      parameters: ['deadbeef', exportPost(validPost), 'share'],
      options: { auth: true },
    })
  })

  it('извлекает txid из конверта { result, data }', async () => {
    mocks.getByPRCWithAuth.mockResolvedValue({ result: 'success', data: 'txid-env' })
    await expect(sendPost(validPost)).resolves.toBe('txid-env')
  })

  it('отложенная публикация (settings.t > 1) → передаёт delayedNtime', async () => {
    await sendPost({ ...validPost, settings: { t: 1_900_000_000 } })
    expect(mocks.buildTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ delayedNtime: 1_900_000_000 })
    )
  })

  it('без отложенной публикации delayedNtime не передаётся', async () => {
    await sendPost(validPost)
    const callArg = mocks.buildTransaction.mock.calls[0][0]
    expect(callArg).not.toHaveProperty('delayedNtime')
  })
})
