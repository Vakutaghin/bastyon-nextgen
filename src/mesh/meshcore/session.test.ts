// Клиент и сеанс MeshCore против поддельных радио с поведением прошивки:
// знакомство, контакты, ЛС с подтверждением, повторы, каналы, обрывы.

import { describe, expect, it, vi } from 'vitest'
import { MeshCoreClient, MeshCoreError } from './client'
import { hashtagSecret } from './channels'
import { OUT_PATH_UNKNOWN, PUBLIC_CHANNEL_SECRET } from './constants'
import type { FrameLink } from './framing'
import { MeshCoreSession, type DeliveryUpdate, type SessionMessage } from './session'
import { FakeAir, FakeCompanion } from './testing/fake-companion'

const FAST = {
  minAckWaitMs: 40,
  maxAckWaitMs: 120,
  busyRetryMs: 10,
  pollIntervalMs: 0,
  lateAckMs: 5_000,
}

function pair(opts: { introduce?: boolean } = {}) {
  const air = new FakeAir()
  const alice = new FakeCompanion(air, {
    name: 'Alice',
    channels: [{ name: 'Public', secret: PUBLIC_CHANNEL_SECRET }],
  })
  const bob = new FakeCompanion(air, {
    name: 'Bob',
    channels: [{ name: 'Public', secret: PUBLIC_CHANNEL_SECRET }],
  })
  if (opts.introduce !== false) FakeCompanion.introduce(alice, bob)
  return { air, alice, bob }
}

async function open(radio: FakeCompanion) {
  return MeshCoreSession.open(radio.connect(), FAST)
}

function collect(session: MeshCoreSession): SessionMessage[] {
  const out: SessionMessage[] = []
  session.on('message', (m) => out.push(m))
  return out
}

describe('MeshCoreClient', () => {
  it('introduces itself, reads the device and sets the clock', async () => {
    const { alice } = pair()
    alice.time = 1000
    const client = new MeshCoreClient(alice.connect(), { nowSeconds: () => 2_000_000_000 })
    const { self, device } = await client.start()
    expect(self.publicKey).toBe(alice.publicKey)
    expect(self.name).toBe('Alice')
    expect(device?.version).toBe('v1.17.1')
    expect(alice.appName).toBe('Bastyon')
    expect(alice.appVersion).toBe(3)
    expect(alice.time).toBe(2_000_000_000)
  })

  it('does not fail when the radio clock is ahead', async () => {
    const { alice } = pair()
    alice.time = 2_100_000_000
    const client = new MeshCoreClient(alice.connect(), { nowSeconds: () => 2_000_000_000 })
    await expect(client.start()).resolves.toBeTruthy()
    expect(alice.time).toBe(2_100_000_000)
  })

  it('collects the streamed contact list', async () => {
    const { alice } = pair()
    const client = new MeshCoreClient(alice.connect())
    const contacts = await client.getContacts()
    expect(contacts.map((c) => c.name)).toEqual(['Bob'])
    expect(contacts[0]!.outPathLen).toBe(OUT_PATH_UNKNOWN)
  })

  it('keeps commands in order, one at a time', async () => {
    const { alice } = pair()
    const client = new MeshCoreClient(alice.connect())
    const [ch0, ch1, battery] = await Promise.all([
      client.getChannel(0),
      client.getChannel(1),
      client.getBattery(),
    ])
    expect(ch0?.name).toBe('Public')
    expect(ch1?.name).toBe('')
    expect(battery.millivolts).toBe(4012)
    expect(await client.getChannel(99)).toBeNull()
  })

  it('reports a rejected command with the firmware error code', async () => {
    const { alice } = pair()
    const client = new MeshCoreClient(alice.connect())
    const err = await client.sendText('ff'.repeat(32), 'hi', 1).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MeshCoreError)
    expect((err as MeshCoreError).notFound).toBe(true)
  })

  it('times out when the radio stays silent', async () => {
    const silent: FrameLink = {
      kind: 'serial',
      label: 'silent',
      send: async () => {},
      onFrame: () => () => {},
      onClose: () => () => {},
      close: async () => {},
    }
    const client = new MeshCoreClient(silent, { commandTimeoutMs: 30 })
    await expect(client.getBattery()).rejects.toMatchObject({ code: 'timeout' })
  })

  it('rejects pending commands and reports the loss when the device drops', async () => {
    const { alice } = pair()
    const client = new MeshCoreClient(alice.connect())
    const closed = vi.fn()
    client.on('closed', closed)
    await client.start()
    alice.drop('device_lost: unplugged')
    expect(closed).toHaveBeenCalledWith('device_lost: unplugged')
    await expect(client.getBattery()).rejects.toMatchObject({ code: 'closed' })
  })
})

describe('MeshCoreSession', () => {
  it('loads the node, contacts and channels', async () => {
    const { alice, bob } = pair()
    const s = await open(alice)
    expect(s.self.name).toBe('Alice')
    expect([...s.contacts.values()].map((c) => c.name)).toEqual(['Bob'])
    expect(s.findContact(bob.publicKey.slice(0, 12))?.name).toBe('Bob')
    expect(s.channels).toHaveLength(1)
    expect(s.channels[0]).toMatchObject({ index: 0, name: 'Public', kind: 'public' })
    expect(s.channelSlots).toBe(8)
    await s.close()
  })

  it('delivers a direct message and reports the ACK', async () => {
    const { alice, bob } = pair()
    const a = await open(alice)
    const b = await open(bob)
    const inbox = collect(b)
    const updates: DeliveryUpdate[] = []
    const result = await a.sendDirect(bob.publicKey, 'Привет, Боб!', 1_750_000_100, (u) =>
      updates.push(u)
    )
    expect(result).toBe('delivered')
    expect(updates.map((u) => u.status)).toEqual(['sent', 'delivered'])
    await vi.waitFor(() => expect(inbox).toHaveLength(1))
    expect(inbox[0]).toMatchObject({
      kind: 'direct',
      peerKey: alice.publicKey,
      peerPrefix: alice.publicKey.slice(0, 12),
      senderName: 'Alice',
      text: 'Привет, Боб!',
      senderTimestamp: 1_750_000_100,
    })
    await a.close()
    await b.close()
  })

  it('retries lost messages and floods the last attempt', async () => {
    const { air, alice, bob } = pair()
    const a = await open(alice)
    await open(bob)
    // Путь известен — сообщения идут напрямую, пока не кончатся попытки.
    alice.contacts[0]!.outPathLen = 1
    air.dropMessages = 3
    const updates: DeliveryUpdate[] = []
    const result = await a.sendDirect(bob.publicKey, 'retry me', 42, (u) => updates.push(u))
    expect(result).toBe('delivered')
    const sent = updates.filter((u) => u.status === 'sent')
    expect(sent.map((u) => u.attempt)).toEqual([0, 1, 2, 3])
    expect(sent.map((u) => u.flood)).toEqual([false, false, false, true])
    // Перед последней попыткой путь сброшен командой RESET_PATH.
    expect(alice.received.some((f) => f[0] === 13)).toBe(true)
  })

  it('gives up after the last attempt, then accepts a late ACK', async () => {
    const { air, alice, bob } = pair()
    const a = await open(alice)
    const b = await open(bob)
    const inbox = collect(b)
    air.ackDelayMs = 700 // дольше всех ожиданий, но до конца «поздних» ACK
    const updates: DeliveryUpdate[] = []
    const result = await a.sendDirect(bob.publicKey, 'slow ack', 7, (u) => updates.push(u))
    expect(result).toBe('failed')
    await vi.waitFor(() => expect(updates[updates.length - 1]?.status).toBe('delivered'), {
      timeout: 3000,
    })
    // Получатель видит каждую попытку — сохранять их по одному разу должен тот,
    // кто показывает переписку.
    await vi.waitFor(() => expect(inbox.length).toBeGreaterThan(1))
    expect(new Set(inbox.map((m) => `${m.senderTimestamp}:${m.text}`)).size).toBe(1)
  })

  it('reports a recipient missing from the radio contacts', async () => {
    const { alice } = pair({ introduce: false })
    const a = await open(alice)
    const updates: DeliveryUpdate[] = []
    const result = await a.sendDirect('ee'.repeat(32), 'nobody', 1, (u) => updates.push(u))
    expect(result).toBe('failed')
    expect(updates).toEqual([
      { status: 'failed', attempt: 0, flood: false, error: 'not_in_contacts' },
    ])
  })

  it('gets no answer from a node that does not know us', async () => {
    const { alice, bob } = pair({ introduce: false })
    // Алиса знает Боба, Боб Алису — нет: расшифровать ЛС ему нечем.
    FakeCompanion.introduce(alice, bob)
    bob.contacts = []
    const a = await open(alice)
    const b = await open(bob)
    const inbox = collect(b)
    const result = await a.sendDirect(bob.publicKey, 'hello?', 9, () => {})
    expect(result).toBe('failed')
    expect(inbox).toHaveLength(0)
  })

  it('receives channel messages with the sender name the radio wrote', async () => {
    const { alice, bob } = pair()
    const a = await open(alice)
    const b = await open(bob)
    const inbox = collect(b)
    await a.sendChannel(a.channels[0]!, 'всем привет', 100)
    await vi.waitFor(() => expect(inbox).toHaveLength(1))
    expect(inbox[0]).toMatchObject({ kind: 'channel', senderName: 'Alice', text: 'всем привет' })
    expect(inbox[0]!.kind === 'channel' && inbox[0]!.channel.kind).toBe('public')
  })

  it('channel text limit leaves room for the sender name', async () => {
    const { alice } = pair()
    const a = await open(alice)
    expect(a.channelTextLimit(160)).toBe(160 - 'Alice: '.length)
  })

  it('adds a hashtag channel into the first free slot and removes it', async () => {
    const { alice } = pair()
    const a = await open(alice)
    const secret = await hashtagSecret('#moscow')
    const added = await a.addChannel('#moscow', secret)
    expect(added).toMatchObject({ index: 1, name: '#moscow', kind: 'hashtag' })
    expect(await a.addChannel('#moscow', secret)).toEqual(added)
    await a.removeChannel(1)
    expect(a.channels.map((c) => c.name)).toEqual(['Public'])
  })

  it('messages queued while the app was away arrive with names', async () => {
    const { alice, bob } = pair()
    const b = await open(bob)
    await b.sendDirect(alice.publicKey, 'пока тебя не было', 5, () => {})
    // Алиса подключается позже: сообщение ждёт в очереди её радио.
    expect(alice.offlineQueue).toHaveLength(1)
    const a = MeshCoreSession.create(alice.connect(), FAST)
    const inbox = collect(a)
    await a.start()
    await vi.waitFor(() => expect(inbox).toHaveLength(1))
    expect(inbox[0]).toMatchObject({ kind: 'direct', senderName: 'Bob', text: 'пока тебя не было' })
    expect(alice.offlineQueue).toHaveLength(0)
  })

  it('keeps contacts in step with adverts', async () => {
    const air = new FakeAir()
    const alice = new FakeCompanion(air, { name: 'Alice' })
    const carol = new FakeCompanion(air, { name: 'Carol' })
    const a = await open(alice)
    const changed = vi.fn()
    a.on('contacts', changed)
    carol.broadcastAdvert()
    await vi.waitFor(() => expect(a.findContact(carol.publicKey.slice(0, 12))?.name).toBe('Carol'))
    expect(changed).toHaveBeenCalled()

    // С ручным добавлением узел приходит как «обнаруженный».
    alice.autoAdd = false
    const dave = new FakeCompanion(air, { name: 'Dave' })
    const discovered = vi.fn()
    a.on('discovered', discovered)
    dave.broadcastAdvert()
    await vi.waitFor(() => expect(discovered).toHaveBeenCalled())
    const found = discovered.mock.calls[0]![0]
    expect(found.name).toBe('Dave')
    await a.addContact(found)
    expect(a.findContact(dave.publicKey.slice(0, 12))?.name).toBe('Dave')
  })
})
