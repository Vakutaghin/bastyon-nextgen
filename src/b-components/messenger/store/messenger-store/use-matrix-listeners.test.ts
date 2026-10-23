import { describe, it, expect, vi, beforeEach } from 'vitest'

type Handler = (...args: unknown[]) => unknown
const handlers: Record<string, Handler> = {}
const client = {
  getUserId: () => '@me:host',
}
const markRoomRead = vi.fn(async (_roomId: string) => {})
const notifyMessage = vi.fn()
const mutedRooms = new Set<string>()
const audioPlay = vi.fn(() => Promise.resolve())

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/composables/use-browser-notifications', () => ({
  notifyMessage: (...a: unknown[]) => notifyMessage(...a),
}))
vi.mock('@/services/logger', () => ({ logger: { scope: () => ({ error: vi.fn() }) } }))
vi.mock('../../sounds/glass.mp3', () => ({ default: 'glass.mp3' }))
vi.mock('@/b-components/donate/sounds/donate.mp3', () => ({ default: 'coin.mp3' }))
vi.mock('@/b-components/header/header-notifications/sounds/notification.mp3', () => ({
  default: 'drop.mp3',
}))
vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    on: (name: string, h: Handler) => {
      handlers[name] = h
    },
    getClient: () => client,
    isRoomMuted: (roomId: string) => mutedRooms.has(roomId),
  },
}))

import { registerMatrixListeners } from './use-matrix-listeners'
import { resetAppSoundsForTests } from '@/services/app-sounds'

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

function setup(activeChatId: string | null, options: { onScreen?: boolean } = {}) {
  // Виджет по умолчанию открыт и на экране — read-marker шлём только тогда (V30).
  const onScreen = options.onScreen ?? true
  const chatStore = {
    messages: {} as Record<string, { id: string }[]>,
    currentUser: { id: 'me', name: 'me' },
    mapEventToMessage: vi.fn(async (e: { event_id: string }) => ({ id: e.event_id, text: 'hi' })),
    enrichMessagesWithReactions: vi.fn(),
    adoptLocalEcho: vi.fn(async () => {}),
    noteReceipt: vi.fn(),
    watchUndecrypted: vi.fn(),
    retryUndecrypted: vi.fn(),
  }
  const uiStore = {
    activeChatId,
    syncState: 'STOPPED',
    syncError: null as string | null,
    dialogsLoadedOnce: false,
    isChatOnScreen: (chatId: string | null) => onScreen && !!chatId && chatId === activeChatId,
  }
  const loadDialogs = vi.fn(async () => {})
  const scheduleLoadDialogs = vi.fn()
  registerMatrixListeners({ uiStore, chatStore, profileCache: {} } as never, {
    loadDialogs,
    scheduleLoadDialogs,
    markRoomRead,
  })
  return { chatStore, uiStore, loadDialogs, scheduleLoadDialogs }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAppSoundsForTests()
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
    expect(markRoomRead).toHaveBeenCalledWith(ROOM)
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

  it('правка сообщения — не новое сообщение: без звука и уведомления', async () => {
    setup('!other:host')
    await handlers['Room.timeline']!(
      mxEvent('m.room.message', {
        content: {
          body: '* hi',
          'm.new_content': { msgtype: 'm.text', body: 'hi' },
          'm.relates_to': { rel_type: 'm.replace', event_id: '$orig' },
        },
      }),
      room,
      false
    )
    expect(audioPlay).not.toHaveBeenCalled()
    expect(notifyMessage).not.toHaveBeenCalled()
  })

  it('пачка сообщений подряд — один звук, уведомление на каждое', async () => {
    setup('!other:host')
    for (const id of ['$a', '$b', '$c']) {
      await handlers['Room.timeline']!(mxEvent('m.room.message', { id }), room, false)
    }
    expect(audioPlay).toHaveBeenCalledTimes(1)
    expect(notifyMessage).toHaveBeenCalledTimes(3)
  })

  it('«Без звука» — ни звука, ни уведомления, но список обновляется', async () => {
    const { scheduleLoadDialogs } = setup('!other:host')
    mutedRooms.add(ROOM)
    try {
      await handlers['Room.timeline']!(mxEvent('m.room.message'), room, false)
    } finally {
      mutedRooms.clear()
    }
    expect(audioPlay).not.toHaveBeenCalled()
    expect(notifyMessage).not.toHaveBeenCalled()
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

describe('Room.receipt', () => {
  it('новая комната (приглашение), своё членство и название группы — список перезагружается', () => {
    const { scheduleLoadDialogs } = setup()
    handlers['Room']!({ roomId: '!invite:host' })
    handlers['Room.myMembership']!({ roomId: ROOM }, 'join', 'invite')
    handlers['Room.name']!({ roomId: ROOM })
    expect(scheduleLoadDialogs).toHaveBeenCalledTimes(3)
  })

  it('квитанция о прочтении пересчитывает галочки своей комнаты', () => {
    const { chatStore } = setup(ROOM)
    handlers['Room.receipt']!({}, room)
    expect(chatStore.noteReceipt).toHaveBeenCalledWith(ROOM)
  })
})

describe('Room.timeline — свёрнутый виджет (V30)', () => {
  it('не шлёт read-marker, если чат выбран, но окно свёрнуто', async () => {
    const { chatStore } = setup(ROOM, { onScreen: false })
    const ev = mxEvent('m.room.message', { id: '$ev-hidden' })

    await handlers['Room.timeline']!(ev, room, false)

    // Сообщение в ленту всё равно попадает (чат выбран), но «прочитано»
    // собеседнику не уходит — окно свёрнуто.
    expect(chatStore.messages[ROOM]?.map((m) => m.id)).toEqual(['$ev-hidden'])
    expect(markRoomRead).not.toHaveBeenCalled()
  })

  it('свёрнутое окно ведёт себя как неактивный чат: звук и уведомление приходят', async () => {
    setup(ROOM, { onScreen: false })

    await handlers['Room.timeline']!(
      mxEvent('m.room.message', { id: '$ev-hidden-2', sender: '@peer:host' }),
      room,
      false
    )

    expect(audioPlay).toHaveBeenCalledTimes(1)
    expect(notifyMessage).toHaveBeenCalled()
  })
})

describe('sync — баннер ошибки (S38)', () => {
  it('гаснет после восстановления связи, а не только на PREPARED', async () => {
    const { uiStore } = setup(null)

    handlers['sync']!('ERROR')
    expect(uiStore.syncError).toBe('appMsg.messenger.syncError')

    // Повторный PREPARED за жизнь клиента не приходит — связь восстанавливается
    // переходом в SYNCING.
    handlers['sync']!('SYNCING')
    expect(uiStore.syncError).toBeNull()
    expect(uiStore.syncState).toBe('SYNCING')
  })

  it('CATCHUP тоже снимает баннер', () => {
    const { uiStore } = setup(null)
    handlers['sync']!('ERROR')
    handlers['sync']!('CATCHUP')
    expect(uiStore.syncError).toBeNull()
  })
})

describe('копия своего события (`~`-id) получает настоящий id', () => {
  it('Room.localEchoUpdated передаёт событие и прежний id в chatStore.adoptLocalEcho', () => {
    const { chatStore } = setup(ROOM)
    const ev = mxEvent('m.room.message', { id: '$real' })
    handlers['Room.localEchoUpdated']!(ev, room, `~${ROOM}:m1.1`, 'sending')
    expect(chatStore.adoptLocalEcho).toHaveBeenCalledWith(ev, `~${ROOM}:m1.1`)
  })

  it('пока копия расшифровывалась, она ушла на сервер — в ленту ложится настоящий id', async () => {
    const { chatStore } = setup(ROOM)
    let id = `~${ROOM}:m1.1`
    const ev = { ...mxEvent('m.room.message', { sender: '@me:host' }), getId: () => id }
    chatStore.mapEventToMessage.mockImplementationOnce(async () => {
      const msg = { id, text: 'hi' }
      id = '$real'
      return msg
    })
    chatStore.messages[ROOM] = [{ id: '$real' }]
    await handlers['Room.timeline']!(ev, room, false)
    expect(chatStore.messages[ROOM]!.map((m) => m.id)).toEqual(['$real'])
  })
})

describe('повторная расшифровка заглушек', () => {
  it('пришёл ключ группы — повтор в этой комнате и пересчёт превью', async () => {
    const { chatStore, scheduleLoadDialogs } = setup(ROOM)
    await handlers['Room.timeline']!(mxEvent('m.room.encryption'), room, false)
    expect(chatStore.retryUndecrypted).toHaveBeenCalledWith(ROOM)
    expect(scheduleLoadDialogs).toHaveBeenCalled()
    expect(chatStore.mapEventToMessage).not.toHaveBeenCalled()
  })

  it('сменился состав участников — тоже повод', async () => {
    const { chatStore } = setup(null)
    await handlers['Room.timeline']!(mxEvent('m.room.member'), room, false)
    expect(chatStore.retryUndecrypted).toHaveBeenCalledWith(ROOM)
  })

  it('новое сообщение в открытом чате — заглушки в нём под присмотром', async () => {
    const { chatStore } = setup(ROOM)
    await handlers['Room.timeline']!(mxEvent('m.room.message'), room, false)
    expect(chatStore.watchUndecrypted).toHaveBeenCalledWith(ROOM)
  })

  it('связь вернулась после ошибки — повтор во всех чатах', () => {
    const { chatStore, scheduleLoadDialogs } = setup(ROOM)
    handlers['sync']!('SYNCING', 'ERROR')
    expect(chatStore.retryUndecrypted).toHaveBeenCalledWith()
    expect(scheduleLoadDialogs).toHaveBeenCalled()
  })

  it('обычный синк без перерыва повода не даёт', () => {
    const { chatStore } = setup(ROOM)
    handlers['sync']!('SYNCING', 'SYNCING')
    handlers['sync']!('PREPARED', null)
    expect(chatStore.retryUndecrypted).not.toHaveBeenCalled()
  })
})
