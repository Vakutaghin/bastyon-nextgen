import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BroadcastStatusUnknownError,
  computeTxidFromHex,
  isAlreadyKnownError,
  sendTransactionWithMessage,
} from './transaction-sender'

const { _rpcCallWithAuth, _getByPRC } = vi.hoisted(() => ({
  _rpcCallWithAuth: vi.fn(),
  _getByPRC: vi.fn(),
}))

vi.mock('@/helpers/api/request', () => ({ rpcCallWithAuth: _rpcCallWithAuth, getByPRC: _getByPRC }))
vi.mock('@/helpers/api/rpc-endpoints', () => ({
  rpcEndpoints: {
    sendRawTransactionWithMessage: 'sendrawtransactionwithmessage',
    getRawTransaction: 'getrawtransaction',
  },
}))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: vi.fn() }))

const validParams = () => ({
  hex: '0100aabb',
  messageData: { source: { v: ['Pa'] } },
  operationType: 'transaction',
})

let errSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  _rpcCallWithAuth.mockReset()
  _getByPRC.mockReset()
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => errSpy.mockRestore())

describe('sendTransactionWithMessage — валидация', () => {
  it('бросает при невалидном hex', async () => {
    await expect(sendTransactionWithMessage({ ...validParams(), hex: '' })).rejects.toThrow(
      'Invalid transaction hex'
    )
    expect(_rpcCallWithAuth).not.toHaveBeenCalled()
  })

  it('бросает при невалидном messageData', async () => {
    await expect(
      sendTransactionWithMessage({ ...validParams(), messageData: null as never })
    ).rejects.toThrow('Invalid message data')
  })

  it('бросает при невалидном operationType', async () => {
    await expect(
      sendTransactionWithMessage({ ...validParams(), operationType: '' })
    ).rejects.toThrow('Invalid operation type')
  })
})

describe('sendTransactionWithMessage — успех', () => {
  it('вызывает RPC с auth и параметрами [hex, messageData, operationType]', async () => {
    _rpcCallWithAuth.mockResolvedValue('txid-123')

    const res = await sendTransactionWithMessage(validParams())

    expect(res).toBe('txid-123')
    // Один сервер, без перебора нод, длинный таймаут (V1).
    expect(_rpcCallWithAuth).toHaveBeenCalledWith({
      method: 'sendrawtransactionwithmessage',
      parameters: ['0100aabb', { source: { v: ['Pa'] } }, 'transaction'],
      options: { auth: true, noFailover: true, timeout: 90_000 },
    })
  })

  it('возвращает txid из поля объекта-ответа', async () => {
    _rpcCallWithAuth.mockResolvedValue({ txid: 'abc', extra: 1 })

    expect(await sendTransactionWithMessage(validParams())).toBe('abc')
  })

  it('принимает txid из поля hash', async () => {
    _rpcCallWithAuth.mockResolvedValue({ hash: 'deadbeef' })

    expect(await sendTransactionWithMessage(validParams())).toBe('deadbeef')
  })
})

describe('sendTransactionWithMessage — ошибки', () => {
  it('пустой объект-ответ → ошибка неожиданного формата (обёрнута)', async () => {
    _rpcCallWithAuth.mockResolvedValue({})

    await expect(sendTransactionWithMessage(validParams())).rejects.toThrow(
      'Failed to send transaction: Unexpected response format'
    )
  })

  // P2-6: непустой объект без известного txid-поля НЕ фабрикуется в псевдо-txid.
  it('объект без txid/hash → бросает, не выдаёт JSON за txid', async () => {
    _rpcCallWithAuth.mockResolvedValue({ foo: 'bar', ok: true })

    await expect(sendTransactionWithMessage(validParams())).rejects.toThrow(
      'Failed to send transaction: Unexpected response format'
    )
  })

  it('оборачивает Error от RPC и сохраняет cause', async () => {
    const original = new Error('node rejected')
    _rpcCallWithAuth.mockRejectedValueOnce(original)

    await expect(sendTransactionWithMessage(validParams())).rejects.toMatchObject({
      message: 'Failed to send transaction: node rejected',
      cause: original,
    })
  })

  it('оборачивает non-Error (RPC-объект с кодом) через JSON', async () => {
    _rpcCallWithAuth.mockRejectedValueOnce({ code: -25, message: 'bad tx' })

    await expect(sendTransactionWithMessage(validParams())).rejects.toThrow(
      'Failed to send transaction: {"code":-25,"message":"bad tx"}'
    )
  })
})

// Локальный txid для hex '0100aabb' (hash256 в обратном порядке) — вычисляем
// тем же кодом; важно лишь, что он детерминирован и совпадает с verify-путём.
const localTxid = async () => (await computeTxidFromHex('0100aabb'))!

describe('sendTransactionWithMessage — бродкаст без повторной отправки (V1)', () => {
  const deps = () => ({
    rpcCallWithAuth: _rpcCallWithAuth,
    getByPRC: _getByPRC,
    sleep: async () => {},
  })

  it('computeTxidFromHex: детерминирован, 64 hex; мусор → null', async () => {
    const a = await computeTxidFromHex('0100aabb')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await computeTxidFromHex('0100aabb')).toBe(a)
    expect(await computeTxidFromHex('zz')).toBeNull()
    expect(await computeTxidFromHex('abc')).toBeNull()
  })

  it('«already in chain/mempool» от ноды = успех с локальным txid', async () => {
    _rpcCallWithAuth.mockRejectedValueOnce({
      code: -27,
      message: 'transaction already in block chain',
    })
    expect(await sendTransactionWithMessage(validParams(), deps())).toBe(await localTxid())
    _rpcCallWithAuth.mockRejectedValueOnce(new Error('txn-already-in-mempool'))
    expect(await sendTransactionWithMessage(validParams(), deps())).toBe(await localTxid())
    expect(isAlreadyKnownError(new Error('bad-txns-inputs-missingorspent'))).toBe(false)
  })

  it('таймаут: транзакция видна по getrawtransaction → успех, повторного бродкаста нет', async () => {
    _rpcCallWithAuth.mockRejectedValueOnce(new Error('RPC request timeout after 90000ms'))
    const txid = await localTxid()
    _getByPRC.mockRejectedValueOnce({ code: -5 }).mockResolvedValueOnce({ data: { txid } })
    expect(await sendTransactionWithMessage(validParams(), deps())).toBe(txid)
    expect(_rpcCallWithAuth).toHaveBeenCalledTimes(1)
    expect(_getByPRC).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'getrawtransaction', parameters: [txid] })
    )
  })

  it('таймаут и ноды tx не знают → BroadcastStatusUnknownError с txid, без повторной отправки', async () => {
    _rpcCallWithAuth.mockRejectedValueOnce(new Error('RPC request timeout after 90000ms'))
    _getByPRC.mockRejectedValue({ code: -5 })
    const err = await sendTransactionWithMessage(validParams(), deps()).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BroadcastStatusUnknownError)
    expect((err as BroadcastStatusUnknownError).txid).toBe(await localTxid())
    expect(_rpcCallWithAuth).toHaveBeenCalledTimes(1)
    expect(_getByPRC).toHaveBeenCalledTimes(3)
  })
})
