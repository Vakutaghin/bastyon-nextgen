// Список диалогов готов к первому открытию мессенджера: с прошлого запуска —
// сразу после входа в аккаунт, свежий — после первого синка, а неудачный вход
// в Matrix повторяется в фоне, не дожидаясь, пока мессенджер откроют.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'

import type { Dialog } from '../types'

const h = vi.hoisted(() => {
  const client = { getUserId: () => '@50416c696365:matrix.pocketnet.app' }
  const matrix = {
    client: null as typeof client | null,
    rooms: [] as { dialog: Dialog }[],
    getClient: vi.fn((): typeof client | null => matrix.client),
    login: vi.fn(async (): Promise<boolean> => {
      matrix.client = client
      return true
    }),
    getRooms: vi.fn(() => matrix.rooms),
    getRoom: vi.fn(() => null),
    getBaseUrl: () => '',
    addressToHex: (a: string) => Buffer.from(a).toString('hex'),
    stop: vi.fn(() => {
      matrix.client = null
    }),
    purgeLocalData: vi.fn(async () => {}),
    leaveAndForgetRoom: vi.fn(async () => {}),
  }
  const auth = {
    isUserAuthenticated: true,
    address: 'PAlice' as string | null,
    keyPair: { privateKey: 'k' } as object | null,
  }
  /** Чат-стор: реактивный, пересоздаётся в beforeEach (см. makeChat). */
  const chat = null as unknown as ChatFake
  const profiles = {
    userProfiles: {} as Record<string, unknown>,
    fetchProfiles: vi.fn(async () => {}),
    reset: vi.fn(),
  }
  /** Колбэк маппинга комнаты — тест может вклиниться в середину загрузки. */
  const onMapRoom = { fn: null as null | (() => void) }
  return { matrix, auth, chat, profiles, onMapRoom }
})

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/services/logger', () => ({ logger: { scope: () => ({ error: vi.fn() }) } }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('../services/matrix-service', () => ({ matrixService: h.matrix }))
vi.mock('../room-helpers', () => ({
  findExistingRoomByAddress: vi.fn(() => null),
  getPartnerMatrixId: () => null,
}))
vi.mock('./messenger-chat-store', () => ({ useMessengerChatStore: () => h.chat }))
vi.mock('./messenger-profile-cache', () => ({ useMessengerProfileCache: () => h.profiles }))
vi.mock('./messenger-store/use-matrix-listeners', () => ({ registerMatrixListeners: vi.fn() }))
vi.mock('./messenger-store/use-dialog-mapping', () => ({
  useDialogMapping: () => ({
    mapRoomToDialog: async (room: { dialog: Dialog }) => {
      h.onMapRoom.fn?.()
      return room.dialog
    },
  }),
}))

import { findExistingRoomByAddress } from '../room-helpers'
import { useMessengerStore } from './messenger-store'
import { useMessengerUiStore } from './messenger-ui-store'

type ChatFake = ReturnType<typeof makeChat>

function makeChat() {
  return reactive({
    currentUser: { id: 'me', name: 'me', avatar: '' },
    messages: {} as Record<string, unknown[]>,
    pcryptoService: null,
    ensurePcryptoInitialized: vi.fn(),
    hydrateDecryptedCache: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => {}),
    // Как настоящий стор: при сбросе объект пользователя заменяется новым.
    reset: vi.fn(() => {
      h.chat.currentUser = { id: 'me', name: 'me', avatar: '' }
    }),
  })
}

function memStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  }
}

function dialog(id: string, text = 'hi'): Dialog {
  return {
    id,
    partner: { id: `@${id}:host`, name: `Name ${id}` },
    unreadCount: 1,
    lastMessage: {
      id: `$${id}`,
      chatId: id,
      senderId: '@peer:host',
      text,
      type: 'text',
      timestamp: 1000,
      read: false,
      status: 'sent',
    },
  }
}

const snapshotOf = (address: string): Dialog[] =>
  (
    JSON.parse(localStorage.getItem(`BST_MSG_DIALOGS_${address}`) ?? '{"dialogs":[]}') as {
      dialogs: Dialog[]
    }
  ).dialogs

function saveSnapshot(address: string, dialogs: Dialog[]) {
  localStorage.setItem(`BST_MSG_DIALOGS_${address}`, JSON.stringify({ v: 1, dialogs }))
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  setActivePinia(createPinia())
  vi.clearAllMocks()
  h.matrix.client = null
  h.matrix.rooms = []
  h.auth.address = 'PAlice'
  h.chat = makeChat()
  h.onMapRoom.fn = null
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('messenger-store: список диалогов до первого открытия', () => {
  it('список с прошлого запуска виден, пока Matrix входит', async () => {
    saveSnapshot('PAlice', [dialog('!a:host'), dialog('!b:host')])
    h.matrix.login.mockImplementationOnce(() => new Promise(() => {}))
    const store = useMessengerStore()

    void store.initMatrix()

    expect(store.dialogs.map((d) => d.id)).toEqual(['!a:host', '!b:host'])
    expect(store.isDialogsLoading).toBe(false)
    // «Вы:» в превью своих сообщений — до того, как клиент назовёт свой id.
    expect(h.chat.currentUser.id).toBe('@50416c696365:matrix.pocketnet.app')
  })

  it('без списка с прошлого запуска — загрузка', () => {
    h.matrix.login.mockImplementationOnce(() => new Promise(() => {}))
    const store = useMessengerStore()
    void store.initMatrix()
    expect(store.dialogs).toEqual([])
    expect(store.isDialogsLoading).toBe(true)
  })

  it('до первого синка неполный список не затирает сохранённый', async () => {
    saveSnapshot('PAlice', [dialog('!a:host'), dialog('!b:host')])
    const store = useMessengerStore()
    await store.initMatrix()
    h.matrix.rooms = [{ dialog: dialog('!a:host') }]

    await store.loadDialogs(true)

    expect(store.dialogs.map((d) => d.id)).toEqual(['!a:host', '!b:host'])
    expect(snapshotOf('PAlice').map((d) => d.id)).toEqual(['!a:host', '!b:host'])
  })

  it('после первого синка список свежий и запоминается до следующего запуска', async () => {
    saveSnapshot('PAlice', [dialog('!old:host')])
    const store = useMessengerStore()
    await store.initMatrix()
    useMessengerUiStore().syncState = 'PREPARED'
    h.matrix.rooms = [{ dialog: dialog('!new:host', 'свежее') }]

    await store.loadDialogs(true)

    expect(store.dialogs.map((d) => d.id)).toEqual(['!new:host'])
    expect(snapshotOf('PAlice').map((d) => d.lastMessage?.text)).toEqual(['свежее'])
    expect(h.chat.hydrateDecryptedCache).toHaveBeenCalled()
  })

  it('открытый чат, которого нет на сервере, остаётся на экране, но не в сохранённом списке', async () => {
    saveSnapshot('PAlice', [dialog('!a:host'), dialog('!gone:host')])
    const store = useMessengerStore()
    await store.initMatrix()
    const ui = useMessengerUiStore()
    ui.activeChatId = '!gone:host'
    ui.syncState = 'PREPARED'
    h.matrix.rooms = [{ dialog: dialog('!a:host') }]

    await store.loadDialogs(true)

    expect(store.dialogs.map((d) => d.id).sort()).toEqual(['!a:host', '!gone:host'])
    expect(snapshotOf('PAlice').map((d) => d.id)).toEqual(['!a:host'])
  })

  it('аккаунт сменили посреди загрузки — список не пишется ни одному из них', async () => {
    saveSnapshot('PAlice', [dialog('!alice:host')])
    const store = useMessengerStore()
    await store.initMatrix()
    useMessengerUiStore().syncState = 'PREPARED'
    h.matrix.rooms = [{ dialog: dialog('!x:host') }]
    h.onMapRoom.fn = () => {
      h.auth.address = 'PBob'
    }

    await store.loadDialogs(true)

    expect(snapshotOf('PAlice').map((d) => d.id)).toEqual(['!alice:host'])
    expect(localStorage.getItem('BST_MSG_DIALOGS_PBob')).toBeNull()
  })

  it('удалённый чат не вернётся из сохранённого списка', async () => {
    const store = useMessengerStore()
    await store.initMatrix()
    useMessengerUiStore().syncState = 'PREPARED'
    h.matrix.rooms = [{ dialog: dialog('!a:host') }, { dialog: dialog('!b:host') }]
    await store.loadDialogs(true)

    store.deleteDialog('!a:host')
    await vi.waitFor(() => expect(snapshotOf('PAlice').map((d) => d.id)).toEqual(['!b:host']))
  })
})

describe('messenger-store: свой matrix-id', () => {
  it('компоненты видят свой id и после сброса при входе в аккаунт', async () => {
    const store = useMessengerStore()
    // resetMessenger при каждом входе: logout → chatStore.reset() → initMatrix.
    store.logout()
    await store.initMatrix()
    expect(h.chat.currentUser.id).toBe('@50416c696365:matrix.pocketnet.app')
    expect(store.currentUser.id).toBe('@50416c696365:matrix.pocketnet.app')
  })
})

describe('messenger-store: повтор входа в Matrix в фоне', () => {
  let store: ReturnType<typeof useMessengerStore>

  beforeEach(() => {
    vi.useFakeTimers()
    store = useMessengerStore()
  })

  // Отложенный повтор и подписка на «сеть вернулась» не должны пережить тест.
  afterEach(() => {
    store.logout()
  })

  it('неудачный вход повторяется сам, без открытия мессенджера', async () => {
    h.matrix.login.mockResolvedValueOnce(false)

    await store.initMatrix()
    expect(store.syncError).toBe('appMsg.messenger.loginFailed')

    await vi.advanceTimersByTimeAsync(5_000)
    expect(h.matrix.login).toHaveBeenCalledTimes(2)
    expect(store.syncError).toBeNull()
  })

  it('пауза между повторами растёт', async () => {
    h.matrix.login.mockResolvedValue(false)

    await store.initMatrix()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(h.matrix.login).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(h.matrix.login).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(h.matrix.login).toHaveBeenCalledTimes(3)
  })

  it('вернулась сеть — повтор сразу', async () => {
    h.matrix.login.mockResolvedValueOnce(false)
    await store.initMatrix()

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(h.matrix.login).toHaveBeenCalledTimes(2)
  })

  it('выход из аккаунта отменяет повтор', async () => {
    h.matrix.login.mockResolvedValue(false)
    await store.initMatrix()

    store.logout()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.matrix.login).toHaveBeenCalledTimes(1)
  })
})

describe('messenger-store: «Начать чат» сразу после запуска', () => {
  beforeEach(() => {
    // Тесты повтора входа выше оставляют login с отказом.
    h.matrix.login.mockImplementation(async () => {
      h.matrix.client = { getUserId: () => '@50416c696365:matrix.pocketnet.app' }
      return true
    })
  })

  it('ждёт ответа сервера и открывает существующий чат, а не карточку собеседника', async () => {
    const store = useMessengerStore()
    const ui = useMessengerUiStore()
    // Как настоящий клиент: кэш ('PREPARED') ещё не знает о приглашении,
    // знает первый ответ сервера ('SYNCING').
    vi.mocked(findExistingRoomByAddress).mockImplementation(() =>
      ui.syncState === 'SYNCING' ? '!bob:host' : null
    )
    const opening = store.openInviteWithAddress('PBob')
    await vi.waitFor(() => expect(h.matrix.login).toHaveBeenCalled())
    ui.syncState = 'PREPARED'
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ui.inviteViewActive).toBe(false)
    expect(ui.activeChatId).toBeNull()

    ui.syncState = 'SYNCING'
    await opening
    expect(ui.activeChatId).toBe('!bob:host')
    expect(ui.inviteViewActive).toBe(false)
  })

  it('без связи ждать нечего — открывается то, что известно', async () => {
    const store = useMessengerStore()
    const ui = useMessengerUiStore()
    vi.mocked(findExistingRoomByAddress).mockReturnValue('!bob:host')
    const opening = store.openInviteWithAddress('PBob')
    await vi.waitFor(() => expect(h.matrix.login).toHaveBeenCalled())
    ui.syncState = 'RECONNECTING'
    await opening
    expect(ui.activeChatId).toBe('!bob:host')
  })

  it('синка нет 15 секунд — карточка собеседника, чтобы начать чат', async () => {
    vi.useFakeTimers()
    const store = useMessengerStore()
    const ui = useMessengerUiStore()
    vi.mocked(findExistingRoomByAddress).mockReturnValue(null)
    const opening = store.openInviteWithAddress('PBob')
    await vi.advanceTimersByTimeAsync(15_000)
    await opening
    expect(ui.inviteViewActive).toBe(true)
  })

  it('вход в Matrix не удался — ждать нечего, сразу карточка', async () => {
    const store = useMessengerStore()
    const ui = useMessengerUiStore()
    h.matrix.login.mockImplementationOnce(async () => false)
    vi.mocked(findExistingRoomByAddress).mockReturnValue(null)
    await store.openInviteWithAddress('PBob')
    expect(ui.inviteViewActive).toBe(true)
  })
})
