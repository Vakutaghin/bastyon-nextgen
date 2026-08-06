import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ApiSignature } from '@/blockchain/types/signatures'
import {
  ensurePeertubeToken,
  getPeertubeChannel,
  loadPeertubeToken,
  savePeertubeToken,
  isAccessTokenValid,
  isRefreshTokenValid,
  type PeertubeToken,
  type InstanceFetch,
} from './peertube-auth'

const SIG: ApiSignature = {
  nonce: 'date=x,exp=360,s=abc',
  signature: 'sighex',
  pubkey: 'pkhex',
  address: 'PADDR',
  v: 1,
}

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Роутер-мок host-scoped fetch: по path отдаёт заранее заданный ответ/функцию. */
function mockInstance(
  handlers: Record<string, (init?: RequestInit) => Response>
): InstanceFetch & { mock: ReturnType<typeof vi.fn>['mock'] } {
  const fn = vi.fn(async (path: string, init?: RequestInit) => {
    const h = handlers[path]
    return h ? h(init) : jsonRes({ error: 'not_found' }, 404)
  })
  return fn as unknown as InstanceFetch & { mock: ReturnType<typeof vi.fn>['mock'] }
}

const tok = (over: Partial<PeertubeToken> = {}): PeertubeToken => ({
  access_token: 'C',
  refresh_token: 'R',
  expires_in: 9999,
  refresh_token_expires_in: 99999,
  isNewUser: false,
  ...over,
})

function memStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      m.set(k, String(v))
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
    clear: () => {
      m.clear()
    },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
})

describe('token cache', () => {
  it('save → load round-trip; повреждённое/пустое → null', () => {
    savePeertubeToken('PADDR', 'h', tok({ access_token: 'AT' }))
    expect(loadPeertubeToken('PADDR', 'h')?.access_token).toBe('AT')
    expect(loadPeertubeToken('PADDR', 'other')).toBeNull()
    localStorage.setItem('token_PADDR_bad', '{not json')
    expect(loadPeertubeToken('PADDR', 'bad')).toBeNull()
  })

  it('валидность access/refresh по абсолютному дедлайну', () => {
    expect(isAccessTokenValid(tok({ expires_in: 2000 }), 1000)).toBe(true)
    expect(isAccessTokenValid(tok({ expires_in: 500 }), 1000)).toBe(false)
    expect(isRefreshTokenValid(tok({ refresh_token_expires_in: 2000 }), 1000)).toBe(true)
    expect(isRefreshTokenValid(null, 1000)).toBe(false)
  })
})

describe('ensurePeertubeToken', () => {
  it('нет кэша → полный 3-шаговый handshake, подпись уходит формой, токен кэшируется', async () => {
    const fetchInstance = mockInstance({
      'api/v1/oauth-clients/local': () => jsonRes({ client_id: 'cid', client_secret: 'csec' }),
      'api/v1/users/blockChainAuth': () =>
        jsonRes({ externalAuthToken: 'eat', username: 'u', isNewUser: true }),
      'api/v1/users/token': () =>
        jsonRes({
          access_token: 'AT',
          refresh_token: 'RT',
          expires_in: 3600,
          refresh_token_expires_in: 7200,
        }),
    })

    const t = await ensurePeertubeToken({
      host: 'h',
      address: 'PADDR',
      signature: SIG,
      fetchInstance,
      now: () => 1000,
    })

    expect(t.access_token).toBe('AT')
    expect(t.expires_in).toBe(1000 + 3600 - 60)
    expect(t.refresh_token_expires_in).toBe(1000 + 7200 - 60)
    expect(t.isNewUser).toBe(true)

    // подпись отправлена x-www-form-urlencoded телом
    const bca = fetchInstance.mock.calls.find((c) => c[0] === 'api/v1/users/blockChainAuth')
    expect(bca?.[1]?.body).toContain('nonce=')
    expect(bca?.[1]?.body).toContain('address=PADDR')

    // токен закэширован
    expect(loadPeertubeToken('PADDR', 'h')?.access_token).toBe('AT')
  })

  it('валидный кэш → без сетевых вызовов', async () => {
    savePeertubeToken('PADDR', 'h', tok({ access_token: 'CACHED', expires_in: 2000 }))
    const fetchInstance = vi.fn() as unknown as InstanceFetch
    const t = await ensurePeertubeToken({
      host: 'h',
      address: 'PADDR',
      signature: SIG,
      fetchInstance,
      now: () => 1000,
    })
    expect(t.access_token).toBe('CACHED')
    expect(fetchInstance).not.toHaveBeenCalled()
  })

  it('истёк access, жив refresh → grant refresh_token, без blockChainAuth', async () => {
    savePeertubeToken('PADDR', 'h', tok({ expires_in: 500, refresh_token_expires_in: 9000 }))
    const fetchInstance = mockInstance({
      'api/v1/oauth-clients/local': () => jsonRes({ client_id: 'cid', client_secret: 'csec' }),
      'api/v1/users/token': () =>
        jsonRes({
          access_token: 'AT2',
          refresh_token: 'RT2',
          expires_in: 3600,
          refresh_token_expires_in: 7200,
        }),
    })

    const t = await ensurePeertubeToken({
      host: 'h',
      address: 'PADDR',
      signature: SIG,
      fetchInstance,
      now: () => 1000,
    })

    expect(t.access_token).toBe('AT2')
    const paths = fetchInstance.mock.calls.map((c) => c[0])
    expect(paths).not.toContain('api/v1/users/blockChainAuth')
    const tokenCall = fetchInstance.mock.calls.find((c) => c[0] === 'api/v1/users/token')
    expect(tokenCall?.[1]?.body).toContain('grant_type=refresh_token')
  })

  it('refresh упал → откат на полную авторизацию', async () => {
    savePeertubeToken('PADDR', 'h', tok({ expires_in: 500, refresh_token_expires_in: 9000 }))
    const fetchInstance = mockInstance({
      'api/v1/oauth-clients/local': () => jsonRes({ client_id: 'cid', client_secret: 'csec' }),
      'api/v1/users/blockChainAuth': () =>
        jsonRes({ externalAuthToken: 'eat', username: 'u', isNewUser: false }),
      'api/v1/users/token': (init) => {
        const body = String(init?.body ?? '')
        // refresh-грант отклоняем, password-грант принимаем
        if (body.includes('grant_type=refresh_token')) return jsonRes({ error: 'bad' }, 400)
        return jsonRes({
          access_token: 'ATP',
          refresh_token: 'RTP',
          expires_in: 3600,
          refresh_token_expires_in: 7200,
        })
      },
    })

    const t = await ensurePeertubeToken({
      host: 'h',
      address: 'PADDR',
      signature: SIG,
      fetchInstance,
      now: () => 1000,
    })

    expect(t.access_token).toBe('ATP')
    expect(fetchInstance.mock.calls.some((c) => c[0] === 'api/v1/users/blockChainAuth')).toBe(true)
  })
})

describe('getPeertubeChannel', () => {
  it('парсит channelId/квоты; реджект без канала', async () => {
    const ok = mockInstance({
      'api/v1/users/me': () =>
        jsonRes({
          videoChannels: [{ id: 7 }],
          videoQuotaDaily: 100,
          videoQuota: -1,
          username: 'bob',
        }),
    })
    const ch = await getPeertubeChannel({ host: 'h', accessToken: 'AT', fetchInstance: ok })
    expect(ch.channelId).toBe(7)
    expect(ch.videoQuotaDaily).toBe(100)
    expect(ch.username).toBe('bob')

    const noChannel = mockInstance({
      'api/v1/users/me': () => jsonRes({ videoChannels: [], videoQuotaDaily: 100 }),
    })
    await expect(
      getPeertubeChannel({ host: 'h', accessToken: 'AT', fetchInstance: noChannel })
    ).rejects.toThrow('peertube_no_channel')
  })

  it('шлёт Bearer-заголовок', async () => {
    const fetchInstance = mockInstance({
      'api/v1/users/me': () =>
        jsonRes({ videoChannels: [{ id: 1 }], videoQuotaDaily: 1, videoQuota: 1, username: 'x' }),
    })
    await getPeertubeChannel({ host: 'h', accessToken: 'SECRET', fetchInstance })
    const call = fetchInstance.mock.calls.find((c) => c[0] === 'api/v1/users/me')
    const headers = call?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer SECRET')
  })
})
