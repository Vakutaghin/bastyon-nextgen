// Чат открыт из списка с прошлого запуска раньше, чем Matrix вошёл и
// синхронизировался: загрузка ждёт комнату, а не показывает пустой чат.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const { matrix } = vi.hoisted(() => ({
  matrix: {
    getClient: vi.fn(),
    getRoom: vi.fn(),
    joinIfInvited: vi.fn(async () => {}),
    acceptInvite: vi.fn(async (_roomId: string): Promise<boolean> => true),
    setPresenceVisible: vi.fn(async () => {}),
  },
}))

vi.mock('../../services/matrix-service', () => ({ matrixService: matrix }))
vi.mock('../../helpers', () => ({
  getRoomTimelineEvents: (room: { events: unknown[] }) => room.events,
  isMessageEvent: () => true,
}))

import { useMessageLoading } from './use-message-loading'
import { useMessengerPrivacyStore } from '../messenger-privacy-store'

type Ev = { id: string; ts: number }

const stuckDecrypt = new Set<string>()

const client = {
  getUserId: () => '@me:host',
  paginateEventTimeline: vi.fn(async () => {}),
}

function fakeRoom(roomId: string, events: Ev[]) {
  return {
    roomId,
    events,
    loadMembersIfNeeded: vi.fn(async () => {}),
    getLiveTimeline: () => ({ getEvents: () => events }),
  }
}

function setup() {
  const messages = reactive<Record<string, { id: string }[]>>({})
  const uiStore = reactive({
    activeChatId: null as string | null,
    isMessagesLoading: false,
    isInitInProgress: false,
    syncState: 'STOPPED',
    dialogs: [] as { id: string; invite?: { by: string } }[],
  })
  const chatCrypto = {
    ensurePcryptoInitialized: vi.fn(),
    waitForPcrypto: vi.fn(async () => true),
    pcryptoService: ref({}),
  }
  const mapping = {
    // Расшифровка `stuckDecrypt` не кончается; без расшифровки — заглушка.
    mapEventToMessage: vi.fn(async (e: Ev, skipDecryption = false) =>
      skipDecryption
        ? { id: e.id, timestamp: e.ts, text: 'заглушка' }
        : stuckDecrypt.has(e.id)
          ? new Promise(() => {})
          : { id: e.id, timestamp: e.ts, text: 'ok' }
    ),
    enrichMessagesWithReactions: vi.fn(),
  }
  // Копия на устройстве: по умолчанию пуста — лента как есть.
  const archive = {
    mergeInto: vi.fn(async (_chatId: string, server: unknown[]) => ({
      messages: server,
      more: false,
    })),
    save: vi.fn(async () => 0),
    hasCopy: vi.fn(() => false),
  }
  const api = useMessageLoading(
    { messages, uiStore, archive } as never,
    chatCrypto as never,
    mapping as never
  )
  return { api, messages, uiStore, archive }
}

/** Matrix вошёл и прошёл первый синк: комнаты известны. */
function matrixReady(uiStore: { syncState: string }, rooms: ReturnType<typeof fakeRoom>[]) {
  matrix.getClient.mockReturnValue(client)
  matrix.getRoom.mockImplementation((id: string) => rooms.find((r) => r.roomId === id) ?? null)
  uiStore.syncState = 'PREPARED'
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  stuckDecrypt.clear()
  matrix.getClient.mockReturnValue(null)
  matrix.getRoom.mockReturnValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  setActivePinia(undefined as never)
})

/** Приглашение от Боба; `join` — вступление, которое принесёт синк. */
function invitedRoom(events: Ev[] = []) {
  const state = { membership: 'invite' }
  return {
    state,
    room: {
      ...fakeRoom('!inv:host', events),
      getMyMembership: () => state.membership,
      getMember: () => ({
        events: { member: { getSender: () => '@bob:host', getTs: () => 1000 } },
      }),
    },
  }
}

/** Настройки → Чаты → «Принимать приглашения сразу». */
function acceptInvitesOnOpen(): void {
  setActivePinia(createPinia())
  useMessengerPrivacyStore().prefs.acceptInvites = true
}

describe('useMessageLoading: чат открыт до конца входа в Matrix', () => {
  it('ждёт первого синка и грузит историю комнаты', async () => {
    const { api, messages, uiStore } = setup()
    const done = api.loadMessages('!a:host')

    await vi.advanceTimersByTimeAsync(1000)
    expect(uiStore.isMessagesLoading).toBe(true)
    expect(messages['!a:host']).toBeUndefined()

    matrixReady(uiStore, [
      fakeRoom('!a:host', [
        { id: '$1', ts: 1 },
        { id: '$2', ts: 2 },
      ]),
    ])
    await vi.advanceTimersByTimeAsync(200)
    await done

    expect(messages['!a:host']?.map((m) => m.id)).toEqual(['$1', '$2'])
    expect(uiStore.isMessagesLoading).toBe(false)
  })

  it('ушли в другой чат — ожидание прекращается и не гасит загрузку нового чата', async () => {
    const { api, messages, uiStore } = setup()
    const first = api.loadMessages('!a:host')
    await vi.advanceTimersByTimeAsync(400)

    const second = api.loadMessages('!b:host')
    await vi.advanceTimersByTimeAsync(200)
    await first
    expect(uiStore.isMessagesLoading).toBe(true)
    expect(messages['!a:host']).toBeUndefined()

    matrixReady(uiStore, [fakeRoom('!b:host', [{ id: '$b', ts: 1 }])])
    await vi.advanceTimersByTimeAsync(200)
    await second
    expect(messages['!b:host']?.map((m) => m.id)).toEqual(['$b'])
    expect(uiStore.isMessagesLoading).toBe(false)
  })

  it('сервер не отвечает на участников и историю — через 15 с видно то, что есть, и что не всё', async () => {
    const { api, messages, uiStore } = setup()
    const room = fakeRoom('!slow:host', [{ id: '$1', ts: 1 }])
    // Сокет умер при смене сети: ответа не будет никогда.
    room.loadMembersIfNeeded.mockImplementation(() => new Promise(() => {}))
    client.paginateEventTimeline.mockImplementationOnce(() => new Promise(() => {}))
    matrixReady(uiStore, [room])
    const done = api.loadMessages('!slow:host')

    await vi.advanceTimersByTimeAsync(14_999)
    expect(uiStore.isMessagesLoading).toBe(true)
    await vi.advanceTimersByTimeAsync(15_001)
    await done
    expect(messages['!slow:host']?.map((m) => m.id)).toEqual(['$1'])
    expect(uiStore.isMessagesLoading).toBe(false)
    expect(api.history['!slow:host']?.error).toBe('timeout')
  })

  it('расшифровка ждёт ключи дольше 8 с — на её месте пока заглушка, остальное видно', async () => {
    const { api, messages, uiStore } = setup()
    matrixReady(uiStore, [
      fakeRoom('!keys:host', [
        { id: '$ok', ts: 1 },
        { id: '$stuck', ts: 2 },
      ]),
    ])
    stuckDecrypt.add('$stuck')
    const done = api.loadMessages('!keys:host')
    await vi.advanceTimersByTimeAsync(8_000)
    await done
    expect(messages['!keys:host']?.map((m) => [m.id, (m as { text?: string }).text])).toEqual([
      ['$ok', 'ok'],
      ['$stuck', 'заглушка'],
    ])
    expect(uiStore.isMessagesLoading).toBe(false)
    expect(api.history['!keys:host']?.error).toBeUndefined()
  })

  it('приглашение не принимается само: ленты нет, видно, кто пригласил', async () => {
    const { api, messages, uiStore } = setup()
    const invited = {
      ...fakeRoom('!inv:host', []),
      getMyMembership: () => 'invite',
      getMember: () => ({
        events: { member: { getSender: () => '@bob:host', getTs: () => 1000 } },
      }),
    }
    matrixReady(uiStore, [invited])
    await api.loadMessages('!inv:host')

    expect(matrix.joinIfInvited).not.toHaveBeenCalled()
    expect(matrix.acceptInvite).not.toHaveBeenCalled()
    expect(client.paginateEventTimeline).not.toHaveBeenCalled()
    expect(messages['!inv:host']).toEqual([])
    expect(api.history['!inv:host']?.invitedBy).toBe('@bob:host')
    expect(uiStore.isMessagesLoading).toBe(false)
  })

  it('«принимать сразу»: открыли приглашение — вступили, лента без окна приглашения', async () => {
    acceptInvitesOnOpen()
    const { api, messages, uiStore } = setup()
    const { state, room } = invitedRoom([{ id: '$hi', ts: 1 }])
    matrixReady(uiStore, [room])
    uiStore.dialogs = [{ id: '!inv:host', invite: { by: '@bob:host' } }]
    matrix.acceptInvite.mockImplementationOnce(async () => {
      state.membership = 'join'
      return true
    })
    await api.loadMessages('!inv:host')

    expect(matrix.acceptInvite).toHaveBeenCalledWith('!inv:host')
    expect(messages['!inv:host']?.map((m) => m.id)).toEqual(['$hi'])
    expect(api.history['!inv:host']?.invitedBy).toBeFalsy()
    expect(uiStore.dialogs[0]!.invite).toBeUndefined()
  })

  it('«принимать сразу», а вступить нельзя — окно приглашения, как без настройки', async () => {
    acceptInvitesOnOpen()
    const { api, messages, uiStore } = setup()
    const { room } = invitedRoom()
    matrixReady(uiStore, [room])
    matrix.acceptInvite.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    await api.loadMessages('!inv:host')

    expect(messages['!inv:host']).toEqual([])
    expect(api.history['!inv:host']?.invitedBy).toBe('@bob:host')
    expect(uiStore.isMessagesLoading).toBe(false)
  })

  it('синк прошёл, а комнаты нет — не ждёт', async () => {
    const { api, messages, uiStore } = setup()
    matrixReady(uiStore, [])
    await api.loadMessages('!gone:host')
    expect(messages['!gone:host']).toBeUndefined()
    expect(uiStore.isMessagesLoading).toBe(false)
  })

  it('повторное открытие: устаревшая `~`-копия своего сообщения второй раз не появляется', async () => {
    // Баг: первое сообщение новому собеседнику — «*** Encrypted Message ***»,
    // а после закрытия и открытия чата — оно и настоящее событие рядом.
    const { api, messages, uiStore } = setup()
    messages['!a:host'] = [
      { id: '~!a:host:m1.1', timestamp: 2, status: 'sent' },
      { id: '~!a:host:m2.2', timestamp: 3, status: 'sending' },
      { id: '~!a:host:m3.3', timestamp: 4, status: 'failed' },
      { id: '$new', timestamp: 5, status: 'sent' },
    ] as unknown as { id: string }[]
    matrixReady(uiStore, [fakeRoom('!a:host', [{ id: '$real', ts: 2 }])])
    await api.loadMessages('!a:host')
    expect(messages['!a:host']?.map((m) => m.id)).toEqual([
      '$real',
      '~!a:host:m2.2',
      '~!a:host:m3.3',
      '$new',
    ])
  })

  it('Matrix так и не вошёл — через 30 секунд загрузка снимается', async () => {
    const { api, uiStore } = setup()
    const done = api.loadMessages('!a:host')
    await vi.advanceTimersByTimeAsync(29_000)
    expect(uiStore.isMessagesLoading).toBe(true)
    await vi.advanceTimersByTimeAsync(1_400)
    await done
    expect(uiStore.isMessagesLoading).toBe(false)
  })
})

describe('useMessageLoading: копия переписки на устройстве', () => {
  it('сервер больше не листает — над его лентой сохранённое, и оно же уходит в копию', async () => {
    const { api, messages, uiStore, archive } = setup()
    matrixReady(uiStore, [fakeRoom('!a:host', [{ id: '$2', ts: 20 }])])
    client.paginateEventTimeline.mockResolvedValueOnce(false as never)
    archive.mergeInto.mockImplementationOnce(async (_chatId: string, server: unknown[]) => ({
      messages: [{ id: '$1', timestamp: 10, archived: true, localOnly: true }, ...server],
      more: true,
    }))

    await api.loadMessages('!a:host')

    expect(archive.mergeInto).toHaveBeenCalledWith(
      '!a:host',
      [expect.objectContaining({ id: '$2' })],
      { exhausted: true, reachedStart: false }
    )
    expect(messages['!a:host']?.map((m) => m.id)).toEqual(['$1', '$2'])
    expect(archive.save).toHaveBeenCalledWith('!a:host', [expect.objectContaining({ id: '$2' })])
    // В копии есть ещё раньше: «начало чата» показывать рано.
    expect(api.history['!a:host']?.archiveMore).toBe(true)
  })
})

describe('useMessageLoading: поиск по чату листает историю глубже ленты', () => {
  const ev = (n: number) => ({ id: `$${n}`, ts: n, event_id: `$${n}` })
  const range = (from: number, to: number) =>
    Array.from({ length: to - from }, (_, i) => ev(from + i))

  /** Комната: в ленте `live`, на сервере старше — `older`; страница — `limit` самых поздних из них. */
  function roomWithHistory(live: Ev[], older: Ev[]) {
    const events = [...live] as Ev[]
    const timeline = {
      getEvents: () => events,
      getPaginationToken: () => (older.length ? 'token' : null),
    }
    const room = {
      roomId: '!a:host',
      events,
      loadMembersIfNeeded: vi.fn(async () => {}),
      getLiveTimeline: () => timeline,
    }
    client.paginateEventTimeline.mockImplementation((async (
      _timeline: unknown,
      opts: { limit: number }
    ) => {
      events.unshift(...older.splice(Math.max(0, older.length - opts.limit)))
      return older.length > 0
    }) as never)
    return room
  }

  async function opened(live: Ev[], older: Ev[]) {
    const s = setup()
    const room = roomWithHistory(live, older)
    matrixReady(s.uiStore, [room])
    await s.api.loadMessages('!a:host')
    client.paginateEventTimeline.mockClear()
    return { ...s, room }
  }

  it('страница истории — поиску, а лента чата не меняется', async () => {
    const { api, messages } = await opened(range(200, 240), range(0, 200))
    const page = await api.scanHistory('!a:host')
    expect(page.messages.map((m) => m.id)).toEqual(range(100, 200).map((e) => e.id))
    expect(page.exhausted).toBe(false)
    expect(messages['!a:host']).toHaveLength(40)
    const last = await api.scanHistory('!a:host')
    expect(last.exhausted).toBe(true)
    expect((await api.scanHistory('!a:host')).messages).toEqual([])
  })

  it('после поиска подгрузка выше разбирает уже долистанное, не спрашивая сервер', async () => {
    const { api, messages } = await opened(range(200, 240), range(0, 200))
    await api.scanHistory('!a:host')
    await api.loadMoreMessages('!a:host')
    expect(client.paginateEventTimeline).toHaveBeenCalledTimes(1)
    expect(messages['!a:host']).toHaveLength(140)
    // Разобрано — следующая подгрузка снова идёт к серверу.
    await api.loadMoreMessages('!a:host')
    expect(client.paginateEventTimeline).toHaveBeenCalledTimes(2)
  })

  it('пришло новое сообщение — подгрузка выше всё равно идёт к серверу', async () => {
    const { api, room, messages } = await opened(range(200, 240), range(0, 200))
    room.events.push(ev(300))
    await api.loadMoreMessages('!a:host')
    expect(client.paginateEventTimeline).toHaveBeenCalledTimes(1)
    expect(messages['!a:host']?.[0]?.id).toBe('$170')
  })

  it('переход к найденному — лента догружается до него страницами поиска', async () => {
    const { api, messages, archive } = await opened(range(200, 240), range(0, 200))
    expect(await api.revealMessage('!a:host', { id: '$50', timestamp: 50 })).toBe(true)
    expect(messages['!a:host']?.some((m) => m.id === '$50')).toBe(true)
    expect(client.paginateEventTimeline).toHaveBeenCalledTimes(2)
    expect(archive.mergeInto).toHaveBeenLastCalledWith(
      '!a:host',
      expect.any(Array),
      expect.objectContaining({ until: 50 })
    )
  })

  it('сообщения нет нигде — false, а не бесконечная подгрузка', async () => {
    const { api } = await opened(range(200, 240), range(100, 200))
    expect(await api.revealMessage('!a:host', { id: '$5', timestamp: 5 })).toBe(false)
    expect(client.paginateEventTimeline.mock.calls.length).toBeLessThan(5)
  })

  it('поиск по всем чатам: лента комнаты с устройства — без запросов и не трогая ленту чата', async () => {
    const { api, uiStore, messages } = setup()
    const room = fakeRoom('!b:host', [
      { id: '$1', ts: 1 },
      { id: '$2', ts: 2 },
    ])
    matrixReady(uiStore, [room])
    const first = await api.recentMessages('!b:host')
    expect(first.map((m) => m.id)).toEqual(['$1', '$2'])
    expect(messages['!b:host']).toBeUndefined()
    expect(client.paginateEventTimeline).not.toHaveBeenCalled()
    // Та же лента — разобранное помнится; пришло новое — разбирается заново.
    expect(await api.recentMessages('!b:host')).toBe(first)
    room.events.push({ id: '$3', ts: 3 })
    expect((await api.recentMessages('!b:host')).map((m) => m.id)).toEqual(['$1', '$2', '$3'])
    expect(await api.recentMessages('!none:host')).toEqual([])
  })

  it('поиск по всем чатам: что не расшифровалось быстро — не ждёт и найдётся в следующий раз', async () => {
    const { api, uiStore } = setup()
    matrixReady(uiStore, [
      fakeRoom('!b:host', [
        { id: '$ok', ts: 1 },
        { id: '$stuck', ts: 2 },
      ]),
    ])
    stuckDecrypt.add('$stuck')
    const pending = api.recentMessages('!b:host')
    await vi.advanceTimersByTimeAsync(1_500)
    expect((await pending).map((m) => m.id)).toEqual(['$ok'])
    stuckDecrypt.clear()
    expect((await api.recentMessages('!b:host')).map((m) => m.id)).toEqual(['$ok', '$stuck'])
  })

  it('поиск сбросили посреди перехода — останавливается', async () => {
    const { api } = await opened(range(200, 240), range(0, 200))
    let stop = false
    client.paginateEventTimeline.mockImplementationOnce((async () => {
      stop = true
      return true
    }) as never)
    expect(await api.revealMessage('!a:host', { id: '$5', timestamp: 5 }, () => stop)).toBe(false)
    expect(client.paginateEventTimeline).toHaveBeenCalledTimes(1)
  })
})
