// «Печатает…» в открытом чате: множество печатающих (чистые функции) и сам
// индикатор поверх клиента Matrix — m.typing из синка и RoomMember.typing,
// имя печатающего без hex-id, сброс при смене чата, снятие слушателей.

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

import { setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  client: null as null | Record<string, unknown>,
  profiles: null as unknown as { userProfiles: Record<string, { name?: string }> },
}))
vi.mock('../../services/matrix-service', async () => {
  const codec = await import('../../services/matrix-service/address-codec')
  return {
    matrixService: { getClient: () => mocks.client, hexToAddress: codec.hexToAddress },
  }
})
vi.mock('../../store/messenger-profile-cache', () => ({
  useMessengerProfileCache: () => mocks.profiles,
}))

import { addressToHex } from '../../services/matrix-service/address-codec'
import { applyTypingEvent, typingFromMembers, useTypingIndicator } from './use-typing-indicator'

const ctx = { roomId: 'room1', myId: 'me' }

describe('applyTypingEvent', () => {
  it('добавляет печатающего в активной комнате', () => {
    const r = applyTypingEvent(new Set(), { userId: 'bob', roomId: 'room1', typing: true }, ctx)
    expect([...r]).toEqual(['bob'])
  })

  it('убирает, когда перестал печатать', () => {
    const r = applyTypingEvent(
      new Set(['bob']),
      { userId: 'bob', roomId: 'room1', typing: false },
      ctx
    )
    expect(r.size).toBe(0)
  })

  it('игнорирует другую комнату', () => {
    const r = applyTypingEvent(new Set(), { userId: 'bob', roomId: 'other', typing: true }, ctx)
    expect(r.size).toBe(0)
  })

  it('игнорирует себя', () => {
    const r = applyTypingEvent(new Set(), { userId: 'me', roomId: 'room1', typing: true }, ctx)
    expect(r.size).toBe(0)
  })

  it('игнорирует при отсутствии активной комнаты', () => {
    const r = applyTypingEvent(
      new Set(),
      { userId: 'bob', roomId: 'room1', typing: true },
      {
        roomId: null,
        myId: 'me',
      }
    )
    expect(r.size).toBe(0)
  })

  it('возвращает новое множество (иммутабельность)', () => {
    const prev = new Set<string>()
    const r = applyTypingEvent(prev, { userId: 'bob', roomId: 'room1', typing: true }, ctx)
    expect(r).not.toBe(prev)
    expect(prev.size).toBe(0)
  })
})

// m.typing из синка без room_id: кто печатает — по флагам участников открытой
// комнаты (SDK обновляет их раньше события). Проверено на живом Synapse:
// RoomMember.typing на клиент не приходил, и «печатает…» не появлялось.
describe('typingFromMembers', () => {
  it('печатающие участники, кроме себя', () => {
    const r = typingFromMembers(
      [
        { userId: 'bob', typing: true },
        { userId: 'me', typing: true },
        { userId: 'ann', typing: false },
      ],
      'me'
    )
    expect([...r]).toEqual(['bob'])
  })

  it('никто не печатает — пусто', () => {
    expect(typingFromMembers([{ userId: 'bob', typing: false }], 'me').size).toBe(0)
    expect(typingFromMembers([], null).size).toBe(0)
  })
})

// ─── Индикатор поверх клиента ────────────────────────────────────────────────

const BOB_ADDR = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const ME = '@me:matrix.pocketnet.app'
const BOB = `@${addressToHex(BOB_ADDR)}:matrix.pocketnet.app`
const ROOM = '!dm:matrix.pocketnet.app'
const OTHER_ROOM = '!other:matrix.pocketnet.app'

type FakeMember = { userId: string; typing?: boolean; name?: string; rawDisplayName?: string }

function fakeClient() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  const rooms: Record<string, { members: FakeMember[] }> = {}
  const client = {
    rooms,
    handlers,
    on: vi.fn((ev: string, fn: (...args: unknown[]) => void) => {
      if (!handlers.has(ev)) handlers.set(ev, new Set())
      handlers.get(ev)!.add(fn)
    }),
    off: vi.fn((ev: string, fn: (...args: unknown[]) => void) => {
      handlers.get(ev)?.delete(fn)
    }),
    emit(ev: string, ...args: unknown[]) {
      handlers.get(ev)?.forEach((fn) => fn(...args))
    },
    getRoom: (rid: string) => {
      const room = rooms[rid]
      if (!room) return null
      return {
        getJoinedMembers: () => room.members,
        getMember: (uid: string) => room.members.find((m) => m.userId === uid) ?? null,
      }
    },
    getUserId: () => ME,
  }
  mocks.client = client
  return client
}

const syncTyping = () => ({ getType: () => 'm.typing' })

let wrapper: VueWrapper | null = null
function mountIndicator(roomId: string | null = ROOM) {
  const activeRoomId = ref<string | null>(roomId)
  let api!: ReturnType<typeof useTypingIndicator>
  wrapper = mount(
    defineComponent({
      setup() {
        api = useTypingIndicator(activeRoomId)
        return () => h('div')
      },
    })
  )
  return { ...api, activeRoomId }
}

describe('useTypingIndicator', () => {
  beforeEach(() => {
    setI18nLocale('ru')
    mocks.profiles = reactive({ userProfiles: {} as Record<string, { name?: string }> })
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    mocks.client = null
  })

  it('m.typing из синка: собеседник печатает — его логин из профиля; сам себе не показываюсь', () => {
    const client = fakeClient()
    client.rooms[ROOM] = {
      members: [
        { userId: ME, typing: true },
        { userId: BOB, typing: true, name: addressToHex(BOB_ADDR) },
      ],
    }
    mocks.profiles.userProfiles[BOB_ADDR] = { name: 'Боб' }
    const { isTyping, typingName } = mountIndicator()
    expect(isTyping.value).toBe(false)

    client.emit('event', syncTyping())
    expect(isTyping.value).toBe(true)
    expect(typingName.value).toBe('Боб')

    client.rooms[ROOM]!.members[1]!.typing = false
    client.emit('event', syncTyping())
    expect(isTyping.value).toBe(false)
    expect(typingName.value).toBeNull()
  })

  it('RoomMember.typing: в открытом чате — показывается, в другом чате и свой — нет', () => {
    const client = fakeClient()
    client.rooms[ROOM] = { members: [{ userId: BOB, name: 'Bobby' }] }
    const { isTyping, typingName } = mountIndicator()

    client.emit('RoomMember.typing', {}, { userId: BOB, roomId: OTHER_ROOM, typing: true })
    client.emit('RoomMember.typing', {}, { userId: ME, roomId: ROOM, typing: true })
    client.emit('RoomMember.typing', {}, null)
    expect(isTyping.value).toBe(false)

    client.emit('RoomMember.typing', {}, { userId: BOB, roomId: ROOM, typing: true })
    expect(isTyping.value).toBe(true)
    // Профиля нет — читаемое имя участника из Matrix.
    expect(typingName.value).toBe('Bobby')

    client.emit('RoomMember.typing', {}, { userId: BOB, roomId: ROOM, typing: false })
    expect(isTyping.value).toBe(false)
  })

  it('нет профиля и имя в Matrix — hex адреса: показывается короткий адрес, не hex', () => {
    const client = fakeClient()
    client.rooms[ROOM] = {
      members: [{ userId: BOB, typing: true, rawDisplayName: addressToHex(BOB_ADDR) }],
    }
    const { typingName } = mountIndicator()
    client.emit('event', syncTyping())
    expect(typingName.value).not.toContain(addressToHex(BOB_ADDR).slice(0, 16))
    expect(typingName.value).not.toBe(BOB)
    expect(typingName.value!.length).toBeLessThan(BOB_ADDR.length)
  })

  it('смена чата сбрасывает «печатает…»', async () => {
    const client = fakeClient()
    client.rooms[ROOM] = { members: [{ userId: BOB, typing: true }] }
    const { isTyping, activeRoomId } = mountIndicator()
    client.emit('event', syncTyping())
    expect(isTyping.value).toBe(true)

    activeRoomId.value = OTHER_ROOM
    await nextTick()
    expect(isTyping.value).toBe(false)
  })

  it('прочие события и m.typing, когда комнаты нет на клиенте, индикатор не трогают', () => {
    const client = fakeClient()
    client.rooms[ROOM] = { members: [{ userId: BOB, typing: true }] }
    const { isTyping } = mountIndicator()

    client.emit('event', { getType: () => 'm.room.message' })
    client.emit('event', {})
    expect(isTyping.value).toBe(false)

    client.emit('event', syncTyping())
    expect(isTyping.value).toBe(true)
    delete client.rooms[ROOM]
    client.emit('event', syncTyping())
    expect(isTyping.value).toBe(true)
  })

  it('чат закрыт — слушатели сняты с клиента', () => {
    const client = fakeClient()
    mountIndicator()
    expect(client.handlers.get('event')?.size).toBe(1)
    expect(client.handlers.get('RoomMember.typing')?.size).toBe(1)

    wrapper!.unmount()
    wrapper = null
    expect(client.handlers.get('event')?.size).toBe(0)
    expect(client.handlers.get('RoomMember.typing')?.size).toBe(0)
  })

  it('клиента нет (не вошли в Matrix) — открывается без ошибок, индикатора нет', () => {
    mocks.client = null
    const { isTyping, typingName } = mountIndicator()
    expect(isTyping.value).toBe(false)
    expect(typingName.value).toBeNull()
  })
})
