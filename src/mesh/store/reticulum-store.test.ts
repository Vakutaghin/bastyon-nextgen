// Стор Reticulum поверх настоящей Dexie (fake-indexeddb) и подменённых команд
// узла: identity из ключа аккаунта, интерфейсы в режиме Tor, announce →
// собеседники, сообщения LXMF → диалоги, судьба своих сообщений, настройки на
// аккаунт.

import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const auth = {
    address: 'PAliceAddressXXXXXXXXXXXXXXXXXXXX' as string | null,
    keyPair: { privateKey: new Uint8Array(32).fill(1) as Uint8Array | null },
  }
  const tor = { enabled: false }
  const rns = {
    onEvent: null as null | ((ev: unknown) => void),
    start: vi.fn(async (_o: unknown, cb: (ev: unknown) => void) => {
      rns.onEvent = cb
      return { address: 'aa'.repeat(16), identityHash: 'bb'.repeat(16) }
    }),
    stop: vi.fn(async () => {}),
    status: vi.fn(async () => ({ running: true, interfaces: [], paths: 0, propagationNode: null })),
    send: vi.fn(async (_to: string, _text: string) => ({ id: 'msg-1' })),
    setPropagationNode: vi.fn(async (_h: string | null) => {}),
  }
  return { auth, tor, rns }
})

vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('@/stores/tor-store', () => ({ useTorStore: () => h.tor }))
vi.mock('@/composables/use-browser-notifications', () => ({ notifyMessage: vi.fn() }))
vi.mock('@/b-components/messenger/sounds/glass.mp3', () => ({ default: 'glass.mp3' }))
vi.mock('../reticulum/rns-api', () => ({
  isRnsAvailable: () => true,
  rnsStart: h.rns.start,
  rnsStop: h.rns.stop,
  rnsStatus: h.rns.status,
  rnsSend: h.rns.send,
  rnsAnnounce: vi.fn(async () => {}),
  rnsSetPropagationNode: h.rns.setPropagationNode,
  rnsSync: vi.fn(async () => {}),
}))

import { db, resetDbAvailabilityForTests } from '@/db/database'
import { deriveRnsIdentity } from '../reticulum/identity'
import { useMeshChatStore } from './mesh-chat-store'
import { allowedInterfaces, useReticulumStore } from './reticulum-store'

const SELF = 'aa'.repeat(16)
const BOB = 'b0'.repeat(16)

beforeEach(async () => {
  resetDbAvailabilityForTests()
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
  setActivePinia(createPinia())
  h.auth.address = 'PAliceAddressXXXXXXXXXXXXXXXXXXXX'
  h.auth.keyPair.privateKey = new Uint8Array(32).fill(1)
  h.tor.enabled = false
  vi.clearAllMocks()
})

describe('reticulum node', () => {
  it('starts with the identity derived from the account key and the account settings', async () => {
    const rns = useReticulumStore()
    rns.ensureConfig()
    await rns.updateConfig({ displayName: 'Алиса', interfaces: [{ kind: 'auto' }] })
    expect(await rns.start()).toBeNull()
    expect(rns.status).toBe('running')
    expect(rns.address).toBe(SELF)
    const options = h.rns.start.mock.calls[0]![0] as {
      identity: Uint8Array
      displayName: string
      interfaces: unknown[]
    }
    expect(Array.from(options.identity)).toEqual(
      Array.from(await deriveRnsIdentity(new Uint8Array(32).fill(1)))
    )
    expect(options.displayName).toBe('Алиса')
    expect(options.interfaces).toEqual([{ kind: 'auto' }])
  })

  it('keeps only the radio in Tor mode', () => {
    const list = [
      { kind: 'tcp' as const, host: 'hub.example', port: 4242 },
      { kind: 'auto' as const },
      {
        kind: 'rnode' as const,
        port: '/dev/cu.usbserial-1',
        frequency: 869_525_000,
        bandwidth: 125_000,
        spreadingFactor: 8,
        codingRate: 5,
        txPower: 14,
      },
    ]
    expect(allowedInterfaces(list, true).map((i) => i.kind)).toEqual(['rnode'])
    expect(allowedInterfaces(list, false)).toHaveLength(3)
  })

  it('refuses to start without the account key', async () => {
    h.auth.keyPair.privateKey = null
    expect(await useReticulumStore().start()).toBe('no_account_key')
    expect(h.rns.start).not.toHaveBeenCalled()
  })

  it('starts on sign-in only when autostart is on', async () => {
    const rns = useReticulumStore()
    await rns.autostart()
    expect(h.rns.start).not.toHaveBeenCalled()
    await rns.updateConfig({ autostart: true })
    await rns.autostart()
    await rns.autostart()
    expect(h.rns.start).toHaveBeenCalledTimes(1)
    expect(rns.status).toBe('running')
  })

  it('restarts the node later when an interface did not come up', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    try {
      h.rns.status.mockResolvedValue({
        running: true,
        interfaces: [
          { name: 'hub:4242', kind: 'tcp', started: false, online: false, rxBytes: 0, txBytes: 0 },
        ],
        paths: 0,
        propagationNode: null,
      } as never)
      const rns = useReticulumStore()
      await rns.start()
      expect(h.rns.start).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(59_000)
      expect(h.rns.stop).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(2_000)
      await vi.waitFor(() => expect(h.rns.start).toHaveBeenCalledTimes(2))
      expect(h.rns.stop).toHaveBeenCalledTimes(1)
      // Всё поднялось — перезапусков больше нет.
      h.rns.status.mockResolvedValue({
        running: true,
        interfaces: [],
        paths: 0,
        propagationNode: null,
      } as never)
      await rns.refreshStatus()
      await vi.advanceTimersByTimeAsync(600_000)
      expect(h.rns.start).toHaveBeenCalledTimes(2)
      await rns.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the settings per account', async () => {
    const rns = useReticulumStore()
    rns.ensureConfig()
    await rns.updateConfig({ displayName: 'Алиса' })
    h.auth.address = 'PBobAddressXXXXXXXXXXXXXXXXXXXXXX'
    rns.ensureConfig()
    expect(rns.config.displayName).toBe('')
    h.auth.address = 'PAliceAddressXXXXXXXXXXXXXXXXXXXX'
    rns.ensureConfig()
    expect(rns.config.displayName).toBe('Алиса')
  })
})

describe('reticulum chats', () => {
  it('lists announced peers and keeps their messages in LXMF chats', async () => {
    const rns = useReticulumStore()
    await rns.start()
    const emit = h.rns.onEvent!
    emit({
      kind: 'announce',
      aspect: 'lxmf.delivery',
      dest: BOB,
      identity: 'cc'.repeat(16),
      name: 'Боб',
      hops: 2,
    })
    emit({
      kind: 'announce',
      aspect: 'lxmf.propagation',
      dest: 'dd'.repeat(16),
      identity: 'ee'.repeat(16),
      name: null,
      hops: 1,
    })
    expect(rns.contacts.map((p) => p.name)).toEqual(['Боб'])
    expect(rns.propagationNodes).toHaveLength(1)
    // Адрес из прошлых запусков: когда его слышали, а не сейчас; свежие — выше.
    emit({
      kind: 'announce',
      aspect: 'lxmf.delivery',
      dest: 'c0'.repeat(16),
      identity: 'c1'.repeat(16),
      name: 'Старый',
      hops: 3,
      heard: 1_700_000_000,
    })
    expect(rns.contacts.map((p) => p.name)).toEqual(['Боб', 'Старый'])
    expect(rns.contacts[1]!.seen).toBe(1_700_000_000_000)
    // Announce без имени (ответ на запрос пути) не стирает известное имя.
    emit({
      kind: 'announce',
      aspect: 'lxmf.delivery',
      dest: BOB,
      identity: 'cc'.repeat(16),
      name: null,
      hops: 1,
    })
    expect(rns.contacts.find((p) => p.dest === BOB)).toMatchObject({ name: 'Боб', hops: 1 })

    emit({
      kind: 'message',
      id: 'm1',
      from: BOB,
      title: '',
      content: 'привет из Reticulum',
      timestamp: 1_790_000_000,
      signed: true,
      method: 'direct',
    })
    emit({
      kind: 'message',
      id: 'm1',
      from: BOB,
      title: '',
      content: 'привет из Reticulum',
      timestamp: 1_790_000_000,
      signed: true,
      method: 'propagated',
    })
    const chat = useMeshChatStore()
    await vi.waitFor(() => expect(chat.dialogs).toHaveLength(1))
    const dialog = chat.dialogs[0]!
    expect(dialog).toMatchObject({
      id: `mesh:lx:${SELF}:u:${BOB}`,
      network: 'lxmf',
      name: 'Боб',
      lastText: 'привет из Reticulum',
      unread: 1,
    })
    // Тот же id пришёл вторым путём (узел доставки) — одно сообщение.
    await vi.waitFor(async () => expect(await db.meshMessages.count()).toBe(1))
  })

  it('sends through the node and follows the delivery state', async () => {
    const rns = useReticulumStore()
    await rns.start()
    const chat = useMeshChatStore()
    const id = await chat.ensureLxmfDialog(SELF, BOB, 'Боб')
    expect(chat.canSend(id)).toBe(true)
    expect(chat.textLimit(id)).toBe(8000)
    expect(await chat.send(id, 'как дела?')).toEqual({ ok: true })
    await vi.waitFor(() => expect(h.rns.send).toHaveBeenCalledWith(BOB, 'как дела?', 'auto'))
    h.rns.onEvent!({ kind: 'state', id: 'msg-1', state: 'sent' })
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('sent'))
    h.rns.onEvent!({ kind: 'state', id: 'msg-1', state: 'delivered' })
    await vi.waitFor(() => expect(chat.messengerMessages(id)[0]!.status).toBe('delivered'))

    await rns.stop()
    expect(chat.canSend(id)).toBe(false)
  })
})
