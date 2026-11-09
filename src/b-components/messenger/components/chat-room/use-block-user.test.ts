// Блокировка собеседника в личном чате (matrix-ignore): состояние при открытии,
// блокировка и разблокировка с сохранением прочих скрытых, свежий чат с
// приглашённым собеседником, группа без «собеседника», отказ сервера.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({ client: null as null | Record<string, unknown> }))
vi.mock('../../services/matrix-service', () => ({
  matrixService: { getClient: () => mocks.client },
}))

import { useBlockUser } from './use-block-user'

const ME = '@me:matrix.pocketnet.app'
const BOB = '@bob:matrix.pocketnet.app'
const ANN = '@ann:matrix.pocketnet.app'
const DM = '!dm-bob:matrix.pocketnet.app'

type Member = { userId: string; membership: string }

function fakeRoom(members: Member[]) {
  return {
    getInvitedAndJoinedMemberCount: () =>
      members.filter((m) => m.membership === 'join' || m.membership === 'invite').length,
    getJoinedMembers: () => members.filter((m) => m.membership === 'join'),
    currentState: { getMembers: () => members },
  }
}

function fakeClient(rooms: Record<string, unknown>, ignored: string[] = []) {
  const client = {
    ignored,
    getRoom: vi.fn((rid: string) => rooms[rid] ?? null),
    getUserId: () => ME,
    getIgnoredUsers: vi.fn((): string[] => [...client.ignored]),
    setIgnoredUsers: vi.fn(async (list: string[]) => {
      client.ignored = list
    }),
  }
  mocks.client = client
  return client
}

const dmWith = (peer: string, membership = 'join') =>
  fakeRoom([
    { userId: ME, membership: 'join' },
    { userId: peer, membership },
  ])

let wrapper: VueWrapper | null = null
function mountBlock(roomId: string | null = DM) {
  const activeRoomId = ref<string | null>(roomId)
  let api!: ReturnType<typeof useBlockUser>
  wrapper = mount(
    defineComponent({
      setup() {
        api = useBlockUser(activeRoomId)
        return () => h('div')
      },
    })
  )
  return { ...api, activeRoomId }
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  mocks.client = null
})

describe('блокировка собеседника', () => {
  it('при открытии чата видно, что собеседник уже заблокирован', () => {
    fakeClient({ [DM]: dmWith(BOB) }, [BOB])
    const { isBlocked } = mountBlock()
    expect(isBlocked.value).toBe(true)
  })

  it('заблокировать и разблокировать: меняется только собеседник, прочие скрытые остаются', async () => {
    const client = fakeClient({ [DM]: dmWith(BOB) }, [ANN])
    const { isBlocked, toggleBlock } = mountBlock()
    expect(isBlocked.value).toBe(false)

    await toggleBlock()
    expect(client.setIgnoredUsers).toHaveBeenLastCalledWith([ANN, BOB])
    expect(isBlocked.value).toBe(true)

    await toggleBlock()
    expect(client.setIgnoredUsers).toHaveBeenLastCalledWith([ANN])
    expect(isBlocked.value).toBe(false)
  })

  it('свежий чат: собеседник лишь приглашён — блокируется именно он', async () => {
    const client = fakeClient({ [DM]: dmWith(BOB, 'invite') })
    const { isBlocked, toggleBlock } = mountBlock()
    await toggleBlock()
    expect(client.setIgnoredUsers).toHaveBeenCalledWith([BOB])
    expect(isBlocked.value).toBe(true)
  })

  it('в группе собеседника нет — не «заблокирован», и нажатие ничего не шлёт', async () => {
    const group = fakeRoom([
      { userId: ME, membership: 'join' },
      { userId: BOB, membership: 'join' },
      { userId: ANN, membership: 'invite' },
    ])
    const client = fakeClient({ [DM]: group }, [BOB])
    const { isBlocked, toggleBlock } = mountBlock()
    expect(isBlocked.value).toBe(false)
    await toggleBlock()
    expect(client.setIgnoredUsers).not.toHaveBeenCalled()
  })

  it('пока запрос идёт — занято, повторное нажатие второй запрос не шлёт', async () => {
    const client = fakeClient({ [DM]: dmWith(BOB) })
    let answer!: () => void
    client.setIgnoredUsers.mockImplementationOnce(
      (list: string[]) =>
        new Promise<void>((resolve) => {
          answer = () => {
            client.ignored = list
            resolve()
          }
        })
    )
    const { busy, isBlocked, toggleBlock } = mountBlock()

    const first = toggleBlock()
    expect(busy.value).toBe(true)
    await toggleBlock()
    expect(client.setIgnoredUsers).toHaveBeenCalledTimes(1)

    answer()
    await first
    expect(busy.value).toBe(false)
    expect(isBlocked.value).toBe(true)
  })

  it('сервер не принял — показывается то, что на самом деле на сервере', async () => {
    const client = fakeClient({ [DM]: dmWith(BOB) })
    client.setIgnoredUsers.mockRejectedValueOnce(new Error('M_LIMIT_EXCEEDED'))
    const { isBlocked, busy, toggleBlock } = mountBlock()

    await toggleBlock()
    expect(isBlocked.value).toBe(false)
    expect(busy.value).toBe(false)
  })

  it('переключили чат — состояние для нового собеседника', async () => {
    const OTHER = '!dm-ann:matrix.pocketnet.app'
    fakeClient({ [DM]: dmWith(BOB), [OTHER]: dmWith(ANN) }, [ANN])
    const { isBlocked, activeRoomId } = mountBlock()
    expect(isBlocked.value).toBe(false)

    activeRoomId.value = OTHER
    await nextTick()
    expect(isBlocked.value).toBe(true)

    activeRoomId.value = null
    await nextTick()
    expect(isBlocked.value).toBe(false)
  })

  it('ответ сервера пришёл, когда открыт уже другой чат, — его кнопка не меняется', async () => {
    const OTHER = '!dm-ann:matrix.pocketnet.app'
    const client = fakeClient({ [DM]: dmWith(BOB), [OTHER]: dmWith(ANN) })
    let answer: () => void = () => {}
    client.setIgnoredUsers.mockImplementationOnce(
      (list: string[]) =>
        new Promise<void>((resolve) => {
          answer = () => {
            client.ignored = list
            resolve()
          }
        })
    )
    const { isBlocked, activeRoomId, toggleBlock } = mountBlock()

    const pending = toggleBlock()
    activeRoomId.value = OTHER
    await nextTick()
    answer()
    await pending
    expect(client.ignored).toEqual([BOB])
    expect(isBlocked.value).toBe(false)

    // Вернулись в чат Боба — он заблокирован.
    activeRoomId.value = DM
    await nextTick()
    expect(isBlocked.value).toBe(true)
  })

  it('нет клиента, комнаты или SDK бросил — не заблокирован, нажатие ничего не делает', async () => {
    mocks.client = null
    const noClient = mountBlock()
    await noClient.toggleBlock()
    expect(noClient.isBlocked.value).toBe(false)
    wrapper!.unmount()

    const client = fakeClient({}, [BOB])
    const noRoom = mountBlock()
    await noRoom.toggleBlock()
    expect(noRoom.isBlocked.value).toBe(false)
    expect(client.setIgnoredUsers).not.toHaveBeenCalled()
    wrapper!.unmount()

    client.getRoom.mockImplementation(() => {
      throw new Error('store not ready')
    })
    const broken = mountBlock()
    await broken.toggleBlock()
    await flushPromises()
    expect(broken.isBlocked.value).toBe(false)
    expect(client.setIgnoredUsers).not.toHaveBeenCalled()
  })
})
