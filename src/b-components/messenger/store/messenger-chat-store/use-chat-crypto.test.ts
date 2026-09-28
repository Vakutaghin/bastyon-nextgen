// Крипто-ядро чата: кто был в комнате в момент сообщения (его ключами оно
// зашифровано — ошибка здесь = «не удалось расшифровать»), блок шифрования
// (личный чат — фиксированный, группа — текущий с кешем), аватар из mxc,
// и жизненный цикл PcryptoService: только при входе с ключом и живом
// matrix-клиенте, один раз, с ожиданием и сбросом при выходе.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  client: null as null | { getUserId: () => string; mxcUrlToHttp?: (...a: unknown[]) => string },
  baseUrl: 'https://matrix.pocketnet.app',
  getByPRC: vi.fn(),
  deriveMessengerKeys: vi.fn(),
  cache: { hydrate: vi.fn(), purge: vi.fn(), resetInMemory: vi.fn() },
  collect: vi.fn(),
}))
vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    getClient: () => mocks.client,
    getBaseUrl: () => mocks.baseUrl,
    hexToAddress: (hex: string) => hex,
  },
}))
vi.mock('../../services/pcrypto', () => ({
  PcryptoService: class {
    constructor(
      public keys: unknown,
      public userId: string
    ) {}
  },
}))
vi.mock('../../services/decryption-cache', () => ({ createDecryptionCache: () => mocks.cache }))
vi.mock('../../services/group-encryption', () => ({ collectPcryptoUsers: mocks.collect }))
vi.mock('@/blockchain/core/keys', () => ({ deriveMessengerKeys: mocks.deriveMessengerKeys }))
vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.getByPRC }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { BLOCK_HEIGHT_CACHE_TTL, DEFAULT_ENCRYPTION_BLOCK } from '../consts'
import { useChatCrypto } from './use-chat-crypto'
import type { ChatContext, MxRoom } from './types'

type Membership = 'join' | 'invite' | 'leave'

/** Событие членства: invite несёт приглашённого в state_key, join/leave — в sender. */
function member(id: string, membership: Membership, ts: number, stateKey = id) {
  return {
    event_id: `${id}-${membership}-${ts}`,
    sender: membership === 'invite' ? '@inviter:srv' : id,
    state_key: stateKey,
    origin_server_ts: ts,
    content: { membership },
  }
}

function room(events: ReturnType<typeof member>[], opts: { direct?: boolean } = {}): MxRoom {
  return {
    tetatet: opts.direct ?? false,
    currentState: {
      getStateEvents: (type: string) => (type === 'm.room.member' ? events : []),
      getMembers: () => [],
    },
  } as unknown as MxRoom
}

function setup(auth: Partial<{ isUserAuthenticated: boolean; keyPair: unknown }> = {}) {
  const ctx = {
    authStore: { isUserAuthenticated: true, keyPair: { privateKey: 'priv' }, ...auth },
    profileCache: { userProfiles: {}, fetchProfiles: vi.fn() },
  } as unknown as ChatContext
  return useChatCrypto(ctx)
}

describe('useChatCrypto', () => {
  beforeEach(() => {
    mocks.client = { getUserId: () => '@me:srv' }
    mocks.baseUrl = 'https://matrix.pocketnet.app'
    mocks.getByPRC.mockReset()
    mocks.deriveMessengerKeys.mockReset().mockReturnValue([{ private: 'mp', public: 'mpub' }])
    mocks.cache.hydrate.mockReset().mockResolvedValue(undefined)
    mocks.cache.purge.mockReset().mockResolvedValue(undefined)
    mocks.cache.resetInMemory.mockReset()
    mocks.collect.mockReset().mockResolvedValue([])
  })
  afterEach(() => vi.useRealTimers())

  describe('участники на момент сообщения', () => {
    const history = [
      member('@alice:srv', 'join', 100),
      member('@bob:srv', 'invite', 150, '@bob:srv'),
      member('@carol:srv', 'join', 200),
      member('@alice:srv', 'leave', 300),
      member('@alice:srv', 'join', 400),
    ]

    it('группа: вышедший не входит в ключи сообщений после выхода и снова входит после возвращения', () => {
      const crypto = setup()
      const r = room(history)
      expect(crypto.getOrderedMemberIds(r, 250).sort()).toEqual(
        ['@alice:srv', '@bob:srv', '@carol:srv'].sort()
      )
      expect(crypto.getOrderedMemberIds(r, 350).sort()).toEqual(['@bob:srv', '@carol:srv'])
      expect(crypto.getOrderedMemberIds(r, 450)).toContain('@alice:srv')
    })

    it('приглашённый учитывается по state_key, а не по пригласившему', () => {
      const ids = setup().getOrderedMemberIds(room(history), 160)
      expect(ids).toContain('@bob:srv')
      expect(ids).not.toContain('@inviter:srv')
    })

    it('до первого вступления — все известные участники (иначе сообщение не расшифровать)', () => {
      const ids = setup().getOrderedMemberIds(room(history), 50)
      expect(ids.sort()).toEqual(['@alice:srv', '@bob:srv', '@carol:srv'].sort())
    })

    it('личный чат: оба участника всегда, выход не учитывается', () => {
      const dm = room(
        [
          member('@me:srv', 'join', 100),
          member('@bob:srv', 'join', 100),
          member('@bob:srv', 'leave', 200),
        ],
        { direct: true }
      )
      expect(setup().getOrderedMemberIds(dm, 300).sort()).toEqual(['@bob:srv', '@me:srv'])
    })

    it('без истории членства — текущие участники, кроме забаненных', () => {
      const r = {
        tetatet: false,
        currentState: {
          getStateEvents: () => [],
          getMembers: () => [
            { userId: '@a:srv', membership: 'join' },
            { userId: '@b:srv', membership: 'ban' },
            { userId: '@c:srv', membership: 'leave' },
          ],
        },
      } as unknown as MxRoom
      expect(setup().getOrderedMemberIds(r, 1)).toEqual(['@a:srv', '@c:srv'])
    })

    it('события из старого состояния тоже учитываются, дубли — один раз', () => {
      const join = member('@dave:srv', 'join', 10)
      const r = {
        tetatet: false,
        currentState: { getStateEvents: () => [join], getMembers: () => [] },
        oldState: { getStateEvents: () => [join, member('@erin:srv', 'join', 20)] },
      } as unknown as MxRoom
      expect(setup().getOrderedMemberIds(r, 30).sort()).toEqual(['@dave:srv', '@erin:srv'])
    })
  })

  describe('блок шифрования', () => {
    it('личный чат — фиксированный блок без запроса к ноде', async () => {
      await expect(setup().pickRoomBlock(room([], { direct: true }))).resolves.toBe(
        DEFAULT_ENCRYPTION_BLOCK
      )
      expect(mocks.getByPRC).not.toHaveBeenCalled()
    })

    it('группа — текущая высота, кешируется; нода не ответила — последнее или дефолт', async () => {
      vi.useFakeTimers()
      mocks.getByPRC.mockResolvedValueOnce({ data: { lastblock: { height: 3_000_000 } } })
      const crypto = setup()
      await expect(crypto.pickRoomBlock(room([]))).resolves.toBe(3_000_000)
      await crypto.pickRoomBlock(room([]))
      expect(mocks.getByPRC).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(BLOCK_HEIGHT_CACHE_TTL)
      mocks.getByPRC.mockRejectedValueOnce(new Error('offline'))
      await expect(crypto.pickRoomBlock(room([]))).resolves.toBe(3_000_000)

      mocks.getByPRC.mockRejectedValue(new Error('offline'))
      await expect(setup().pickRoomBlock(room([]))).resolves.toBe(DEFAULT_ENCRYPTION_BLOCK)
    })
  })

  describe('аватар из mxc', () => {
    it('через клиент, если он умеет', () => {
      mocks.client = { getUserId: () => '@me:srv', mxcUrlToHttp: (...a) => `http:${a.join('|')}` }
      expect(setup().getMatrixAvatarUrl('mxc://srv/abc', 64)).toBe('http:mxc://srv/abc|64|64|crop')
    })

    it('иначе — thumbnail на сервере матрицы; локальная база заменяется на боевой сервер', () => {
      mocks.client = null
      expect(setup().getMatrixAvatarUrl('mxc://srv/abc')).toBe(
        'https://matrix.pocketnet.app/_matrix/media/r0/thumbnail/srv/abc?width=40&height=40&method=crop'
      )
      mocks.baseUrl = 'http://localhost:1990/matrix'
      expect(setup().getMatrixAvatarUrl('mxc://srv/abc')).toContain('https://matrix.pocketnet.app/')
      expect(setup().getMatrixAvatarUrl('https://not-mxc')).toBeUndefined()
      expect(setup().getMatrixAvatarUrl(null)).toBeUndefined()
    })
  })

  describe('PcryptoService', () => {
    it('создаётся один раз из ключей аккаунта и поднимает кеш расшифровок', () => {
      const crypto = setup()
      crypto.ensurePcryptoInitialized()
      crypto.ensurePcryptoInitialized()
      expect(mocks.deriveMessengerKeys).toHaveBeenCalledTimes(1)
      expect(mocks.deriveMessengerKeys).toHaveBeenCalledWith('priv')
      expect(crypto.pcryptoService.value).toMatchObject({ userId: '@me:srv' })
      expect(crypto.localMessengerKeys.value).toEqual([{ private: 'mp', public: 'mpub' }])
      expect(mocks.cache.hydrate).toHaveBeenCalledWith('@me:srv')
    })

    it.each([
      ['не вошёл', { isUserAuthenticated: false }],
      ['нет ключа', { keyPair: null }],
    ])('%s — не создаётся', (_name, auth) => {
      const crypto = setup(auth)
      crypto.ensurePcryptoInitialized()
      expect(crypto.pcryptoService.value).toBeNull()
    })

    it('без matrix-клиента не создаётся; ошибка вывода ключей не роняет чат', () => {
      mocks.client = null
      const crypto = setup()
      crypto.ensurePcryptoInitialized()
      expect(crypto.pcryptoService.value).toBeNull()

      mocks.client = { getUserId: () => '@me:srv' }
      mocks.deriveMessengerKeys.mockImplementation(() => {
        throw new Error('bad key')
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})
      crypto.ensurePcryptoInitialized()
      expect(crypto.pcryptoService.value).toBeNull()
    })

    it('ожидание сервиса: дожидается появления или сдаётся по таймауту', async () => {
      vi.useFakeTimers()
      const crypto = setup()
      const waiting = crypto.waitForPcrypto(1000)
      await vi.advanceTimersByTimeAsync(300)
      crypto.ensurePcryptoInitialized()
      await vi.advanceTimersByTimeAsync(100)
      await expect(waiting).resolves.toBe(true)

      const other = setup()
      const timedOut = other.waitForPcrypto(500)
      await vi.advanceTimersByTimeAsync(600)
      await expect(timedOut).resolves.toBe(false)
    })

    it('выход сбрасывает сервис, ключи и кеш в памяти; purge — для своего пользователя', async () => {
      const crypto = setup()
      crypto.ensurePcryptoInitialized()
      crypto.resetCrypto()
      expect(crypto.pcryptoService.value).toBeNull()
      expect(crypto.localMessengerKeys.value).toBeNull()
      expect(mocks.cache.resetInMemory).toHaveBeenCalled()
      await crypto.purgeDecryptedCache()
      expect(mocks.cache.purge).toHaveBeenCalledWith('@me:srv')
    })

    it('ключи участников собираются с текущими локальными ключами', async () => {
      const crypto = setup()
      crypto.ensurePcryptoInitialized()
      await crypto.collectPcryptoUsers(['@a:srv'])
      expect(mocks.collect).toHaveBeenCalledWith(['@a:srv'], {
        profileCache: expect.anything(),
        localMessengerKeys: [{ private: 'mp', public: 'mpub' }],
      })
    })
  })
})
