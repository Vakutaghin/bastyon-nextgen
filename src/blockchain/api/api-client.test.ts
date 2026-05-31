import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthenticatedApiClient } from './api-client'
import type { KeyPair } from '../types/keys'

// ---------------------------------------------------------------------------
// getByPRC (динамический импорт) и signRequest мокаем — request-signer уже
// покрыт отдельно. signRequest помечает данные signature:'SIG'.
// ---------------------------------------------------------------------------

const { _getByPRC, _signRequest } = vi.hoisted(() => ({
  _getByPRC: vi.fn(),
  _signRequest: vi.fn((data) => ({ ...data, signature: 'SIG' })),
}))

vi.mock('../../helpers/api/request', () => ({ getByPRC: _getByPRC }))
vi.mock('./request-signer', () => ({ signRequest: _signRequest }))

const KEY_PAIR = { ecPair: {} } as unknown as KeyPair
const ADDRESS = 'PUserAddr'

beforeEach(() => {
  _getByPRC.mockReset().mockResolvedValue({ ok: true })
  _signRequest.mockClear()
})

function makeClient(keyPair: KeyPair | null = KEY_PAIR, address: string | null = ADDRESS) {
  return createAuthenticatedApiClient({
    getKeyPair: () => keyPair,
    getAddress: () => address,
  })
}

describe('createAuthenticatedApiClient', () => {
  it('подписывает запрос, когда auth не отключён и есть ключи', async () => {
    const client = makeClient()

    await client({ method: 'getposts', parameters: [1], options: { session: 'sess' } })

    expect(_signRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'getposts', parameters: [1] }),
      KEY_PAIR,
      ADDRESS,
      { requireSignature: true, session: 'sess' }
    )
    // getByPRC получает подписанные параметры
    expect(_getByPRC.mock.calls[0][0]).toMatchObject({ method: 'getposts', signature: 'SIG' })
  })

  it('возвращает результат getByPRC', async () => {
    _getByPRC.mockResolvedValue({ data: 42 })
    const client = makeClient()

    expect(await client({ method: 'm', parameters: [] })).toEqual({ data: 42 })
  })

  it('auth=false при наличии ключей добавляет state=1 без подписи', async () => {
    const client = makeClient()

    await client({ method: 'm', parameters: [], options: { auth: false } })

    expect(_signRequest).not.toHaveBeenCalled()
    expect(_getByPRC.mock.calls[0][0]).toMatchObject({ state: 1 })
    expect(_getByPRC.mock.calls[0][0]).not.toHaveProperty('signature')
  })

  it('без ключей не подписывает и не добавляет state', async () => {
    const client = makeClient(null, null)

    await client({ method: 'm', parameters: [] })

    expect(_signRequest).not.toHaveBeenCalled()
    const sent = _getByPRC.mock.calls[0][0]
    expect(sent).not.toHaveProperty('signature')
    expect(sent).not.toHaveProperty('state')
  })

  it('пробрасывает customConfig (host/port) в getByPRC', async () => {
    const client = makeClient()
    const cfg = { host: 'node1', port: 8899 }

    await client({ method: 'm', parameters: [] }, cfg)

    expect(_getByPRC).toHaveBeenCalledWith(expect.any(Object), cfg)
  })
})
