// Расшифровка сообщений: без PcryptoService и для обычного текста — null;
// расшифрованное берётся из кеша и сохраняется в него (память + диск);
// групповое — через общий ключ из state-события отправителя; личное и
// групповое с секретами — ключами участников на момент сообщения, секреты
// бывают в info, pbody, content или base64-теле; блок у личного чата без
// блока — текущий; для version > 1 участники по dbId. Любая ошибка — null
// (заглушка «не удалось расшифровать»), а не исключение.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rooms: {} as Record<string, unknown>,
  decryptTextWithSecret: vi.fn(),
  findCommonKeyStateEvent: vi.fn(),
  decryptGroupCommonKey: vi.fn(),
}))
vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    getRoom: (id: string) => mocks.rooms[id] ?? null,
    getClient: () => ({ getUserId: () => '@me:srv' }),
    hexToAddress: (hex: string) => `PAddress${hex}`,
  },
}))
vi.mock('../../services/encryption-service', () => ({
  decryptTextWithSecret: mocks.decryptTextWithSecret,
}))
vi.mock('../../services/group-encryption', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/group-encryption')>()
  return {
    isGroupEncryptedContent: actual.isGroupEncryptedContent,
    findCommonKeyStateEvent: mocks.findCommonKeyStateEvent,
    decryptGroupCommonKey: mocks.decryptGroupCommonKey,
  }
})
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import type { ChatContext, MxEvent } from './types'
import type { ChatCrypto } from './use-chat-crypto'
import { useMessageDecryption } from './use-message-decryption'

const SENDER = '@abcd:srv'

function setup(opts: { pcrypto?: boolean; direct?: boolean } = {}) {
  const cache = new Map<string, string>()
  const decryptionCache = {
    has: (id: string) => cache.has(id),
    get: (id: string) => cache.get(id),
    set: vi.fn((id: string, text: string) => cache.set(id, text)),
    persist: vi.fn(),
  }
  const pcrypto = { decryptEvent: vi.fn(async (_event: unknown, _users: unknown) => 'Привет!') }
  const users = [
    { id: '@zz:srv', keys: ['kz'], dbId: 20 },
    { id: SENDER, keys: ['ks'], dbId: 10 },
  ]
  const chatCrypto = {
    pcryptoService: { value: opts.pcrypto === false ? null : pcrypto },
    decryptionCache,
    getOrderedMemberIds: vi.fn(() => users.map((u) => u.id)),
    collectPcryptoUsers: vi.fn(async () => users.map((u) => ({ ...u }))),
    getCurrentBlockHeight: vi.fn(async () => 3_000_000),
  } as unknown as ChatCrypto
  const profileCache = {
    userProfiles: {} as Record<string, { k?: string; id?: number }>,
    fetchProfiles: vi.fn(),
  }
  mocks.rooms['!room:srv'] = { tetatet: opts.direct ?? false }
  const { tryDecrypt } = useMessageDecryption(
    { profileCache } as unknown as ChatContext,
    chatCrypto
  )
  return { tryDecrypt, pcrypto, chatCrypto, decryptionCache, profileCache, cache }
}

const event = (content: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({
    event_id: '$e1',
    room_id: '!room:srv',
    sender: SENDER,
    origin_server_ts: 1000,
    type: 'm.room.message',
    content,
    ...extra,
  }) as unknown as MxEvent

describe('useMessageDecryption', () => {
  beforeEach(() => {
    mocks.rooms = {}
    mocks.decryptTextWithSecret.mockReset().mockResolvedValue('Групповое привет')
    mocks.findCommonKeyStateEvent.mockReset().mockReturnValue({ id: 'state' })
    mocks.decryptGroupCommonKey.mockReset().mockResolvedValue('common-secret')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('без PcryptoService — null; обычный текст не расшифровывается', async () => {
    await expect(
      setup({ pcrypto: false }).tryDecrypt(event({ secrets: { keys: 'k' } }))
    ).resolves.toBeNull()
    const { tryDecrypt, pcrypto } = setup()
    await expect(tryDecrypt(event({ body: 'просто текст', msgtype: 'm.text' }))).resolves.toBeNull()
    expect(pcrypto.decryptEvent).not.toHaveBeenCalled()
  })

  it('уже расшифрованное берётся из кеша без криптографии', async () => {
    const { tryDecrypt, pcrypto, cache } = setup()
    cache.set('$e1', 'из кеша')
    await expect(tryDecrypt(event({ secrets: { keys: 'k' } }))).resolves.toBe('из кеша')
    expect(pcrypto.decryptEvent).not.toHaveBeenCalled()
  })

  describe('личные и групповые с секретами', () => {
    it('ключами участников на момент сообщения; результат — в кеш и на диск', async () => {
      const { tryDecrypt, pcrypto, chatCrypto, decryptionCache } = setup()
      await expect(tryDecrypt(event({ info: { secrets: { keys: 'k', block: 7 } } }))).resolves.toBe(
        'Привет!'
      )
      expect(chatCrypto.getOrderedMemberIds).toHaveBeenCalledWith(mocks.rooms['!room:srv'], 1000)
      const [raw, users] = pcrypto.decryptEvent.mock.lastCall! as [
        { content: { block: number } },
        Array<{ id: string }>,
      ]
      expect(raw.content.block).toBe(7)
      expect(users.map((u) => u.id)).toEqual(['@zz:srv', SENDER])
      expect(decryptionCache.set).toHaveBeenCalledWith('$e1', 'Привет!')
      expect(decryptionCache.persist).toHaveBeenCalledWith('@me:srv', '$e1', 'Привет!')
    })

    it.each([
      ['pbody', { pbody: { secrets: { keys: 'k', block: 1 } } }],
      ['content', { secrets: { keys: 'k', block: 1 } }],
      ['m.room.encrypted без секретов', {}],
    ])('секреты в %s тоже находятся', async (_name, content) => {
      const { tryDecrypt, pcrypto } = setup()
      const type = Object.keys(content).length ? 'm.room.message' : 'm.room.encrypted'
      await tryDecrypt(event(content, { type }))
      expect(pcrypto.decryptEvent).toHaveBeenCalledTimes(1)
    })

    it('секреты в base64-теле (старые клиенты) распознаются', async () => {
      const body = btoa(JSON.stringify({ keys: 'k', cipher: 'c', block: 5 }))
      const { tryDecrypt, pcrypto } = setup()
      await tryDecrypt(event({ body }))
      const [raw] = pcrypto.decryptEvent.mock.lastCall! as [
        { content: { info: { secrets: { keys: string; block: number } } } },
        unknown,
      ]
      expect(raw.content.info.secrets).toEqual({ keys: body, block: 5 })
    })

    it('версия > 1 — участники по dbId, как при шифровании', async () => {
      const { tryDecrypt, pcrypto } = setup()
      await tryDecrypt(event({ secrets: { keys: 'k', block: 1, v: 2 } }))
      const users = pcrypto.decryptEvent.mock.lastCall![1] as Array<{ id: string }>
      expect(users.map((u) => u.id)).toEqual([SENDER, '@zz:srv'])
    })

    it('личный чат без блока — текущий блок сети', async () => {
      const { tryDecrypt, pcrypto } = setup({ direct: true })
      await tryDecrypt(event({ secrets: { keys: 'k' } }))
      const [raw] = pcrypto.decryptEvent.mock.lastCall! as [
        { content: { block: number; secrets: { block: number } } },
        unknown,
      ]
      expect(raw.content.block).toBe(3_000_000)
      expect(raw.content.secrets.block).toBe(3_000_000)
    })

    it('ключей отправителя нет среди участников — догружаются из профиля', async () => {
      const { tryDecrypt, chatCrypto, profileCache, pcrypto } = setup()
      ;(chatCrypto.collectPcryptoUsers as ReturnType<typeof vi.fn>).mockResolvedValue([])
      profileCache.fetchProfiles.mockImplementation(async () => {
        profileCache.userProfiles.PAddressabcd = { k: 'ks1,ks2', id: 3 }
      })
      await tryDecrypt(event({ secrets: { keys: 'k', block: 1 } }))
      expect(profileCache.fetchProfiles).toHaveBeenCalledWith(['PAddressabcd'])
      expect(pcrypto.decryptEvent.mock.lastCall![1]).toEqual([
        { id: SENDER, keys: ['ks1', 'ks2'], dbId: 3 },
      ])
    })

    it('отправитель неизвестен или расшифровка упала — null и не в кеш', async () => {
      const unknown = setup()
      ;(unknown.chatCrypto.collectPcryptoUsers as ReturnType<typeof vi.fn>).mockResolvedValue([])
      await expect(unknown.tryDecrypt(event({ secrets: { keys: 'k' } }))).resolves.toBeNull()

      const failing = setup()
      failing.pcrypto.decryptEvent.mockRejectedValue(new Error('bad mac'))
      await expect(failing.tryDecrypt(event({ secrets: { keys: 'k' } }))).resolves.toBeNull()
      expect(failing.decryptionCache.set).not.toHaveBeenCalled()
    })
  })

  describe('групповое с общим ключом', () => {
    const groupContent = { msgtype: 'm.encrypted', hash: 'h1', body: 'ab'.repeat(16) }

    it('общий ключ из state-события отправителя, тело — AES этим ключом', async () => {
      const { tryDecrypt, decryptionCache } = setup()
      await expect(tryDecrypt(event(groupContent))).resolves.toBe('Групповое привет')
      expect(mocks.findCommonKeyStateEvent).toHaveBeenCalledWith(
        mocks.rooms['!room:srv'],
        'abcd',
        'h1'
      )
      expect(mocks.decryptTextWithSecret).toHaveBeenCalledWith('ab'.repeat(16), 'common-secret')
      expect(decryptionCache.persist).toHaveBeenCalledWith('@me:srv', '$e1', 'Групповое привет')
    })

    it('нет комнаты, state-события или общего ключа — null вместо сырого hex', async () => {
      const noRoom = setup()
      mocks.rooms = {}
      await expect(noRoom.tryDecrypt(event(groupContent))).resolves.toBeNull()

      const { tryDecrypt } = setup()
      mocks.findCommonKeyStateEvent.mockReturnValueOnce(null)
      await expect(tryDecrypt(event(groupContent))).resolves.toBeNull()
      mocks.decryptGroupCommonKey.mockResolvedValueOnce(null)
      await expect(tryDecrypt(event(groupContent))).resolves.toBeNull()
      expect(mocks.decryptTextWithSecret).not.toHaveBeenCalled()
    })
  })
})
