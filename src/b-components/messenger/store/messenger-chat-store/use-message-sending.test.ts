// Отправка текста: эхо в ленте живёт под id копии события в SDK
// (`~<комната>:<txnId>`) и после ответа сервера получает настоящий id. Свой
// текст сразу лежит в кэше расшифровок — ни копия, ни история не показывают
// «*** Encrypted Message ***», даже пока ключа группы ещё нет.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { matrix, encryptKey, isTetatetchat, toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
  matrix: {
    getRoom: vi.fn(() => ({ roomId: '!dm:host', loadMembersIfNeeded: async () => {} })),
    joinIfInvited: vi.fn(async () => {}),
    makeTxnId: vi.fn(() => 'm1.1'),
    getClient: () => ({ getUserId: () => '@me:host' }),
    sendEncryptedDirectMessage: vi.fn(async () => ({ event_id: '$real' })),
    sendEncryptedTextMessage: vi.fn(async () => ({ event_id: '$group' })),
    sendMessage: vi.fn(async () => ({ event_id: '$plain' })),
    sendStateEvent: vi.fn(async () => ({})),
    redactEvent: vi.fn(async () => ({})),
    sendArchiveRedact: vi.fn(async () => ({})),
  },
  encryptKey: vi.fn(async () => ({ keys: 'CIPHER', block: 10 })),
  isTetatetchat: vi.fn(() => true),
}))

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: toastError } }))
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
    profileCache: { userProfiles: {}, isUnresolved: vi.fn(() => false) },
    archive: { remove: vi.fn(async () => {}) },
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
  // Outbox без базы: что лежало бы на устройстве.
  const outbox = {
    kept: [] as string[],
    forgotten: [] as string[],
    hold: vi.fn(),
    payload: () => undefined,
    async keep(message: Message) {
      this.kept.push(message.id)
    },
    async forget(id: string) {
      this.forgotten.push(id)
    },
  }
  return {
    api: useMessageSending(ctx as never, crypto as never, outbox as never),
    outbox,
    messages,
    cache,
    decryptionCache,
    archive: ctx.archive,
    crypto,
    profileCache: ctx.profileCache,
  }
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

  it('запрос оборвался, а копия в SDK «не ушла» — повтор той же копией, с прежним txnId', async () => {
    const { api, messages } = setup()
    matrix.sendEncryptedDirectMessage.mockRejectedValueOnce(new Error('connection reset'))
    await api.sendMessage(ROOM, 'Привет')

    const unsent = { status: 'not_sent' }
    const resendEvent = vi.fn(async () => ({ event_id: '$real' }))
    const getClient = matrix.getClient
    matrix.getClient = () => ({ getUserId: () => '@me:host', resendEvent }) as never
    matrix.getRoom.mockReturnValueOnce({
      roomId: ROOM,
      findEventById: (id: string) => (id === LOCAL ? unsent : undefined),
    } as never)
    try {
      await api.retryMessage(ROOM, LOCAL)
    } finally {
      matrix.getClient = getClient
    }

    expect(resendEvent).toHaveBeenCalledWith(unsent, expect.objectContaining({ roomId: ROOM }))
    // Заново не шифровали и новой транзакции не открывали.
    expect(matrix.sendEncryptedDirectMessage).toHaveBeenCalledTimes(1)
    expect(matrix.makeTxnId).toHaveBeenCalledTimes(1)
    expect(messages[ROOM]!.map((m) => [m.id, m.status])).toEqual([['$real', 'sent']])
  })
})

describe('неотправленный текст на устройстве', () => {
  it('не ушло — сохраняется; повтор удался — забывается под прежним id', async () => {
    const { api, outbox } = setup()
    matrix.sendEncryptedDirectMessage.mockRejectedValueOnce(new Error('offline'))
    await api.sendMessage(ROOM, 'Привет')
    expect(outbox.kept).toEqual([LOCAL])

    matrix.makeTxnId.mockReturnValueOnce('m2.2')
    await api.retryMessage(ROOM, LOCAL)
    expect(outbox.forgotten).toEqual([LOCAL])
    expect(outbox.kept).toEqual([LOCAL])
  })

  it('повтор снова не удался — сохраняется под новым id, прежний забыт', async () => {
    const { api, outbox, messages } = setup()
    matrix.sendEncryptedDirectMessage.mockRejectedValue(new Error('offline'))
    try {
      await api.sendMessage(ROOM, 'Привет')
      matrix.makeTxnId.mockReturnValueOnce('m2.2')
      await api.retryMessage(ROOM, LOCAL)
    } finally {
      matrix.sendEncryptedDirectMessage.mockReset()
      matrix.sendEncryptedDirectMessage.mockResolvedValue({ event_id: '$real' })
    }
    const again = `~${ROOM}:m2.2`
    expect(messages[ROOM]!.map((m) => [m.id, m.status])).toEqual([[again, 'failed']])
    expect(outbox.kept).toEqual([LOCAL, again])
    expect(outbox.forgotten).toEqual([LOCAL])
  })

  it('«Удалить» у неотправленного — из ленты, с устройства и копию в SDK', async () => {
    const { api, outbox, messages } = setup()
    matrix.sendEncryptedDirectMessage.mockRejectedValueOnce(new Error('offline'))
    await api.sendMessage(ROOM, 'Привет')

    const unsent = { status: 'not_sent' }
    const cancelPendingEvent = vi.fn()
    const getClient = matrix.getClient
    matrix.getClient = () => ({ getUserId: () => '@me:host', cancelPendingEvent }) as never
    matrix.getRoom.mockReturnValueOnce({
      roomId: ROOM,
      findEventById: (id: string) => (id === LOCAL ? unsent : undefined),
    } as never)
    try {
      await api.discardMessage(ROOM, LOCAL)
    } finally {
      matrix.getClient = getClient
    }
    expect(messages[ROOM]).toEqual([])
    expect(cancelPendingEvent).toHaveBeenCalledWith(unsent)
    expect(outbox.forgotten).toEqual([LOCAL])
  })

  it('отправленное «Удалить неотправленное» не трогает', async () => {
    const { api, outbox, messages } = setup()
    await api.sendMessage(ROOM, 'Привет')
    await api.discardMessage(ROOM, '$real')
    expect(messages[ROOM]!.map((m) => m.id)).toEqual(['$real'])
    expect(outbox.forgotten).toEqual([])
  })
})

describe('шифровать ли — правила прежнего клиента (canBeEncrypt)', () => {
  const members = (n: number) => [
    '@me:host',
    ...Array.from({ length: n - 1 }, (_, i) => `@u${i}:host`),
  ]
  const groupRoom = (joinRule?: string) => ({
    roomId: ROOM,
    loadMembersIfNeeded: async () => {},
    ...(joinRule ? { getJoinRule: () => joinRule } : {}),
  })

  beforeEach(() => isTetatetchat.mockReturnValue(false))
  // clearAllMocks подменённую комнату не сбрасывает — возвращаем личную.
  afterEach(() =>
    matrix.getRoom.mockImplementation(() => ({ roomId: ROOM, loadMembersIfNeeded: async () => {} }))
  )

  it('публичная группа — обычный m.text с txnId эхо, ключи участников не нужны', async () => {
    matrix.getRoom.mockReturnValue(groupRoom('public') as never)
    const { api, messages, crypto } = setup()
    await api.sendMessage(ROOM, 'Всем привет')
    expect(matrix.sendMessage).toHaveBeenCalledWith(ROOM, 'Всем привет', undefined, 'm1.1')
    expect(matrix.sendEncryptedTextMessage).not.toHaveBeenCalled()
    expect(crypto.collectPcryptoUsers).not.toHaveBeenCalled()
    expect(messages[ROOM]!.map((m) => [m.id, m.status])).toEqual([['$plain', 'sent']])
  })

  it('закрытая группа от 50 участников — тоже открытым текстом', async () => {
    matrix.getRoom.mockReturnValue(groupRoom('invite') as never)
    const { api, crypto } = setup()
    crypto.getOrderedMemberIds.mockReturnValue(members(50))
    await api.sendMessage(ROOM, 'Привет')
    expect(matrix.sendMessage).toHaveBeenCalledTimes(1)
    expect(matrix.sendEncryptedTextMessage).not.toHaveBeenCalled()
  })

  it('в комнате пока одна я (личный чат до прихода собеседника) — не открытым текстом', async () => {
    matrix.getRoom.mockReturnValue(groupRoom() as never)
    const { api, crypto } = setup()
    crypto.getOrderedMemberIds.mockReturnValue(['@me:host'])
    crypto.collectPcryptoUsers.mockResolvedValue([{ id: '@me:host' }])
    await api.sendMessage(ROOM, 'Привет')
    expect(matrix.sendMessage).not.toHaveBeenCalled()
    expect(matrix.sendEncryptedTextMessage).toHaveBeenCalledTimes(1)
  })

  it('закрытая группа из 49 — шифруется; участник без ключей отправку не останавливает', async () => {
    matrix.getRoom.mockReturnValue(groupRoom('invite') as never)
    const { api, messages, crypto } = setup()
    const ids = members(49)
    crypto.getOrderedMemberIds.mockReturnValue(ids)
    const withKeys = ids.slice(0, 48).map((id) => ({ id }))
    crypto.collectPcryptoUsers.mockResolvedValue(withKeys)
    await api.sendMessage(ROOM, 'Привет')
    expect(matrix.sendMessage).not.toHaveBeenCalled()
    expect(encryptKey).toHaveBeenCalledWith(expect.any(String), withKeys, 10, 2)
    expect(matrix.sendEncryptedTextMessage).toHaveBeenCalledTimes(1)
    expect(toastError).not.toHaveBeenCalled()
    expect(messages[ROOM]!.map((m) => m.status)).toEqual(['sent'])
  })

  it('профиль участника группы не загрузился — запрашиваем ещё раз и шифруем и для него', async () => {
    matrix.getRoom.mockReturnValue(groupRoom() as never)
    const { api, crypto, profileCache } = setup()
    const ids = members(3)
    crypto.getOrderedMemberIds.mockReturnValue(ids)
    crypto.collectPcryptoUsers
      .mockResolvedValueOnce(ids.slice(0, 2).map((id) => ({ id })))
      .mockResolvedValueOnce(ids.map((id) => ({ id })))
    profileCache.isUnresolved.mockReturnValue(true)
    await api.sendMessage(ROOM, 'Привет')
    expect(crypto.collectPcryptoUsers).toHaveBeenCalledTimes(2)
    expect(encryptKey).toHaveBeenCalledWith(
      expect.any(String),
      ids.map((id) => ({ id })),
      10,
      2
    )
  })
})

describe('личный чат без ключей собеседника', () => {
  it('ключей нет — «не опубликовал ключи», без второго запроса профиля', async () => {
    const { api, messages, crypto } = setup()
    crypto.collectPcryptoUsers.mockResolvedValue([{ id: '@me:host' }])
    await api.sendMessage(ROOM, 'Привет')
    expect(crypto.collectPcryptoUsers).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith({ message: 'appMsg.messenger.recipientNoKeys' })
    expect(matrix.sendEncryptedDirectMessage).not.toHaveBeenCalled()
    expect(messages[ROOM]!.map((m) => m.status)).toEqual(['failed'])
  })

  it('профиль не загрузился и со второго раза — «нода не ответила», а не «нет ключей»', async () => {
    const { api, messages, crypto, profileCache } = setup()
    crypto.collectPcryptoUsers.mockResolvedValue([{ id: '@me:host' }])
    profileCache.isUnresolved.mockReturnValue(true)
    await api.sendMessage(ROOM, 'Привет')
    expect(crypto.collectPcryptoUsers).toHaveBeenCalledTimes(2)
    expect(toastError).toHaveBeenCalledWith({
      message: 'appMsg.messenger.recipientKeysUnavailable',
    })
    expect(messages[ROOM]!.map((m) => m.status)).toEqual(['failed'])
  })

  it('профиль пришёл со второго запроса — сообщение уходит зашифрованным', async () => {
    const { api, messages, crypto, profileCache } = setup()
    crypto.collectPcryptoUsers
      .mockResolvedValueOnce([{ id: '@me:host' }])
      .mockResolvedValueOnce([{ id: '@me:host' }, { id: '@peer:host' }])
    profileCache.isUnresolved.mockReturnValue(true)
    await api.sendMessage(ROOM, 'Привет')
    expect(matrix.sendEncryptedDirectMessage).toHaveBeenCalledTimes(1)
    expect(messages[ROOM]!.map((m) => [m.id, m.status])).toEqual([['$real', 'sent']])
  })
})

describe('deleteMessage — у всех и с устройства', () => {
  const saved = (over: Partial<Message> = {}): Message => ({
    id: '$old',
    chatId: ROOM,
    senderId: '@peer:host',
    text: 'привет',
    timestamp: 1,
    read: true,
    status: 'sent',
    ...over,
  })

  it('удалено на сервере — отметка в ленте и стирается из копии', async () => {
    const { api, messages, archive } = setup()
    messages[ROOM] = [saved()]
    await api.deleteMessage(ROOM, '$old')
    expect(matrix.redactEvent).toHaveBeenCalledWith(ROOM, '$old', 'deleted')
    expect(messages[ROOM]![0]).toMatchObject({ deleted: { by: '@me:host' }, text: '' })
    expect(archive.remove).toHaveBeenCalledWith(ROOM, ['$old'])
  })

  it('сервер не принял удаление — сообщение остаётся, ошибка наверх', async () => {
    const { api, messages, archive } = setup()
    messages[ROOM] = [saved()]
    matrix.redactEvent.mockRejectedValueOnce(new Error('HTTP 502'))
    await expect(api.deleteMessage(ROOM, '$old')).rejects.toThrow('HTTP 502')
    expect(messages[ROOM]![0]!.deleted).toBeUndefined()
    expect(archive.remove).not.toHaveBeenCalled()
  })

  it('сообщение есть только на устройстве — сервер его не знает, а с устройства оно стирается', async () => {
    const { api, messages, archive } = setup()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    messages[ROOM] = [saved({ archived: true, localOnly: true })]
    matrix.redactEvent.mockRejectedValueOnce({ errcode: 'M_NOT_FOUND', httpStatus: 404 })
    await api.deleteMessage(ROOM, '$old')
    expect(messages[ROOM]![0]!.deleted).toBeTruthy()
    expect(archive.remove).toHaveBeenCalledWith(ROOM, ['$old'])
    // Удаление стёртого сервер собеседнику не отдаёт — для его копии своё событие.
    expect(matrix.sendArchiveRedact).toHaveBeenCalledWith(ROOM, ['$old'])
  })

  it('удаление того, что есть на сервере, своего события для копий не шлёт', async () => {
    const { api, messages } = setup()
    messages[ROOM] = [saved()]
    await api.deleteMessage(ROOM, '$old')
    expect(matrix.sendArchiveRedact).not.toHaveBeenCalled()
  })
})
