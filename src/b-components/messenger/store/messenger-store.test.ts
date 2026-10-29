// Список диалогов готов к первому открытию мессенджера: с прошлого запуска —
// сразу после входа в аккаунт, свежий — после первого синка, а неудачный вход
// в Matrix повторяется в фоне, не дожидаясь, пока мессенджер откроют.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'

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
    hexToAddress: (hex: string) => Buffer.from(hex, 'hex').toString(),
    stop: vi.fn(() => {
      matrix.client = null
    }),
    purgeLocalData: vi.fn(async () => {}),
    leaveAndForgetRoom: vi.fn(async () => {}),
    on: vi.fn(),
    getAccountData: vi.fn((): unknown => undefined),
    setAccountData: vi.fn(async () => {}),
    createDirectRoom: vi.fn(async (): Promise<string | null> => '!new:host'),
    joinIfInvited: vi.fn(async () => {}),
  }
  /** Синк принёс собеседника в новую комнату (MatrixService.waitForMember). */
  const service = { waitForMember: vi.fn(async () => true) }
  const toast = { error: vi.fn() }
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
  return { matrix, service, toast, auth, chat, profiles, onMapRoom }
})

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/services/logger', () => ({ logger: { scope: () => ({ error: vi.fn() }) } }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('../services/matrix-service', () => ({ matrixService: h.matrix, MatrixService: h.service }))
vi.mock('@/b-components/app-toast', () => ({ appToast: h.toast }))
vi.mock('../room-helpers', () => ({
  findExistingRoomByAddress: vi.fn(() => null),
  getPartnerMatrixId: () => null,
}))
vi.mock('./messenger-chat-store', () => ({ useMessengerChatStore: () => h.chat }))
vi.mock('./messenger-profile-cache', () => ({ useMessengerProfileCache: () => h.profiles }))
vi.mock('./messenger-store/use-matrix-listeners', () => ({ registerMatrixListeners: vi.fn() }))
vi.mock('../lib/channel-feed', () => ({
  fetchChannelPage: vi.fn(async () => ({ posts: [], hasMore: false })),
}))
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
import { useMessengerChannelsStore } from './messenger-channels-store'

type ChatFake = ReturnType<typeof makeChat>

function makeChat() {
  return reactive({
    currentUser: { id: 'me', name: 'me', avatar: '' },
    messages: {} as Record<string, unknown[]>,
    pcryptoService: null,
    ensurePcryptoInitialized: vi.fn(),
    hydrateDecryptedCache: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
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

describe('messenger-store: смена аккаунта посреди входа и загрузки', () => {
  it('вход прежнего аккаунта кончился после смены — новый его не видит', async () => {
    let aliceLogin!: (ok: boolean) => void
    h.matrix.login.mockImplementationOnce(() => new Promise((resolve) => (aliceLogin = resolve)))
    h.matrix.login.mockImplementationOnce(() => new Promise(() => {}))
    saveSnapshot('PBob', [dialog('!bob:host')])
    const store = useMessengerStore()
    const ui = useMessengerUiStore()
    const alice = store.initMatrix()

    // Сменили аккаунт: resetMessenger → logout + initMatrix.
    store.logout()
    h.auth.address = 'PBob'
    void store.initMatrix()
    expect(ui.isInitInProgress).toBe(true)

    // Вход Алисы вернулся (сервис отдаёт false: клиента он не поставил).
    aliceLogin(false)
    await alice
    expect(store.syncError).toBeNull()
    expect(ui.syncState).not.toBe('ERROR')
    // Вход Боба ещё идёт — его флаг не сброшен чужим входом.
    expect(ui.isInitInProgress).toBe(true)
    expect(store.dialogs.map((d) => d.id)).toEqual(['!bob:host'])
    store.logout()
  })

  it('список прежнего аккаунта, собранный после смены, не попадает в новый', async () => {
    const store = useMessengerStore()
    await store.initMatrix()
    const ui = useMessengerUiStore()
    ui.syncState = 'PREPARED'
    h.matrix.rooms = [{ dialog: dialog('!alice:host') }]
    h.onMapRoom.fn = () => {
      store.logout()
      h.auth.address = 'PBob'
    }

    await store.loadDialogs()

    expect(store.dialogs).toEqual([])
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

describe('messenger-store: первое сообщение новому собеседнику', () => {
  const KEYS = Array.from({ length: 12 }, (_, i) => `key${i}`).join(',')

  beforeEach(() => {
    h.matrix.login.mockImplementation(async () => {
      h.matrix.client = { getUserId: () => '@50416c696365:matrix.pocketnet.app' }
      return true
    })
    h.profiles.userProfiles = { PBob: { name: 'Bob', k: KEYS } }
    vi.mocked(findExistingRoomByAddress).mockReturnValue(null)
  })

  function startInvite() {
    const store = useMessengerStore()
    const ui = useMessengerUiStore()
    ui.syncState = 'SYNCING'
    ui.showInvite('PBob')
    return { store, ui }
  }

  it('сообщение уходит, когда собеседник уже в комнате', async () => {
    const { store, ui } = startInvite()
    await expect(store.sendToNewChat('Привет')).resolves.toBe(true)
    expect(h.matrix.createDirectRoom).toHaveBeenCalledWith(
      `@${Buffer.from('PBob').toString('hex')}:matrix.pocketnet.app`
    )
    expect(h.service.waitForMember).toHaveBeenCalledWith(
      expect.any(Function),
      `@${Buffer.from('PBob').toString('hex')}:matrix.pocketnet.app`
    )
    expect(h.chat.sendMessage).toHaveBeenCalledWith('!new:host', 'Привет')
    expect(ui.activeChatId).toBe('!new:host')
  })

  it('собеседник так и не появился в комнате — не отправляем: ключ был бы только для себя', async () => {
    h.service.waitForMember.mockResolvedValueOnce(false)
    const { store } = startInvite()
    await expect(store.sendToNewChat('Привет')).resolves.toBe(false)
    expect(h.chat.sendMessage).not.toHaveBeenCalled()
    expect(h.toast.error).toHaveBeenCalledWith({ message: 'messenger.startChatFailed' })
  })
})

describe('messenger-store: закрыть полноэкранный мессенджер', () => {
  it('закрывается целиком — с чатом и приглашением', () => {
    const store = useMessengerStore()
    const ui = useMessengerUiStore()
    ui.isFullScreen = true
    ui.activeChatId = '!bob:host'
    ui.lastTargetAddress = 'PBob'
    store.closeFullScreen()
    expect(ui.isFullScreen).toBe(false)
    expect(ui.activeChatId).toBeNull()
    expect(ui.lastTargetAddress).toBeNull()
    expect(ui.inviteViewActive).toBe(false)
  })
})

describe('messenger-store: каналы', () => {
  const AUTHOR = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'

  it('канал открывается без Matrix: ни истории, ни отметок прочтения', async () => {
    const store = useMessengerStore()
    await store.openChat(`channel:${AUTHOR}`)
    expect(store.activeChatId).toBe(`channel:${AUTHOR}`)
    expect(h.chat.loadMessages).not.toHaveBeenCalled()
    expect(h.matrix.getRoom).not.toHaveBeenCalled()
  })

  it('«Открыть в мессенджере» из профиля — мессенджер открыт на канале', async () => {
    const store = useMessengerStore()
    await store.openChannel(AUTHOR)
    expect(store.isOpen).toBe(true)
    expect(store.activeChatId).toBe(`channel:${AUTHOR}`)
  })

  it('канал виден сразу, а пока переписки не пришли — строка загрузки над ним', async () => {
    h.matrix.login.mockImplementationOnce(() => new Promise(() => {}))
    const store = useMessengerStore()
    void store.initMatrix()
    const channels = useMessengerChannelsStore()
    channels.attach('PAlice')
    channels.setChannel(AUTHOR, true)

    // Список не пуст — общей загрузки нет, но переписки ещё грузятся.
    expect(store.isDialogsLoading).toBe(false)
    expect(store.isChatsLoading).toBe(true)

    // Сбой синка показывает баннер, загрузка не висит рядом с ним.
    useMessengerUiStore().syncError = 'нет связи'
    expect(store.isChatsLoading).toBe(false)
  })

  it('после первого синка список каналов — с сервера; выход из аккаунта его убирает', async () => {
    h.matrix.getAccountData.mockReturnValue({ v: 1, items: { [AUTHOR]: { on: true, t: 1 } } })
    const store = useMessengerStore()
    await store.initMatrix()
    useMessengerUiStore().syncState = 'PREPARED'
    await nextTick()
    expect(useMessengerChannelsStore().addresses).toEqual([AUTHOR])
    store.logout()
    expect(useMessengerChannelsStore().addresses).toEqual([])
  })
})

describe('messenger-ui-store: фильтр списка', () => {
  it('помнится на устройстве: после выхода и перезапуска тот же', () => {
    const ui = useMessengerUiStore()
    expect(ui.chatFilter).toEqual([])
    ui.setChatFilter(['channels', 'groups'])
    expect(ui.chatFilter).toEqual(['groups', 'channels'])
    ui.reset()
    expect(ui.chatFilter).toEqual(['groups', 'channels'])
    setActivePinia(createPinia())
    expect(useMessengerUiStore().chatFilter).toEqual(['groups', 'channels'])
  })

  it('виды включаются, как флажки; из «Все» остаётся один, все три или ни одного — «Все»', () => {
    const ui = useMessengerUiStore()
    ui.toggleChatKind('groups')
    expect(ui.chatFilter).toEqual(['groups'])
    ui.toggleChatKind('direct')
    expect(ui.chatFilter).toEqual(['direct', 'groups'])
    ui.toggleChatKind('channels')
    expect(ui.chatFilter).toEqual([])
    ui.toggleChatKind('channels')
    ui.toggleChatKind('channels')
    expect(ui.chatFilter).toEqual([])
    expect(localStorage.getItem('BST_MSG_CHAT_FILTER')).toBe('all')
  })

  it('прежние значения: «Переписки» — личные и группы, «Каналы» и «Группы» — как были', () => {
    localStorage.setItem('BST_MSG_CHAT_FILTER', 'chats')
    expect(useMessengerUiStore().chatFilter).toEqual(['direct', 'groups'])
    setActivePinia(createPinia())
    localStorage.setItem('BST_MSG_CHAT_FILTER', 'channels')
    expect(useMessengerUiStore().chatFilter).toEqual(['channels'])
    setActivePinia(createPinia())
    localStorage.setItem('BST_MSG_CHAT_FILTER', 'groups')
    expect(useMessengerUiStore().chatFilter).toEqual(['groups'])
    setActivePinia(createPinia())
    localStorage.setItem('BST_MSG_CHAT_FILTER', 'junk')
    expect(useMessengerUiStore().chatFilter).toEqual([])
  })
})
