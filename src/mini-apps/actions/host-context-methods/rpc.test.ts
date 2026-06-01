import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRpcMethods, type RpcDeps } from './rpc'

const rpcEndpoints = {
  getAddressInfo: 'getaddressinfo',
  getNodeInfo: 'getnodeinfo',
} as unknown as RpcDeps['rpcEndpoints']

function makeDeps(over: Partial<RpcDeps> = {}) {
  const getByPRC = vi.fn()
  const unwrapRpcResponse = vi.fn((raw: unknown) => raw)
  const useAuthStore = vi.fn(() => ({ address: 'PXYZ' }))
  const deps = {
    useAuthStore: useAuthStore as unknown as RpcDeps['useAuthStore'],
    getByPRC: getByPRC as unknown as RpcDeps['getByPRC'],
    rpcEndpoints,
    unwrapRpcResponse: unwrapRpcResponse as unknown as RpcDeps['unwrapRpcResponse'],
    ...over,
  }
  return { deps, getByPRC, unwrapRpcResponse, useAuthStore }
}

describe('createRpcMethods.callRpc', () => {
  let ctx: ReturnType<typeof makeDeps>

  beforeEach(() => {
    ctx = makeDeps()
  })

  it('делегирует в getByPRC с auth:false и дефолтными parameters []', async () => {
    ctx.getByPRC.mockResolvedValueOnce({ foo: 'bar' })
    ctx.unwrapRpcResponse.mockReturnValueOnce({ unwrapped: true })

    const methods = createRpcMethods(ctx.deps)
    const res = await methods.callRpc('somemethod')

    expect(ctx.getByPRC).toHaveBeenCalledWith({
      method: 'somemethod',
      parameters: [],
      options: { auth: false },
    })
    expect(res).toEqual({ unwrapped: true })
  })

  it('пробрасывает parameters (массив) и мёржит options поверх auth:false', async () => {
    ctx.getByPRC.mockResolvedValueOnce({})
    const methods = createRpcMethods(ctx.deps)
    await methods.callRpc('m', ['a', 'b'], { auth: true })

    expect(ctx.getByPRC).toHaveBeenCalledWith({
      method: 'm',
      parameters: ['a', 'b'],
      options: { auth: true },
    })
  })

  it('пробрасывает parameters в виде объекта', async () => {
    ctx.getByPRC.mockResolvedValueOnce({})
    const methods = createRpcMethods(ctx.deps)
    await methods.callRpc('m', { key: 'val' } as never)

    expect(ctx.getByPRC).toHaveBeenCalledWith({
      method: 'm',
      parameters: { key: 'val' },
      options: { auth: false },
    })
  })

  it('бросает ошибку, когда нода вернула result:error с текстом', async () => {
    ctx.getByPRC.mockResolvedValueOnce({ result: 'error', error: 'boom' })
    const methods = createRpcMethods(ctx.deps)
    await expect(methods.callRpc('m')).rejects.toThrow('boom')
  })

  it('бросает rpc_error, когда result:error без текста', async () => {
    ctx.getByPRC.mockResolvedValueOnce({ result: 'error' })
    const methods = createRpcMethods(ctx.deps)
    await expect(methods.callRpc('m')).rejects.toThrow('rpc_error')
  })

  it('возвращает сырой raw, если unwrapRpcResponse дал null/undefined', async () => {
    const raw = { result: 'ok', data: 1 }
    ctx.getByPRC.mockResolvedValueOnce(raw)
    ctx.unwrapRpcResponse.mockReturnValueOnce(null)
    const methods = createRpcMethods(ctx.deps)
    expect(await methods.callRpc('m')).toBe(raw)
  })

  it('не считает ошибкой объект без result:error', async () => {
    ctx.getByPRC.mockResolvedValueOnce({ result: 'ok' })
    ctx.unwrapRpcResponse.mockReturnValueOnce({ ok: true })
    const methods = createRpcMethods(ctx.deps)
    await expect(methods.callRpc('m')).resolves.toEqual({ ok: true })
  })
})

describe('createRpcMethods.getUserBalance', () => {
  it('возвращает {} без обращения к ноде, если нет адреса', async () => {
    const ctx = makeDeps({
      useAuthStore: vi.fn(() => ({ address: '' })) as unknown as RpcDeps['useAuthStore'],
    })
    const methods = createRpcMethods(ctx.deps)
    expect(await methods.getUserBalance()).toEqual({})
    expect(ctx.getByPRC).not.toHaveBeenCalled()
  })

  it('запрашивает getAddressInfo по адресу и возвращает распакованные данные', async () => {
    const ctx = makeDeps()
    ctx.getByPRC.mockResolvedValueOnce({})
    ctx.unwrapRpcResponse.mockReturnValueOnce({ balance: 100 })
    const methods = createRpcMethods(ctx.deps)

    const res = await methods.getUserBalance()
    expect(ctx.getByPRC).toHaveBeenCalledWith({
      method: 'getaddressinfo',
      parameters: ['PXYZ'],
      options: { auth: false },
    })
    expect(res).toEqual({ balance: 100 })
  })

  it('возвращает {}, если unwrapRpcResponse дал null', async () => {
    const ctx = makeDeps()
    ctx.getByPRC.mockResolvedValueOnce({})
    ctx.unwrapRpcResponse.mockReturnValueOnce(null)
    const methods = createRpcMethods(ctx.deps)
    expect(await methods.getUserBalance()).toEqual({})
  })
})

describe('createRpcMethods.getCurrentBlockHeight', () => {
  it('возвращает height из lastblock', async () => {
    const ctx = makeDeps()
    ctx.getByPRC.mockResolvedValueOnce({})
    ctx.unwrapRpcResponse.mockReturnValueOnce({ lastblock: { height: 42 } })
    const methods = createRpcMethods(ctx.deps)

    expect(await methods.getCurrentBlockHeight()).toBe(42)
    expect(ctx.getByPRC).toHaveBeenCalledWith({
      method: 'getnodeinfo',
      parameters: [],
      options: { auth: false },
    })
  })

  it('бросает, если height не число', async () => {
    const ctx = makeDeps()
    ctx.getByPRC.mockResolvedValueOnce({})
    ctx.unwrapRpcResponse.mockReturnValueOnce({ lastblock: {} })
    const methods = createRpcMethods(ctx.deps)
    await expect(methods.getCurrentBlockHeight()).rejects.toThrow(
      'actions_currentBlock_not_defined',
    )
  })

  it('бросает, если данные пустые', async () => {
    const ctx = makeDeps()
    ctx.getByPRC.mockResolvedValueOnce({})
    ctx.unwrapRpcResponse.mockReturnValueOnce(null)
    const methods = createRpcMethods(ctx.deps)
    await expect(methods.getCurrentBlockHeight()).rejects.toThrow(
      'actions_currentBlock_not_defined',
    )
  })
})
