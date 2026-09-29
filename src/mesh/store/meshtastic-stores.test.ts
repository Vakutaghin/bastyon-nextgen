// Сторы mesh-переписки с радио Meshtastic поверх настоящей Dexie
// (fake-indexeddb) и поддельных радио: подключение, приём ЛС и канала,
// доставка, ответы и реакции в обе стороны, ключ собеседника в диалоге,
// первичная настройка региона с перезагрузкой, сброс при выходе.

import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ address: 'PAliceAddressXXXXXXXXXXXXXXXXXXXX' as string | null }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => auth }))
const notify = vi.hoisted(() => vi.fn())
vi.mock('@/composables/use-browser-notifications', () => ({ notifyMessage: notify }))
vi.mock('@/b-components/messenger/sounds/glass.mp3', () => ({ default: 'glass.mp3' }))

const radio = vi.hoisted(() => ({ current: null as null | { connect: () => unknown } }))
vi.mock('../radio/open-link', () => ({
  openFrameLink: async () => {
    throw Object.assign(new Error('port_not_found: gone'), { code: 'port_not_found' })
  },
  openPacketLink: async () => {
    if (!radio.current)
      throw Object.assign(new Error('port_not_found: gone'), { code: 'port_not_found' })
    return radio.current.connect()
  },
  targetLabel: (t: { transport: string; path?: string; host?: string }) =>
    t.path ?? t.host ?? t.transport,
}))

import { db, resetDbAvailabilityForTests } from '@/db/database'
import { nodeKey } from '../ids'
import { MeshtasticSession, type MtIncoming } from '../meshtastic/session'
import { FakeMeshAir, FakeMeshtasticDevice } from '../meshtastic/testing/fake-device'
import { useMeshChatStore } from './mesh-chat-store'
import {
  MESHTASTIC_SESSION_OPTIONS,
  useMeshtasticConnectionStore,
} from './meshtastic-connection-store'
import { RECONNECT_DELAYS } from './radio-common'

const FAST = { textSpacingMs: 0, keyWaitMs: 100, adminTimeoutMs: 500, setClock: false }
Object.assign(MESHTASTIC_SESSION_OPTIONS, FAST)
const TARGET = { transport: 'serial' as const, path: '/dev/cu.usbmodem1101' }

let air: FakeMeshAir
let alice: FakeMeshtasticDevice
let bob: FakeMeshtasticDevice
let bobSession: MeshtasticSession
let bobInbox: MtIncoming[]

beforeEach(async () => {
  resetDbAvailabilityForTests()
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
  setActivePinia(createPinia())
  auth.address = 'PAliceAddressXXXXXXXXXXXXXXXXXXXX'
  notify.mockClear()
  air = new FakeMeshAir()
  alice = new FakeMeshtasticDevice(air, { longName: 'Alice' })
  bob = new FakeMeshtasticDevice(air, { longName: 'Bob' })
  alice.learn(bob)
  bob.learn(alice)
  radio.current = alice
  bobSession = MeshtasticSession.create(bob.connect(), FAST)
  bobInbox = []
  bobSession.on('message', (m) => bobInbox.push(m))
  await bobSession.start()
})

afterEach(async () => {
  await useMeshtasticConnectionStore().disconnect()
  await bobSession.close()
})

async function connected() {
  const conn = useMeshtasticConnectionStore()
  expect(await conn.connect(TARGET)).toBeNull()
  return conn
}

describe('meshtastic connection', () => {
  it('connects, loads the node, the nodes and the channels, and remembers the device', async () => {
    const conn = await connected()
    expect(conn.status).toBe('connected')
    expect(conn.self?.longName).toBe('Alice')
    expect(conn.selfKey).toBe(nodeKey(alice.nodeNum))
    expect(conn.nodes.map((n) => n.user?.longName)).toEqual(['Bob'])
    expect(conn.channels.map((c) => c.name)).toEqual(['LongFast'])
    expect(conn.regionUnset).toBe(false)
    expect(JSON.parse(localStorage.getItem(`BST_MESH_DEVICE_${auth.address}`)!)).toEqual({
      meshtastic: TARGET,
    })
  })

  it('sets the region of a new radio and comes back after its reboot', async () => {
    const saved = [...RECONNECT_DELAYS]
    RECONNECT_DELAYS.splice(0, RECONNECT_DELAYS.length, 20, 20)
    try {
      alice.lora.region = 0
      const conn = await connected()
      expect(conn.regionUnset).toBe(true)
      // Переходы статуса: переподключение проходит быстрее опроса waitFor.
      const seen: string[] = []
      conn.$subscribe(() => {
        if (seen[seen.length - 1] !== conn.status) seen.push(conn.status)
      })
      expect(await conn.setRadio({ region: 9 })).toBe(true)
      expect(conn.rebooting).toBe(true)
      await vi.waitFor(() => expect(seen).toContain('reconnecting'))
      await vi.waitFor(() => expect(conn.status).toBe('connected'))
      await vi.waitFor(() => expect(conn.regionUnset).toBe(false))
      expect(conn.regionUnset).toBe(false)
      expect(conn.rebooting).toBe(false)
      expect(alice.reboots).toBe(1)
    } finally {
      RECONNECT_DELAYS.splice(0, RECONNECT_DELAYS.length, ...saved)
    }
  })
})

describe('meshtastic chats', () => {
  it('stores a direct message from a node and keeps its key in the dialog', async () => {
    await connected()
    const chat = useMeshChatStore()
    bob.sendTextFromHere(alice.nodeNum, 'Привет, Алиса')
    await vi.waitFor(() => expect(chat.dialogs).toHaveLength(1))
    const dialog = chat.dialogs[0]!
    expect(dialog).toMatchObject({
      id: `mesh:mt:${nodeKey(alice.nodeNum)}:u:${nodeKey(bob.nodeNum)}`,
      network: 'meshtastic',
      kind: 'direct',
      name: 'Bob',
      lastText: 'Привет, Алиса',
      unread: 1,
    })
    expect(notify).toHaveBeenCalledWith('Bob', 'Привет, Алиса')
    // Ключ Боба приложение запоминает, пока радио его знает.
    await vi.waitFor(() =>
      expect(chat.dialogs[0]!.peerPublicKey).toBe(
        Array.from(bob.user.publicKey, (b) => b.toString(16).padStart(2, '0')).join('')
      )
    )
  })

  it('sends a direct message and shows the recipient ACK', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    const id = await chat.ensureMeshtasticDirectDialog(conn.self!.nodeNum, {
      num: bob.nodeNum,
      name: 'Bob',
    })
    expect(await chat.send(id, 'Привет из Bastyon')).toEqual({ ok: true })
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('delivered'))
    await vi.waitFor(() => expect(bobInbox.map((m) => m.text)).toEqual(['Привет из Bastyon']))
    expect(bobInbox[0]).toMatchObject({ kind: 'direct', pki: true })
  })

  it('hands the radio the key the app remembered when the radio forgot the node', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    const id = await chat.ensureMeshtasticDirectDialog(conn.self!.nodeNum, {
      num: bob.nodeNum,
      name: 'Bob',
    })
    // Раньше приложение видело ключ Боба; радио его вытеснило, а Боб молчит.
    const dialog = chat.dialogs.find((d) => d.id === id)!
    dialog.peerPublicKey = Array.from(bob.user.publicKey, (b) =>
      b.toString(16).padStart(2, '0')
    ).join('')
    alice.nodeDb.delete(bob.nodeNum)
    conn.session!.nodes.delete(bob.nodeNum)
    bob.nodeInfoThrottled = true
    expect(await chat.send(id, 'Ключ из памяти')).toEqual({ ok: true })
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('delivered'))
    expect(alice.nodeDb.get(bob.nodeNum)?.isFavorite).toBe(true)
  })

  it('shows replies and reactions from the other side on the right messages', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    const id = await chat.ensureMeshtasticDirectDialog(conn.self!.nodeNum, {
      num: bob.nodeNum,
      name: 'Bob',
    })
    await chat.send(id, 'Как дела?')
    await vi.waitFor(() => expect(bobInbox).toHaveLength(1))
    const question = bobInbox[0]!.packetId
    bob.sendTextFromHere(alice.nodeNum, 'Отлично', { replyId: question })
    bob.sendTextFromHere(alice.nodeNum, '👍', { replyId: question, emoji: true })
    await vi.waitFor(() => expect(chat.messengerMessages(id)).toHaveLength(2))
    const [mine, reply] = chat.messengerMessages(id)
    expect(mine!.text).toBe('Как дела?')
    expect(mine!.reactions).toEqual([{ key: '👍', count: 1 }])
    expect(reply!.text).toBe('Отлично')
    expect(reply!.replyTo).toEqual({ id: mine!.id })
    // Реакция не «новое сообщение»: непрочитанных — только ответ.
    expect(chat.dialogs[0]!.unread).toBe(1)
    expect(chat.dialogs[0]!.lastText).toBe('Отлично')
  })

  it('replies and reacts to a message over the radio', async () => {
    await connected()
    const chat = useMeshChatStore()
    const bobPacket = bob.sendTextFromHere(alice.nodeNum, 'Встретимся в 7?')
    await vi.waitFor(() => expect(chat.dialogs).toHaveLength(1))
    const id = chat.dialogs[0]!.id
    await chat.openDialog(id)
    const incoming = chat.messengerMessages(id)[0]!
    expect(incoming.meshReplyable).toBe(true)

    expect(await chat.send(id, 'Да', { replyTo: incoming.id })).toEqual({ ok: true })
    await vi.waitFor(() => expect(bobInbox.map((m) => m.text)).toEqual(['Да']))
    expect(bobInbox[0]!.replyId).toBe(bobPacket)

    expect(await chat.react(id, incoming.id, '❤️')).toBe(true)
    await vi.waitFor(() => expect(bobInbox).toHaveLength(2))
    expect(bobInbox[1]).toMatchObject({ text: '❤️', reaction: true, replyId: bobPacket })
    expect(chat.messengerMessages(id)[0]!.reactions).toEqual([{ key: '❤️', count: 1, my: true }])
  })

  it('talks in the primary channel', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    const id = await chat.ensureMeshtasticChannelDialog(conn.self!.nodeNum, conn.channels[0]!)
    expect(chat.dialogs.find((d) => d.id === id)).toMatchObject({
      kind: 'channel',
      channelKind: 'public',
      name: 'LongFast',
    })
    await chat.send(id, 'Всем привет')
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('delivered'))
    await vi.waitFor(() =>
      expect(bobInbox.filter((m) => m.kind === 'channel').map((m) => m.text)).toEqual([
        'Всем привет',
      ])
    )
    bob.sendTextFromHere('broadcast', 'И тебе')
    await vi.waitFor(() => expect(chat.messengerMessages(id)).toHaveLength(2))
    expect(chat.messengerMessages(id)[1]).toMatchObject({ text: 'И тебе', senderName: 'Bob' })
  })

  it('does not send while the radio has no region', async () => {
    alice.lora.region = 0
    const conn = await connected()
    const chat = useMeshChatStore()
    const id = await chat.ensureMeshtasticChannelDialog(conn.self!.nodeNum, conn.channels[0]!)
    expect(chat.canSend(id)).toBe(false)
    expect(await chat.send(id, 'алло')).toEqual({ ok: false, error: 'not_connected' })
  })

  it('disconnects the radio on reset and wipes the account history on purge', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    bob.sendTextFromHere(alice.nodeNum, 'до выхода')
    await vi.waitFor(() => expect(chat.dialogs).toHaveLength(1))
    await conn.reset()
    expect(conn.status).toBe('idle')
    expect(conn.self).toBeNull()
    chat.reset({ purge: true })
    await vi.waitFor(async () => expect(await db.meshDialogs.count()).toBe(0))
  })
})
