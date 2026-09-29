// Групповое шифрование, совместимое с bastyon-chat: хеш комплекта ключей —
// md5 от локальных частей matrix-id остальных участников по возрастанию
// dbId плюс «_v13_2» (сверяется с node:crypto, без crypto-js); state-событие
// общего ключа ищется по pcrypto.<отправитель>.<хеш>; признак зашифрованного
// сообщения; сбор ключей участников с догрузкой профилей и своими
// локальными ключами как запасом.

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ myMatrixId: '@me:matrix.pocketnet.app' as string | null }))
vi.mock('./matrix-service', async () => {
  const codec = await import('./matrix-service/address-codec')
  return {
    matrixService: {
      getClient: () => (mocks.myMatrixId ? { getUserId: () => mocks.myMatrixId } : null),
      hexToAddress: codec.hexToAddress,
    },
  }
})
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { addressToHex } from './matrix-service/address-codec'
import {
  collectPcryptoUsers,
  computeGroupUsershash,
  decryptGroupCommonKey,
  findCommonKeyStateEvent,
  isGroupEncryptedContent,
  type ProfileCacheLike,
} from './group-encryption'
import type { PcryptoService } from './pcrypto'
import { acceptPeerKeys, clearAllKeyPins } from './key-pinning'

const md5 = (s: string) => createHash('md5').update(s).digest('hex')

describe('computeGroupUsershash', () => {
  const users = [
    { id: '@cc:srv', keys: [], dbId: 30 },
    { id: '@aa:srv', keys: [], dbId: 10 },
    { id: '@me:srv', keys: [], dbId: 5 },
    { id: '@bb:srv', keys: [], dbId: 20 },
  ]

  it('md5 от остальных участников по dbId и суффикса _v13_2', () => {
    expect(computeGroupUsershash(users, 'me')).toBe(md5('aabbcc_v13_2'))
  })

  it('не зависит от порядка участников на входе', () => {
    expect(computeGroupUsershash([...users].reverse(), 'me')).toBe(md5('aabbcc_v13_2'))
  })

  it('равные dbId упорядочиваются по id', () => {
    const tie = [
      { id: '@zz:srv', keys: [], dbId: 1 },
      { id: '@yy:srv', keys: [], dbId: 1 },
    ]
    expect(computeGroupUsershash(tie, 'me')).toBe(md5('yyzz_v13_2'))
  })
})

describe('findCommonKeyStateEvent', () => {
  const event = (stateKey: string) => ({
    getStateKey: () => stateKey,
    event: { state_key: stateKey },
  })

  it('находит событие прямым запросом по state_key', () => {
    const target = event('pcrypto.alice.h1')
    const room = {
      currentState: {
        getStateEvents: (_type: string, key?: string) =>
          key === 'pcrypto.alice.h1' ? target : null,
      },
    }
    expect(findCommonKeyStateEvent(room, 'alice', 'h1')).toBe(target)
  })

  it('иначе — перебором всех m.room.encryption', () => {
    const target = { event: { state_key: 'pcrypto.alice.h1' } }
    const room = {
      currentState: {
        getStateEvents: (_type: string, key?: string) =>
          key ? null : [event('pcrypto.bob.h1'), target],
      },
    }
    expect(findCommonKeyStateEvent(room, 'alice', 'h1')).toBe(target)
    expect(findCommonKeyStateEvent(room, 'alice', 'other')).toBeNull()
    expect(findCommonKeyStateEvent(null, 'alice', 'h1')).toBeNull()
  })
})

describe('decryptGroupCommonKey', () => {
  const pcrypto = (impl: (event: unknown) => Promise<string>) =>
    ({ decryptEvent: vi.fn(impl) }) as unknown as PcryptoService & {
      decryptEvent: ReturnType<typeof vi.fn>
    }

  it('расшифровывает содержимое state-события от имени его отправителя', async () => {
    const service = pcrypto(async () => 'common-secret')
    const state = {
      getSender: () => '@alice:srv',
      getContent: () => ({ keys: 'k1', block: 7 }),
    }
    await expect(decryptGroupCommonKey(service, state, [])).resolves.toBe('common-secret')
    expect(service.decryptEvent).toHaveBeenCalledWith(
      { type: 'm.room.encryption', sender: '@alice:srv', content: { keys: 'k1', block: 7 } },
      []
    )
  })

  it('сырое событие без методов тоже читается', async () => {
    const service = pcrypto(async () => 'secret')
    await decryptGroupCommonKey(
      service,
      { event: { sender: '@bob:srv', content: { keys: 'k' } } },
      []
    )
    expect(service.decryptEvent.mock.lastCall![0]).toMatchObject({ sender: '@bob:srv' })
  })

  it('нет ключей, нет сервиса или расшифровка упала — null, без исключения', async () => {
    const failing = pcrypto(async () => {
      throw new Error('bad key')
    })
    await expect(
      decryptGroupCommonKey(failing, { getContent: () => ({ keys: 'k' }) }, [])
    ).resolves.toBeNull()
    await expect(decryptGroupCommonKey(failing, { getContent: () => ({}) }, [])).resolves.toBeNull()
    await expect(
      decryptGroupCommonKey(null, { getContent: () => ({ keys: 'k' }) }, [])
    ).resolves.toBeNull()
  })
})

describe('isGroupEncryptedContent', () => {
  it.each([
    [{ hash: 'h', body: 'a'.repeat(32) }, true],
    [{ hash: 'h', body: 'ABCDEF0123456789'.repeat(4) }, true],
    [{ hash: 'h', body: 'a'.repeat(31) }, false],
    [{ hash: 'h', body: 'g'.repeat(32) }, false],
    [{ hash: '', body: 'a'.repeat(32) }, false],
    [{ body: 'a'.repeat(32) }, false],
    [{ hash: 'h', body: 'Привет' }, false],
    [null, false],
  ])('%j → %s', (content, expected) => {
    expect(isGroupEncryptedContent(content as never)).toBe(expected)
  })
})

describe('collectPcryptoUsers', () => {
  const ALICE = 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM'
  const ME = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
  const mx = (address: string) => `@${addressToHex(address)}:matrix.pocketnet.app`

  let cache: ProfileCacheLike & { fetchProfiles: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    clearAllKeyPins()
    mocks.myMatrixId = mx(ME)
    cache = {
      userProfiles: {},
      fetchProfiles: vi.fn(async (addresses: string[]) => {
        for (const a of addresses) {
          if (a === ALICE) cache.userProfiles[a] = { k: 'ka1, ka2', id: 11 }
        }
      }),
    }
  })

  it('догружает недостающие профили (и свой) одним запросом, ключи — из профиля', async () => {
    const users = await collectPcryptoUsers([mx(ALICE)], {
      profileCache: cache,
      localMessengerKeys: null,
    })
    expect(cache.fetchProfiles).toHaveBeenCalledWith([ALICE, ME])
    expect(users).toEqual([{ id: mx(ALICE), keys: ['ka1', 'ka2'], dbId: 11 }])
  })

  it('сменившиеся ключи собеседника не используются, пока их не приняли (TOFU)', async () => {
    acceptPeerKeys(ME, ALICE, 'old1,old2')
    const opts = { profileCache: cache, localMessengerKeys: null }
    expect((await collectPcryptoUsers([mx(ALICE)], opts))[0]!.keys).toEqual(['old1', 'old2'])

    acceptPeerKeys(ME, ALICE, 'ka1, ka2')
    expect((await collectPcryptoUsers([mx(ALICE)], opts))[0]!.keys).toEqual(['ka1', 'ka2'])
  })

  it('свои ключи — из профиля, а без него из локальных ключей мессенджера', async () => {
    const local = [{ private: 'p', public: 'local-pub' }]
    const users = await collectPcryptoUsers([mx(ME)], {
      profileCache: cache,
      localMessengerKeys: local,
    })
    expect(users).toEqual([{ id: mx(ME), keys: ['local-pub'], dbId: undefined }])

    cache.userProfiles[ME] = { k: 'my1', id: 3 }
    const again = await collectPcryptoUsers([mx(ME)], {
      profileCache: cache,
      localMessengerKeys: local,
    })
    expect(again).toEqual([{ id: mx(ME), keys: ['my1'], dbId: 3 }])
  })

  it('участник без опубликованных ключей пропускается', async () => {
    const BOB = 'PBwpYFxv9kXhu5Ta3bRz5TJbNeqT4eqyTp'
    const users = await collectPcryptoUsers([mx(ALICE), mx(BOB)], {
      profileCache: cache,
      localMessengerKeys: null,
    })
    expect(users.map((u) => u.id)).toEqual([mx(ALICE)])
  })

  it('профили уже в кеше — повторного запроса нет', async () => {
    cache.userProfiles[ALICE] = { k: 'ka', id: 1 }
    cache.userProfiles[ME] = { k: 'km', id: 2 }
    await collectPcryptoUsers([mx(ALICE)], { profileCache: cache, localMessengerKeys: null })
    expect(cache.fetchProfiles).not.toHaveBeenCalled()
  })
})
