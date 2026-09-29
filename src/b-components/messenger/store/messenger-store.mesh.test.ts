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
  return { matrix, auth, chat, profiles, mesh, connection, meshtastic }
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

  it('disconnects both radios and wipes mesh chats on sign-out', async () => {
    const store = useMessengerStore()
    store.logout({ purge: true })
    expect(h.connection.reset).toHaveBeenCalled()
    expect(h.meshtastic.reset).toHaveBeenCalled()
    expect(h.mesh.reset).toHaveBeenCalledWith({ purge: true })
    await store.purgeAccountData('PBob')
    expect(h.mesh.purgeAccount).toHaveBeenCalledWith('PBob')
    expect(h.matrix.purgeLocalData).toHaveBeenCalledWith({ address: 'PBob' })
  })
})
