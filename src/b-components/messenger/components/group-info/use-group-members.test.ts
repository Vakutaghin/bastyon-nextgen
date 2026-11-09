// Участники группы в окне группы: состав из Matrix-комнаты с ролями, именами и
// аватарами из профилей Bastyon, догрузка участников и профилей, «скрыть
// сообщения» участника (matrix-ignore) — с откатом, если сервер не принял.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref, type EffectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'

import { setI18nLocale } from '@/i18n'

type Member = { userId: string; membership: string }

const mocks = vi.hoisted(() => ({
  client: null as null | Record<string, unknown>,
  store: null as unknown as {
    dialogs: Array<{ id: string }>
    userProfiles: Record<string, Record<string, unknown>>
    fetchProfiles: ReturnType<typeof vi.fn>
  },
}))

vi.mock('../../services/matrix-service', async () => {
  const codec = await import('../../services/matrix-service/address-codec')
  return {
    matrixService: { getClient: () => mocks.client, hexToAddress: codec.hexToAddress },
  }
})
vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))

import { addressToHex } from '../../services/matrix-service/address-codec'
import { useGroupMembers } from './use-group-members'

const ROOM = '!club:matrix.pocketnet.app'
const ME = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const ALICE = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const BOB = 'PBobbobbobbobbobbobbobbobbobbob1'
const CAROL = 'PCarolcarolcarolcarolcarolcarol2'
const id = (address: string) => `@${addressToHex(address)}:matrix.pocketnet.app`

function fakeRoom(members: Member[], users: Record<string, number> = {}) {
  const room = {
    members,
    currentState: {
      getMembers: (): Member[] => room.members,
      getStateEvents: (type: string) =>
        type === 'm.room.power_levels' ? { getContent: () => ({ users }) } : null,
    },
    loadMembersIfNeeded: vi.fn(async () => {}),
  }
  return room
}

function fakeClient(rooms: Record<string, ReturnType<typeof fakeRoom>>, ignored: string[] = []) {
  const client = {
    ignored,
    getRoom: (rid: string) => rooms[rid] ?? null,
    getUserId: () => id(ME),
    getIgnoredUsers: vi.fn((): string[] => [...client.ignored]),
    setIgnoredUsers: vi.fn(async (list: string[]) => {
      client.ignored = list
    }),
  }
  return client
}

let scope: EffectScope
function run(roomId = ref<string | null>(ROOM)) {
  scope = effectScope()
  const api = scope.run(() => useGroupMembers(roomId))!
  return { ...api, roomId }
}

beforeEach(() => {
  setI18nLocale('ru')
  mocks.store = reactive({
    dialogs: [{ id: ROOM }],
    userProfiles: {} as Record<string, Record<string, unknown>>,
    fetchProfiles: vi.fn(async () => {}),
  })
})

afterEach(() => scope?.stop())

describe('состав группы', () => {
  it('вступившие и приглашённые с именами, аватарами и ролями; админы сверху, приглашённые в конце', async () => {
    const room = fakeRoom(
      [
        { userId: id(BOB), membership: 'invite' },
        { userId: id(ALICE), membership: 'join' },
        { userId: id(ME), membership: 'join' },
        { userId: id(CAROL), membership: 'leave' },
        { userId: '@banned:matrix.pocketnet.app', membership: 'ban' },
      ],
      { [id(ME)]: 100, [id(ALICE)]: 50 }
    )
    mocks.client = fakeClient({ [ROOM]: room })
    Object.assign(mocks.store.userProfiles, {
      [ME]: { name: 'Я сама' },
      [ALICE]: { name: 'Алиса', i: 'https://img.example/alice.png' },
      [BOB]: { name: 'Боб' },
    })

    const { members, loaded } = run()
    await flushPromises()

    expect(loaded.value).toBe(true)
    expect(members.value.map((m) => [m.name, m.role, m.membership, m.isMe, m.address])).toEqual([
      ['Я сама', 'admin', 'join', true, ME],
      ['Алиса', 'moderator', 'join', false, ALICE],
      ['Боб', null, 'invite', false, BOB],
    ])
    expect(members.value[1]!.avatar).toBe('https://img.example/alice.png')
    expect(members.value[0]!.avatar).toBeUndefined()
  })

  it('нет профиля — вместо hex-id короткий адрес, а профили догружаются одной пачкой', async () => {
    const room = fakeRoom([
      { userId: id(ME), membership: 'join' },
      { userId: id(ALICE), membership: 'join' },
      { userId: id(BOB), membership: 'join' },
    ])
    mocks.client = fakeClient({ [ROOM]: room })
    mocks.store.userProfiles[ME] = { name: 'Я сама' }

    const { members } = run()
    await flushPromises()

    // Пачкой, только неизвестные (свой профиль уже есть). Повтор после догрузки
    // участников допустим — кэш профилей сам склеивает одинаковые запросы.
    expect(mocks.store.fetchProfiles).toHaveBeenCalled()
    for (const [batch] of mocks.store.fetchProfiles.mock.calls) {
      expect(batch).toEqual([ALICE, BOB])
    }
    const alice = members.value.find((m) => m.address === ALICE)!
    expect(alice.name).not.toContain(addressToHex(ALICE))
    expect(alice.name.length).toBeLessThan(ALICE.length)

    // Профиль пришёл — имя появляется без перезагрузки окна.
    mocks.store.userProfiles[ALICE] = { name: 'Алиса' }
    await nextTick()
    expect(members.value.find((m) => m.address === ALICE)!.name).toBe('Алиса')
  })

  it('комнаты ещё нет на клиенте (синк не прошёл) — не загружено; появилась с пересборкой диалога — состав есть', async () => {
    const rooms: Record<string, ReturnType<typeof fakeRoom>> = {}
    mocks.client = fakeClient(rooms)
    const { members, loaded } = run()
    await flushPromises()
    expect(loaded.value).toBe(false)
    expect(members.value).toEqual([])

    rooms[ROOM] = fakeRoom([{ userId: id(ME), membership: 'join' }])
    mocks.store.dialogs.splice(0, 1, { id: ROOM })
    await nextTick()
    expect(loaded.value).toBe(true)
    expect(members.value.map((m) => m.address)).toEqual([ME])
  })

  it('клиента нет (вышли из Matrix) — пустой список без ошибок', async () => {
    mocks.client = null
    const { members, loaded } = run()
    await flushPromises()
    expect(loaded.value).toBe(false)
    expect(members.value).toEqual([])
  })

  it('участники догрузились с сервера (ленивая загрузка) — список дополняется', async () => {
    const room = fakeRoom([{ userId: id(ME), membership: 'join' }])
    room.loadMembersIfNeeded.mockImplementation(async () => {
      room.members = [...room.members, { userId: id(ALICE), membership: 'join' }]
    })
    mocks.client = fakeClient({ [ROOM]: room })

    const { members } = run()
    await flushPromises()
    expect(room.loadMembersIfNeeded).toHaveBeenCalledTimes(1)
    expect(members.value.map((m) => m.address).sort()).toEqual([ALICE, ME].sort())
  })

  it('догрузка упала — остаются те, кто пришёл с синком', async () => {
    const room = fakeRoom([{ userId: id(ME), membership: 'join' }])
    room.loadMembersIfNeeded.mockRejectedValue(new Error('network'))
    mocks.client = fakeClient({ [ROOM]: room })

    const { members, loaded } = run()
    await flushPromises()
    expect(loaded.value).toBe(true)
    expect(members.value.map((m) => m.address)).toEqual([ME])
  })

  it('открыли другую группу — её участники и её догрузка', async () => {
    const other = '!other:matrix.pocketnet.app'
    const club = fakeRoom([{ userId: id(ME), membership: 'join' }])
    const second = fakeRoom([
      { userId: id(ME), membership: 'join' },
      { userId: id(BOB), membership: 'join' },
    ])
    mocks.client = fakeClient({ [ROOM]: club, [other]: second })
    mocks.store.dialogs.push({ id: other })

    const { members, roomId } = run()
    await flushPromises()
    roomId.value = other
    await flushPromises()

    expect(second.loadMembersIfNeeded).toHaveBeenCalledTimes(1)
    expect(members.value.map((m) => m.address).sort()).toEqual([BOB, ME].sort())
  })
})

describe('скрыть сообщения участника', () => {
  function setup(ignored: string[] = []) {
    const room = fakeRoom([
      { userId: id(ME), membership: 'join' },
      { userId: id(ALICE), membership: 'join' },
      { userId: id(BOB), membership: 'join' },
    ])
    const client = fakeClient({ [ROOM]: room }, ignored)
    mocks.client = client
    return { client, ...run() }
  }
  const isIgnored = (list: Array<{ address: string | null; ignored: boolean }>, a: string) =>
    list.find((m) => m.address === a)!.ignored

  it('уже скрытые на сервере отмечены при открытии', async () => {
    const { members } = setup([id(BOB)])
    await flushPromises()
    expect(isIgnored(members.value, BOB)).toBe(true)
    expect(isIgnored(members.value, ALICE)).toBe(false)
  })

  it('скрыть, затем показать — список на сервере меняется, остальные скрытые сохраняются', async () => {
    const stranger = '@spam:other.server'
    const { client, members, toggleIgnored } = setup([stranger])
    await flushPromises()

    await toggleIgnored(id(ALICE))
    expect(client.setIgnoredUsers).toHaveBeenLastCalledWith([stranger, id(ALICE)])
    expect(isIgnored(members.value, ALICE)).toBe(true)

    await toggleIgnored(id(ALICE))
    expect(client.setIgnoredUsers).toHaveBeenLastCalledWith([stranger])
    expect(isIgnored(members.value, ALICE)).toBe(false)
  })

  it('пока запрос идёт — занято, повторное нажатие не шлёт второй запрос', async () => {
    const { client, ignoreBusy, toggleIgnored } = setup()
    await flushPromises()
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

    const first = toggleIgnored(id(ALICE))
    expect(ignoreBusy.value).toBe(true)
    await toggleIgnored(id(BOB))
    expect(client.setIgnoredUsers).toHaveBeenCalledTimes(1)

    answer()
    await first
    expect(ignoreBusy.value).toBe(false)
  })

  it('сервер не принял — отметка возвращается к тому, что на сервере', async () => {
    const { client, members, ignoreBusy, toggleIgnored } = setup()
    await flushPromises()
    client.setIgnoredUsers.mockRejectedValueOnce(new Error('M_LIMIT_EXCEEDED'))

    await toggleIgnored(id(ALICE))
    expect(isIgnored(members.value, ALICE)).toBe(false)
    expect(ignoreBusy.value).toBe(false)
  })

  it('клиент без account-data API — ничего не делает', async () => {
    const { client, members, toggleIgnored } = setup()
    await flushPromises()
    delete (client as Partial<typeof client>).setIgnoredUsers
    await toggleIgnored(id(ALICE))
    expect(isIgnored(members.value, ALICE)).toBe(false)
  })
})
