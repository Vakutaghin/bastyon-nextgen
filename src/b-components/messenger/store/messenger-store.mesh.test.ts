// Mesh-диалоги (переписка через радио, src/mesh) в общем списке мессенджера:
// вперемешку с комнатами Matrix по свежести, непрочитанные в общем счётчике,
// видны без Matrix, а открытие, отправка, повтор и удаление идут в mesh-стор,
// не трогая Matrix. Выход отключает радио и стирает переписку.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'

import type { Dialog, Message } from '../types'

const h = vi.hoisted(() => {
  const matrix = {
    client: null as null | { getUserId: () => string },
    getClient: vi.fn(() => matrix.client),
    login: vi.fn(async () => false),
    getRooms: vi.fn(() => []),
    getRoom: vi.fn(() => null),
    getBaseUrl: () => '',
    addressToHex: (a: string) => a,
    hexToAddress: (hex: string) =>
      (hex.match(/../g) ?? []).map((b) => String.fromCharCode(parseInt(b, 16))).join(''),
    stop: vi.fn(),
    purgeLocalData: vi.fn(async () => {}),
    leaveAndForgetRoom: vi.fn(async () => {}),
  }
  const auth = { isUserAuthenticated: true, address: 'PAlice', keyPair: { privateKey: 'k' } }
  const chat = {
    currentUser: { id: 'me', name: 'me', avatar: '' },
    messages: {} as Record<string, unknown[]>,
    pcryptoService: null,
    ensurePcryptoInitialized: vi.fn(),
    hydrateDecryptedCache: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    retryMessage: vi.fn(async () => {}),
    reset: vi.fn(),
  }
  const profiles = { userProfiles: {}, fetchProfiles: vi.fn(async () => {}), reset: vi.fn() }
  const mesh = null as unknown as MeshFake
  const connection = { reset: vi.fn(async () => {}) }
  const meshtastic = { reset: vi.fn(async () => {}) }
  const reticulum = {
    reset: vi.fn(async () => {}),
    autostart: vi.fn(async () => {}),
    address: null as string | null,
    status: 'idle',
  }
  const routes = {
    route: null as null | { contact: string; binding: { dest: string } },
    routeFor: vi.fn((c: string | null) => (c && routes.route?.contact === c ? routes.route : null)),
    reset: vi.fn(),
  }
  return { matrix, auth, chat, profiles, mesh, connection, meshtastic, reticulum, routes }
})

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/services/logger', () => ({ logger: { scope: () => ({ error: vi.fn() }) } }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('../services/matrix-service', () => ({ matrixService: h.matrix }))
vi.mock('../room-helpers', () => ({
  findExistingRoomByAddress: vi.fn(),
  getPartnerMatrixId: () => null,
}))
vi.mock('./messenger-chat-store', () => ({ useMessengerChatStore: () => h.chat }))
vi.mock('./messenger-profile-cache', () => ({ useMessengerProfileCache: () => h.profiles }))
vi.mock('./messenger-store/use-matrix-listeners', () => ({ registerMatrixListeners: vi.fn() }))
vi.mock('./messenger-store/use-dialog-mapping', () => ({
  useDialogMapping: () => ({ mapRoomToDialog: async () => null }),
}))
vi.mock('@/mesh/store/mesh-chat-store', () => ({ useMeshChatStore: () => h.mesh }))
vi.mock('@/mesh/store/mesh-connection-store', () => ({
  useMeshConnectionStore: () => h.connection,
}))
vi.mock('@/mesh/store/meshtastic-connection-store', () => ({
  useMeshtasticConnectionStore: () => h.meshtastic,
}))
vi.mock('@/mesh/store/reticulum-store', () => ({ useReticulumStore: () => h.reticulum }))
vi.mock('@/mesh/store/mesh-routes-store', () => ({ useMeshRoutesStore: () => h.routes }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: vi.fn() } }))

import { useMessengerStore } from './messenger-store'
import { useMessengerUiStore } from './messenger-ui-store'

const MESH_ID = 'mesh:mc:aaaaaaaaaaaa:u:bbbbbbbbbbbb'

type MeshFake = ReturnType<typeof makeMesh>

function makeMesh() {
  const meshMessage: Message = {
    id: `${MESH_ID}|1`,
    chatId: MESH_ID,
    senderId: 'mesh:mc:u:bbbbbbbbbbbb',
    senderName: 'Bob',
    text: 'по радио',
    type: 'text',
    timestamp: 3000,
    read: true,
    status: 'sent',
    transport: 'meshcore',
  }
  return reactive({
    dialogs: [{ id: MESH_ID }] as Array<{ id: string }>,
    messengerDialogs: [dialog(MESH_ID, 3000, 2, 'meshcore')],
    totalUnread: 2,
    ensureLoaded: vi.fn(async () => {}),
    openDialog: vi.fn(async () => {}),
    messengerMessages: vi.fn(() => [meshMessage]),
    send: vi.fn(async () => ({ ok: true })),
    retry: vi.fn(async () => true),
    deleteDialog: vi.fn(async () => {}),
    reset: vi.fn(),
    purgeAccount: vi.fn(async () => {}),
    ensureLxmfDialog: vi.fn(
      async (self: string, dest: string) => `mesh:lx:${self}:u:${dest}` as string
    ),
    canSend: vi.fn(() => true),
    markRead: vi.fn(),
  })
}

function dialog(id: string, ts: number, unread: number, transport?: 'meshcore'): Dialog {
  return {
    id,
    partner: { id, name: id },
    unreadCount: unread,
    lastMessage: {
      id: `${id}|last`,
      chatId: id,
      senderId: 'x',
      text: 't',
      type: 'text',
      timestamp: ts,
      read: false,
      status: 'sent',
      transport,
    },
    transport,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  h.mesh = makeMesh()
  h.routes.route = null
  h.reticulum.address = null
  h.reticulum.status = 'idle'
})

describe('mesh chats in the messenger', () => {
  it('lists mesh and Matrix chats together, freshest first, and sums the unread', () => {
    const store = useMessengerStore()
    useMessengerUiStore().setDialogs([dialog('!old:host', 1000, 1), dialog('!new:host', 5000, 3)])
    expect(store.dialogs.map((d) => d.id)).toEqual(['!new:host', MESH_ID, '!old:host'])
    expect(store.totalUnreadCount).toBe(1 + 3 + 2)
  })

  it('shows mesh chats while Matrix has not loaded anything', () => {
    const store = useMessengerStore()
    expect(store.isDialogsLoading).toBe(false)
    h.mesh.dialogs = []
    expect(store.isDialogsLoading).toBe(true)
  })

  it('opens a mesh chat without touching Matrix', async () => {
    const store = useMessengerStore()
    await store.openChat(MESH_ID)
    expect(store.activeChatId).toBe(MESH_ID)
    expect(h.mesh.openDialog).toHaveBeenCalledWith(MESH_ID)
    expect(h.chat.loadMessages).not.toHaveBeenCalled()
    expect(h.matrix.getRoom).not.toHaveBeenCalled()
    expect(store.activeMessages.map((m) => m.text)).toEqual(['по радио'])
    expect(store.activeDialog?.id).toBe(MESH_ID)
  })

  it('sends, retries and deletes through the mesh store', async () => {
    const store = useMessengerStore()
    await store.sendMessage(MESH_ID, 'привет')
    await store.retryMessage(MESH_ID, `${MESH_ID}|1`)
    expect(h.mesh.send).toHaveBeenCalledWith(MESH_ID, 'привет')
    expect(h.mesh.retry).toHaveBeenCalledWith(MESH_ID, `${MESH_ID}|1`)
    expect(h.chat.sendMessage).not.toHaveBeenCalled()

    await store.openChat(MESH_ID)
    store.deleteDialog(MESH_ID)
    expect(store.activeChatId).toBeNull()
    expect(h.mesh.deleteDialog).toHaveBeenCalledWith(MESH_ID)
    expect(h.matrix.leaveAndForgetRoom).not.toHaveBeenCalled()

    await store.sendMessage('!room:host', 'matrix')
    expect(h.chat.sendMessage).toHaveBeenCalledWith('!room:host', 'matrix')
  })

  it('loads mesh chats on sign-in even when Matrix fails', async () => {
    const store = useMessengerStore()
    await store.initMatrix()
    expect(h.mesh.ensureLoaded).toHaveBeenCalled()
  })

  it('disconnects the radios, stops Reticulum and wipes mesh chats on sign-out', async () => {
    const store = useMessengerStore()
    store.logout({ purge: true })
    expect(h.connection.reset).toHaveBeenCalled()
    expect(h.meshtastic.reset).toHaveBeenCalled()
    expect(h.reticulum.reset).toHaveBeenCalled()
    expect(h.mesh.reset).toHaveBeenCalledWith({ purge: true })
    await store.purgeAccountData('PBob')
    expect(h.mesh.purgeAccount).toHaveBeenCalledWith('PBob')
    expect(h.matrix.purgeLocalData).toHaveBeenCalledWith({ address: 'PBob' })
  })
})

describe('one dialog, several routes', () => {
  // Боб — собеседник Bastyon (Matrix-id — hex адреса), поделился адресом LXMF.
  const BOB = 'PBobBobBobBobBobBobBobBobBobBobBob'
  const BOB_MX = `@${[...BOB].map((c) => c.charCodeAt(0).toString(16)).join('')}:matrix.pocketnet.app`
  const ROOM = '!bob:host'
  const SELF = 'a1'.repeat(16)
  const BOB_LXMF = 'b2'.repeat(16)
  const ROUTED = `mesh:lx:${SELF}:u:${BOB_LXMF}`

  function setup() {
    h.routes.route = { contact: BOB, binding: { dest: BOB_LXMF } }
    h.reticulum.address = SELF
    h.reticulum.status = 'running'
    const matrixMsg = (id: string, ts: number, mine = false): Message => ({
      id,
      chatId: ROOM,
      senderId: mine ? 'me' : BOB_MX,
      text: id,
      type: 'text',
      timestamp: ts,
      read: true,
      status: 'sent',
    })
    h.chat.messages[ROOM] = [matrixMsg('до', 1000), matrixMsg('после', 5000, true)]
    const lxmf: Message = {
      id: `${ROUTED}|1`,
      chatId: ROUTED,
      senderId: `mesh:lx:u:${BOB_LXMF}`,
      senderName: 'Bob LXMF',
      text: 'по Reticulum',
      type: 'text',
      timestamp: 3000,
      read: true,
      status: 'sent',
      transport: 'lxmf',
    }
    h.mesh.messengerMessages = vi.fn((id: string) => (id === ROUTED ? [lxmf] : []))
    h.mesh.messengerDialogs = [
      dialog(ROUTED, 6000, 2, 'meshcore'),
      dialog(MESH_ID, 3000, 1, 'meshcore'),
    ]
    const ui = useMessengerUiStore()
    const bob = dialog(ROOM, 5000, 1)
    bob.partner = { id: BOB_MX, name: 'Боб' }
    ui.setDialogs([bob])
    return { store: useMessengerStore(), ui }
  }

  it('keeps the Reticulum chat inside the Bastyon dialog', async () => {
    const { store } = setup()
    // Отдельного LXMF-диалога в списке нет; свежее и непрочитанное — у Боба.
    expect(store.dialogs.map((d) => d.id)).toEqual([ROOM, MESH_ID])
    const bob = store.dialogs[0]!
    expect(bob.unreadCount).toBe(1 + 2)
    expect(bob.lastMessage).toMatchObject({ timestamp: 6000, chatId: ROOM })

    await store.openChat(ROOM)
    expect(h.mesh.ensureLxmfDialog).toHaveBeenCalledWith(SELF, BOB_LXMF, 'Боб')
    expect(h.mesh.openDialog).toHaveBeenCalledWith(ROUTED)
    // Лента — по времени, входящее LXMF — от Боба.
    expect(store.activeMessages.map((m) => m.text)).toEqual(['до', 'по Reticulum', 'после'])
    expect(store.activeMessages[1]).toMatchObject({ senderId: BOB_MX, senderName: 'Боб' })
  })

  it('sends over Reticulum while the chat server is unreachable, or when chosen', async () => {
    const { store, ui } = setup()
    ui.syncState = 'ERROR'
    await store.sendMessage(ROOM, 'без интернета')
    expect(h.mesh.send).toHaveBeenCalledWith(ROUTED, 'без интернета')
    expect(h.chat.sendMessage).not.toHaveBeenCalled()
    // Без сервера история Matrix не придёт — лента LXMF сразу.
    ui.activeChatId = ROOM
    ui.isMessagesLoading = true
    expect(store.isMessagesLoading).toBe(false)
    expect(store.activeMeshRoute).toMatchObject({ meshId: ROUTED, online: false, viaMesh: true })

    ui.syncState = 'SYNCING'
    expect(store.isMessagesLoading).toBe(true)
    await store.sendMessage(ROOM, 'по серверу')
    expect(h.chat.sendMessage).toHaveBeenCalledWith(ROOM, 'по серверу')

    store.toggleMeshRoute(ROOM)
    await store.sendMessage(ROOM, 'выбран Reticulum')
    expect(h.mesh.send).toHaveBeenLastCalledWith(ROUTED, 'выбран Reticulum')
    expect(store.activeMeshRoute).toMatchObject({ forced: true, online: true, viaMesh: true })
  })

  it('sends through Matrix to people without a route', async () => {
    const { store, ui } = setup()
    h.routes.route = null
    ui.syncState = 'ERROR'
    await store.sendMessage(ROOM, 'привет')
    expect(h.chat.sendMessage).toHaveBeenCalledWith(ROOM, 'привет')
    expect(h.mesh.send).not.toHaveBeenCalled()
    expect(store.dialogs.map((d) => d.id)).toEqual([ROUTED, ROOM, MESH_ID])
  })
})
