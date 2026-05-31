import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendTransactionWithMessage } from './transaction-sender'

const _rpcCallWithAuth = vi.hoisted(() => vi.fn())

vi.mock('@/helpers/api/request', () => ({ rpcCallWithAuth: _rpcCallWithAuth }))
vi.mock('@/helpers/api/rpc-endpoints', () => ({
  rpcEndpoints: { sendRawTransactionWithMessage: 'sendrawtransactionwithmessage' },
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
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => errSpy.mockRestore())

describe('sendTransactionWithMessage — валидация', () => {
  it('бросает при невалидном hex', async () => {
    await expect(
      sendTransactionWithMessage({ ...validParams(), hex: '' })
    ).rejects.toThrow('Invalid transaction hex')
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
    expect(_rpcCallWithAuth).toHaveBeenCalledWith({
      method: 'sendrawtransactionwithmessage',
      parameters: ['0100aabb', { source: { v: ['Pa'] } }, 'transaction'],
      options: { auth: true },
    })
  })

  it('возвращает txid из поля объекта-ответа', async () => {
    _rpcCallWithAuth.mockResolvedValue({ txid: 'abc', extra: 1 })

    expect(await sendTransactionWithMessage(validParams())).toBe('abc')
  })

  it('fallback: непустой объект без txid сериализуется и принимается', async () => {
    _rpcCallWithAuth.mockResolvedValue({ hash: 'deadbeef' })

    const res = await sendTransactionWithMessage(validParams())

    expect(res).toBe(JSON.stringify({ hash: 'deadbeef' }))
  })
})

describe('sendTransactionWithMessage — ошибки', () => {
  it('пустой объект-ответ → ошибка неожиданного формата (обёрнута)', async () => {
    _rpcCallWithAuth.mockResolvedValue({})

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
