import { describe, it, expect, vi, beforeEach } from 'vitest'

type Handler = (...args: unknown[]) => unknown
const handlers: Record<string, Handler> = {}
const client = {
  getUserId: () => '@me:host',
  setRoomReadMarkers: vi.fn(async () => {}),
}
const notifyMessage = vi.fn()
const audioPlay = vi.fn(() => Promise.resolve())

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/composables/use-browser-notifications', () => ({
  notifyMessage: (...a: unknown[]) => notifyMessage(...a),
}))
vi.mock('@/services/logger', () => ({ logger: { scope: () => ({ error: vi.fn() }) } }))
vi.mock('../../sounds/glass.mp3', () => ({ default: 'glass.mp3' }))
vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    on: (name: string, h: Handler) => {
      handlers[name] = h
    },
    getClient: () => client,
  },
}))

import { registerMatrixListeners } from './use-matrix-listeners'

const ROOM = '!room:host'

function mxEvent(type: string, over: Record<string, unknown> = {}) {
  const content = { msgtype: 'm.text', body: 'hi', ...((over.content as object) || {}) }
  const id = (over.id as string) || '$e1'
  return {
    event_id: id,
    room_id: ROOM,
    sender: (over.sender as string) || '@peer:host',
    origin_server_ts: (over.ts as number) ?? Date.now(),
    type,
    content,
    redacts: over.redacts,
    getId: () => id,
    getType: () => type,
    getRoomId: () => ROOM,
    getSender: () => (over.sender as string) || '@peer:host',
    getTs: () => (over.ts as number) ?? Date.now(),
    getContent: () => content,
  }
}

const room = { roomId: ROOM, getMember: (id: string) => ({ name: `name-of-${id}` }) }

function setup(activeChatId: string | null) {
  const chatStore = {
    messages: {} as Record<string, { id: string }[]>,
    currentUser: { id: 'me', name: 'me' },
    mapEventToMessage: vi.fn(async (e: { event_id: string }) => ({ id: e.event_id, text: 'hi' })),
    enrichMessagesWithReactions: vi.fn(),
  }
  const uiStore = {
    activeChatId,
    syncState: 'STOPPED',
    syncError: null as string | null,
    dialogsLoadedOnce: false,
  }
  const loadDialogs = vi.fn(async () => {})
  const scheduleLoadDialogs = vi.fn()
  registerMatrixListeners({ uiStore, chatStore, profileCache: {} } as never, {
    loadDialogs,
    scheduleLoadDialogs,
  })
  return { chatStore, uiStore, loadDialogs, scheduleLoadDialogs }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'Audio',
    class {
      play = audioPlay
    }
  )
})

describe('registerMatrixListeners — Room.timeline', () => {
  it('регистрирует оба обработчика', () => {
    setup(null)
    expect(typeof handlers['Room.timeline']).toBe('function')
    expect(typeof handlers['sync']).toBe('function')
  })

  it('события из начала таймлайна (пагинация) игнорируются', async () => {
    const { chatStore, scheduleLoadDialogs } = setup(ROOM)
    await handlers['Room.timeline']!(mxEvent('m.room.message'), room, true)
    expect(chatStore.mapEventToMessage).not.toHaveBeenCalled()
    expect(scheduleLoadDialogs).not.toHaveBeenCalled()
  })

  it('m.reaction в активном чате обогащает список реакциями, в неактивном — нет', async () => {
    const { chatStore } = setup(ROOM)
    chatStore.messages[ROOM] = [{ id: '$m1' }]
    await handlers['Room.timeline']!(mxEvent('m.reaction'), room, false)
    expect(chatStore.enrichMessagesWithReactions).toHaveBeenCalledWith(
      room,
      chatStore.messages[ROOM],
      '@me:host'
    )

    const other = setup('!other:host')
    other.chatStore.messages[ROOM] = [{ id: '$m1' }]
    await handlers['Room.timeline']!(mxEvent('m.reaction'), room, false)
    expect(other.chatStore.enrichMessagesWithReactions).not.toHaveBeenCalled()
  })

  it('m.room.redaction удаляет целевое сообщение из ленты', async () => {
    const { chatStore, scheduleLoadDialogs } = setup(ROOM)
    chatStore.messages[ROOM] = [{ id: '$keep' }, { id: '$gone' }]
    await handlers['Room.timeline']!(mxEvent('m.room.redaction', { redacts: '$gone' }), room, false)
    expect(chatStore.messages[ROOM]).toEqual([{ id: '$keep' }])
    expect(scheduleLoadDialogs).not.toHaveBeenCalled()
  })

  it('новое сообщение в активном чате: добавляется один раз, ставится read-marker, диалоги перезагружаются', async () => {
    const { chatStore, scheduleLoadDialogs } = setup(ROOM)
    const ev = mxEvent('m.room.message', { id: '$new' })
    await handlers['Room.timeline']!(ev, room, false)
    await handlers['Room.timeline']!(ev, room, false)
    expect(chatStore.messages[ROOM]).toEqual([{ id: '$new', text: 'hi' }])
    expect(chatStore.currentUser.id).toBe('@me:host') // 'me' → реальный id из клиента
    expect(client.setRoomReadMarkers).toHaveBeenCalledWith(ROOM, '$new', ev)
    expect(chatStore.enrichMessagesWithReactions).toHaveBeenCalled()
    expect(scheduleLoadDialogs).toHaveBeenCalledTimes(2)
    // своё сообщение из активного чата звук не играет
    expect(audioPlay).not.toHaveBeenCalled()
  })

  it('свежее чужое сообщение в неактивном чате: звук + уведомление, в ленту не пишется', async () => {
    const { chatStore, scheduleLoadDialogs } = setup('!other:host')
    await handlers['Room.timeline']!(
      mxEvent('m.room.message', { sender: '@peer:host' }),
      room,
      false
    )
    expect(audioPlay).toHaveBeenCalledTimes(1)
    expect(notifyMessage).toHaveBeenCalledWith('name-of-@peer:host', 'hi')
    expect(chatStore.messages[ROOM]).toBeUndefined()
    expect(scheduleLoadDialogs).toHaveBeenCalledTimes(1)
  })

  it('старое сообщение (старше SOUND_MAX_AGE) не озвучивается', async () => {
    setup('!other:host')
    await handlers['Room.timeline']!(
      mxEvent('m.room.message', { ts: Date.now() - 10 * 60_000 }),
      room,
      false
    )
    expect(audioPlay).not.toHaveBeenCalled()
    expect(notifyMessage).not.toHaveBeenCalled()
  })
})

describe('registerMatrixListeners — sync', () => {
  it('ERROR → текст ошибки; PREPARED → ошибка снята, диалоги загружены, dialogsLoadedOnce', async () => {
    const { uiStore, loadDialogs } = setup(null)
    handlers['sync']!('ERROR')
    expect(uiStore.syncState).toBe('ERROR')
    expect(uiStore.syncError).toBe('appMsg.messenger.syncError')

    handlers['sync']!('PREPARED')
    expect(uiStore.syncError).toBeNull()
    expect(loadDialogs).toHaveBeenCalledWith(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(uiStore.dialogsLoadedOnce).toBe(true)
  })
})
