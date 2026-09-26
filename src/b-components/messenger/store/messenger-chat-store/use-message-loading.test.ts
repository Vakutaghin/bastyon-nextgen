// Чат открыт из списка с прошлого запуска раньше, чем Matrix вошёл и
// синхронизировался: загрузка ждёт комнату, а не показывает пустой чат.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

const { matrix } = vi.hoisted(() => ({
  matrix: {
    getClient: vi.fn(),
    getRoom: vi.fn(),
    joinIfInvited: vi.fn(async () => {}),
  },
}))

vi.mock('../../services/matrix-service', () => ({ matrixService: matrix }))
vi.mock('../../helpers', () => ({
  getRoomTimelineEvents: (room: { events: unknown[] }) => room.events,
}))

import { useMessageLoading } from './use-message-loading'

type Ev = { id: string; ts: number }

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
  })
  const chatCrypto = {
    ensurePcryptoInitialized: vi.fn(),
    waitForPcrypto: vi.fn(async () => true),
    pcryptoService: ref({}),
  }
  const mapping = {
    mapEventToMessage: vi.fn(async (e: Ev) => ({ id: e.id, timestamp: e.ts })),
    enrichMessagesWithReactions: vi.fn(),
  }
  const api = useMessageLoading(
    { messages, uiStore } as never,
    chatCrypto as never,
    mapping as never
  )
  return { api, messages, uiStore }
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
  matrix.getClient.mockReturnValue(null)
  matrix.getRoom.mockReturnValue(null)
})

afterEach(() => {
  vi.useRealTimers()
})

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

  it('синк прошёл, а комнаты нет — не ждёт', async () => {
    const { api, messages, uiStore } = setup()
    matrixReady(uiStore, [])
    await api.loadMessages('!gone:host')
    expect(messages['!gone:host']).toBeUndefined()
    expect(uiStore.isMessagesLoading).toBe(false)
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
