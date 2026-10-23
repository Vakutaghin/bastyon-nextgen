import { describe, it, expect, vi, beforeEach } from 'vitest'

const muted = vi.hoisted(() => new Set<string>())

vi.mock('@/i18n', () => ({
  t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k),
}))
vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    getClient: () => ({ getUserId: () => '@0a0b0c:host', getProfileInfo: undefined }),
    getBaseUrl: () => 'https://mx.host',
    hexToAddress: (hex: string) => `P${hex.toUpperCase()}ADDRESS0000`,
    isRoomMuted: (roomId: string) => muted.has(roomId),
  },
}))

import { useDialogMapping } from './use-dialog-mapping'
import { tetatetid } from '../../helpers'

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
  const me = { userId: '@0a0b0c:host', name: 'me', membership: 'join' }
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
  beforeEach(() => {
    vi.clearAllMocks()
    muted.clear()
  })

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
      mark: 'verified',
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

  it('модератор и «акула» — значок из бейджей узла, модератор старше', async () => {
    const { ctx: c } = ctx({
      profiles: { [PEER_ADDR]: { name: 'alice', badges: ['shark', 'moderator'] } },
    })
    const d = await useDialogMapping(c).mapRoomToDialog(fakeRoom())
    expect(d.partner.verified).toBe(false)
    expect(d.partner.mark).toBe('moderator')
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

  describe('группа', () => {
    const me = { userId: '@0a0b0c:host', name: 'me', membership: 'join', powerLevel: 100 }
    const peer = { userId: PEER_ID, name: PEER_HEX, membership: 'join' }
    const carol = { userId: '@c0c0:host', name: 'Carol', membership: 'invite' }
    const left = { userId: '@dead:host', name: 'dead', membership: 'leave' }

    function groupRoom(state: Record<string, Record<string, unknown>>, over = {}) {
      const members = [me, peer, carol, left]
      return fakeRoom({
        name: '@Team',
        getJoinedMembers: () => [me, peer],
        getInvitedAndJoinedMemberCount: () => 3,
        currentState: {
          getMembers: () => members,
          getStateEvents: (type: string) =>
            state[type] ? { getContent: () => state[type] } : null,
        },
        getMember: (id: string) => members.find((m) => m.userId === id) ?? null,
        getAvatarUrl: () => 'https://mx.host/peer-avatar',
        ...over,
      })
    }

    it('название без «@», картинка комнаты, а не аватар участника', async () => {
      const { ctx: c } = ctx()
      const d = await useDialogMapping(c).mapRoomToDialog(
        groupRoom({
          'm.room.name': { name: '@Team' },
          'm.room.avatar': { avatarUrl: 'data:image/png;base64,AAAA' },
          'm.room.topic': { topic: 'Обо_всём_подряд' },
        })
      )
      expect(d.partner).toEqual({
        id: '!room:host',
        name: 'Team',
        avatar: 'data:image/png;base64,AAAA',
        verified: false,
        mark: null,
      })
      expect(d.group).toEqual({
        memberCount: 3,
        previewIds: [PEER_ID, '@c0c0:host'],
        topic: 'Обо всём подряд',
      })
    })

    it('без картинки — без аватара (рисуется мозаика), профили мозаики дозапрашиваются', async () => {
      const { ctx: c, profileCache } = ctx()
      const d = await useDialogMapping(c).mapRoomToDialog(
        groupRoom({ 'm.room.name': { name: '@Team' } })
      )
      expect(d.partner.avatar).toBeUndefined()
      expect(profileCache.fetchProfiles).toHaveBeenCalledWith([PEER_ADDR, 'PC0C0ADDRESS0000'])
    })

    it('без названия — имена участников из профилей', async () => {
      const { ctx: c } = ctx({ profiles: { [PEER_ADDR]: { name: 'alice' } } })
      const d = await useDialogMapping(c).mapRoomToDialog(
        groupRoom({}, { name: 'abcdef and 1 other' })
      )
      expect(d.partner.name).toBe('alice, Carol')
    })

    it('на двоих, но с «@» — группа, а не личный чат', async () => {
      const { ctx: c } = ctx()
      const d = await useDialogMapping(c).mapRoomToDialog(
        groupRoom({ 'm.room.name': { name: '@Duo' } }, { getInvitedAndJoinedMemberCount: () => 2 })
      )
      expect(d.group?.memberCount).toBe(3)
      expect(d.partner.name).toBe('Duo')
    })

    it('открытая группа', async () => {
      const { ctx: c } = ctx()
      const d = await useDialogMapping(c).mapRoomToDialog(
        groupRoom({ 'm.room.name': { name: '@Team' } }, { getJoinRule: () => 'public' })
      )
      expect(d.group?.isPublic).toBe(true)
    })
  })

  describe('без звука', () => {
    it('правило уведомлений комнаты → muted; новое чужое сообщение без отметки прочтения → hasUnread', async () => {
      muted.add('!room:host')
      const { ctx: c } = ctx()
      const d = await useDialogMapping(c).mapRoomToDialog(
        fakeRoom({ hasUserReadEvent: () => false, getUnreadNotificationCount: () => 0 })
      )
      expect(d.muted).toBe(true)
      expect(d.hasUnread).toBe(true)
    })

    it('прочитано или чат открыт — без отметки нового', async () => {
      muted.add('!room:host')
      const read = await useDialogMapping(ctx().ctx).mapRoomToDialog(
        fakeRoom({ hasUserReadEvent: () => true })
      )
      expect(read.hasUnread).toBeUndefined()
      const open = await useDialogMapping(ctx({ activeChatId: '!room:host' }).ctx).mapRoomToDialog(
        fakeRoom({ hasUserReadEvent: () => false })
      )
      expect(open.hasUnread).toBeUndefined()
    })

    it('со звуком полей нет', async () => {
      const d = await useDialogMapping(ctx().ctx).mapRoomToDialog(fakeRoom())
      expect(d.muted).toBeUndefined()
      expect(d.hasUnread).toBeUndefined()
    })
  })

  describe('личная комната «#<sha224>»', () => {
    const TETATET_NAME = `#${tetatetid('0a0b0c', PEER_HEX)}`
    const me = { userId: '@0a0b0c:host', name: 'me', membership: 'join' }

    it('собеседник вышел: чат остаётся личным, вместо имени комнаты — адрес, профиль дозапрашивается', async () => {
      const peer = { userId: PEER_ID, name: PEER_HEX, membership: 'leave' }
      const { ctx: c, profileCache } = ctx()
      const { mapRoomToDialog } = useDialogMapping(c)
      const d = await mapRoomToDialog(
        fakeRoom({
          name: TETATET_NAME,
          getJoinedMembers: () => [me],
          getInvitedAndJoinedMemberCount: () => 1,
          currentState: { getMembers: () => [me, peer] },
          getMember: (id: string) => (id === PEER_ID ? peer : null),
        })
      )
      expect(d.partner.id).toBe(PEER_ID)
      expect(d.partner.name).toBe(PEER_ADDR)
      expect(profileCache.fetchProfiles).toHaveBeenCalledWith([PEER_ADDR])
    })

    it('профиль пришёл — ник собеседника', async () => {
      const peer = { userId: PEER_ID, membership: 'leave' }
      const { ctx: c } = ctx({ profiles: { [PEER_ADDR]: { name: 'alice' } } })
      const { mapRoomToDialog } = useDialogMapping(c)
      const d = await mapRoomToDialog(
        fakeRoom({
          name: TETATET_NAME,
          getJoinedMembers: () => [me],
          getInvitedAndJoinedMemberCount: () => 1,
          currentState: { getMembers: () => [me, peer] },
          getMember: () => null,
        })
      )
      expect(d.partner.name).toBe('alice')
    })

    it('собеседника ещё нет в участниках — «Чат», а не хэш', async () => {
      const { ctx: c } = ctx()
      const { mapRoomToDialog } = useDialogMapping(c)
      const d = await mapRoomToDialog(
        fakeRoom({
          name: TETATET_NAME,
          getJoinedMembers: () => [me],
          getInvitedAndJoinedMemberCount: () => 1,
          currentState: { getMembers: () => [me] },
          getMember: () => null,
        })
      )
      expect(d.partner.name).toBe('appMsg.messenger.chat')
    })
  })

  it('пустой таймлайн → без lastMessage и createdAt', async () => {
    const { ctx: c } = ctx()
    const { mapRoomToDialog } = useDialogMapping(c)
    const d = await mapRoomToDialog(fakeRoom({ getLiveTimeline: () => ({ getEvents: () => [] }) }))
    expect(d.lastMessage).toBeUndefined()
    expect(d.createdAt).toBeUndefined()
  })
})
