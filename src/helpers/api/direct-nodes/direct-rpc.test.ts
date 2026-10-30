// RPC напрямую к нодам: конверт как у прокси, перебор нод при сбое (но не при
// ошибке самой ноды), транзакция — одна попытка, монеты и баланс — по
// большинству нод, ленты — с профилями комментаторов, как их собирает прокси.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  call: vi.fn(),
  nodes: vi.fn(),
  dead: vi.fn(),
  rejected: vi.fn(),
}))
vi.mock('./node-call', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./node-call')>()),
  nodeCall: h.call,
}))
vi.mock('./node-pool', () => ({
  directNodes: h.nodes,
  markNodeDead: h.dead,
  markNodeRejected: h.rejected,
}))

import { canonical, directRpc } from './direct-rpc'
import { NodePinMismatchError } from './native-link'
import { NodeTransportError } from './node-call'

const down = (host: string) => new NodeTransportError(host, 'timeout')

describe('directRpc', () => {
  beforeEach(() => {
    h.call.mockReset()
    h.dead.mockReset()
    h.rejected.mockReset()
    h.nodes.mockReset().mockResolvedValue(['a', 'b', 'c'])
  })

  it('ответ ноды — в конверте прокси', async () => {
    h.call.mockResolvedValue({ height: 5 })
    await expect(directRpc({ method: 'getnodeinfo', parameters: [] })).resolves.toEqual({
      result: 'success',
      data: { height: 5 },
    })
    expect(h.call).toHaveBeenCalledWith('a', 'getnodeinfo', [], { timeoutMs: 30000 })
  })

  it('сбой связи — следующая нода; ошибка самой ноды — сразу наверх', async () => {
    h.call.mockRejectedValueOnce(down('a')).mockResolvedValueOnce('ok')
    await expect(directRpc({ method: 'getcomments', parameters: [] })).resolves.toMatchObject({
      data: 'ok',
    })
    expect(h.dead).toHaveBeenCalledWith('a')

    h.call.mockReset().mockRejectedValue({ code: -8, message: 'bad params', httpStatus: 500 })
    await expect(directRpc({ method: 'getcomments', parameters: [] })).rejects.toMatchObject({
      code: -8,
    })
    expect(h.call).toHaveBeenCalledTimes(1)
  })

  it('медленный SQL и перегрузка — другая нода, а эта остаётся в рабочих', async () => {
    h.call
      .mockRejectedValueOnce({
        code: 500,
        message: '{"code":408,"message":"GetBoostFeed: sql request timeout"}',
        httpStatus: 500,
      })
      .mockRejectedValueOnce(new NodeTransportError('b', 'busy', { busy: true }))
      .mockResolvedValueOnce('ok')
    await expect(directRpc({ method: 'getboostfeed', parameters: [] })).resolves.toMatchObject({
      data: 'ok',
    })
    expect(h.dead).not.toHaveBeenCalled()
  })

  it('ошибка в нашем коде — сразу наверх, ноды не страдают', async () => {
    h.call.mockRejectedValue(new TypeError('e.map is not a function'))
    await expect(directRpc({ method: 'getapps', parameters: [] })).rejects.toThrow(TypeError)
    expect(h.call).toHaveBeenCalledTimes(1)
    expect(h.dead).not.toHaveBeenCalled()
  })

  it('сменивший сертификат исключается; все молчат — общая ошибка', async () => {
    h.call
      .mockRejectedValueOnce(new NodePinMismatchError('a'))
      .mockRejectedValueOnce(down('b'))
      .mockRejectedValueOnce(down('c'))
    await expect(directRpc({ method: 'getcomments', parameters: [] })).rejects.toThrow(
      /All direct nodes failed/
    )
    expect(h.rejected).toHaveBeenCalledWith('a')
    expect(h.dead).toHaveBeenCalledWith('b')
  })

  it('транзакция — только одна попытка у лучшей ноды', async () => {
    h.call.mockRejectedValue(down('a'))
    await expect(
      directRpc({
        method: 'sendrawtransactionwithmessage',
        parameters: ['hex'],
        options: { noFailover: true },
      })
    ).rejects.toBeInstanceOf(NodeTransportError)
    expect(h.call).toHaveBeenCalledTimes(1)
  })

  it('названная нода (обход сети) — только она', async () => {
    h.call.mockResolvedValue([])
    await directRpc({ method: 'getpeerinfo', parameters: [], options: { node: '9.9.9.9:38081' } })
    expect(h.call).toHaveBeenCalledWith('9.9.9.9', 'getpeerinfo', [], { timeoutMs: 30000 })
    expect(h.nodes).not.toHaveBeenCalled()
  })

  describe('монеты и баланс — по большинству', () => {
    const utxo = (confirmations: number) => [{ txid: 't', vout: 0, amount: 1, confirmations }]
    const later = <T>(ms: number, value: T) =>
      new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

    it('три ноды разом; две совпали (подтверждения не в счёт) — медленную не ждём', async () => {
      h.call
        .mockReturnValueOnce(later(5, utxo(3)))
        .mockReturnValueOnce(new Promise(() => {}))
        .mockReturnValueOnce(later(10, utxo(4)))
      const res = await directRpc({ method: 'txunspent', parameters: [['P'], 1] })
      expect(res).toEqual({ result: 'success', data: utxo(3) })
      expect(h.call).toHaveBeenCalledTimes(3)
    })

    it('одна врёт — решают две другие', async () => {
      const fake = [{ txid: 'fake', vout: 0, amount: 1000 }]
      h.call
        .mockResolvedValueOnce(fake)
        .mockResolvedValueOnce(utxo(3))
        .mockResolvedValueOnce(utxo(3))
      const res = await directRpc({ method: 'txunspent', parameters: [['P'], 1] })
      expect(res).toEqual({ result: 'success', data: utxo(3) })
    })

    it('не сошлись все — ответ самой быстрой', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      h.call
        .mockReturnValueOnce(later(1, utxo(1)))
        .mockReturnValueOnce(later(5, [{ txid: 'x' }]))
        .mockReturnValueOnce(later(9, [{ txid: 'y' }]))
      const res = await directRpc({ method: 'txunspent', parameters: [['P'], 1] })
      expect(res).toEqual({ result: 'success', data: utxo(1) })
    })
  })

  it('порядок элементов и подтверждения на сверку не влияют', () => {
    expect(canonical([{ b: 1, a: 2, confirmations: 5 }, 'x'])).toBe(
      canonical(['x', { a: 2, b: 1, confirmations: 9 }])
    )
  })

  it('лента через rpc-ex: contents и профили авторов последних комментариев', async () => {
    const posts = [
      { txid: '1', address: 'A', lastComment: { address: 'C' } },
      { txid: '2', address: 'B', lastComment: { address: 'A' } },
    ]
    h.call.mockImplementation(async (_host: string, method: string, params: unknown[]) => {
      if (method === 'gethierarchicalstrip') return posts
      if (method === 'getuserprofile') return [{ address: (params[0] as string[])[0], name: 'c' }]
      throw new Error(method)
    })
    const res = (await directRpc({
      method: 'gethierarchicalstrip',
      parameters: [],
      options: { ex: true },
    })) as { data: { contents: unknown; users: unknown } }
    expect(res.data.contents).toEqual(posts)
    // A сам автор поста — его профиль и так в ленте.
    expect(h.call).toHaveBeenCalledWith('a', 'getuserprofile', [['C'], '1'], { timeoutMs: 30000 })
    expect(res.data.users).toEqual([{ address: 'C', name: 'c' }])
  })
})
