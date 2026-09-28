// Подпись запросов текущим аккаунтом: с ключом — подпись (и session), без
// ключа у вошедшего — legacy state=1, гость — RPC уходит как есть, а
// HTTP-запрос, требующий входа, отказывает явно. auth:false не подписывает.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: {
    getKeyPair: { privateKey: 'priv' } as unknown,
    getUserAddress: 'PMe' as string | null,
    isUserAuthenticated: true,
  },
  signRequest: vi.fn(),
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/blockchain/api/request-signer', () => ({ signRequest: mocks.signRequest }))

import { signHttpDataIfNeeded, signRpcParamsIfNeeded } from './request-signing'

describe('request-signing', () => {
  beforeEach(() => {
    mocks.auth.getKeyPair = { privateKey: 'priv' }
    mocks.auth.getUserAddress = 'PMe'
    mocks.auth.isUserAuthenticated = true
    mocks.signRequest
      .mockReset()
      .mockImplementation((data: object) => ({ ...data, signature: { address: 'PMe' } }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  describe('RPC', () => {
    it('с ключом — подпись с обязательной сигнатурой и session из options', async () => {
      const params = { method: 'getuserstate', parameters: ['PMe'], options: { session: 's1' } }
      const signed = await signRpcParamsIfNeeded(params)
      expect(mocks.signRequest).toHaveBeenCalledWith(params, { privateKey: 'priv' }, 'PMe', {
        requireSignature: true,
        session: 's1',
      })
      expect(signed).toMatchObject({ signature: { address: 'PMe' } })
    })

    it('вошёл, но ключа нет — state=1 без подписи', async () => {
      mocks.auth.getKeyPair = null
      const signed = await signRpcParamsIfNeeded({ method: 'm', parameters: [] })
      expect(signed.state).toBe(1)
      expect(mocks.signRequest).not.toHaveBeenCalled()
    })

    it('гость — запрос как есть', async () => {
      mocks.auth.getKeyPair = null
      mocks.auth.getUserAddress = null
      mocks.auth.isUserAuthenticated = false
      const signed = await signRpcParamsIfNeeded({ method: 'm', parameters: [] })
      expect(signed.state).toBeUndefined()
    })

    it('auth:false не подписывает, но у вошедшего ставит state=1', async () => {
      const signed = await signRpcParamsIfNeeded({
        method: 'm',
        parameters: [],
        options: { auth: false },
      })
      expect(mocks.signRequest).not.toHaveBeenCalled()
      expect(signed.state).toBe(1)
    })
  })

  describe('HTTP', () => {
    it('auth:false — копия данных без подписи', async () => {
      const data = { a: 1 }
      const out = await signHttpDataIfNeeded(data, { auth: false }, 'peertube/best')
      expect(out).toEqual({ a: 1 })
      expect(out).not.toBe(data)
      expect(mocks.signRequest).not.toHaveBeenCalled()
    })

    it('с ключом — подписанные данные', async () => {
      const out = await signHttpDataIfNeeded({ a: 1 }, { session: 's2' }, 'captcha')
      expect(out).toMatchObject({ a: 1, signature: { address: 'PMe' } })
      expect(mocks.signRequest.mock.lastCall![3]).toEqual({ requireSignature: true, session: 's2' })
    })

    it('подпись не получилась — ошибка, запрос не уходит без неё', async () => {
      mocks.signRequest.mockImplementation((data: object) => ({ ...data }))
      await expect(signHttpDataIfNeeded({ a: 1 }, undefined, 'x')).rejects.toThrow(
        'Failed to generate signature for request'
      )
    })

    it('вошёл без ключа — state=1; гость — явный отказ', async () => {
      mocks.auth.getKeyPair = null
      await expect(signHttpDataIfNeeded({ a: 1 }, undefined, 'x')).resolves.toEqual({
        a: 1,
        state: 1,
      })
      mocks.auth.isUserAuthenticated = false
      await expect(signHttpDataIfNeeded({ a: 1 }, undefined, 'x')).rejects.toThrow(
        'Authentication required'
      )
    })
  })
})
