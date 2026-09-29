// Сторы mesh-переписки поверх настоящей Dexie (fake-indexeddb) и поддельных
// радио MeshCore: подключение, приём (с повторами ЛС от радио), непрочитанные,
// отправка с подтверждением, длинный текст частями, каналы, обрыв связи,
// очистка при выходе. Сеть и радио подменены, логика сторов — настоящая.

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
    if (!radio.current)
      throw Object.assign(new Error('port_not_found: gone'), { code: 'port_not_found' })
    return radio.current.connect()
  },
  targetLabel: (t: { transport: string; path?: string; host?: string }) =>
    t.path ?? t.host ?? t.transport,
}))

import { db, resetDbAvailabilityForTests } from '@/db/database'
import { useMessengerUiStore } from '@/b-components/messenger/store/messenger-ui-store'
import { PUBLIC_CHANNEL_SECRET } from '../meshcore/constants'
import { MeshCoreSession } from '../meshcore/session'
import { FakeAir, FakeCompanion } from '../meshcore/testing/fake-companion'
import { useMeshChatStore } from './mesh-chat-store'
import {
  MESH_SESSION_OPTIONS,
  RECONNECT_DELAYS,
  useMeshConnectionStore,
} from './mesh-connection-store'

const FAST = { minAckWaitMs: 40, maxAckWaitMs: 120, busyRetryMs: 10, pollIntervalMs: 0 }
// Сеанс стора — с теми же короткими ожиданиями ACK.
Object.assign(MESH_SESSION_OPTIONS, FAST)
const TARGET = { transport: 'serial' as const, path: '/dev/cu.usbserial-0001' }

let air: FakeAir
let alice: FakeCompanion
let bob: FakeCompanion
let bobSession: MeshCoreSession

beforeEach(async () => {
  resetDbAvailabilityForTests()
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
  setActivePinia(createPinia())
  auth.address = 'PAliceAddressXXXXXXXXXXXXXXXXXXXX'
  notify.mockClear()
  air = new FakeAir()
  const channels = [{ name: 'Public', secret: PUBLIC_CHANNEL_SECRET }]
  alice = new FakeCompanion(air, { name: 'Alice', channels })
  bob = new FakeCompanion(air, { name: 'Bob', channels })
  FakeCompanion.introduce(alice, bob)
  radio.current = alice
  bobSession = await MeshCoreSession.open(bob.connect(), FAST)
})

afterEach(async () => {
  await useMeshConnectionStore().disconnect()
  await bobSession.close()
})

async function connected() {
  const conn = useMeshConnectionStore()
  expect(await conn.connect(TARGET)).toBeNull()
  return conn
}

describe('mesh connection', () => {
  it('connects, loads the node and remembers the device', async () => {
    const conn = await connected()
    expect(conn.status).toBe('connected')
    expect(conn.self?.name).toBe('Alice')
    expect(conn.chatContacts.map((c) => c.name)).toEqual(['Bob'])
    expect(conn.channels.map((c) => c.name)).toEqual(['Public'])
    await vi.waitFor(() => expect(conn.battery?.millivolts).toBe(4012))
    expect(JSON.parse(localStorage.getItem(`BST_MESH_DEVICE_${auth.address}`)!)).toEqual({
      meshcore: TARGET,
    })
  })

  it('still reads the last radio saved before Meshtastic appeared', () => {
    localStorage.setItem(`BST_MESH_DEVICE_${auth.address}`, JSON.stringify(TARGET))
    const conn = useMeshConnectionStore()
    conn.refreshLastDevice()
    expect(conn.lastDevice).toEqual(TARGET)
  })

  it('reports why it could not connect', async () => {
    radio.current = null
    const conn = useMeshConnectionStore()
    expect(await conn.connect(TARGET)).toBe('port_not_found')
    expect(conn.status).toBe('idle')
    expect(conn.error).toBe('port_not_found')
  })

  it('reconnects after the radio drops, not after a disconnect', async () => {
    const saved = [...RECONNECT_DELAYS]
    RECONNECT_DELAYS.splice(0, RECONNECT_DELAYS.length, 20, 20)
    try {
      const conn = await connected()
      alice.drop()
      expect(conn.status).toBe('reconnecting')
      await vi.waitFor(() => expect(conn.status).toBe('connected'))

      await conn.disconnect()
      expect(conn.status).toBe('idle')
      expect(conn.error).toBeNull()

      // Радио пропало насовсем: попытки кончаются, остаётся понятная ошибка.
      await conn.connect(TARGET)
      radio.current = null
      alice.drop()
      await vi.waitFor(() => expect(conn.status).toBe('idle'))
      expect(conn.error).toBe('device_lost')
    } finally {
      RECONNECT_DELAYS.splice(0, RECONNECT_DELAYS.length, ...saved)
    }
  })
})

describe('mesh chats', () => {
  it('stores an incoming message once even when the radio repeats it', async () => {
    await connected()
    const chat = useMeshChatStore()
    // ACK до Боба не доходит — его радио повторяет сообщение ещё трижды.
    air.dropAcks = 3
    await bobSession.sendDirect(alice.publicKey, 'Ты где?', 1_750_000_500, () => {})
    await vi.waitFor(() => expect(chat.dialogs).toHaveLength(1))
    const dialog = chat.dialogs[0]!
    expect(dialog).toMatchObject({ kind: 'direct', name: 'Bob', lastText: 'Ты где?', unread: 1 })
    await vi.waitFor(async () => expect(await db.meshMessages.count()).toBe(1))
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('Bob', 'Ты где?')

    // История — с диска: после перезапуска диалог и сообщение на месте.
    setActivePinia(createPinia())
    const again = useMeshChatStore()
    await again.openDialog(dialog.id)
    expect(again.messengerMessages(dialog.id).map((m) => m.text)).toEqual(['Ты где?'])
    expect(again.dialogs[0]!.unread).toBe(0)
  })

  it('does not count a message in the chat that is open on screen', async () => {
    await connected()
    const chat = useMeshChatStore()
    const conn = useMeshConnectionStore()
    const id = await chat.ensureDirectDialog(conn.self!.publicKey, conn.chatContacts[0]!)
    const ui = useMessengerUiStore()
    ui.isOpen = true
    ui.switchToChat(id)
    await bobSession.sendDirect(alice.publicKey, 'на экране', 1_750_000_600, () => {})
    await vi.waitFor(() => expect(chat.dialogs[0]!.lastText).toBe('на экране'))
    expect(chat.dialogs[0]!.unread).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })

  it('sends a direct message and shows the delivery', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    const inbox: string[] = []
    bobSession.on('message', (m) => inbox.push(m.text))
    const id = await chat.ensureDirectDialog(conn.self!.publicKey, conn.chatContacts[0]!)
    expect(await chat.send(id, 'Привет!')).toEqual({ ok: true })
    const mine = chat.messengerMessages(id)
    expect(mine).toHaveLength(1)
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('delivered'))
    await vi.waitFor(() => expect(inbox).toEqual(['Привет!']))
    expect(chat.dialogs[0]).toMatchObject({ lastText: 'Привет!', lastMine: true })
  })

  it('splits a long Cyrillic text into numbered parts and keeps their order', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    const inbox: string[] = []
    bobSession.on('message', (m) => inbox.push(m.text))
    const id = await chat.ensureDirectDialog(conn.self!.publicKey, conn.chatContacts[0]!)
    const long = 'Проверка связи через радио. '.repeat(8).trim() // ~420 байт
    expect(await chat.send(id, long)).toEqual({ ok: true })
    const parts = chat.messengerMessages(id).map((m) => m.text)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0]).toMatch(/^\(1\/\d\) /)
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(160)
    await vi.waitFor(() => expect(inbox).toHaveLength(parts.length))
    expect(inbox).toEqual(parts)

    const tooLong = 'я'.repeat(1000)
    expect(await chat.send(id, tooLong)).toEqual({ ok: false, error: 'too_long' })
  })

  it('channels: own messages go out, others arrive with the sender name', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    const id = await chat.ensureChannelDialog(conn.self!.publicKey, conn.channels[0]!)
    expect(chat.textLimit(id)).toBe(160 - 'Alice: '.length)
    await chat.send(id, 'всем привет')
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('sent'))

    await bobSession.sendChannel(bobSession.channels[0]!, 'и тебе', 1_750_000_700)
    await vi.waitFor(() =>
      expect(chat.dialogs.find((d) => d.id === id)!.lastText).toBe('Bob: и тебе')
    )
    await chat.openDialog(id)
    const list = chat.messengerMessages(id)
    const last = list[list.length - 1]!
    expect(last).toMatchObject({ text: 'и тебе', senderName: 'Bob' })
  })

  it('refuses to send without the radio and keeps failed parts for a retry', async () => {
    const conn = await connected()
    const chat = useMeshChatStore()
    const id = await chat.ensureDirectDialog(conn.self!.publicKey, conn.chatContacts[0]!)
    air.dropMessages = 100
    await chat.send(id, 'в пустоту')
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('failed'), {
      timeout: 4000,
    })
    air.dropMessages = 0
    const failed = chat.messengerMessages(id)[0]!
    expect(await chat.retry(id, failed.id)).toBe(true)
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('delivered'))

    await conn.disconnect()
    expect(chat.canSend(id)).toBe(false)
    expect(await chat.send(id, 'нет радио')).toEqual({ ok: false, error: 'not_connected' })
  })

  it('wipes the account history on sign-out', async () => {
    await connected()
    const chat = useMeshChatStore()
    await bobSession.sendDirect(alice.publicKey, 'секрет', 1_750_000_800, () => {})
    await vi.waitFor(async () => expect(await db.meshMessages.count()).toBe(1))
    chat.reset({ purge: true })
    await vi.waitFor(async () => expect(await db.meshMessages.count()).toBe(0))
    expect(await db.meshDialogs.count()).toBe(0)
    expect(chat.dialogs).toEqual([])
  })
})
