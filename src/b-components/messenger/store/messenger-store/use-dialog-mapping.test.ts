import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    getClient: () => ({ getUserId: () => '@me:host', getProfileInfo: undefined }),
    getBaseUrl: () => 'https://mx.host',
    hexToAddress: (hex: string) => `P${hex.toUpperCase()}ADDRESS0000`,
  },
}))

import { useDialogMapping } from './use-dialog-mapping'

const PEER_HEX = 'abcdef'
const PEER_ID = `@${PEER_HEX}:host`
const PEER_ADDR = `P${PEER_HEX.toUpperCase()}ADDRESS0000`

// Событие в форме, которую понимают getEvent*-хелперы (сырой JSON + геттеры).
function mxEvent(type: string, ts: number, id = `$${ts}`) {
  return {
    event_id: id,
    room_id: '!room:host',
    sender: PEER_ID,
    origin_server_ts: ts,
    type,
    content: { msgtype: 'm.text', body: 'hi' },
    getId: () => id,
    getType: () => type,
    getTs: () => ts,
    getContent: () => ({ msgtype: 'm.text', body: 'hi' }),
  }
}

function fakeRoom(over: Record<string, unknown> = {}) {
  const peer = { userId: PEER_ID, name: PEER_HEX, membership: 'join' }
  const me = { userId: '@me:host', name: 'me', membership: 'join' }
  return {
    roomId: '!room:host',
    name: '',
    getJoinedMembers: () => [me, peer],
    getInvitedAndJoinedMemberCount: () => 2,
    currentState: { getMembers: () => [me, peer] },
    getMember: (id: string) => (id === PEER_ID ? peer : null),
    getLiveTimeline: () => ({
      getEvents: () => [
        mxEvent('m.room.message', 100),
        mxEvent('m.reaction', 300),
        mxEvent('m.room.message', 200),
      ],
    }),
    getUnreadNotificationCount: () => 3,
    ...over,
  }
}

function ctx(over: { activeChatId?: string | null; profiles?: Record<string, unknown> } = {}) {
  const chatStore = {
    pcryptoService: {},
    ensurePcryptoInitialized: vi.fn(),
    waitForPcrypto: vi.fn(),
    getMatrixAvatarUrl: (u: string) => `mx:${u}`,
    mapEventToMessage: vi.fn(async (e: { event_id: string; origin_server_ts: number }) => ({
      id: e.event_id,
      chatId: '!room:host',
      senderId: PEER_ID,
      text: 'hi',
      timestamp: e.origin_server_ts,
      read: true,
      status: 'sent' as const,
    })),
  }
  const profileCache = { userProfiles: over.profiles ?? {}, fetchProfiles: vi.fn() }
  const uiStore = { activeChatId: over.activeChatId ?? null, isInitInProgress: false }
  return { ctx: { uiStore, chatStore, profileCache } as never, chatStore, profileCache }
}

describe('useDialogMapping — mapRoomToDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('DM с профилем в кэше: имя/аватар/verified из профиля, последнее сообщение и unread из комнаты', async () => {
    const { ctx: c } = ctx({
      profiles: {
        [PEER_ADDR]: { name: 'alice', i: 'https://img.host/a.jpg', badges: ['verified'] },
      },
    })
    const { mapRoomToDialog } = useDialogMapping(c)
    const d = await mapRoomToDialog(fakeRoom())
    expect(d.id).toBe('!room:host')
    expect(d.partner).toEqual({
      id: PEER_ID,
      name: 'alice',
      avatar: 'https://img.host/a.jpg',
      verified: true,
    })
    expect(d.unreadCount).toBe(3)
    // m.reaction (ts 300) не считается сообщением — берётся последнее m.room.message
    expect(d.lastMessage?.id).toBe('$200')
    expect(d.createdAt).toBe(100)
  })

  it('DM без профиля: имя = hex-локалпарт заменяется на Bastyon-адрес, профиль дозапрашивается', async () => {
    const { ctx: c, profileCache } = ctx()
    const { mapRoomToDialog } = useDialogMapping(c)
    const d = await mapRoomToDialog(fakeRoom())
    expect(d.partner.name).toBe(PEER_ADDR)
    expect(profileCache.fetchProfiles).toHaveBeenCalledWith([PEER_ADDR])
  })

  it('verified через flags.real, если бейджей нет', async () => {
    const { ctx: c } = ctx({
      profiles: { [PEER_ADDR]: { name: 'bob', badges: [], flags: { real: '1' } } },
    })
    const { mapRoomToDialog } = useDialogMapping(c)
    const d = await mapRoomToDialog(fakeRoom())
    expect(d.partner.verified).toBe(true)
  })

  it('активный чат → unreadCount = 0', async () => {
    const { ctx: c } = ctx({ activeChatId: '!room:host' })
    const { mapRoomToDialog } = useDialogMapping(c)
    const d = await mapRoomToDialog(fakeRoom())
    expect(d.unreadCount).toBe(0)
  })

  it('группа (3 участника): partner.id = roomId, имя комнаты, кэш профилей не трогается', async () => {
    const { ctx: c, profileCache } = ctx()
    const { mapRoomToDialog } = useDialogMapping(c)
    const d = await mapRoomToDialog(
      fakeRoom({ name: 'Team', getInvitedAndJoinedMemberCount: () => 3 })
    )
    expect(d.partner.id).toBe('!room:host')
    expect(d.partner.name).toBe('Team')
    expect(d.partner.verified).toBe(false)
    expect(profileCache.fetchProfiles).not.toHaveBeenCalled()
  })

  it('пустой таймлайн → без lastMessage и createdAt', async () => {
    const { ctx: c } = ctx()
    const { mapRoomToDialog } = useDialogMapping(c)
    const d = await mapRoomToDialog(fakeRoom({ getLiveTimeline: () => ({ getEvents: () => [] }) }))
    expect(d.lastMessage).toBeUndefined()
    expect(d.createdAt).toBeUndefined()
  })
})
