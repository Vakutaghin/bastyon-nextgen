// Отправка текста: эхо в ленте живёт под id копии события в SDK
// (`~<комната>:<txnId>`) и после ответа сервера получает настоящий id. Свой
// текст сразу лежит в кэше расшифровок — ни копия, ни история не показывают
// «*** Encrypted Message ***», даже пока ключа группы ещё нет.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { matrix, encryptKey, isTetatetchat } = vi.hoisted(() => ({
  matrix: {
    getRoom: vi.fn(() => ({ roomId: '!dm:host', loadMembersIfNeeded: async () => {} })),
    joinIfInvited: vi.fn(async () => {}),
    makeTxnId: vi.fn(() => 'm1.1'),
    getClient: () => ({ getUserId: () => '@me:host' }),
    sendEncryptedDirectMessage: vi.fn(async () => ({ event_id: '$real' })),
    sendEncryptedTextMessage: vi.fn(async () => ({ event_id: '$group' })),
    sendStateEvent: vi.fn(async () => ({})),
  },
  encryptKey: vi.fn(async () => ({ keys: 'CIPHER', block: 10 })),
  isTetatetchat: vi.fn(() => true),
}))

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: vi.fn() } }))
vi.mock('../../services/matrix-service', () => ({ matrixService: matrix }))
vi.mock('../../services/encryption-service', () => ({
  encryptTextWithSecret: vi.fn(async () => 'HEX'),
}))
vi.mock('../../services/group-encryption', () => ({
  computeGroupUsershash: () => 'hash',
  findCommonKeyStateEvent: () => null,
  decryptGroupCommonKey: vi.fn(),
}))
vi.mock('../../helpers', () => ({
  isTetatetchat,
  getAddressFromMatrixId: () => 'PPARTNER',
  getMatrixId: (a: string) => a,
}))
vi.mock('../../room-helpers', () => ({ getPartnerMatrixId: () => '@peer:host' }))

import type { Message } from '../../types'
import { useMessageSending } from './use-message-sending'

const ROOM = '!dm:host'
const LOCAL = `~${ROOM}:m1.1`

function setup() {
  const messages: Record<string, Message[]> = {}
  const cache = new Map<string, string>()
  const decryptionCache = {
    get: (id: string) => cache.get(id),
    has: (id: string) => cache.has(id),
    set: vi.fn((id: string, text: string) => cache.set(id, text)),
    persist: vi.fn(),
  }
  const ctx = {
    messages,
    currentUser: { value: { id: '@me:host', name: 'me' } },
    authStore: { isUserAuthenticated: true },
    uiStore: { isInitInProgress: false },
    profileCache: { userProfiles: {} },
  }
  const crypto = {
    ensurePcryptoInitialized: vi.fn(),
    waitForPcrypto: vi.fn(),
    pcryptoService: { value: { encryptKey } },
    getOrderedMemberIds: vi.fn(() => ['@me:host', '@peer:host']),
    collectPcryptoUsers: vi.fn(async () => [{ id: '@me:host' }, { id: '@peer:host' }]),
    pickRoomBlock: vi.fn(async () => 10),
    decryptionCache,
  }
  return { api: useMessageSending(ctx as never, crypto as never), messages, cache, decryptionCache }
}

beforeEach(() => {
  vi.clearAllMocks()
  isTetatetchat.mockReturnValue(true)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendMessage — эхо и копия события SDK', () => {
  it('эхо под id копии SDK, после ответа сервера — настоящий id, одно сообщение', async () => {
    const { api, messages, cache, decryptionCache } = setup()
    const sending = api.sendMessage(ROOM, 'Привет')
    expect(messages[ROOM]).toEqual([expect.objectContaining({ id: LOCAL, status: 'sending' })])
    await sending
    // txnId уходит в SDK — копия события получит тот же id, что у эхо.
    expect(matrix.sendEncryptedDirectMessage).toHaveBeenCalledWith(
      ROOM,
      { body: 'CIPHER', block: 10, version: 2 },
      undefined,
      'm1.1'
    )
    expect(messages[ROOM]).toEqual([
      expect.objectContaining({ id: '$real', status: 'sent', text: 'Привет' }),
    ])
    expect(cache.get(LOCAL)).toBe('Привет')
    expect(cache.get('$real')).toBe('Привет')
    expect(decryptionCache.persist).toHaveBeenCalledWith('@me:host', '$real', 'Привет')
  })

  it('SDK уже переименовал эхо (Room.localEchoUpdated) — копий не появляется', async () => {
    const { api, messages } = setup()
    matrix.sendEncryptedDirectMessage.mockImplementationOnce(async () => {
      messages[ROOM]![0]!.id = '$real'
      return { event_id: '$real' }
    })
    await api.sendMessage(ROOM, 'Привет')
    expect(messages[ROOM]!.map((m) => [m.id, m.status])).toEqual([['$real', 'sent']])
  })

  it('новый чат: групповой путь тоже с txnId, свой текст виден без ключа комнаты', async () => {
    isTetatetchat.mockReturnValue(false)
    const { api, messages, cache } = setup()
    await api.sendMessage(ROOM, 'Первое')
    expect(matrix.sendEncryptedTextMessage).toHaveBeenCalledWith(
      ROOM,
      { body: 'HEX', hash: 'hash', block: 10 },
      undefined,
      'm1.1'
    )
    expect(cache.get('$group')).toBe('Первое')
    expect(messages[ROOM]!.map((m) => m.id)).toEqual(['$group'])
  })

  it('не ушло — эхо «не отправлено»; повтор берёт новый txnId и доводит до настоящего id', async () => {
    const { api, messages } = setup()
    matrix.sendEncryptedDirectMessage.mockRejectedValueOnce(new Error('offline'))
    await api.sendMessage(ROOM, 'Привет')
    expect(messages[ROOM]).toEqual([expect.objectContaining({ id: LOCAL, status: 'failed' })])

    matrix.makeTxnId.mockReturnValueOnce('m2.2')
    await api.retryMessage(ROOM, LOCAL)
    expect(matrix.sendEncryptedDirectMessage).toHaveBeenLastCalledWith(
      ROOM,
      expect.anything(),
      undefined,
      'm2.2'
    )
    expect(messages[ROOM]!.map((m) => [m.id, m.status])).toEqual([['$real', 'sent']])
  })
})
